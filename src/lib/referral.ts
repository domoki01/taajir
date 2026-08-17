// ── REFERRAL LINK, SHARED FACTS ──────────────────────────────────────────────
// Named here rather than in src/server/affiliate.ts because both the route
// handler that sets the cookie and the client that renders the link need them,
// and neither may pull firebase-admin into its bundle.

/** Where the invited visitor's code is parked until they create an account. */
export const kReferralCookie = "taajir_ref";

/**
 * Ninety days.
 *
 * Someone sent a link on WhatsApp does not sign up in the same minute; they
 * look, close the tab, and come back when they actually need a flat. A cookie
 * that expired in a day would credit almost nobody, and the only cost of a long
 * one is attributing a signup to an invitation that really did cause it, late.
 */
export const kReferralCookieMaxAgeMs = 90 * 24 * 60 * 60 * 1000;

/**
 * The code alphabet: no vowels and no lookalikes.
 *
 * A code gets read aloud, typed from a WhatsApp message and written on paper,
 * so `0/O` and `1/I` are out — and so are vowels, which is what keeps a random
 * six-character string from spelling something unfortunate in Arabic or French.
 */
export const kCodeAlphabet = "23456789BCDFGHJKLMNPQRSTVWXYZ";
export const kCodeLength = 6;

export const kReferralCodePattern = new RegExp(
  `^[${kCodeAlphabet}]{${kCodeLength}}$`,
);

/** The link a referrer shares. Absolute, because it is pasted into WhatsApp. */
export function referralLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/r/${code}`;
}
