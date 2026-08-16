import "server-only";

import { adminDb, adminMessaging } from "@/lib/firebase/admin";

/**
 * One notice to everybody who agreed to receive notices.
 *
 * The existing push paths are per-user: an alert about a listing someone asked
 * to be told about, or the outcome of their own post. This is the other kind —
 * the site talking to its whole audience at once — and it needs different care
 * in exactly two places.
 *
 * **Consent.** `notifyAuthor` deliberately ignores the profile switch because a
 * moderation decision is transactional. A broadcast is the opposite: it is the
 * marketing-shaped message that switch exists for, so it is honoured here. A
 * banned account is skipped too — nothing the site announces is for them.
 *
 * **Reach.** Tokens are collected with a collection-group query over every
 * user's `devices` subcollection, which is the only way to see them all without
 * walking the user list. FCM takes 500 tokens per call, so the send is chunked;
 * a partial failure inside a chunk is reported per token and never aborts the
 * rest.
 */
export type BroadcastMessage = { title: string; body: string; url: string };

export type BroadcastResult = {
  /** Devices FCM accepted. */
  sent: number;
  /** Devices it refused — mostly tokens that have since died. */
  failed: number;
  /** Accounts the message was addressed to, after consent and bans. */
  users: number;
  /** Dead tokens removed while sending, so the next broadcast is cheaper. */
  pruned: number;
};

/** How many devices a broadcast would reach right now. */
export async function countRecipients(): Promise<{
  users: number;
  devices: number;
}> {
  const targets = await recipients();
  return {
    users: new Set(targets.map((t) => t.uid)).size,
    devices: targets.length,
  };
}

type Target = {
  uid: string;
  token: string;
  ref: FirebaseFirestore.DocumentReference;
};

async function recipients(): Promise<Target[]> {
  const db = adminDb();
  const devices = await db.collectionGroup("devices").get();
  if (devices.empty) return [];

  // One read per account that owns a device, not per device: several browsers
  // on one account are common and would otherwise be several identical reads.
  const uids = [
    ...new Set(
      devices.docs
        .map((d) => d.ref.parent.parent?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const allowed = new Set<string>();
  // getAll takes a bounded number of refs at a time; 200 is comfortably inside
  // any limit and keeps the round trips few.
  for (let i = 0; i < uids.length; i += 200) {
    const chunk = uids.slice(i, i + 200);
    const snaps = await db.getAll(
      ...chunk.map((uid) => db.collection("users").doc(uid)),
    );
    for (const snap of snaps) {
      const data = snap.data();
      if (!data) continue;
      if (data.isBanned === true) continue;
      if (data.notifyOnSavedSearch === false) continue;
      allowed.add(snap.id);
    }
  }

  return devices.docs
    .map((d) => ({
      uid: d.ref.parent.parent?.id ?? "",
      token: (d.data().token as string) ?? "",
      ref: d.ref,
    }))
    .filter((t) => t.token && allowed.has(t.uid));
}

export async function sendBroadcast(
  message: BroadcastMessage,
): Promise<BroadcastResult> {
  const targets = await recipients();
  if (targets.length === 0) {
    return { sent: 0, failed: 0, users: 0, pruned: 0 };
  }

  let sent = 0;
  let failed = 0;
  let pruned = 0;

  for (let i = 0; i < targets.length; i += 500) {
    const chunk = targets.slice(i, i + 500);
    const res = await adminMessaging().sendEachForMulticast({
      tokens: chunk.map((t) => t.token),
      notification: { title: message.title, body: message.body },
      // The click target rides in `data` as well: the service worker reads it
      // from there, not from `notification`.
      data: { url: message.url },
      webpush: {
        notification: { icon: "/icon-192.png", tag: "taajir-news" },
        fcmOptions: { link: message.url },
      },
    });

    sent += res.successCount;
    failed += res.failureCount;

    // A token dies when permission is revoked or storage is cleared, and FCM
    // only says so on the next send. Left in place, every future broadcast pays
    // for them again.
    await Promise.all(
      res.responses.map(async (r, index) => {
        const code = r.error?.code ?? "";
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-argument"
        ) {
          await chunk[index].ref.delete().catch(() => {});
          pruned++;
        }
      }),
    );
  }

  return {
    sent,
    failed,
    users: new Set(targets.map((t) => t.uid)).size,
    pruned,
  };
}
