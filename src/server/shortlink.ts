import "server-only";

import { createHash } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import { kCodeAlphabet } from "@/lib/referral";
import { kShortCodeLength, shortenablePath } from "@/lib/shortlink";

export const kShortLinks = "shortLinks";

export type ShortLink = {
  path: string;
  /** The sharer's referral code, or null for an anonymous share. */
  ref: string | null;
  createdAt: number;
};

/**
 * The code for a destination — derived, not drawn.
 *
 * A random code would mean a new row every time the same person opens the same
 * ad, and a different link in every message they send. Hashing the destination
 * makes it idempotent: the same ad shared by the same person is always the same
 * short link, so a second share costs one read and nothing else, and a link
 * already circulating never becomes a second entry in the table.
 *
 * The salt exists for collisions. Two different destinations landing on one
 * code would silently send people to the wrong ad — rare at 29^7, and cheap
 * enough to rule out rather than hope about.
 */
function codeFor(path: string, ref: string | null, salt: number): string {
  const digest = createHash("sha256")
    .update(`${path}|${ref ?? ""}|${salt}`)
    .digest();
  let out = "";
  for (let i = 0; i < kShortCodeLength; i++) {
    out += kCodeAlphabet[digest[i] % kCodeAlphabet.length];
  }
  return out;
}

/**
 * Mint — or find — the short link for this destination.
 *
 * Returns null rather than throwing: a share row whose short link could not be
 * created still has a perfectly good long link to fall back on, and a Firestore
 * hiccup is not worth taking the button away over.
 */
export async function shortenPath(
  path: string,
  ref: string | null,
): Promise<string | null> {
  if (!shortenablePath(path)) return null;

  try {
    const db = adminDb();
    for (let salt = 0; salt < 4; salt++) {
      const code = codeFor(path, ref, salt);
      const doc = db.collection(kShortLinks).doc(code);
      const snap = await doc.get();

      if (!snap.exists) {
        await doc.create({ path, ref, createdAt: Date.now() } as ShortLink);
        return code;
      }

      const existing = snap.data() as ShortLink;
      // The same destination, already minted — the ordinary case on every share
      // after the first.
      if (existing.path === path && (existing.ref ?? null) === ref) return code;
      // Somebody else's destination on this code. Salt and try again.
    }
    return null;
  } catch (error) {
    console.error("[shortlink] mint failed:", error);
    return null;
  }
}

/** Where a code points, or null when it points nowhere. */
export async function resolveShortLink(
  code: string,
): Promise<ShortLink | null> {
  try {
    const snap = await adminDb().collection(kShortLinks).doc(code).get();
    if (!snap.exists) return null;
    const link = snap.data() as ShortLink;
    // Re-checked on the way out as well as on the way in: this row decides
    // where a visitor's browser is sent, and the allowlist is the whole
    // difference between a shortener and an open redirector.
    return shortenablePath(link.path) ? link : null;
  } catch (error) {
    console.error("[shortlink] resolve failed:", error);
    return null;
  }
}
