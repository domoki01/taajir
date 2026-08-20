// ── SHORT LINKS, SHARED FACTS ────────────────────────────────────────────────
// `taajirdz.com/s/K7M2QX` instead of
// `taajirdz.com/demandes/BodalBbKvTtVFa9xD5y2?ref=275M8V`.
//
// Length is not vanity here. A link pasted into a Facebook group wraps across
// four lines on a phone and reads as machine output; the same post with one
// short line reads as something a person meant to send. And on WhatsApp the
// preview card is what people tap — a long URL pushes it further down the
// bubble.
//
// The same alphabet as referral codes, and for the same reason: no 0/O, no 1/I,
// nothing that turns into a different character when somebody reads it aloud
// down the phone.

import { kCodeAlphabet } from "@/lib/referral";

export const kShortCodeLength = 7;

export const kShortCodePattern = new RegExp(
  `^[${kCodeAlphabet}]{${kShortCodeLength}}$`,
);

export function shortLinkUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/s/${code}`;
}

/**
 * Which paths may be shortened.
 *
 * An allowlist rather than a filter: this table is written by whoever calls the
 * mint action, and a shortener that accepts any string is an open redirector
 * wearing the site's own domain — the exact thing `safeNext` exists to prevent
 * two files over.
 */
export function shortenablePath(path: string): boolean {
  return (
    /^\/annonce\/[A-Za-z0-9_-]{1,64}\/[^/?#]{1,120}$/.test(path) ||
    /^\/demandes\/[A-Za-z0-9_-]{1,64}$/.test(path)
  );
}
