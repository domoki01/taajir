import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { kListingStatuses } from "@/lib/enums";

/**
 * Counts for the two dashboards.
 *
 * These use Firestore's count() aggregation rather than fetching the documents:
 * a count is billed at a fraction of a read per document scanned instead of a
 * full read each, which matters on a page whose only job is to show numbers.
 *
 * Every count is independently guarded. A dashboard that 500s because one
 * aggregate failed is worse than one showing a dash in a single tile.
 */
async function countOf(
  build: (
    col: FirebaseFirestore.CollectionReference,
  ) => FirebaseFirestore.Query,
  collection = "listings",
): Promise<number | null> {
  try {
    const snap = await build(adminDb().collection(collection)).count().get();
    return snap.data().count;
  } catch (error) {
    console.error(`[stats] count on ${collection} failed:`, error);
    return null;
  }
}

export type OwnerStats = {
  byStatus: Record<string, number>;
  views: number | null;
  activeListingCount: number;
  listingQuota: number;
};

/**
 * The seller's own numbers.
 *
 * Derived from the documents rather than from count() aggregates: the same
 * page already lists these ads, the ceiling is a page of 50, and a sum of
 * viewCount cannot be done with an aggregate anyway.
 */
export function ownerStats(
  listings: Array<{ status: string; viewCount?: number }>,
  quota: { activeListingCount: number; listingQuota: number },
): OwnerStats {
  const byStatus: Record<string, number> = {};
  for (const key of Object.keys(kListingStatuses)) byStatus[key] = 0;

  let views = 0;
  for (const listing of listings) {
    byStatus[listing.status] = (byStatus[listing.status] ?? 0) + 1;
    views += listing.viewCount ?? 0;
  }

  return { byStatus, views, ...quota };
}

export type AdminStats = {
  pending: number | null;
  published: number | null;
  rejected: number | null;
  users: number | null;
  banned: number | null;
  promos: number | null;
};

export async function adminStats(): Promise<AdminStats> {
  // In parallel: six sequential round trips to Firestore is most of the time
  // this page takes.
  const [pending, published, rejected, users, banned, promos] =
    await Promise.all([
      countOf((c) => c.where("status", "==", "pending")),
      countOf((c) => c.where("status", "==", "published")),
      countOf((c) => c.where("status", "==", "rejected")),
      countOf((c) => c, "users"),
      countOf((c) => c.where("isBanned", "==", true), "users"),
      countOf((c) => c, "promos"),
    ]);

  return { pending, published, rejected, users, banned, promos };
}
