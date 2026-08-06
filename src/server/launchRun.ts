import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { kLaunchSettingsPath } from "@/server/launch";
import { notifyLaunch } from "@/server/launchNotify";
import type { LaunchState } from "@/types/launch";

// ── THE LAUNCH ITSELF ────────────────────────────────────────────────────────
// Deliberately NOT in a "use server" module. Every export of one of those is a
// callable endpoint, so an unguarded `executeLaunchUnattended` sitting beside
// the guarded action would hand anyone with a browser console the power to open
// the site. The authorisation lives with each caller — the admin session in the
// Server Action, the shared secret in the cron route — and the work lives here.

export type LaunchOutcome = {
  published: number;
  requeued: number;
  requests: number;
  notified: number;
};

/**
 * Open the site.
 *
 * Order matters and is not arbitrary: content is published first, then the
 * state flips, then people are told. Announcing before the ads are public sends
 * a thousand people to a page that still says "coming soon"; flipping the state
 * before publishing shows an empty catalogue to whoever arrives first.
 */
export async function runLaunch(actorUid: string): Promise<LaunchOutcome> {
  const db = adminDb();
  const now = Date.now();

  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  // 1. Approved listings go live. Everything else that was held falls into the
  //    ordinary review queue — never published unreviewed, and never lost.
  const held = await db
    .collection("listings")
    .where("status", "==", "pendingLaunch")
    .limit(2000)
    .get();

  let published = 0;
  let requeued = 0;
  for (const doc of held.docs) {
    const approved = doc.data().approvedForLaunch === true;
    batch.update(doc.ref, {
      status: approved ? "published" : "pending",
      publishedAt: approved ? (doc.data().publishedAt ?? now) : null,
      updatedAt: now,
    });
    if (approved) published++;
    else requeued++;
    ops++;
    if (ops >= 400) await flush();
  }
  await flush();

  // 2. Held demands. No approval gate on those — a request is text, and the
  //    link ban already covers what is worth banning.
  const requestDocs = await db
    .collection("requests")
    .where("status", "==", "pendingLaunch")
    .limit(2000)
    .get();

  let requests = 0;
  for (const doc of requestDocs.docs) {
    batch.update(doc.ref, { status: "visible" });
    requests++;
    ops++;
    if (ops >= 400) await flush();
  }
  await flush();

  // 3. Open the doors.
  await db.doc(kLaunchSettingsPath).set(
    {
      state: "active" as LaunchState,
      launchAt: null,
      launchedAt: now,
      updatedAt: now,
      updatedBy: actorUid,
    },
    { merge: false },
  );

  // 4. Tell everyone. Swallows its own failures — the site is already open, and
  //    a notification that did not send is a row to retry, not a rollback.
  const fan = await notifyLaunch();

  await db
    .collection("adminAudit")
    .add({
      actorUid,
      action: "launch:execute",
      targetType: "settings",
      targetId: "launch",
      note: `نُشر ${published}، للمراجعة ${requeued}، طلبات ${requests}، إشعارات ${fan.users}`,
      at: now,
    })
    .catch(() => {});

  return { published, requeued, requests, notified: fan.users };
}
