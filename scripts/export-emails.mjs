// ── EMAIL EXPORT ─────────────────────────────────────────────────────────────
// The address list for a mail-out, as CSV on stdout:
//
//   node scripts/export-emails.mjs > emails.csv
//   node scripts/export-emails.mjs --all > everything.csv
//
// Verified addresses only, unless --all. That default is the whole point of the
// script rather than a nicety: Firebase's email/password provider accepted any
// address anybody typed, and this project's live site was mass-registered
// through Identity Toolkit's REST endpoint — 213 accounts in under an hour, on
// invented addresses. `users.email` is a field full of claims.
//
// Mailing those claims from a young domain is how a sending reputation dies:
// the invented ones hard-bounce, the provider reads the bounce rate as a list
// bought rather than earned, and the message that mattered lands in spam for
// the people who *did* sign up. The 213 cost nothing while nobody writes to
// them. src/server/launchNotify.ts applies the same filter for the same reason.
//
// Banned accounts are left out either way.

import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const all = process.argv.includes("--all");

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

// Auth is the authority on whether an address was ever proven; the users
// collection is where the ban lives. Read the collection once rather than a
// lookup per account — thousands of round trips for one boolean otherwise.
const banned = new Set();
const snap = await getFirestore().collection("users").get();
for (const doc of snap.docs) {
  if (doc.data().isBanned) banned.add(doc.id);
}

/** RFC 4180: quote everything, double the quotes inside. A display name can
 *  hold a comma, and one unquoted comma shifts every column after it. */
const cell = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;

const rows = [];
const counts = { verified: 0, unverified: 0, banned: 0, noEmail: 0 };

let pageToken;
do {
  const page = await getAuth().listUsers(1000, pageToken);
  for (const u of page.users) {
    if (!u.email) {
      counts.noEmail++;
      continue;
    }
    if (banned.has(u.uid)) {
      counts.banned++;
      continue;
    }
    if (u.emailVerified) counts.verified++;
    else counts.unverified++;
    if (!u.emailVerified && !all) continue;

    rows.push([
      u.email,
      u.displayName ?? "",
      u.emailVerified ? "yes" : "no",
      // Which provider vouched for them. google.com is the one that proved the
      // address; password is the one that proved nothing.
      u.providerData.map((p) => p.providerId).join(" ") || "unknown",
      u.metadata.creationTime ?? "",
      u.metadata.lastSignInTime ?? "",
    ]);
  }
  pageToken = page.pageToken;
} while (pageToken);

// CSV on stdout, the report on stderr — so `> emails.csv` gets a clean file and
// you still see what was left out.
console.log(
  ["email", "name", "verified", "providers", "created", "last_sign_in"]
    .map(cell)
    .join(","),
);
for (const row of rows) console.log(row.map(cell).join(","));

console.error(
  [
    "",
    `exported        ${rows.length}`,
    `  verified      ${counts.verified}`,
    `  unverified    ${counts.unverified}${all ? " (included — --all)" : " (excluded)"}`,
    `  banned        ${counts.banned} (excluded)`,
    `  no address    ${counts.noEmail} (phone-only accounts)`,
    "",
    all
      ? "--all includes addresses nobody ever proved. Sending to them is how a young domain loses its reputation."
      : "",
  ].join("\n"),
);
