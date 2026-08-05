import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase/admin";
import { ModerationCard } from "@/components/admin/ModerationCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Listing } from "@/types/listing";

export const metadata: Metadata = {
  title: "طابور المراجعة",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Oldest first, deliberately. A moderation queue sorted newest-first starves
 * its tail: the ad nobody got to is the one that waits forever, and the seller
 * who waited longest is the one most likely to give up on the platform.
 */
async function pendingListings(): Promise<Listing[] | null> {
  try {
    const snap = await adminDb()
      .collection("listings")
      .where("status", "==", "pending")
      .orderBy("createdAt", "asc")
      .limit(50)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Listing);
  } catch (error) {
    console.error("[moderation] read failed:", error);
    return null;
  }
}

export default async function ModerationPage() {
  const listings = await pendingListings();

  return (
    <div>
      <h1 className="text-2xl font-black">طابور المراجعة</h1>
      <p className="text-muted mt-1 text-sm font-semibold">
        {listings === null
          ? "—"
          : listings.length === 0
            ? "ما كاش إعلانات تستنى"
            : `${listings.length} إعلان يستنى المراجعة`}
      </p>

      <div className="mt-6">
        {listings === null ? (
          <EmptyState
            title="ما قدرناش نجيبو الطابور"
            body="وقع مشكل مؤقت. عاود تحميل الصفحة."
          />
        ) : listings.length === 0 ? (
          <EmptyState
            title="كل شيء مراجَع"
            body="ما بقاش إعلان يستنى. الإعلانات الجديدة تبان هنا مباشرة."
          />
        ) : (
          <ul className="space-y-4">
            {listings.map((listing) => (
              <ModerationCard key={listing.id} listing={listing} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
