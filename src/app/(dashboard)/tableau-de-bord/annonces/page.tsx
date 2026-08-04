import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser } from "@/server/auth";
import { formatPrice } from "@/lib/price";
import { placeLabel } from "@/lib/geo";
import { kListingStatuses, kPropertyTypes } from "@/lib/enums";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Listing } from "@/types/listing";

export const metadata: Metadata = {
  title: "إعلاناتي",
  robots: { index: false, follow: false },
};

// Always fresh: a seller who just posted must see the ad here immediately, and
// a cached page would read as the submission having failed.
export const dynamic = "force-dynamic";

/** Owner reads go through the Admin SDK — drafts and rejections included. */
async function myListings(uid: string): Promise<Listing[]> {
  const snap = await adminDb()
    .collection("listings")
    .where("ownerUid", "==", uid)
    .orderBy("updatedAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Listing);
}

const statusStyle: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  published: "bg-success/15 text-success",
  rejected: "bg-danger/15 text-danger",
  draft: "bg-surface-soft text-muted",
};

export default async function MyListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/tableau-de-bord/annonces");
  const listings = await myListings(user.uid);
  const justPosted = (await searchParams).nouveau === "1";

  return (
    <div>
      <h1 className="text-2xl font-black">إعلاناتي</h1>

      {justPosted && (
        <p
          role="status"
          className="rounded-input bg-success/10 text-success mt-4 flex items-center gap-2 px-4 py-3 text-sm font-bold"
        >
          <CheckCircle2 className="size-5 shrink-0" />
          تنشر الإعلان. راه في المراجعة ويظهر للعموم بعد الموافقة.
        </p>
      )}

      <div className="mt-6">
        {listings.length === 0 ? (
          <EmptyState
            title="ما عندك حتى إعلان"
            body="انشر أول إعلان وشوفه هنا مع حالته."
          />
        ) : (
          <ul className="space-y-3">
            {listings.map((listing) => (
              <li
                key={listing.id}
                className="rounded-card border-border bg-surface flex flex-wrap items-center gap-3 border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{listing.title}</p>
                  <p className="text-muted mt-1 text-xs">
                    {kPropertyTypes[listing.propertyType]} ·{" "}
                    {placeLabel(listing.wilayaSlug, listing.communeSlug)}
                  </p>
                </div>

                <p className="text-accent ltr-nums font-extrabold">
                  {listing.priceOnRequest
                    ? "بالاتفاق"
                    : formatPrice(listing.price)}
                </p>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    statusStyle[listing.status] ?? "bg-surface-soft text-muted"
                  }`}
                >
                  {kListingStatuses[listing.status]}
                </span>

                {listing.status === "published" && (
                  <Link
                    href={`/annonce/${listing.id}/${listing.slug}`}
                    className="text-accent text-xs font-bold underline"
                  >
                    عرض
                  </Link>
                )}

                {listing.status === "rejected" && listing.rejectionReason && (
                  <p className="text-danger w-full text-xs font-semibold">
                    سبب الرفض: {listing.rejectionReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
