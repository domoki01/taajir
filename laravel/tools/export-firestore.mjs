#!/usr/bin/env node
//
// ── FIRESTORE → JSON, plus the images ────────────────────────────────────────
//
// Run this ON YOUR OWN MACHINE, from the Next.js repository, where the service
// account already lives. It must never run on the shared host: the whole point
// of the lean php-jwt verifier (§5 of the roadmap) is that no service-account
// key is ever copied there, and a key on a cPanel account is a key in every
// backup of that account.
//
// It writes one JSON file per collection into <out>/, plus <out>/storage/…
// mirroring the bucket paths, plus <out>/manifest.json holding the counts that
// `php artisan taajir:import` checks its own work against.
//
//   node tools/export-firestore.mjs --out ../export
//   node tools/export-firestore.mjs --out ../export --no-media   # rows only
//
// `gcloud firestore export` is deliberately not used. It writes LevelDB, which
// PHP cannot read without a parser nobody should be writing under a freeze;
// this reads the documents through the Admin SDK and writes plain JSON.

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// ── what to take, and from where ─────────────────────────────────────────────
//
// `sub` names a subcollection to flatten into its own file, carrying the parent
// id down as a column — the Laravel schema has real tables and foreign keys
// where Firestore had nesting.
const kCollections = [
  { name: "settings" },
  { name: "users" },
  { name: "listings", sub: [{ name: "comments", parentKey: "listingId" }] },
  { name: "requests", sub: [{ name: "replies", parentKey: "requestId" }] },
  { name: "savedSearches" },
  { name: "articles", sub: [{ name: "articleComments", parentKey: "articleId" }] },
  { name: "promos" },
  { name: "adminAudit" },
  // The affiliate programme is not ported (§11), but its ledger is: §11
  // point 3 says migrate it anyway so nobody's balance is lost.
  { name: "pointsLedger" },
];

// Bucket prefixes worth pulling down. Everything else in the bucket is either
// derived or already gone.
const kMediaPrefixes = ["listings/", "promos/", "articles/"];

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
}

const out = path.resolve(arg("--out", "./export"));
const withMedia = !process.argv.includes("--no-media");

// The same three variables the Next app reads. No new configuration to get
// wrong on the day of the freeze.
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY first.\n" +
      "They are the three the Next app already uses — `source .env.local` is usually enough.",
  );
  process.exit(1);
}

initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? `${projectId}.appspot.com`,
});

const db = getFirestore();

/**
 * One document as a plain object.
 *
 * Firestore Timestamps become epoch milliseconds, which is what the app stored
 * everywhere else anyway, so the importer has one date shape to read rather
 * than two. References and GeoPoints are flattened rather than dropped: losing
 * one silently is worse than an importer that says it found something odd.
 */
function plain(value) {
  if (value === null || value === undefined) return null;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.latitude === "number" && typeof value?.longitude === "number") {
    return { lat: value.latitude, lng: value.longitude };
  }
  if (typeof value?.path === "string" && typeof value?.id === "string") return value.path;
  if (Array.isArray(value)) return value.map(plain);
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

/**
 * A whole collection, paged.
 *
 * Paged by document id rather than read in one go: `listings` is the biggest
 * collection here and a single get() of it is the one call most likely to time
 * out halfway through an export that then looks complete.
 */
async function readAll(ref, pageSize = 500) {
  const rows = [];
  let cursor = null;

  for (;;) {
    let query = ref.orderBy("__name__").limit(pageSize);
    if (cursor) query = query.startAfter(cursor);

    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) rows.push({ id: doc.id, ...plain(doc.data()) });

    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }

  return rows;
}

async function exportCollections() {
  const manifest = {};

  for (const collection of kCollections) {
    const rows = await readAll(db.collection(collection.name));
    await writeFile(path.join(out, `${collection.name}.json`), JSON.stringify(rows, null, 1));
    manifest[collection.name] = rows.length;
    console.log(`${collection.name.padEnd(18)} ${rows.length}`);

    for (const sub of collection.sub ?? []) {
      const nested = [];

      for (const parent of rows) {
        const child = await readAll(db.collection(collection.name).doc(parent.id).collection(sub.name));
        for (const row of child) nested.push({ ...row, [sub.parentKey]: parent.id });
      }

      await writeFile(path.join(out, `${sub.name}.json`), JSON.stringify(nested, null, 1));
      manifest[sub.name] = nested.length;
      console.log(`${sub.name.padEnd(18)} ${nested.length}`);
    }
  }

  return manifest;
}

/**
 * Every image, under the same path it has in the bucket.
 *
 * Skipping what is already on disk makes this resumable, which matters: this is
 * the slow half, it runs over a home connection, and an export that has to
 * start again from zero after a dropped Wi-Fi is an export nobody finishes.
 */
async function exportMedia() {
  const bucket = getStorage().bucket();
  let downloaded = 0;
  let skipped = 0;

  for (const prefix of kMediaPrefixes) {
    const [files] = await bucket.getFiles({ prefix });

    for (const file of files) {
      if (file.name.endsWith("/")) continue;

      const destination = path.join(out, "storage", file.name);
      if (existsSync(destination)) {
        skipped += 1;
        continue;
      }

      await mkdir(path.dirname(destination), { recursive: true });
      await file.download({ destination });
      downloaded += 1;

      if (downloaded % 50 === 0) console.log(`  … ${downloaded} files`);
    }
  }

  console.log(`media              ${downloaded} downloaded, ${skipped} already here`);
  return { downloaded, skipped };
}

await mkdir(out, { recursive: true });

const manifest = await exportCollections();
const media = withMedia ? await exportMedia() : null;

await writeFile(
  path.join(out, "manifest.json"),
  JSON.stringify({ exportedAt: new Date().toISOString(), projectId, counts: manifest, media }, null, 1),
);

console.log(`\nWritten to ${out}`);
console.log("Next: copy the folder to the server and run `php artisan taajir:import <path>`.");
