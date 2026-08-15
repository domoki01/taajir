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
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { firebaseConfig, useEmulators } from "./config";

// Next's fast refresh re-runs modules, so guard against a duplicate app.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Auth with an explicit persistence fallback chain.
 *
 * `getAuth()` leads with IndexedDB and does not recover when the browser hands
 * back a handle it then closes — Android Chrome does exactly that in private
 * mode and under storage pressure. It surfaced as "Database is closing/hidden"
 * thrown from `confirm()` *after* the SMS code had already been verified with
 * the server: the sign-in had succeeded and the only thing that failed was
 * writing it to disk. Listing localStorage and sessionStorage behind IndexedDB
 * means that case now degrades instead of failing.
 *
 * `inMemoryPersistence` is last and is not a disaster here: the ID token is
 * traded for an httpOnly session cookie by /api/auth/session immediately after
 * sign-in, and every page reads that cookie — the client-side handle only has
 * to survive the few milliseconds between the two.
 */
function createAuth(): Auth {
  // Client components are evaluated on the server during SSR too, where none of
  // the browser persistences exist.
  if (typeof window === "undefined") return getAuth(app);

  try {
    return initializeAuth(app, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
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
