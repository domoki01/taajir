// ── PRICE ────────────────────────────────────────────────────────────────────
// Algerians quote property in "ملايين" — millions of centimes. One مليون is
// 10 000 DZD, so a flat advertised at "800 مليون" costs 8 000 000 DZD. Rents
// are usually quoted in ألف (thousands of dinars): "3 ملايين" a month is
// 30 000 DZD.
//
// Prices are stored as a whole number of DINARS everywhere — Firestore, query
// buckets, sort keys. Mixing the units up is a 10 000x error, so every
// conversion lives in this file and nowhere else.

import { kDinarsPerMillion } from "@/lib/constants";
import { kPriceUnits, type PriceUnit } from "@/lib/enums";

export type PriceInputUnit = "dzd" | "million";

/** Convert what the user typed into the canonical dinar amount. */
export function toDinars(amount: number, unit: PriceInputUnit): number {
  return Math.round(unit === "million" ? amount * kDinarsPerMillion : amount);
}

/** Convert a stored dinar amount back into the unit the user is editing in. */
export function fromDinars(dinars: number, unit: PriceInputUnit): number {
  return unit === "million" ? dinars / kDinarsPerMillion : dinars;
}

const nf = new Intl.NumberFormat("en-US");

/**
 * Format a price the way an Algerian seller would say it out loud.
 *
 *   8_000_000 -> "800 مليون"      (sale prices are spoken in ملايين)
 *      35_000 -> "3.5 مليون"      (rents too, once past a million centimes)
 *       8_000 -> "8,000 دج"       (below that, plain dinars read better)
 *
 * Digits stay Latin — that is what the market uses on every listing site and
 * what the Cairo font renders most legibly at small sizes.
 */
export function formatPrice(dinars: number): string {
  if (!Number.isFinite(dinars) || dinars <= 0) return "السعر بالاتفاق";

  const millions = dinars / kDinarsPerMillion;
  if (millions < 1) return `${nf.format(Math.round(dinars))} دج`;

  // One decimal only when it carries information: 3.5 مليون, not 800.0 مليون.
  const rounded =
    millions < 10 ? Math.round(millions * 10) / 10 : Math.round(millions);
  return `${nf.format(rounded)} مليون`;
}

/** Full form for the listing detail page, where precision is expected. */
export function formatPriceExact(dinars: number): string {
  if (!Number.isFinite(dinars) || dinars <= 0) return "السعر بالاتفاق";
  return `${nf.format(Math.round(dinars))} دج`;
}

/** Price with its unit suffix, e.g. "4.5 مليون في الشهر". */
export function formatPriceWithUnit(dinars: number, unit: PriceUnit): string {
  const price = formatPrice(dinars);
  return unit === "total" ? price : `${price} ${kPriceUnits[unit]}`;
}

// ── QUERY BUCKETS ────────────────────────────────────────────────────────────
// Firestore cannot order by `publishedAt` while filtering on a `price` range —
// the sort has to lead with the inequality field. Since "الأحدث" is the default
// ordering for classifieds, prices are bucketed at write time and filtered as
// an equality class (`where('priceBucket', 'in', [...])`), which composes with
// any sort and needs no extra index.
//
// The buckets double as the filter UI: preset chips ("تحت 400 مليون") are how
// people actually shop here, and how every competitor presents it.

export const kSaleBuckets = [
  0, 2_000_000, 4_000_000, 6_000_000, 8_000_000, 12_000_000, 20_000_000,
  35_000_000, 60_000_000,
] as const;

export const kRentBuckets = [
  0, 15_000, 25_000, 35_000, 50_000, 80_000, 120_000, 200_000,
] as const;

export const kAreaBuckets = [0, 50, 70, 90, 120, 160, 250, 500] as const;

function bucketIndex(value: number, edges: readonly number[]): number {
  let i = 0;
  while (i + 1 < edges.length && value >= edges[i + 1]!) i++;
  return i;
}

/** Denormalized onto the listing at write time. `s_` sale, `r_` rent. */
export function priceBucket(dinars: number, isRental: boolean): string {
  const edges = isRental ? kRentBuckets : kSaleBuckets;
  return `${isRental ? "r" : "s"}_${bucketIndex(dinars, edges)}`;
}

export function areaBucket(m2: number): string {
  return `a_${bucketIndex(m2, kAreaBuckets)}`;
}

/** Every bucket key overlapping [min, max], for building an `in` filter. */
export function bucketsInRange(
  min: number | null,
  max: number | null,
  isRental: boolean,
): string[] {
  const edges = isRental ? kRentBuckets : kSaleBuckets;
  const lo = min == null ? 0 : bucketIndex(min, edges);
  const hi = max == null ? edges.length - 1 : bucketIndex(max, edges);
  return Array.from(
    { length: hi - lo + 1 },
    (_, i) => `${isRental ? "r" : "s"}_${lo + i}`,
  );
}

/** Human label for a bucket, used on the filter chips. */
export function bucketLabel(index: number, isRental: boolean): string {
  const edges = isRental ? kRentBuckets : kSaleBuckets;
  const lo = edges[index]!;
  const hi = edges[index + 1];
  if (index === 0) return `أقل من ${formatPrice(hi!)}`;
  if (hi === undefined) return `أكثر من ${formatPrice(lo)}`;
  return `${formatPrice(lo)} — ${formatPrice(hi)}`;
}
