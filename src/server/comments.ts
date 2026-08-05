import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type { Comment } from "@/types/comment";

/**
 * Comments for a listing, oldest first — a thread reads as a conversation, and
 * a question makes no sense above the answer it received.
 *
 * Wrapped like every other read here: a comment thread failing must not take
 * down the listing page it hangs off.
 */
export async function getComments(
  listingId: string,
  max = 100,
): Promise<Comment[]> {
  try {
    const snap = await adminDb()
      .collection("listings")
      .doc(listingId)
      .collection("comments")
      .where("status", "==", "visible")
      .orderBy("createdAt", "asc")
      .limit(max)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment);
  } catch (error) {
    console.error("[comments] read failed:", error);
    return [];
  }
}
