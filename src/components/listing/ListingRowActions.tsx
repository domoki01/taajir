"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteListing, markListingClosed } from "@/server/actions/moderation";
import type { Listing } from "@/types/listing";

export function ListingRowActions({ listing }: { listing: Listing }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closedLabel =
    listing.transactionType === "vente" ? "تم البيع" : "تم الكراء";
  const isClosed = listing.status === "sold" || listing.status === "rented";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "وقع مشكل");
    });
  }

  if (listing.status === "archived") return null;

  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <Link
        href={`/tableau-de-bord/annonces/${listing.id}/modifier`}
        className="text-primary text-xs font-bold underline"
      >
        تعديل
      </Link>

      {!isClosed && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => markListingClosed(listing.id))}
          className="text-muted hover:text-success text-xs font-bold underline disabled:opacity-50"
        >
          {closedLabel}
        </button>
      )}

      {confirming ? (
        <span className="flex items-center gap-2 text-xs font-bold">
          متأكّد؟
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteListing(listing.id))}
            className="text-danger underline disabled:opacity-50"
          >
            نعم، احذف
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-muted underline"
          >
            لا
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-muted hover:text-danger text-xs font-bold underline"
        >
          حذف
        </button>
      )}

      {error && (
        <span role="alert" className="text-danger text-xs font-bold">
          {error}
        </span>
      )}
    </div>
  );
}
