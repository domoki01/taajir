// ── APP CONSTANTS ────────────────────────────────────────────────────────────
// Values that are part of the product definition rather than configuration.
// Anything that differs per environment belongs in .env, not here.

export const kSiteName = "تأجير";
export const kSiteTagline = "عقارات الجزائر";

/** Absolute origin, needed by metadataBase, sitemap and canonical URLs. */
export const kSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Whether a *new* account may be opened with a phone number.
 *
 * Firebase's SMS backend started refusing this project's verification codes —
 * a valid reCAPTCHA token passes the captcha check and the send then answers
 * HTTP 503 `backendError`, which the SDK surfaces as an unmapped number. It is
 * outside this codebase, so the only thing to decide here is what somebody
 * standing in front of the form should be offered meanwhile.
 *
 * Signing *in* by phone is never hidden by this. Thirty-five accounts have no
 * email and no password; hiding their only door would strand them, and it costs
 * nothing to leave a door that works again the moment Google's does.
 *
 * An environment variable rather than an admin setting on purpose: the day this
 * is switched back is the day somebody watches it work, not a day it should
 * flip on its own.
 */
export const kPhoneSignupEnabled =
  process.env.NEXT_PUBLIC_PHONE_SIGNUP !== "off";

/**
 * The picture a shared link shows when the thing being shared has none.
 *
 * Demands never have a photo and plenty of ads are posted without one. A link
 * preview with no image is a grey rectangle in a WhatsApp group, next to
 * everybody else's pictures — this is the difference between a link that gets
 * tapped and one that gets scrolled past.
 */
export const kDefaultShareImage = "/og-default.png";

/** Photos per listing. Real-estate ads live on their gallery. */
export const kMaxImages = 20;

/** Free listings an individual may keep active (pending + published). */
export const kFreeListingQuota = 3;

/** Days a listing stays published before it needs renewing. */
export const kListingLifetimeDays = 60;

/**
 * Saved searches one account may keep. Generous for a person, and low enough
 * that approving an ad fans out to a bounded number of pushes.
 */
export const kMaxSavedSearches = 10;

/**
 * Open property requests one account may have on the feed.
 *
 * Nothing moderates the demand feed before it appears, so the cap is what stops
 * one person from owning the first screen. Five is more demands than anyone
 * genuinely has at once.
 */
export const kMaxOpenRequests = 5;

// ── PRICE UNITS ──────────────────────────────────────────────────────────────
// Algerians quote property prices in "ملايين" — millions of centimes.
// 1 مليون = 100 * 10_000 centimes = 10_000 DZD. A flat advertised at
// "800 مليون" costs 8_000_000 DZD. Prices are ALWAYS stored as whole dinars;
// mixing the two units up is a 10_000x error, so the conversion lives in
// exactly one place (lib/price.ts) and nowhere else.
export const kDinarsPerMillion = 10_000;
