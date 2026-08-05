/**
 * A question or remark under a listing.
 *
 * Stored as a subcollection of the listing (`listings/{id}/comments`) rather
 * than a top-level collection: the scoping is the access rule, ordering within
 * one listing needs no composite index, and deleting a listing takes its thread
 * with it instead of leaving orphans behind.
 */
export type Comment = {
  id: string;
  listingId: string;

  authorUid: string;
  /**
   * Denormalized from the verified session, never from client input — otherwise
   * anyone could post as "وكالة موثّقة" and borrow its credibility.
   */
  authorName: string;
  authorPhotoUrl: string | null;
  /** True when the commenter is the person who posted the ad. */
  isOwner: boolean;

  text: string;
  /** Hidden comments stay readable to their author and to admins only. */
  status: "visible" | "hidden";
  hiddenReason: string | null;

  createdAt: number;
  editedAt: number | null;
};
