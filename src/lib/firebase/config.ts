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
    "AIzaSyAKonS-qRWyhWOi_sK7chdOf14SiQklTz4",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "newmokit.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "newmokit",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "newmokit.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "224868230062",
  // This must match a web app that actually exists in the project. The value
  // here was `…c43e0c67d18581aed9de3f`, which does not — the project's only web
  // app is `…8f2342346aa6ca0bd9de3f` ("Taajir"). Auth and Firestore never
  // noticed, because they key off apiKey and projectId; App Check does notice,
  // because a token is minted *per app*, so a wrong id makes every App Check
  // exchange fail no matter how the provider is configured.
  // Paired with the appId below: both come from the "Taajir" web app's own
  // config. The key shipped here before belonged to a different app in the
  // project — it worked, because a browser key is project-scoped for Auth and
  // Firestore, but FCM registration and Analytics key off the *pair*, and push
  // is about to depend on it.
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:224868230062:web:8f2342346aa6ca0bd9de3f",
} as const;

/**
 * The reCAPTCHA Enterprise site key App Check attests with.
 *
 * Public by design — it ships in the bundle and is bound to the domains listed
 * on the key itself, which is what stops it being reused elsewhere. The secret
 * half lives in Google Cloud and never reaches a browser.
 */
/**
 * The App Check site key — configured, never guessed.
 *
 * There used to be a hard-coded fallback here, and it named a reCAPTCHA key
 * that does not exist in this project. That is worse than having no key at
 * all: App Check loads the reCAPTCHA Enterprise script with whatever it is
 * given, so every page view was starting Google's script against a site key it
 * would refuse — and phone sign-in drives the same script through the same
 * global. Attestation cannot succeed with a key from another project, so the
 * fallback bought nothing and could only interfere.
 *
 * Empty means App Check simply does not start. Enforcement is off for every
 * service in this project, so that costs nothing today, and a key that is
 * actually correct can be set without a code change.
 */
export const kAppCheckSiteKey =
  process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_KEY ?? "";

/** Firestore prefers a region close to the traffic; DZ routes via Europe. */
export const kFirestoreRegion = "europe-west1";

export const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

/**
 * The public half of the Web Push key pair.
 *
 * Public by definition: the browser hands it to the push service on every
 * subscription, so it ships in the bundle like the rest of this file. The
 * private half never leaves Google. There is no API that mints these — it is
 * generated once in Firebase Console → Project settings → Cloud Messaging.
 */
export const kVapidPublicKey =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ??
  "BOqNOe2WiEjFxLpRAueeyj25gIqKo0ggdc1TjOtOjHs27IKGcPbchP-L000L-ZXKzjhPWRYXf0JoqYA2jAlLcw4";
