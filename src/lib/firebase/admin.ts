// ── FIREBASE ADMIN SDK ───────────────────────────────────────────────────────
// Server-side Firebase. The Admin SDK bypasses security rules entirely, which
// is exactly why every privileged operation is funnelled through it inside a
// Server Action: listing creation with a quota check, moderation, promotion
// flags, subscription activation. Rules can then simply deny all client writes
// to `listings` instead of trying to whitelist individual fields.
//
// Never import this from a Client Component. The `server-only` marker turns
// that mistake into a build error rather than a leaked service account.

import "server-only";

import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { firebaseConfig } from "./config";

const kAppName = "taajir-admin";

/**
 * In production this returns nothing on purpose.
 *
 * App Hosting runs the app on Cloud Run with a service account already
 * attached, so firebase-admin picks up Application Default Credentials by
 * itself. Shipping a service-account key as a secret would add a credential to
 * rotate, a Secret Manager dependency and a way to leak — for no capability the
 * runtime does not already have.
 *
 * The env var exists for the places ADC is absent: a local machine and the
 * seed script.
 */
function credentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return undefined;

  // Accept raw JSON or base64 — one-line JSON is awkward to paste into a
  // dashboard, and shells eat the quotes when a .env file is sourced.
  const json = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");

  try {
    return cert(JSON.parse(json));
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON (or base64 of it).",
    );
  }
}

function adminApp(): App {
  const existing = getApps().find((a) => a.name === kAppName);
  if (existing) return existing;

  const credential = credentials();
  return initializeApp(
    {
      // Omitting `credential` entirely lets the SDK fall back to Application
      // Default Credentials; passing `undefined` explicitly does not.
      ...(credential ? { credential } : {}),
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
    },
    kAppName,
  );
}

// Lazy accessors rather than module-level singletons: importing this file must
// not throw at build time on a machine that has no service account, or
// `next build` fails before it renders a single public page.
export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());
export const adminStorage = () => getStorage(adminApp());

export { getApp as getAdminApp };
