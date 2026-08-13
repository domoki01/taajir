import Image from "next/image";
import Link from "next/link";
import { ImageOff, MapPin } from "lucide-react";
import { getTaxonomy, labelOf } from "@/server/filterSettings";
import { formatPrice } from "@/lib/price";
import { placeLabel } from "@/lib/geo";
import type { ListingSummary } from "@/types/listing";

// A Server Component so it can read the site's taxonomy: categories are
// admin-editable, so the label for a slug is a runtime lookup rather than a
// constant. The read is cached per request, so a grid of twenty cards costs one.
export async function ListingCard({ listing }: { listing: ListingSummary }) {
  const area = listing.areaBuilt ?? listing.areaLand;
  const { propertyTypes } = await getTaxonomy();

  return (
    <li>
      <Link
        href={`/annonce/${listing.id}/${listing.slug}`}
        className="rounded-card border-border bg-surface hover:border-primary hover:shadow-soft group flex h-full flex-col overflow-hidden border transition-all"
      >
        <div className="bg-surface-soft relative aspect-4/3 overflow-hidden">
          {listing.coverUrl ? (
            <Image
              src={listing.coverUrl}
              alt=""
              fill
              // One column on a phone, up to four on a wide screen — telling the
              // browser this stops it downloading a full-width image for a card.
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform group-hover:scale-[1.02]"
            />
          ) : (
            <div className="text-dim grid h-full place-items-center">
              <ImageOff className="size-8" />
            </div>
          )}

          {listing.isFeatured && (
            <span className="bg-primary absolute start-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold text-white">
              مميّز
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="text-primary ltr-nums text-lg font-extrabold">
            {listing.priceOnRequest
              ? "السعر بالاتفاق"
              : formatPrice(listing.price)}
          </p>

          <h3 className="line-clamp-2 text-sm leading-relaxed font-bold">
            {listing.title}
          </h3>

          <p className="text-muted mt-auto flex items-center gap-1 text-xs">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {placeLabel(listing.wilayaSlug, listing.communeSlug)}
            </span>
          </p>

          <p className="text-dim flex flex-wrap items-center gap-x-3 text-xs font-semibold">
            <span>{labelOf(propertyTypes, listing.propertyType)}</span>
            {listing.roomsCode && (
              <span className="ltr-nums">{listing.roomsCode}</span>
            )}
            {area != null && <span className="ltr-nums">{area} م²</span>}
          </p>
        </div>
      </Link>
    </li>
  );
}
