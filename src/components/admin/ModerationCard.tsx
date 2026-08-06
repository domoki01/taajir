"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Check, Star, X } from "lucide-react";
import {
  approveListing,
  rejectListing,
  setFeatured,
} from "@/server/actions/moderation";
import { formatPriceExact } from "@/lib/price";
import { placeLabel } from "@/lib/geo";
import { kPaperwork, kPropertyTypes, kTransactionTypes } from "@/lib/enums";
import type { Listing } from "@/types/listing";

/** Reasons that cover almost every rejection, so the common case is one tap. */
const kQuickReasons = [
  "الصور ما تخصّش العقار",
  "السعر ماشي واقعي",
  "معلومات ناقصة ولا غير واضحة",
  "إعلان مكرّر",
  "العقار ماشي متوفّر",
];

export function ModerationCard({ listing }: { listing: Listing }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [featured, setFeaturedState] = useState(listing.isFeatured);
  const [done, setDone] = useState<string | null>(null);

  /**
   * Confirmation is shown locally rather than left to the row disappearing.
   * The queue is force-dynamic, so revalidatePath has no cache to invalidate
   * and router.refresh() has to re-run the query — that round trip is slow
   * enough that a moderator working quickly would otherwise tap the same ad
   * twice, unsure whether the first tap registered.
   */
  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    settled?: string,
  ) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "وقع مشكل");
        return;
      }
      if (settled) {
        setDone(settled);
        router.refresh();
      }
    });
  }

  if (done) {
    return (
      <li className="rounded-card border-success/30 bg-success/5 text-success border p-4 text-sm font-bold">
        {listing.title} — {done}
      </li>
    );
  }

  return (
    <li className="rounded-card border-border bg-surface border p-4">
      <div className="flex gap-4">
        <div className="bg-surface-soft rounded-input relative size-24 shrink-0 overflow-hidden">
          {listing.coverUrl ? (
            <Image
              src={listing.coverUrl}
              alt=""
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <span className="text-dim grid h-full place-items-center text-xs font-bold">
              بلا صورة
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-bold">{listing.title}</p>
          <p className="text-primary ltr-nums mt-1 text-sm font-extrabold">
            {listing.priceOnRequest
              ? "السعر بالاتفاق"
              : formatPriceExact(listing.price)}
          </p>
          <p className="text-muted mt-1 text-xs">
            {kTransactionTypes[listing.transactionType]} ·{" "}
            {kPropertyTypes[listing.propertyType]} ·{" "}
            {placeLabel(listing.wilayaSlug, listing.communeSlug)}
          </p>
          <p className="text-dim mt-1 text-xs">
            {listing.roomsCode ? `${listing.roomsCode} · ` : ""}
            {listing.areaBuilt ?? listing.areaLand ?? "?"} م²
            {listing.paperwork ? ` · ${kPaperwork[listing.paperwork]}` : ""}
            {` · ${listing.images.length} صورة`}
          </p>
        </div>
      </div>

      <p className="text-muted mt-3 line-clamp-3 text-sm leading-relaxed">
        {listing.description}
      </p>

      <p className="text-dim ltr-nums mt-2 text-xs">
        {listing.contactPhone} · {listing.ownerName}
      </p>

      {error && (
        <p role="alert" className="text-danger mt-3 text-xs font-bold">
          {error}
        </p>
      )}

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {kQuickReasons.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-input border px-3 py-1.5 text-xs font-bold ${
                  reason === r
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-white"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="سبب الرفض — يشوفو صاحب الإعلان"
            className="rounded-input border-border w-full border bg-white px-3 py-2 text-sm outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => rejectListing(listing.id, reason), "تم الرفض")
              }
              className="bg-danger rounded-input px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              أكّد الرفض
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="text-muted px-3 py-2 text-sm font-bold"
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => approveListing(listing.id), "تمت الموافقة")
            }
            className="bg-success rounded-input inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Check className="size-4" strokeWidth={3} />
            وافق
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setRejecting(true)}
            className="rounded-input border-border inline-flex items-center gap-1.5 border bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            <X className="size-4" strokeWidth={3} />
            ارفض
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const next = !featured;
              setFeaturedState(next);
              run(() => setFeatured(listing.id, next));
            }}
            className="text-muted inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold disabled:opacity-50"
          >
            <Star
              className={`size-4 ${featured ? "fill-warning text-warning" : ""}`}
            />
            {featured ? "مميّز" : "ميّز"}
          </button>
          <Link
            href={`/annonce/${listing.id}/${listing.slug}`}
            className="text-primary ms-auto text-xs font-bold underline"
          >
            معاينة
          </Link>
        </div>
      )}
    </li>
  );
}
