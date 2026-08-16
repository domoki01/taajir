import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type { PropertyRequest, RequestReply } from "@/types/request";
import type { Listing } from "@/types/listing";

/**
 * Every read here is wrapped, for the same reason the listing reads are: a
 * missing composite index or a cold database must degrade the feed to an empty
 * state, not turn it into a 500.
 */
async function safely<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch (error) {
    console.error("[requests] read failed:", error);
    return fallback;
  }
}

/**
 * The feed, newest first, optionally narrowed to a wilaya and then a commune.
 *
 * The commune filter only applies inside a wilaya: on its own a commune slug is
 * not unique across the 69 wilayas, and a query on it alone would mix places
 * that merely share a name.
 */
export async function listRequests(
  wilayaSlug?: string,
  communeSlug?: string,
  max = 40,
): Promise<PropertyRequest[]> {
  return safely(async () => {
    let query = adminDb()
      .collection("requests")
      .where("status", "==", "visible");
    if (wilayaSlug) {
      query = query.where("wilayaSlug", "==", wilayaSlug);
      if (communeSlug) query = query.where("communeSlug", "==", communeSlug);
    }

    const snap = await query.orderBy("createdAt", "desc").limit(max).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PropertyRequest);
  }, []);
}

/**
 * One request. Hidden ones come back too — the caller decides, because the
 * author and an admin should still see a hidden request rather than a 404 that
 * looks like the post was silently deleted.
 */
export async function getRequest(id: string): Promise<PropertyRequest | null> {
  return safely(async () => {
    const snap = await adminDb().collection("requests").doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as PropertyRequest;
  }, null);
}

/** Replies oldest first — a thread reads as a conversation. */
export async function getReplies(
  requestId: string,
  max = 100,
): Promise<RequestReply[]> {
  return safely(async () => {
    const snap = await adminDb()
      .collection("requests")
      .doc(requestId)
      .collection("replies")
      .where("status", "==", "visible")
      .orderBy("createdAt", "asc")
      .limit(max)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RequestReply);
  }, []);
}

/**
 * The published ads a person may attach to a reply.
 *
 * Published only, and only their own: this list is what the dropdown offers,
 * and the Server Action re-checks both before writing. Offering a draft would
 * put a link to a page that 404s in the middle of someone else's thread.
 */
export async function listMyPublishedListings(
  uid: string,
  max = 30,
): Promise<Listing[]> {
  return safely(async () => {
    const snap = await adminDb()
      .collection("listings")
      .where("ownerUid", "==", uid)
      .where("status", "==", "published")
      .limit(max)
      .get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Listing)
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  }, []);
}

/**
 * Demands waiting on a human, oldest first.
 *
 * Oldest first for the same reason the listing queue is: a newest-first queue
 * starves its tail, and the tail here is somebody whose post has been invisible
 * the longest.
 */
export async function listPendingRequests(
  max = 50,
): Promise<PropertyRequest[] | null> {
  try {
    const snap = await adminDb()
      .collection("requests")
      .where("status", "==", "pending")
      .orderBy("createdAt", "asc")
      .limit(max)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PropertyRequest);
  } catch (error) {
    console.error("[requests] pending list failed:", error);
    return null;
  }
}

/**
 * Demands waiting for the launch, oldest first.
 *
 * Separate from the review queue because they are waiting on a different thing:
 * nobody has to decide anything about these, they are simply held until the
 * site opens. They had no reader at all until now — the queue asked only for
 * `pending`, so everything posted before launch was invisible to staff while
 * its author could see it sitting in «منشوراتي» marked محجوز للإطلاق. Held ads
 * have had their own section since the launch screen was built; this is the
 * same thing for demands.
 */
export async function listHeldRequests(
  max = 50,
): Promise<PropertyRequest[] | null> {
  try {
    const snap = await adminDb()
      .collection("requests")
      .where("status", "==", "pendingLaunch")
      .orderBy("createdAt", "asc")
      .limit(max)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PropertyRequest);
  } catch (error) {
    console.error("[requests] held list failed:", error);
    return null;
  }
}

/** Everything one person has posted, whatever state it is in — for «منشوراتي». */
export async function listMyRequests(
  uid: string,
  max = 50,
): Promise<PropertyRequest[] | null> {
  try {
    const snap = await adminDb()
      .collection("requests")
      .where("ownerUid", "==", uid)
      .limit(max)
      .get();
    // Sorted in memory rather than by the query: ownerUid + createdAt would
    // need its own composite index for a list that is never more than a
    // handful of rows.
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as PropertyRequest)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error("[requests] mine list failed:", error);
    return null;
  }
}
