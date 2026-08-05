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

// ── FIELD OVERRIDES ──────────────────────────────────────────────────────────
// Single-field index settings, which are a different API from the composite
// indexes above and were previously not deployed at all. Two kinds live here:
// turning indexing *off* for a field too large to index (listings.description),
// and turning collection-group ordering *on*, which single-field indexes do not
// get by default — the moderation screen's query across every listing's
// comments fails without it, and the composite API rejects it as "not
// necessary", which is easy to read as "nothing to do".

const overrides = JSON.parse(
  readFileSync("firestore.indexes.json", "utf8"),
).fieldOverrides;
if (!overrides?.length) process.exit(0);

let patched = 0;
for (const override of overrides) {
  const field = `${base}/${override.collectionGroup}/fields/${override.fieldPath}`;
  const current = await fetch(field, { headers: auth }).then((r) => r.json());

  const key = (i) =>
    `${i.order ?? i.arrayConfig}:${i.queryScope || "COLLECTION"}`;
  const have = new Set((current.indexConfig?.indexes ?? []).map(key));
  const want = new Set(override.indexes.map(key));
  const same = have.size === want.size && [...want].every((k) => have.has(k));
  if (same) continue;

  const label = `${override.collectionGroup}.${override.fieldPath}`;
  if (kDry) {
    console.log(
      `would set — ${label} [${[...want].join(", ") || "no indexes"}]`,
    );
    patched++;
    continue;
  }

  // updateMask targets indexConfig alone so the TTL setting on the field, if it
  // ever gains one, is not wiped by this call.
  const res = await fetch(`${field}?updateMask=indexConfig`, {
    method: "PATCH",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      indexConfig: {
        indexes: override.indexes.map((i) => ({
          queryScope: i.queryScope || "COLLECTION",
          fields: [
            {
              fieldPath: override.fieldPath,
              ...(i.arrayConfig
                ? { arrayConfig: i.arrayConfig }
                : { order: i.order }),
            },
          ],
        })),
      },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${label}: ${JSON.stringify(body)}`);
  console.log(`set — ${label}`);
  patched++;
}

console.log(
  patched === 0
    ? `field overrides up to date (${overrides.length})`
    : `${patched} field override(s) ${kDry ? "differ" : "applied"}`,
);
