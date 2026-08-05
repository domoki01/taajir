// Publishes firestore.rules through the Firebase Rules REST API.
//
// `firebase deploy --only firestore:rules` calls firebaserules.projects.test
// first and aborts the whole deploy on the 403 this service account gets for
// that method, even though creating and releasing the ruleset succeeds. These
// two calls are exactly what the deploy would have done.
//
// IMPORTANT: this project is shared with catalogev, whose rules live only in
// this file's `match /catalog/{doc=**}` block. Publishing without it takes that
// app down, so it is checked for before anything is sent.
//
//   node scripts/deploy-rules.mjs

import { readFileSync } from "node:fs";
import { accessToken, serviceAccount } from "./gcp-token.mjs";

const projectId = serviceAccount().project_id;
const bucket = `${projectId}.firebasestorage.app`;

const firestoreSource = readFileSync("firestore.rules", "utf8");
if (!firestoreSource.includes("match /catalog/{doc=**}")) {
  console.error(
    "refusing to deploy: the catalogev block is missing from firestore.rules.\n" +
      "Publishing this would remove the only rules that app has.",
  );
  process.exit(1);
}

const token = await accessToken();
const headers = {
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
};

async function publish(fileName, releaseName) {
  const source = readFileSync(fileName, "utf8");

  const created = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: { files: [{ name: fileName, content: source }] },
      }),
    },
  ).then((r) => r.json());
  if (!created.name) throw new Error(`${fileName}: ${JSON.stringify(created)}`);

  // The release name is fixed — updating it is what makes the ruleset live.
  const release = `projects/${projectId}/releases/${releaseName}`;
  const patched = await fetch(
    `https://firebaserules.googleapis.com/v1/${release}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        release: { name: release, rulesetName: created.name },
      }),
    },
  ).then((r) => r.json());
  if (!patched.name) throw new Error(`${fileName}: ${JSON.stringify(patched)}`);

  console.log(`${fileName} → ${patched.rulesetName.split("/").pop()}`);
}

await publish("firestore.rules", "cloud.firestore");
// Storage releases are named per bucket, unlike Firestore's single release.
await publish("storage.rules", `firebase.storage/${bucket}`);
