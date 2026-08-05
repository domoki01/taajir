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

/**
 * Every listing's comments in one stream, newest first, for the moderation
 * screen. Hidden ones are included — the point of hiding rather than deleting
 * is that the decision stays reviewable.
 *
 * A collection-group query, so it needs its own index with COLLECTION_GROUP
 * scope; the one serving getComments() above does not cover it.
 */
export async function listRecentComments(max = 100): Promise<Comment[] | null> {
  try {
    const snap = await adminDb()
      .collectionGroup("comments")
      .orderBy("createdAt", "desc")
      .limit(max)
      .get();
    return snap.docs.map(
      (d) =>
        ({
          id: d.id,
          ...d.data(),
          // The parent listing id is in the path, and a comment written before
          // listingId was denormalized would not have the field.
          listingId: d.ref.parent.parent?.id ?? "",
        }) as Comment,
    );
  } catch (error) {
    console.error("[comments] group read failed:", error);
    return null;
  }
}
