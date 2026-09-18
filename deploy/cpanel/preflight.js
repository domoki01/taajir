// ── PREFLIGHT CHECK ──────────────────────────────────────────────────────────
// Run this on the cPanel account, from the directory the bundle was unpacked
// into, BEFORE wiring the app up in "Setup Node.js App":
//
//   node preflight.js
//
// Everything it tests is something shared hosting is allowed to take away, and
// each one fails at a different moment in a way that does not name its cause: a
// Node too old crashes on boot, a blocked outbound port hangs every page that
// touches Firestore until it times out, a read-only directory breaks ISR only
// on the second request to a cached page. Better to learn it here than from a
// 500 with no log line.
//
// Exit code 0 means every required check passed.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadEnv } = require("./env.js");

const kMinNode = [20, 9, 0];
const kHosts = [
  // Firestore and Auth. The Admin SDK reaches Firestore over gRPC on 443 and
  // the token endpoints over plain HTTPS, so a host that allows outbound 443
  // for one does not automatically allow it for the other.
  "https://firestore.googleapis.com",
  "https://identitytoolkit.googleapis.com",
  "https://oauth2.googleapis.com",
];

const results = [];

function record(name, ok, detail, { required = true } = {}) {
  results.push({ name, ok, detail, required });
  const mark = ok ? "PASS" : required ? "FAIL" : "WARN";
  console.log(`  ${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function checkNode() {
  const parts = process.versions.node.split(".").map(Number);
  const ok =
    parts[0] > kMinNode[0] ||
    (parts[0] === kMinNode[0] && parts[1] >= kMinNode[1]);
  record(
    "Node version",
    ok,
    ok
      ? `v${process.versions.node}`
      : `v${process.versions.node}, Next 16 needs >= ${kMinNode.join(".")} — raise it in Setup Node.js App`,
  );
}

function checkEnv(loaded) {
  record(
    "Environment file",
    Boolean(loaded),
    loaded
      ? `${loaded.name}: ${loaded.keys.length} variables`
      : "none found — copy env.example to .env.production next to app.js",
  );

  record(
    "FIREBASE_SERVICE_ACCOUNT_JSON",
    Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? "set"
      : "missing — sign-in, publishing and moderation will fail",
  );

  record(
    "FIELD_ENCRYPTION_KEY",
    Boolean(process.env.FIELD_ENCRYPTION_KEY),
    process.env.FIELD_ENCRYPTION_KEY
      ? "set"
      : "missing — payout and prize forms will refuse to store bank details",
    { required: false },
  );
}

function checkBundle() {
  const missing = ["server.js", ".next", "node_modules/next"].filter(
    (p) => !fs.existsSync(path.join(__dirname, p)),
  );
  record(
    "Bundle contents",
    missing.length === 0,
    missing.length
      ? `missing: ${missing.join(", ")}`
      : "server.js, .next, node_modules",
  );

  // `.next/static` and `public` are copied in by the packaging script, not by
  // `next build` — a bundle assembled by hand is missing exactly these, and the
  // symptom is a site that renders as unstyled HTML.
  const assets = [".next/static", "public"].filter(
    (p) => !fs.existsSync(path.join(__dirname, p)),
  );
  record(
    "Static assets",
    assets.length === 0,
    assets.length
      ? `missing: ${assets.join(", ")} — the pages will load without CSS or images`
      : "present",
  );
}

function checkWritable() {
  // ISR writes rendered pages under .next/cache (annonce pages revalidate every
  // 300s, articles every 3600s). A read-only app directory does not fail the
  // first request, it fails the one that tries to store the result.
  const dir = path.join(__dirname, ".next", "cache");
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, ".preflight-probe");
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    record("Writable .next/cache", true, "ISR can store rendered pages");
  } catch (err) {
    record("Writable .next/cache", false, err.message);
  }
}

async function checkOutbound() {
  for (const host of kHosts) {
    const started = Date.now();
    try {
      // Any HTTP status answers the question. 404 from a bare Google API host
      // still proves DNS, TLS and outbound 443 all work; a firewall gives a
      // timeout or a connection refusal instead.
      const res = await fetch(host, {
        method: "GET",
        signal: AbortSignal.timeout(15000),
      });
      record(
        `Outbound → ${new URL(host).hostname}`,
        true,
        `HTTP ${res.status} in ${Date.now() - started}ms`,
      );
    } catch (err) {
      record(
        `Outbound → ${new URL(host).hostname}`,
        false,
        `${err.message} — shared hosts often block outbound connections; ask support to allow 443 to *.googleapis.com`,
      );
    }
  }
}

function buildInfo() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(__dirname, "build-info.json"), "utf8"),
    );
  } catch {
    return null;
  }
}

function checkSharp(info) {
  // Whether images are optimised was decided by the build, not by this machine:
  // a bundle built with NEXT_IMAGE_UNOPTIMIZED=true has had sharp removed from it
  // entirely, and reading the env var here would report that as a failure on a
  // host where nothing is wrong.
  if (
    info ? !info.optimizesImages : process.env.NEXT_IMAGE_UNOPTIMIZED === "true"
  ) {
    record(
      "Image optimisation",
      true,
      "disabled for this build — sharp not needed, photos served straight from Firebase Storage",
      { required: false },
    );
    return;
  }

  try {
    const sharp = require("sharp");
    record("sharp native binary", true, `libvips ${sharp.versions.vips}`);
  } catch (err) {
    record(
      "sharp native binary",
      false,
      `${err.message} — rebuild with NEXT_IMAGE_UNOPTIMIZED=true, or next/image will 500 on every photo`,
    );
  }
}

async function checkFirestore() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    record("Firestore read", false, "skipped — no service account", {
      required: false,
    });
    return;
  }

  try {
    const { cert, initializeApp } = require("firebase-admin/app");
    const { getFirestore } = require("firebase-admin/firestore");

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
    const json = raw.startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json);

    const app = initializeApp(
      { credential: cert(parsed), projectId: parsed.project_id },
      "preflight",
    );
    const started = Date.now();
    const snap = await getFirestore(app).collection("listings").limit(1).get();

    record(
      "Firestore read",
      true,
      `project ${parsed.project_id}, ${snap.size} document(s) in ${Date.now() - started}ms`,
    );
  } catch (err) {
    record(
      "Firestore read",
      false,
      `${err.message} — a hang here is a blocked outbound port, an auth error is the wrong service account`,
    );
  }
}

async function main() {
  console.log(`\ntaajir — cPanel preflight in ${__dirname}\n`);

  const loaded = loadEnv(__dirname);
  const info = buildInfo();

  // Which bundle is actually on this server. The origin and the image mode are
  // compiled in, so there is no other way to read them back off a host.
  if (info) {
    const built = String(info.builtAt).slice(0, 16).replace("T", " ");
    console.log(
      `  built ${built} UTC for ${info.siteUrl ?? "an unspecified origin"}, Next ${info.next}, images ${info.optimizesImages ? "optimised" : "unoptimised"}\n`,
    );
  }

  checkNode();
  checkEnv(loaded);
  checkBundle();
  checkWritable();
  checkSharp(info);
  await checkOutbound();
  await checkFirestore();

  const failed = results.filter((r) => !r.ok && r.required);
  const warned = results.filter((r) => !r.ok && !r.required);

  console.log(
    `\n${results.length - failed.length - warned.length} passed, ${warned.length} warning(s), ${failed.length} blocking failure(s)\n`,
  );

  // The process is kept alive by firebase-admin's gRPC channel otherwise.
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
