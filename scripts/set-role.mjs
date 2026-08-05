// ── ROLE GRANT ───────────────────────────────────────────────────────────────
// Bootstraps the first admin, and the only supported way to change a role.
//
//   node scripts/set-role.mjs someone@example.com admin
//   node scripts/set-role.mjs someone@example.com user
//
// The role is written to the custom claim AND mirrored onto users/{uid}. The
// claim is the authority — security rules read it for free out of the token,
// where a users/ lookup would cost a billable read on every rule evaluation.
// The mirrored field exists only so admin screens can list roles.

import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const [email, role] = process.argv.slice(2);
const kRoles = ["user", "agency", "moderator", "admin"];

if (!email || !kRoles.includes(role)) {
  console.error(
    `usage: node scripts/set-role.mjs <email> <${kRoles.join("|")}>`,
  );
  process.exit(1);
}

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw) {
  console.error("FIREBASE_SERVICE_ACCOUNT_JSON is not set.");
  process.exit(1);
}
const json = raw.trim().startsWith("{")
  ? raw
  : Buffer.from(raw, "base64").toString("utf8");

initializeApp({
  credential: cert(JSON.parse(json)),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "newmokit",
});

const user = await getAuth().getUserByEmail(email);
await getAuth().setCustomUserClaims(user.uid, { role });

// Without this the change waits for the current token to expire — up to an
// hour of someone still holding a role they no longer have.
await getAuth().revokeRefreshTokens(user.uid);

await getFirestore()
  .collection("users")
  .doc(user.uid)
  .set({ role, updatedAt: Date.now() }, { merge: true });

console.log(`> ${email} (${user.uid}) is now "${role}"`);
console.log("> their existing sessions are revoked; they must sign in again");
process.exit(0);
