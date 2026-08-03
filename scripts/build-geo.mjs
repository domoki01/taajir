// ── GEO DATASET GENERATOR ────────────────────────────────────────────────────
// Regenerates src/data/geo/* from two independently published datasets, which
// are cross-checked against each other before anything is written.
//
//   node scripts/build-geo.mjs
//
// The output is committed, so this only needs running when the administrative
// division changes. It requires network access (it npm-packs the sources); the
// app itself never depends on either package at runtime — both are recent,
// single-maintainer publications and not something to trust in a build.
//
// Background: loi n° 26-06 (JO n°25, 5 April 2026) moved Algeria from 58 to 69
// wilayas, keeping 1541 communes. The transfer of competences to the new walis
// runs to 31 December 2026, and in the meantime most people — and every
// competitor site — still think in the old 58. So each wilaya records both its
// current `code` and the `code58` parent it was carved out of, and the URL
// identifier is the slug, which never changes either way.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const kPrimary = "geoalgeria@1.2.0"; // accented French names, coordinates
const kCrossCheck = "algeria-wilayas-communes@1.0.0"; // independent second source

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src/data/geo");

// ── FETCH ────────────────────────────────────────────────────────────────────

function fetchPackage(spec) {
  const dir = mkdtempSync(join(tmpdir(), "geo-"));
  // `npm pack` may emit notices alongside the filename; the tarball name is
  // always the last non-empty line.
  const out = execFileSync("npm", ["pack", spec, "--silent"], {
    cwd: dir,
    encoding: "utf8",
  });
  const tgz = out.trim().split("\n").filter(Boolean).pop().trim();
  execFileSync("tar", ["xzf", tgz, "-C", dir], { cwd: dir });
  return join(dir, "package");
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

// Both sources wrap their arrays differently across files; flatten defensively.
const asRows = (data, guard) => {
  const rows = Array.isArray(data) ? data : Object.values(data).flat();
  return rows.filter((r) => r && guard(r));
};

// ── SLUGS ────────────────────────────────────────────────────────────────────
// Latin, French-derived, ASCII-folded. These become URL segments
// (/vente/appartement/sidi-bel-abbes) and are the stable identity of a place —
// a commune reassigned to a different wilaya keeps its slug and gets a 301.

const kFold = {
  à: "a",
  á: "a",
  â: "a",
  ä: "a",
  ã: "a",
  å: "a",
  è: "e",
  é: "e",
  ê: "e",
  ë: "e",
  ì: "i",
  í: "i",
  î: "i",
  ï: "i",
  ò: "o",
  ó: "o",
  ô: "o",
  ö: "o",
  õ: "o",
  ù: "u",
  ú: "u",
  û: "u",
  ü: "u",
  ç: "c",
  ñ: "n",
  ý: "y",
  ÿ: "y",
};

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[àáâäãåèéêëìíîïòóôöõùúûüçñýÿ]/g, (c) => kFold[c] ?? c)
    .replace(/['’`]/g, "") // M'sila -> msila
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── BUILD ────────────────────────────────────────────────────────────────────

console.log(`> fetching ${kPrimary}`);
const primary = fetchPackage(kPrimary);
console.log(`> fetching ${kCrossCheck}`);
const secondary = fetchPackage(kCrossCheck);

const wilayasA = asRows(
  readJson(join(primary, "data/wilayas.json")),
  (r) => r.code,
);
const wilayasB = asRows(
  readJson(join(secondary, "data/wilayas.json")),
  (r) => r.wilaya_num,
);

const communes = [
  "data/communes_w1_w23.json",
  "data/communes_w24_w48.json",
  "data/communes_w49_w69.json",
].flatMap((f) => asRows(readJson(join(primary, f)), (r) => r.wilaya_code));

// ── VALIDATE ─────────────────────────────────────────────────────────────────
// Fail loudly rather than shipping a plausible-looking but wrong dataset.

const fail = (msg) => {
  throw new Error(`geo validation failed: ${msg}`);
};

if (wilayasA.length !== 69) fail(`expected 69 wilayas, got ${wilayasA.length}`);
if (wilayasB.length !== 69) fail(`cross-check has ${wilayasB.length} wilayas`);
if (communes.length !== 1541)
  fail(`expected 1541 communes, got ${communes.length}`);

// The original 58 must match code-for-code. French names differ only by
// diacritics (the cross-check source strips them), so compare them folded.
for (const a of wilayasA.filter((w) => +w.code <= 58)) {
  const b = wilayasB.find((w) => +w.wilaya_num === +a.code);
  if (!b) fail(`wilaya ${a.code} missing from cross-check`);
  if (slugify(a.name_fr) !== slugify(b.nom_fr)) {
    fail(`wilaya ${a.code} name disagreement: "${a.name_fr}" vs "${b.nom_fr}"`);
  }
  if (+a.communes_count !== +b.nb_communes) {
    fail(
      `wilaya ${a.code} commune count: ${a.communes_count} vs ${b.nb_communes}`,
    );
  }
}

// The two sources agree on WHICH 11 wilayas were created but disagree on their
// numbering. The primary source matches the official matricules published with
// the decree (59 Aflou, 60 Barika, 61 El Kantara, 62 Bir El Ater, 63 El Aricha,
// 64 Ksar Chellala, 65 Aïn Oussera, 66 Messaad, 67 Ksar El Boukhari,
// 68 Bou Saâda, 69 El Abiodh Sidi Cheikh); the cross-check source does not, so
// for 59-69 only the set of names is compared, never the codes.
const newA = wilayasA
  .filter((w) => +w.code > 58)
  .map((w) => slugify(w.name_fr));
const newB = wilayasB
  .filter((w) => +w.wilaya_num > 58)
  .map((w) => slugify(w.nom_fr));
// Both French spellings of these names are in common use; the sources picked
// different ones. The variant is kept as a search alias further down.
const kSpellingVariants = {
  "ain-oussera": "ain-oussara",
};

if (newA.length !== 11) fail(`expected 11 new wilayas, got ${newA.length}`);
for (const slug of newA) {
  const variant = kSpellingVariants[slug];
  if (!newB.includes(slug) && !(variant && newB.includes(variant))) {
    fail(`new wilaya "${slug}" missing from cross-check`);
  }
}

// The official numbering follows the parent wilaya in ascending order, the same
// convention used for the 2019 reform. If that no longer holds, the primary
// source has drifted from the decree and needs re-checking by hand.
const kOfficialOrder = [
  "aflou",
  "barika",
  "el-kantara",
  "bir-el-ater",
  "el-aricha",
  "ksar-chellala",
  "ain-oussera",
  "messaad",
  "ksar-el-boukhari",
  "bou-saada",
  "el-abiodh-sidi-cheikh",
];
if (newA.join(",") !== kOfficialOrder.join(",")) {
  fail(
    `new wilaya numbering does not match the decree:\n  got      ${newA.join(", ")}\n  expected ${kOfficialOrder.join(", ")}`,
  );
}

// ── PARENT WILAYA (58-scheme) ────────────────────────────────────────────────
// Wilayas 59-69 were created in 2026 out of existing ones. The source keeps the
// pre-reform numbering inside `code_commune` (wilaya * 100 + n), so the parent
// is recoverable as the most common prefix among a new wilaya's communes rather
// than something we have to hand-maintain. Note `code_commune` is NOT unique
// across the dataset (50 collisions), so it is used only for this inference.

function parentOf(code) {
  if (code <= 58) return code;
  const tally = new Map();
  for (const c of communes.filter((c) => +c.wilaya_code === code)) {
    const prefix = Math.floor(c.code_commune / 100);
    if (prefix >= 1 && prefix <= 58) {
      tally.set(prefix, (tally.get(prefix) ?? 0) + 1);
    }
  }
  const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!best) fail(`cannot infer the parent wilaya of ${code}`);
  return best[0];
}

// ── EMIT ─────────────────────────────────────────────────────────────────────

const wilayas = wilayasA
  .map((w) => {
    const code = +w.code;
    const code58 = parentOf(code);
    const slug = slugify(w.name_fr);
    // Someone searching "Bou Saâda" still thinks of it as M'sila, and typing a
    // bare wilaya number is common; both resolve through the alias list.
    const aliases = [String(code).padStart(2, "0"), slugify(w.name_en ?? "")];
    if (kSpellingVariants[slug]) aliases.push(kSpellingVariants[slug]);
    if (code58 !== code) {
      aliases.push(slugify(wilayasA.find((x) => +x.code === code58).name_fr));
    }
    return {
      code,
      code58,
      nameAr: w.name_ar,
      nameFr: w.name_fr,
      slug,
      aliases: [...new Set(aliases.filter((a) => a && a !== slug))],
      isNew2026: code > 58,
      communeCount: +w.communes_count,
    };
  })
  .sort((a, b) => a.code - b.code);

const byWilaya = {};
for (const c of communes) {
  const code = +c.wilaya_code;
  (byWilaya[code] ??= []).push({
    slug: slugify(c.name_fr),
    nameAr: c.name_ar,
    nameFr: c.name_fr,
    postalCode: c.postal_code ?? null,
    // Kept for the map, which is deliberately not built yet.
    lat: c.latitude ?? null,
    lng: c.longitude ?? null,
  });
}
for (const code of Object.keys(byWilaya)) {
  byWilaya[code].sort((a, b) => a.nameFr.localeCompare(b.nameFr, "fr"));
}

// A slug must be unique inside its wilaya, otherwise two communes collide on
// the same URL.
for (const [code, list] of Object.entries(byWilaya)) {
  const seen = new Set();
  for (const c of list) {
    const key = c.slug;
    if (seen.has(key))
      fail(`duplicate commune slug "${key}" in wilaya ${code}`);
    seen.add(key);
  }
}

mkdirSync(outDir, { recursive: true });

const banner = `// GENERATED by scripts/build-geo.mjs — do not edit by hand.
// Sources: ${kPrimary} cross-checked against ${kCrossCheck}.
// Legal basis: loi n° 26-06 (JO n°25, 5 April 2026) — 69 wilayas, 1541 communes.
`;

writeFileSync(
  join(outDir, "wilayas.ts"),
  `${banner}
export type Wilaya = {
  /** 1–69 under the current law. */
  code: number;
  /** The pre-2026 parent wilaya (1–58). Equal to \`code\` for the original 58. */
  code58: number;
  nameAr: string;
  nameFr: string;
  /** URL identifier — stable across administrative reshuffles. */
  slug: string;
  /** Alternate spellings and the parent name, for the search box. */
  aliases: string[];
  isNew2026: boolean;
  communeCount: number;
};

export const kWilayas: Wilaya[] = ${JSON.stringify(wilayas, null, 2)};

export const kWilayaBySlug = new Map(kWilayas.map((w) => [w.slug, w]));
export const kWilayaByCode = new Map(kWilayas.map((w) => [w.code, w]));
`,
);

writeFileSync(
  join(outDir, "communes.json"),
  JSON.stringify(byWilaya, null, 0) + "\n",
);

console.log(
  `> wrote ${wilayas.length} wilayas and ${communes.length} communes to src/data/geo/`,
);
