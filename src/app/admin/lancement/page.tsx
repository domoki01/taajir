import type { Metadata } from "next";
import { Rocket } from "lucide-react";
import { LaunchPanel } from "@/components/admin/LaunchPanel";
import { requirePermission } from "@/server/auth";
import { getLaunchStatus } from "@/server/launch";
import { channelReady, outboxSummary } from "@/server/launchNotify";
import { adminDb } from "@/lib/firebase/admin";
import { formatFullDateTime } from "@/lib/datetime";
import type { OutboxChannel } from "@/types/launch";

export const metadata: Metadata = {
  title: "الإطلاق",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Counts, each wrapped: an empty panel beats a 500 on the launch screen. */
async function counts() {
  const db = adminDb();
  const safely = async (work: () => Promise<number>) => {
    try {
      return await work();
    } catch (error) {
      console.error("[launch] count failed:", error);
      return 0;
    }
  };

  const [heldListings, approvedListings, heldRequests, users] =
    await Promise.all([
      safely(
        async () =>
          (
            await db
              .collection("listings")
              .where("status", "==", "pendingLaunch")
              .count()
              .get()
          ).data().count,
      ),
      safely(
        async () =>
          (
            await db
              .collection("listings")
              .where("status", "==", "pendingLaunch")
              .where("approvedForLaunch", "==", true)
              .count()
              .get()
          ).data().count,
      ),
      safely(
        async () =>
          (
            await db
              .collection("requests")
              .where("status", "==", "pendingLaunch")
              .count()
              .get()
          ).data().count,
      ),
      safely(
        async () => (await db.collection("users").count().get()).data().count,
      ),
    ]);

  return { heldListings, approvedListings, heldRequests, users };
}

export default async function AdminLaunchPage() {
  // The layout already admits moderators. Deciding whether the public can see
  // the site at all is a different power from reviewing an ad, so this page
  // checks again — and so does every action behind it.
  await requirePermission("launch.control", "/admin/lancement");

  const [status, c, outbox] = await Promise.all([
    getLaunchStatus(),
    counts(),
    outboxSummary(),
  ]);

  const channelsReady = {
    push: channelReady("push"),
    email: channelReady("email"),
    sms: channelReady("sms"),
  } as Record<OutboxChannel, boolean>;

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-extrabold">
        <Rocket className="text-primary size-5" />
        إطلاق المنصّة
      </h1>
      <p className="text-muted mt-2 text-sm">
        غلق الموقع، العدّاد، مراجعة المحجوز، ومفتاح الفتح — كلّو من هنا.
      </p>

      <LaunchPanel
        // Keyed on the last write so a state change or a timer edit remounts
        // the panel: the datetime input lives in useState, which does not
        // re-initialise when router.refresh() delivers new props.
        key={status.updatedAt}
        status={status}
        counts={c}
        outbox={outbox}
        channelsReady={channelsReady}
        // Formatted here, in Africa/Algiers: doing it in the client component
        // renders UTC on the server and local time in the browser.
        launchAtLabel={
          status.launchAt ? formatFullDateTime(status.launchAt) : null
        }
      />
    </div>
  );
}
