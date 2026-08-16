// ── WEB PUSH (FCM) ───────────────────────────────────────────────────────────
// The browser half of saved-search alerts. Everything here is best-effort by
// design: push is unavailable on iOS Safari outside an installed PWA, blocked
// by default in several browsers, and switched off entirely without a VAPID
// key. None of those are errors — they are states the UI has to be able to
// explain, so each returns a reason in Arabic rather than throwing.

"use client";

import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { app } from "./client";
import { kVapidPublicKey } from "./config";
import { registerDevice, unregisterDevice } from "@/server/actions/devices";

/**
 * The public half of the Web Push key pair, generated once in
 * Firebase Console → Project settings → Cloud Messaging → Web Push certificates.
 *
 * There is no API that mints it, so it cannot be provisioned by a script. It
 * now ships with the build; the empty-string path below stays because a fork
 * pointed at another Firebase project has to be told, in Arabic, that push is
 * off rather than failing with the SDK's "applicationServerKey is not valid".
 */
const kVapidKey = kVapidPublicKey;

export const isPushConfigured = kVapidKey.length > 0;

export type PushState =
  "unsupported" | "unconfigured" | "denied" | "default" | "granted";

/**
 * What the current browser can do, without asking for anything. Requesting
 * permission is a one-shot: a browser that has been asked and refused can never
 * be asked again from script, so the UI must know the state before it offers
 * the button.
 */
export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return "unsupported";
  }
  // Covers the cases the feature-detects above miss — notably iOS Safari, which
  // exposes Notification but has no push until the site is added to the home
  // screen.
  if (!(await isSupported().catch(() => false))) return "unsupported";
  if (!isPushConfigured) return "unconfigured";
  return Notification.permission as PushState;
}

export type EnableResult = { ok: true } | { ok: false; error: string };

/**
 * Ask for permission, mint a registration token, and hand it to the server.
 *
 * The service worker is registered explicitly rather than left to the SDK's
 * convention lookup: an explicit registration is awaited to `activated`, so
 * getToken() cannot race a worker that is still installing — which is what the
 * "no active Service Worker" failure on a first visit actually is.
 */
export async function enablePush(): Promise<EnableResult> {
  const state = await pushState();
  if (state === "unsupported") {
    return { ok: false, error: "المتصفّح تاعك ما يدعمش التنبيهات." };
  }
  if (state === "unconfigured") {
    return { ok: false, error: "التنبيهات ما زالت ما تفعّلتش على الموقع." };
  }
  if (state === "denied") {
    return {
      ok: false,
      error: "منعت التنبيهات فهذا المتصفّح. رجّعها من إعدادات الموقع.",
    };
  }

  const permission =
    state === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "ما سمحتش بالتنبيهات." };
  }

  try {
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" },
    );
    await navigator.serviceWorker.ready;

    const token = await getToken(getMessaging(app), {
      vapidKey: kVapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { ok: false, error: "ما نجّمناش نجيبو رمز الجهاز." };

    return await registerDevice(token, navigator.userAgent);
  } catch (error) {
    console.error("[push] enable failed:", error);
    return { ok: false, error: "ما نجّمناش نفعّلو التنبيهات. عاود من بعد." };
  }
}

/**
 * Detach this browser from the account. The OS-level permission stays granted —
 * only a person can revoke that — so the honest thing to remove is the token,
 * which is what the server actually sends to.
 */
export async function disablePush(): Promise<EnableResult> {
  try {
    const registration = await navigator.serviceWorker.getRegistration(
      "/firebase-messaging-sw.js",
    );
    const token = await getToken(getMessaging(app), {
      vapidKey: kVapidKey,
      serviceWorkerRegistration: registration ?? undefined,
    }).catch(() => "");
    if (token) await unregisterDevice(token);
    return { ok: true };
  } catch (error) {
    console.error("[push] disable failed:", error);
    return { ok: false, error: "ما نجّمناش نوقّفو التنبيهات." };
  }
}
