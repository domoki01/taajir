"use server";

// ── ANNOUNCEMENTS ────────────────────────────────────────────────────────────
// The one action on the site that speaks to everybody at once. It is behind its
// own permission rather than folded into `users.manage`: sending a notification
// to every phone that ever installed the site is a different kind of power from
// editing an account, and it should be grantable — and withholdable — on its
// own.

import { adminDb } from "@/lib/firebase/admin";
import { actorWith, kForbidden } from "@/server/auth";
import { sendBroadcast } from "@/server/broadcast";
import { safeNext } from "@/lib/redirect";

export type BroadcastActionResult =
  | { ok: true; sent: number; failed: number; users: number }
  | { ok: false; error: string };

const kTitle = { min: 4, max: 60 };
const kBody = { min: 4, max: 160 };
/** Past this the screen stops waiting and says it does not know. */
const kSendTimeoutMs = 25_000;

export async function broadcastToEveryone(
  title: string,
  body: string,
  url: string,
): Promise<BroadcastActionResult> {
  const admin = await actorWith("push.broadcast");
  if (!admin) return { ok: false, error: kForbidden };

  const heading = title.trim();
  if (heading.length < kTitle.min || heading.length > kTitle.max) {
    return {
      ok: false,
      error: `العنوان لازم بين ${kTitle.min} و${kTitle.max} حرف`,
    };
  }

  const text = body.trim();
  if (text.length < kBody.min || text.length > kBody.max) {
    // Android and iOS both cut a notification around two lines; anything past
    // that is written for nobody.
    return {
      ok: false,
      error: `النصّ لازم بين ${kBody.min} و${kBody.max} حرف`,
    };
  }

  // Same rule as the sign-in redirect: an internal path only. A notification is
  // the most trusted surface the site has — it arrives wearing the site's name
  // and icon on a lock screen — and it must not be able to carry anyone off it.
  const target = safeNext(url.trim() || "/", "/");

  let result;
  try {
    // Bounded. FCM is normally quick, but the SDK retries a long time when it
    // cannot reach the service, and an admin left watching "راه يبعث…" forever
    // on the one action with no undo is the worst place on the site to hang.
    // The send is not cancelled by the timeout — nothing can recall a push in
    // flight — so the message below says exactly that rather than inviting a
    // second attempt that would double-send.
    result = await Promise.race([
      sendBroadcast({ title: heading, body: text, url: target }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), kSendTimeoutMs),
      ),
    ]);
  } catch (error) {
    const timedOut = (error as Error).message === "TIMEOUT";
    console.error("[broadcast] send failed:", error);

    if (timedOut) {
      await adminDb()
        .collection("broadcasts")
        .add({
          title: heading,
          body: text,
          url: target,
          sentBy: admin.uid,
          sentAt: Date.now(),
          sent: 0,
          failed: 0,
          users: 0,
          pruned: 0,
          timedOut: true,
        })
        .catch(() => {});
      return {
        ok: false,
        error:
          "الإرسال طوّل بزاف وما عرفناش واش وصل. تراجع الإشعارات على هاتفك قبل ما تعاود — تقدر يكون تبعث.",
      };
    }
    return { ok: false, error: "ما نجحش الإرسال. عاود من بعد." };
  }

  // Recorded before anything is reported back: an announcement that went to
  // thousands of phones and left no trace of who sent it, when, or what it
  // said is not something to discover from a screenshot later.
  await adminDb()
    .collection("broadcasts")
    .add({
      title: heading,
      body: text,
      url: target,
      sentBy: admin.uid,
      sentAt: Date.now(),
      ...result,
    })
    .catch((error) => console.error("[broadcast] record failed:", error));

  await adminDb()
    .collection("adminAudit")
    .add({
      actorUid: admin.uid,
      action: "broadcast",
      targetType: "push",
      targetId: "all",
      note: `${heading} — ${result.sent}/${result.sent + result.failed}`,
      at: Date.now(),
    })
    .catch(() => {});

  return {
    ok: true,
    sent: result.sent,
    failed: result.failed,
    users: result.users,
  };
}
