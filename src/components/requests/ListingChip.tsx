import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Home } from "lucide-react";
import { formatPrice } from "@/lib/price";
import type { ReplyListing } from "@/types/request";

/**
 * The ad a replier attached, under their reply.
 *
 * Deliberately a button rather than a listing card. A full card in the middle
 * of a conversation reads as an advertisement inserted into someone's thread;
 * this is one line that says "here is the ad I mean" and gets out of the way.
 * The thumbnail earns its place because a property with no picture is not worth
 * clicking, and the price because it is the one fact that decides whether the
 * person who posted the request opens it at all.
 */
export function ListingChip({ listing }: { listing: ReplyListing }) {
  return (
    <Link
      href={`/annonce/${listing.id}/${listing.slug}`}
      className="rounded-input border-border hover:border-primary bg-surface-soft mt-2 inline-flex max-w-full items-center gap-2 border py-1.5 ps-1.5 pe-2 transition-colors"
    >
      <span className="bg-surface relative size-8 shrink-0 overflow-hidden rounded-[8px]">
        {listing.coverUrl ? (
          <Image
            src={listing.coverUrl}
            alt=""
            fill
            sizes="32px"
            className="object-cover"
          />
        ) : (
          <Home className="text-dim absolute inset-0 m-auto size-4" />
        )}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-xs font-bold">
          {listing.title}
        </span>
        <span className="text-primary ltr-nums block text-[11px] font-extrabold">
          {listing.priceOnRequest
            ? "السعر بالاتفاق"
            : formatPrice(listing.price)}
        </span>
      </span>

      <ChevronLeft className="text-dim size-4 shrink-0" />
    </Link>
  );
}
