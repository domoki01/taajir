// ── QUERY BUILDER ────────────────────────────────────────────────────────────
// Every Firestore read of `listings` is built here, so the day this outgrows
// Firestore only this file is replaced.
//
// The shape of these queries is dictated by one Firestore constraint: a range
// filter forces the sort to lead with that same field. "الأحدث" is the default
// ordering for classifieds, so a live `price >= x` range would make it
// impossible. Prices are therefore bucketed at write time (see lib/price.ts)
// and filtered as an equality class, which composes with any sort and needs no
// extra index.

import {
  collection,
  limit as fbLimit,
  orderBy,
  query,
  where,
  type Query,
} from "firebase/firestore";
import { publicDb } from "@/lib/firebase/public";
import { bucketsInRange } from "@/lib/price";
import type { RoomCode } from "@/lib/enums";

export type ListingFilters = {
  /** Deal slug — renameable from the admin panel, so a plain string. */
  transactionType?: string;
  /** Category slug — admin-editable, so not the enum union. */
  propertyType?: string;
  wilayaSlug?: string;
  communeSlug?: string;
  roomsCode?: RoomCode;
  priceMin?: number | null;
  priceMax?: number | null;
  /** Free text — matched against the denormalized token array. */
  q?: string;
};

export type SortMode = "recent" | "price-asc" | "price-desc" | "area-desc";

/** Rentals price on a different scale, so they bucket separately. */
export function isRental(t: string | undefined): boolean {
  return t === "location" || t === "vacances";
}

/**
 * Build the listings query.
 *
 * Only predicates that are both selective and indexed go into Firestore.
 * Low-selectivity filters (amenities, paperwork) are applied in memory by the
 * caller over the returned page — burning an index on them would multiply the
 * index count for almost no reduction in documents read.
 */
export function buildListingsQuery(
  filters: ListingFilters,
  sort: SortMode = "recent",
  max = 48,
): Query {
  const clauses = [where("status", "==", "published")];

  if (filters.transactionType) {
    clauses.push(where("transactionType", "==", filters.transactionType));
  }
  if (filters.propertyType) {
    clauses.push(where("propertyType", "==", filters.propertyType));
  }
  if (filters.wilayaSlug) {
    clauses.push(where("wilayaSlug", "==", filters.wilayaSlug));
  }
  if (filters.communeSlug) {
    clauses.push(where("communeSlug", "==", filters.communeSlug));
  }
  if (filters.roomsCode) {
    clauses.push(where("roomsCode", "==", filters.roomsCode));
  }

  // A price range becomes an `in` over precomputed buckets. Firestore caps `in`
  // at 30 values; the widest possible range here is 9, so it cannot overflow.
  if (filters.priceMin != null || filters.priceMax != null) {
    const buckets = bucketsInRange(
      filters.priceMin ?? null,
      filters.priceMax ?? null,
      isRental(filters.transactionType),
    );
    clauses.push(where("priceBucket", "in", buckets));
  }

  // Only one array predicate is allowed per query, so when a text search is
  // active it takes that slot and amenity filtering falls to the in-memory pass.
  const tokens = tokenize(filters.q ?? "");
  if (tokens.length > 0) {
    clauses.push(
      where("searchTokens", "array-contains-any", tokens.slice(0, 10)),
    );
  }

  const ordering = {
    recent: orderBy("publishedAt", "desc"),
    "price-asc": orderBy("price", "asc"),
    "price-desc": orderBy("price", "desc"),
    "area-desc": orderBy("areaBuilt", "desc"),
  }[sort];

  return query(
    collection(publicDb(), "listings"),
    ...clauses,
    ordering,
    fbLimit(max),
  );
}

/**
 * Normalize a query string into search tokens, applying the same folding the
 * write path uses. Without it "الجزاير" would never match "الجزائر".
 */
export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3);
}
