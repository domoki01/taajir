// ── LISTING READS ────────────────────────────────────────────────────────────
// Called from Server Components so listing content lands in the initial HTML.
// That is not a performance detail — it is the entire reason this project is on
// Next.js rather than the Flutter stack of its sibling repo.

import { doc, getDoc, getDocs } from "firebase/firestore";
import { publicDb } from "@/lib/firebase/public";
// The public reads above go through the client SDK so security rules apply to
// them. `listMyListings` at the bottom is the one exception and says why.
import { adminDb } from "@/lib/firebase/admin";
import {
  buildListingsQuery,
  type ListingFilters,
  type SortMode,
} from "@/lib/queries";
import type { Listing, ListingSummary } from "@/types/listing";

/**
 * Firestore is unreachable in more situations than it is reachable during early
 * development: no seeded data, no network in a build sandbox, rules mid-deploy.
 * A browse page must degrade to an empty state in all of them rather than
 * throwing a 500 over a missing ad.
 */
async function safely<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch (error) {
    console.error("[listings] Firestore read failed:", error);
    return fallback;
  }
}

export async function listListings(
  filters: ListingFilters,
  sort: SortMode = "recent",
  max = 48,
): Promise<ListingSummary[]> {
  return safely(async () => {
    const snap = await getDocs(buildListingsQuery(filters, sort, max));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ListingSummary);
  }, []);
}

export async function getListing(id: string): Promise<Listing | null> {
  return safely(async () => {
    const snap = await getDoc(doc(publicDb(), "listings", id));
    if (!snap.exists()) return null;
    const listing = { id: snap.id, ...snap.data() } as Listing;
    // Rules already hide unpublished ads from anonymous reads; this is a second
    // check so a future authenticated read path cannot leak a draft publicly.
    return listing.status === "published" ? listing : null;
  }, null);
}

/** Ads shown under a listing: same wilaya, same transaction, excluding itself. */
export async function getSimilarListings(
  listing: Listing,
  max = 4,
): Promise<ListingSummary[]> {
  const results = await listListings(
    {
      transactionType: listing.transactionType,
      wilayaSlug: listing.wilayaSlug,
    },
    "recent",
    max + 1,
  );
  return results.filter((l) => l.id !== listing.id).slice(0, max);
}

/**
 * Everything one person has posted, whatever state it is in.
 *
 * Wrapped because a Firestore read can fail for reasons that have nothing to do
 * with this user: a missing composite index, a cold database, a transient
 * network fault. Letting that throw turns "here are your ads" into a blank 500
 * right after someone has posted, which reads as having lost their work.
 *
 * Uses the Admin SDK rather than the public client: a pending or rejected ad is
 * invisible to security rules by design, and its own author still has to be
 * able to see it and read why.
 */
export async function listMyListings(
  uid: string,
  max = 50,
): Promise<Listing[] | null> {
  try {
    const snap = await adminDb()
      .collection("listings")
      .where("ownerUid", "==", uid)
      .orderBy("updatedAt", "desc")
      .limit(max)
      .get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Listing)
      .filter((l) => l.status !== "archived");
  } catch (error) {
    console.error("[my-listings] read failed:", error);
    return null;
  }
}
