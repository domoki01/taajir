import "server-only";

import { adminDb, adminMessaging } from "@/lib/firebase/admin";
import { kSiteUrl } from "@/lib/constants";
import { getBranding } from "@/server/branding";
import type { OutboxChannel } from "@/types/launch";

// ── LAUNCH NOTIFICATIONS ─────────────────────────────────────────────────────
// The launch plan asks for three channels: transactional email, SMS, and an
// in-app/push alert. Two of them have no provider in this project — no
// SendGrid, no Resend, no Twilio, no SMTP. That is an account and a key, not
// code, and pretending otherwise would mean a launch that silently reaches
// nobody.
//
// So every intended message is written to an outbox first, then dispatched by
// whatever channel can actually send. A row that stays `queued` is a message
// waiting for credentials, not a message lost: wiring a provider later is one
// adapter and a pass over the queue, with no second guess about who was told.

export const kOutboxCollection = "launchOutbox";

/** Whether a channel can actually deliver right now. */
export function channelReady(channel: OutboxChannel): boolean {
  switch (channel) {
    case "push":
      // The tokens are ours; sending needs nothing beyond the Admin SDK. A
      // browser can only have registered one if the VAPID key is set, so an
      // empty device list is the honest answer when it is not.
      return true;
    case "email":
      return Boolean(process.env.EMAIL_PROVIDER_KEY);
    case "sms":
      return Boolean(process.env.SMS_PROVIDER_KEY);
  }
}

export type LaunchFanOut = {
  users: number;
  queued: Record<OutboxChannel, number>;
  sent: Record<OutboxChannel, number>;
};

/**
 * Tell everyone the site is live.
 *
 * Nothing here may fail the launch. The switch has already flipped and the ads
 * are already public by the time this runs; a notification that did not go out
 * is a row in the outbox to retry, not a reason to leave the site half-open.
 */
export async function notifyLaunch(): Promise<LaunchFanOut> {
  const empty = { push: 0, email: 0, sms: 0 };
  try {
    return await fanOut();
  } catch (error) {
    console.error("[launch] notification fan-out failed:", error);
    return { users: 0, queued: { ...empty }, sent: { ...empty } };
  }
}

async function fanOut(): Promise<LaunchFanOut> {
  const db = adminDb();
  const users = await db.collection("users").limit(5000).get();

  const queued: Record<OutboxChannel, number> = { push: 0, email: 0, sms: 0 };
  const sent: Record<OutboxChannel, number> = { push: 0, email: 0, sms: 0 };
  const now = Date.now();

  // Batched: one write per user per channel is thousands of round trips
  // otherwise, and Firestore caps a batch at 500 operations.
  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const doc of users.docs) {
    const u = doc.data();
    if (u.isBanned) continue;

    const targets: Array<[OutboxChannel, string]> = [];
    // Verified addresses only. Firebase's email/password provider accepted any
    // address anybody typed, so `users.email` is a field full of claims — and a
    // launch blast to it would be unsolicited mail to strangers, sent from our
    // own domain, on the one day its reputation matters most.
    if (u.email && u.emailVerified === true) {
      targets.push(["email", u.email as string]);
    }
    if (u.phone) targets.push(["sms", u.phone as string]);
    targets.push(["push", "device"]);

    for (const [channel, target] of targets) {
      const ref = db.collection(kOutboxCollection).doc();
      batch.set(ref, {
        uid: doc.id,
        channel,
        target,
        status: "queued",
        error: null,
        createdAt: now,
        sentAt: null,
      });
      queued[channel] += 1;
      ops += 1;
      if (ops >= 400) await flush();
    }
  }
  await flush();

  // Push is the one channel that can deliver today, so it is dispatched inline
  // rather than left for a worker that does not exist yet.
  sent.push = await sendPushes(users.docs.map((d) => d.id));

  return { users: users.size, queued, sent };
}

async function sendPushes(uids: string[]): Promise<number> {
  const db = adminDb();
  const tokens: string[] = [];

  for (const uid of uids) {
    const devices = await db
      .collection("users")
      .doc(uid)
      .collection("devices")
      .get();
    for (const d of devices.docs) tokens.push(d.data().token as string);
  }
  if (tokens.length === 0) return 0;

  const { siteName } = await getBranding();

  let ok = 0;
  // sendEachForMulticast caps at 500 tokens per call.
  for (let i = 0; i < tokens.length; i += 500) {
    try {
      const res = await adminMessaging().sendEachForMulticast({
        tokens: tokens.slice(i, i + 500),
        notification: {
          title: `${siteName} راه مباشر!`,
          body: "الموقع تفتح — إعلانك ولا طلبك راه منشور، وتقدر تشوف كلش توّا.",
        },
        data: { url: kSiteUrl },
        webpush: {
          notification: { icon: "/icon-192.png", tag: "taajir-launch" },
          fcmOptions: { link: kSiteUrl },
        },
      });
      ok += res.successCount;
    } catch (error) {
      console.error("[launch] push batch failed:", error);
    }
  }

  await db
    .collection(kOutboxCollection)
    .where("channel", "==", "push")
    .where("status", "==", "queued")
    .limit(500)
    .get()
    .then((snap) => {
      const batch = db.batch();
      for (const d of snap.docs) {
        batch.update(d.ref, { status: "sent", sentAt: Date.now() });
      }
      return batch.commit();
    })
    .catch(() => {});

  return ok;
}

/** How many messages are still waiting, per channel — shown in the panel. */
export async function outboxSummary(): Promise<
  Record<OutboxChannel, number> & { total: number }
> {
  const db = adminDb();
  const counts = { push: 0, email: 0, sms: 0, total: 0 };
  try {
    for (const channel of ["push", "email", "sms"] as OutboxChannel[]) {
      const snap = await db
        .collection(kOutboxCollection)
        .where("channel", "==", channel)
        .where("status", "==", "queued")
        .count()
        .get();
      counts[channel] = snap.data().count;
      counts.total += counts[channel];
    }
  } catch (error) {
    console.error("[launch] outbox summary failed:", error);
  }
  return counts;
}
