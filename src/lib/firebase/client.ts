// ── FIREBASE CLIENT SDK ──────────────────────────────────────────────────────
// Browser-side Firebase: sign-in, realtime message threads, favourites.
// Listing reads for public pages go through the Admin SDK on the server
// instead, so the HTML search engines see is fully rendered.

"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { firebaseConfig, useEmulators } from "./config";

// Next's fast refresh re-runs modules, so guard against a duplicate app.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
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
