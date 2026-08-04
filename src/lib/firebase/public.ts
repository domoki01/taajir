// ── PUBLIC FIRESTORE READS ───────────────────────────────────────────────────
// Deliberately NOT the "use client" module next door, and deliberately not the
// Admin SDK either.
//
// Public listing pages are rendered on the server, so they need a Firestore
// handle that works in Node. The Admin SDK would do it, but it needs a service
// account and it bypasses security rules — neither of which a page showing
// published ads to anonymous visitors should require. The regular SDK runs fine
// server-side and is subject to the same rules an anonymous browser gets, so
// `status == 'published'` is enforced by firestore.rules rather than by
// remembering to add a where() clause on every query.

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { firebaseConfig, useEmulators } from "./config";

const kAppName = "taajir-public";

function publicApp() {
  const existing = getApps().find((a) => a.name === kAppName);
  return existing ?? initializeApp(firebaseConfig, kAppName);
}

let connected = false;

export function publicDb() {
  const db = getFirestore(publicApp());
  if (useEmulators && !connected) {
    connected = true;
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  return db;
}

export { getApp };
