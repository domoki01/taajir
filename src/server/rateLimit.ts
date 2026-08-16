import "server-only";

import { adminDb } from "@/lib/firebase/admin";

/**
 * How fast one account may write the same kind of thing.
 *
 * Every posting action is guarded by identity, quota or moderation — but none
 * of those is a *rate*. A signed-in account could post comments and replies as
 * fast as it could issue requests, which is the shape spam actually takes on a
 * classifieds site: not one forged document, but four hundred honest ones.
 *
 * Counted in Firestore rather than in memory: App Hosting runs several
 * instances and restarts them freely, so an in-process counter is a limit that
 * resets whenever the attacker is unlucky, and is not shared with the instance
 * handling their next request.
 *
 * One rolling document per account and kind, holding the timestamps inside the
 * window — not one document per event. A row per event would need a composite
 * index and would grow forever with nothing to prune it; this is a fixed number
 * of tiny documents, read by id, updated in place.
 */
export type RateWindow = { max: number; seconds: number };

export const kRates = {
  comment: { max: 8, seconds: 60 },
  reply: { max: 8, seconds: 60 },
  request: { max: 4, seconds: 300 },
} as const satisfies Record<string, RateWindow>;

export type RateKind = keyof typeof kRates;

/** What the person sees. Deliberately vague about the wait — a countdown reads as a challenge. */
export const kTooFast = "روّح شوية — استنّى دقيقة وعاود.";

/**
 * Record one attempt and say whether it is allowed.
 *
 * In a transaction, because two requests arriving together would otherwise
 * both read the same count and both pass it. The attempt is recorded whether or
 * not it was allowed, so hammering the endpoint extends the wait instead of
 * resetting it.
 */
export async function withinRate(
  uid: string,
  kind: RateKind,
): Promise<boolean> {
  const { max, seconds } = kRates[kind];
  const now = Date.now();
  const since = now - seconds * 1000;
  const ref = adminDb().collection("rateLimits").doc(`${uid}_${kind}`);

  try {
    return await adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const previous: number[] = snap.exists
        ? ((snap.data()?.hits as number[]) ?? [])
        : [];
      const hits = previous.filter((t) => t > since);

      // Trimmed to the window plus one, so a long burst cannot grow the
      // document without bound either.
      tx.set(ref, {
        uid,
        kind,
        hits: [...hits, now].slice(-(max + 1)),
        updatedAt: now,
      });

      return hits.length < max;
    });
  } catch (error) {
    // Failing open is deliberate. A limiter that failed closed would turn a
    // Firestore hiccup into "nobody can comment" — a worse outage than the
    // abuse it prevents — and the content check and moderation queue both
    // still stand behind this one.
    console.error("[rate] check failed, allowing:", error);
    return true;
  }
}
