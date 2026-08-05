// ── APP CONSTANTS ────────────────────────────────────────────────────────────
// Values that are part of the product definition rather than configuration.
// Anything that differs per environment belongs in .env, not here.

export const kSiteName = "تأجير";
export const kSiteTagline = "عقارات الجزائر";

/** Absolute origin, needed by metadataBase, sitemap and canonical URLs. */
export const kSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Photos per listing. Real-estate ads live on their gallery. */
export const kMaxImages = 20;

/** Free listings an individual may keep active (pending + published). */
export const kFreeListingQuota = 3;

/** Days a listing stays published before it needs renewing. */
export const kListingLifetimeDays = 60;

// ── PRICE UNITS ──────────────────────────────────────────────────────────────
// Algerians quote property prices in "ملايين" — millions of centimes.
// 1 مليون = 100 * 10_000 centimes = 10_000 DZD. A flat advertised at
// "800 مليون" costs 8_000_000 DZD. Prices are ALWAYS stored as whole dinars;
// mixing the two units up is a 10_000x error, so the conversion lives in
// exactly one place (lib/price.ts) and nowhere else.
export const kDinarsPerMillion = 10_000;
