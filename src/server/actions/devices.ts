"use server";

// ── PUSH DEVICES ─────────────────────────────────────────────────────────────
// One document per browser that agreed to receive notifications, keyed by its
// FCM registration token. Written server-side so a token can only ever be
// attached to the session that presented it — a client-writable version would
// let anyone point someone else's account at their own device.

import { createHash } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser } from "@/server/auth";

export type DeviceResult = { ok: true } | { ok: false; error: string };

/**
 * The document id is a hash of the token, not the token itself: FCM tokens run
 * past 160 characters and Firestore caps a document id at 1500 bytes of UTF-8,
 * but more usefully the hash is a fixed length so re-registering the same
 * browser overwrites rather than accumulating.
 */
const idFor = (token: string) =>
  createHash("sha256").update(token).digest("hex").slice(0, 40);

export async function registerDevice(
  token: string,
  userAgent = "",
): Promise<DeviceResult> {
  const user = await requireUser("/tableau-de-bord/alertes");
  const trimmed = token.trim();
  if (trimmed.length < 20) return { ok: false, error: "رمز الجهاز ماشي صحيح" };

  await adminDb()
    .collection("users")
    .doc(user.uid)
    .collection("devices")
    .doc(idFor(trimmed))
    .set(
      {
        token: trimmed,
        userAgent: userAgent.slice(0, 200),
        updatedAt: Date.now(),
      },
      { merge: true },
    );

  return { ok: true };
}

export async function unregisterDevice(token: string): Promise<DeviceResult> {
  const user = await requireUser("/tableau-de-bord/alertes");
  await adminDb()
    .collection("users")
    .doc(user.uid)
    .collection("devices")
    .doc(idFor(token.trim()))
    .delete();
  return { ok: true };
}
