// Mints a short-lived Google OAuth access token from the service account in
// .env.local, so `firestore.indexes.json` and `firestore.rules` can be pushed
// through the REST APIs.
//
// Why not `firebase deploy`: the CLI insists on calling
// `firebaserules.projects.test` first, which this service account is not
// granted, and fails the whole deploy on that 403 even though the release
// itself would succeed. The REST calls do exactly the step we want.
//
// Usage:  node scripts/gcp-token.mjs   →  prints the token
//
// Scope note: cloud-platform is what both APIs require. The token lives an
// hour and is never written to disk.

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

export function serviceAccount() {
  const line = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .find((l) => l.startsWith("FIREBASE_SERVICE_ACCOUNT_JSON="));
  if (!line) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON missing");
  const raw = line.slice(line.indexOf("=") + 1).replace(/^["']|["']$/g, "");
  const json = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(json);
}

export async function accessToken() {
  const sa = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const claim = b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  });
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${claim}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(sa.private_key, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(JSON.stringify(data));
  return data.access_token;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(await accessToken());
}
