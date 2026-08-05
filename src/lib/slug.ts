// ── LISTING SLUGS ────────────────────────────────────────────────────────────
// The slug is the readable half of /annonce/{id}/{slug}. The id is what
// resolves the page, so the slug exists purely for humans and for search.
//
// It is built from the listing's structured fields rather than transliterated
// from its Arabic title, and that is the whole point. Transliteration produced
// "bya-chqa-fy-bjaya" — a string nobody types, nobody reads, and that matches no
// query. The fields instead yield "vente-appartement-f3-akbou", which is the
// French-derived vocabulary Algerians actually search with and which mirrors the
// browse routes (/vente/appartement/bejaia) that carry this site's SEO.
//
// A title change no longer changes the URL either, which removes a whole class
// of link churn: only moving the property or reclassifying it does.

import type { PropertyType, RoomCode, TransactionType } from "@/lib/enums";

export type ListingSlugParts = {
  transactionType: TransactionType;
  propertyType: PropertyType;
  roomsCode?: RoomCode | null;
  communeSlug?: string | null;
  wilayaSlug: string;
};

/**
 * `vente-appartement-f3-akbou`
 *
 * Rooms are included when known because "F3" is a real search term here, not
 * decoration. The commune is preferred over the wilaya since it is the more
 * specific — and more searched — location.
 */
export function buildListingSlug(parts: ListingSlugParts): string {
  const place = parts.communeSlug?.trim() || parts.wilayaSlug;

  return [
    parts.transactionType,
    parts.propertyType,
    parts.roomsCode?.toLowerCase().replace("+", "-plus"),
    place,
  ]
    .filter(Boolean)
    .join("-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
