// ── FIREBASE WEB CONFIG ──────────────────────────────────────────────────────
// These values are PUBLIC project identifiers, not credentials. Firebase ships
// them inside every client bundle by design, and Google documents them as
// non-secret. What actually protects the data is firestore.rules and
// storage.rules — both version-controlled in this repo, which is the gap the
// sibling catalogev project never closed.
//
// They are committed as defaults so a fresh clone builds and runs with no
// setup, and overridable by env vars so the project can be pointed at a
// different Firebase project (a staging one, say) without touching code.

export const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyCbOzPZiJu2khbC1HZMpz--nTPeN0NmXjI",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "newmokit.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "newmokit",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "newmokit.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "224868230062",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:224868230062:web:c43e0c67d18581aed9de3f",
} as const;

/** Firestore prefers a region close to the traffic; DZ routes via Europe. */
export const kFirestoreRegion = "europe-west1";

export const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
