import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminMessaging } from "@/lib/firebase/admin";
import { kSiteUrl } from "@/lib/constants";
import { formatPrice } from "@/lib/price";
import type { Listing } from "@/types/listing";
import type { SavedSearch } from "@/types/savedSearch";

/**
 * Tell people whose saved search this ad matches.
 *
 * Called after an ad is approved, which is the only moment it becomes visible
 * — notifying on submission would leak unmoderated content, and a rejected ad
 * would have already been announced.
 *
 * Nothing here is allowed to fail the approval. A moderator pressing "وافق"
 * cares that the ad went live; a push that did not go out is worth a log line,
 * not a rolled-back publish.
 */
export async function notifyMatchingSearches(
  listing: Listing & { id: string },
): Promise<{ searches: number; sent: number }> {
  try {
    return await fanOut(listing);
  } catch (error) {
    console.error("[push] fan-out failed:", error);
    return { searches: 0, sent: 0 };
  }
}

async function fanOut(listing: Listing & { id: string }) {
  const db = adminDb();

  // Anchored on the wilaya because every saved search has one, so this is a
  // bounded index lookup rather than a scan of the whole collection. The rest
  // of the shape is checked in memory over what comes back.
  const snap = await db
    .collection("savedSearches")
    .where("wilayaSlug", "==", listing.wilayaSlug)
    .where("notify", "==", true)
    .limit(500)
    .get();

  const matches = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as SavedSearch)
    .filter((s) => matchesSearch(s, listing))
    // Never notify people about their own ad.
    .filter((s) => s.ownerUid !== listing.ownerUid);

  if (matches.length === 0) return { searches: 0, sent: 0 };

  // One person can hold several alerts that all match; they should get one push,
  // not four.
  const byOwner = new Map<string, SavedSearch>();
  for (const s of matches)
    if (!byOwner.has(s.ownerUid)) byOwner.set(s.ownerUid, s);

  const url = `${kSiteUrl}/annonce/${listing.id}/${listing.slug}`;
  const price = listing.priceOnRequest
    ? "السعر بالاتفاق"
    : formatPrice(listing.price);

  let sent = 0;
  for (const [uid, search] of byOwner) {
    sent += await pushToUser(uid, {
      title: `إعلان جديد: ${search.label}`,
      body: `${listing.title} — ${price}`,
      url,
    });
  }

  // Recorded per search so someone can see their alert is alive, and so a
  // future digest has something to count.
  await Promise.all(
    matches.map((s) =>
      db
        .collection("savedSearches")
        .doc(s.id)
        .update({
          lastNotifiedAt: Date.now(),
          matchCount: FieldValue.increment(1),
        })
        .catch(() => {}),
    ),
  );

  return { searches: matches.length, sent };
}

/** A null field on the search means "anything", which is how it was saved. */
function matchesSearch(search: SavedSearch, listing: Listing): boolean {
  if (search.communeSlug && search.communeSlug !== listing.communeSlug) {
    return false;
  }
  if (
    search.transactionType &&
    search.transactionType !== listing.transactionType
  ) {
    return false;
  }
  if (search.propertyType && search.propertyType !== listing.propertyType) {
    return false;
  }
  return true;
}

async function pushToUser(
  uid: string,
  message: { title: string; body: string; url: string },
): Promise<number> {
  const db = adminDb();
  const userRef = db.collection("users").doc(uid);

  // The per-search `notify` flag says which alerts are live; the profile switch
  // says whether this person wants alert push at all. Checked here rather than
  // in the query because it lives on a different document, and because a
  // silenced account should still accumulate matchCount — turning push back on
  // should not look like the alerts stopped working while it was off.
  const profile = await userRef.get();
  if (profile.data()?.notifyOnSavedSearch === false) return 0;

  const devices = await userRef.collection("devices").get();
  if (devices.empty) return 0;

  const tokens = devices.docs.map((d) => d.data().token as string);

  const res = await adminMessaging().sendEachForMulticast({
    tokens,
    notification: { title: message.title, body: message.body },
    // The click target lives in `data` as well: a web push opened from the
    // service worker reads it from there, not from `notification`.
    data: { url: message.url },
    webpush: {
      notification: { icon: "/icon-192.png", tag: "taajir-alert" },
      fcmOptions: { link: message.url },
    },
  });

  // A token dies when the browser's permission is revoked or its storage is
  // cleared, and FCM only tells you on the next send. Left in place they turn
  // every future fan-out into a pile of guaranteed failures.
  await Promise.all(
    res.responses.map(async (r, i) => {
      const code = r.error?.code ?? "";
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-argument"
      ) {
        await devices.docs[i].ref.delete().catch(() => {});
      }
    }),
  );

  if (res.failureCount > 0) {
    console.error(
      `[push] ${res.failureCount}/${tokens.length} failed for ${uid}:`,
      res.responses.find((r) => r.error)?.error?.code,
    );
  }
  return res.successCount;
}
