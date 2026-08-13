import type { Metadata } from "next";
import { requirePermission } from "@/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { ModerationCard } from "@/components/admin/ModerationCard";
import { HoldApproval } from "@/components/admin/HoldApproval";
import { EmptyState } from "@/components/ui/EmptyState";
import { getLaunchStatus } from "@/server/launch";
import { getTaxonomy } from "@/server/filterSettings";
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
async function byStatus(status: string): Promise<Listing[] | null> {
  try {
    const snap = await adminDb()
      .collection("listings")
      .where("status", "==", status)
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
  await requirePermission("listings.moderate", "/admin/moderation");

  const taxonomy = await getTaxonomy();
  const labels = {
    deals: taxonomy.transactionTypes,
    types: taxonomy.propertyTypes,
  };

  const [listings, held, launch] = await Promise.all([
    byStatus("pending"),
    byStatus("pendingLaunch"),
    getLaunchStatus(),
  ]);

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

      {/* ── HELD FOR LAUNCH ──────────────────────────────────────────────────
          Its own section rather than a mixed list: the buttons mean different
          things. "وافق" here would publish onto a site nobody can see and drop
          the ad out of the launch batch. */}
      {held !== null && held.length > 0 && (
        <section className="mt-6">
          <h2 className="font-extrabold">
            محجوز للإطلاق{" "}
            <span className="text-dim ltr-nums text-sm">{held.length}</span>
          </h2>
          <p className="text-dim mt-1 text-xs leading-relaxed">
            {launch.state === "prelaunch"
              ? "اعتمد اللي يستاهل — المعتمد ينشر تلقائياً كي تضغط «نفّذ الإطلاق»، وغير المعتمد يرجع لهذا الطابور."
              : "الموقع راه مفتوح لكن هذي بقات محجوزة. اعتمدها ونفّذ الإطلاق مرّة أخرى، ولا راجعها عادي."}
          </p>

          <ul className="mt-4 space-y-4">
            {held.map((listing) => (
              <ModerationCard
                key={listing.id}
                listing={listing}
                labels={labels}
              >
                <HoldApproval
                  id={listing.id}
                  approved={listing.approvedForLaunch === true}
                />
              </ModerationCard>
            ))}
          </ul>
        </section>
      )}

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
              <ModerationCard
                key={listing.id}
                listing={listing}
                labels={labels}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
