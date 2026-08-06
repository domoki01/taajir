import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type { SavedSearch } from "@/types/savedSearch";

/**
 * Someone's own alerts, newest first.
 *
 * Read through the Admin SDK because the collection is server-write-only and
 * clients have no read rule on it either — an alert is a statement about what a
 * person is looking for, which is nobody else's business.
 */
export async function listMySavedSearches(uid: string): Promise<SavedSearch[]> {
  const snap = await adminDb()
    .collection("savedSearches")
    .where("ownerUid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SavedSearch);
}

/** How many browsers this account currently receives push on. */
export async function countMyDevices(uid: string): Promise<number> {
  const snap = await adminDb()
    .collection("users")
    .doc(uid)
    .collection("devices")
    .count()
    .get();
  return snap.data().count;
}
