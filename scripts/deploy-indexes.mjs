// Creates any index in firestore.indexes.json that production does not already
// have, through the Firestore Admin REST API.
//
// This exists because index shape is invisible locally: the emulator serves any
// query without an index, so a page that works in development returns 500 in
// production. Four separate outages in this project came from exactly that.
// The rule now is that the index is created here *before* the query ships.
//
//   node scripts/deploy-indexes.mjs [--dry]

import { readFileSync } from "node:fs";
import { accessToken, serviceAccount } from "./gcp-token.mjs";

const kDry = process.argv.includes("--dry");
const projectId = serviceAccount().project_id;
const base =
  `https://firestore.googleapis.com/v1/projects/${projectId}` +
  `/databases/(default)/collectionGroups`;

const token = await accessToken();
const auth = { authorization: `Bearer ${token}` };

const wanted = JSON.parse(
  readFileSync("firestore.indexes.json", "utf8"),
).indexes;

// Compared on shape, not on name: the API assigns opaque ids, so the only way
// to tell "already there" is to match the field list exactly.
const shape = (index) =>
  [
    index.queryScope ?? "COLLECTION",
    ...index.fields.map(
      (f) => `${f.fieldPath}:${f.order ?? f.arrayConfig ?? ""}`,
    ),
  ].join("|");

const existing = new Set();
// One call is enough: despite the collectionGroup in the path, this endpoint
// returns every index in the database. Keying the comparison on the *requested*
// group rather than on each index's own name made a `comments` index look
// present because an identically shaped `listings` one already existed.
{
  const res = await fetch(`${base}/-/indexes`, { headers: auth });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  for (const index of body.indexes ?? []) {
    const group = index.name.split("/collectionGroups/")[1].split("/")[0];
    // __name__ is appended implicitly by Firestore and is not in our file.
    const fields = (index.fields ?? []).filter(
      (f) => f.fieldPath !== "__name__",
    );
    existing.add(`${group} ${shape({ ...index, fields })}`);
  }
}

let created = 0;
for (const index of wanted) {
  const key = `${index.collectionGroup} ${shape(index)}`;
  if (existing.has(key)) continue;

  const label = `${index.collectionGroup}: ${index.fields
    .map((f) => f.fieldPath)
    .join(", ")}`;
  if (kDry) {
    console.log(`would create — ${label}`);
    created++;
    continue;
  }

  const res = await fetch(`${base}/${index.collectionGroup}/indexes`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      queryScope: index.queryScope ?? "COLLECTION",
      fields: index.fields,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${label}: ${JSON.stringify(body)}`);
  console.log(`created — ${label}`);
  created++;
}

console.log(
  created === 0
    ? `up to date (${wanted.length} indexes)`
    : `${created} index(es) ${kDry ? "missing" : "building"}`,
);
