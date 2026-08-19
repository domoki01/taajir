// ── FIREBASE CLIENT SDK ──────────────────────────────────────────────────────
// Browser-side Firebase: sign-in, realtime message threads, favourites.
// Listing reads for public pages go through the Admin SDK on the server
// instead, so the HTML search engines see is fully rendered.

"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { firebaseConfig, kAppCheckSiteKey, useEmulators } from "./config";

// Next's fast refresh re-runs modules, so guard against a duplicate app.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * App Check: proves the request came from this site, not from a script holding
 * the public config.
 *
 * In the browser only, and before anything else touches Auth, Firestore or
 * Storage — the token has to be attachable to the first call, and there is no
 * browser here during SSR to attest with anyway. That asymmetry is also why
 * App Check enforcement cannot be turned on for Firestore: this app's public
 * reads run through the *client* SDK on the server (so security rules apply to
 * them), and a server has no reCAPTCHA to attest with.
 *
 * Failures are swallowed on purpose. While enforcement is off, a failed
 * attestation costs nothing; turning a misconfigured key into a blank site
 * would cost everything.
 */
function startAppCheck() {
  if (typeof window === "undefined") return;
  // The emulators ignore App Check entirely, and attesting against a real
  // reCAPTCHA key from localhost only produces noise in the console.
  if (useEmulators) return;

  // No key configured, nothing to attest with. Starting Google's script with a
  // key this project does not own is not a degraded App Check — it is a broken
  // reCAPTCHA on every page, shared with the one phone sign-in needs.
  if (!kAppCheckSiteKey) return;

  const w = window as typeof window & { __taajirAppCheck?: boolean };
  if (w.__taajirAppCheck) return; // Fast refresh runs this module again.
  w.__taajirAppCheck = true;

  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(kAppCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    console.error("[app-check] initialisation failed:", error);
  }
}

startAppCheck();

/**
 * Auth persisted to localStorage, with IndexedDB deliberately not first.
 *
 * `getAuth()` leads with IndexedDB, and the fallback list below is only
 * consulted at *initialisation*, when Firebase asks each store "are you
 * available?". Brave — and Chrome in private mode, and any browser under
 * storage pressure — answers yes for IndexedDB and then closes the handle
 * during the actual write. The failure therefore lands at runtime, long past
 * the point where the fallback chain could have chosen differently: it
 * surfaced as "Database is closing/hidden" thrown out of `confirm()` *after*
 * the SMS code had already been verified with the server. The sign-in had
 * succeeded; only writing it to disk failed.
 *
 * localStorage first is the fix, and costs nothing here. Firebase Auth used it
 * by default for years, it syncs across tabs through storage events the same
 * way, and this app does not lean on the client handle anyway: the ID token is
 * traded for an httpOnly session cookie by /api/auth/session immediately after
 * sign-in, and every page reads that cookie. IndexedDB stays in the list for
 * the rare browser where localStorage is the one that is blocked.
 */
function createAuth(): Auth {
  // Client components are evaluated on the server during SSR too, where none of
  // the browser persistences exist.
  if (typeof window === "undefined") return getAuth(app);

  try {
    return initializeAuth(app, {
      persistence: [
        browserLocalPersistence,
        indexedDBLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence,
      ],
      // Must be passed explicitly: initializeAuth does not install the resolver
      // getAuth() installs by default, and without it signInWithPopup — the
      // Google button — throws auth/argument-error.
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Fast refresh re-runs this module, and the second initializeAuth throws.
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);

if (useEmulators && typeof window !== "undefined") {
  // `connect*Emulator` throws if called twice on the same instance, which fast
  // refresh will happily do.
  const w = window as typeof window & { __taajirEmulators?: boolean };
  if (!w.__taajirEmulators) {
    w.__taajirEmulators = true;
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  }
}

export { app };
