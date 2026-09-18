// Builds the app into an upload-ready bundle for cPanel shared hosting.
//
//   npm run build:cpanel
//   npm run build:cpanel -- --slim         # drop the sharp builds this host cannot use
//   npm run build:cpanel -- --skip-build   # repackage the .next already on disk
//
// Produces `dist/cpanel/` (upload this directory) and `dist/taajir-cpanel.tgz`
// (upload this single file instead, and extract it from cPanel's File Manager —
// which is the faster route by an order of magnitude, because shared-hosting
// upload forms transfer one file at a time and the bundle has thousands).
//
// What the assembly is for: `next build` with output "standalone" writes a
// server that runs anywhere Node runs, but deliberately leaves out two things
// it cannot know the deployment layout for — `.next/static` (the CSS and JS the
// browser fetches) and `public/`. Uploading the standalone directory alone gets
// you a site that renders as unstyled HTML, which is the single most common way
// this goes wrong.

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const slim = args.includes("--slim");
const skipBuild = args.includes("--skip-build");

const kRoot = process.cwd();
const kOut = join(kRoot, "dist", "cpanel");
const kTarball = join(kRoot, "dist", "taajir-cpanel.tgz");
const unoptimizedImages = process.env.NEXT_IMAGE_UNOPTIMIZED === "true";

// ── BUILD ────────────────────────────────────────────────────────────────────
// NEXT_PUBLIC_SITE_URL is read at build time as well as at runtime: canonical
// tags, OpenGraph URLs, the sitemap and the invite link are all baked into the
// generated pages. Setting it only in the server's env file leaves every
// shareable link pointing at localhost, and nothing about the running site says
// so — hence the refusal rather than a warning.
if (!skipBuild) {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site || site.includes("localhost")) {
    console.error(
      `refusing to build: NEXT_PUBLIC_SITE_URL is ${site ? `"${site}"` : "unset"}.\n` +
        "It is compiled into every canonical URL, share link and sitemap entry, so it\n" +
        "has to be the address this bundle will actually be served from:\n\n" +
        "  NEXT_PUBLIC_SITE_URL=https://test.example.com npm run build:cpanel\n",
    );
    process.exit(1);
  }

  console.log(
    `building for ${site}${unoptimizedImages ? " (images unoptimized)" : ""}…`,
  );
  execFileSync("npx", ["next", "build"], {
    stdio: "inherit",
    env: { ...process.env, NEXT_OUTPUT: "standalone" },
  });
}

const kStandalone = join(kRoot, ".next", "standalone");
if (!existsSync(kStandalone)) {
  console.error(
    "no .next/standalone directory. Either the build failed, or --skip-build was\n" +
      "passed for a build that never ran with NEXT_OUTPUT=standalone.",
  );
  process.exit(1);
}

// ── ASSEMBLE ─────────────────────────────────────────────────────────────────
console.log("assembling dist/cpanel…");
rmSync(kOut, { recursive: true, force: true });
mkdirSync(kOut, { recursive: true });

cpSync(kStandalone, kOut, { recursive: true });
cpSync(join(kRoot, ".next", "static"), join(kOut, ".next", "static"), {
  recursive: true,
});
cpSync(join(kRoot, "public"), join(kOut, "public"), { recursive: true });

for (const file of ["app.js", "env.js", "preflight.js", "env.example"]) {
  cpSync(join(kRoot, "deploy", "cpanel", file), join(kOut, file));
}

// The standalone output copies this project's package.json verbatim, scripts
// and devDependencies included. On cPanel that is a loaded gun: the Node.js app
// screen has a "Run NPM Install" button, and pressing it against that file
// makes the account try to install 1100 packages — including the toolchain —
// over the bundle that is already complete. What replaces it names the entry
// point and lists nothing to install.
const pkg = JSON.parse(readFileSync(join(kRoot, "package.json"), "utf8"));
writeFileSync(
  join(kOut, "package.json"),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      private: true,
      description: pkg.description,
      main: "app.js",
      scripts: { start: "node app.js", preflight: "node preflight.js" },
    },
    null,
    2,
  ) + "\n",
);

// A note of what this bundle is, for the host: which origin it was compiled
// for, whether it can optimise images, when it was built. Both the preflight
// check and whoever is looking at a server six weeks from now need it — the
// baked-in values are otherwise invisible from the outside.
writeFileSync(
  join(kOut, "build-info.json"),
  JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
      optimizesImages: !unoptimizedImages,
      next: pkg.dependencies.next,
      slim,
    },
    null,
    2,
  ) + "\n",
);

// ── PRUNE ────────────────────────────────────────────────────────────────────
// sharp ships a native build per platform plus a WebAssembly fallback, and the
// libvips binaries are ~18 MB each. What can go depends on how the site was
// built, so nothing is removed on a guess.
function drop(rel) {
  const target = join(kOut, rel);
  if (!existsSync(target)) return 0;
  const size = dirSize(target);
  rmSync(target, { recursive: true, force: true });
  return size;
}

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : statSync(full).size;
  }
  return total;
}

let freed = 0;
if (unoptimizedImages) {
  // next/image is emitting Storage URLs untouched, so nothing ever calls sharp.
  freed += drop("node_modules/sharp");
  freed += drop("node_modules/@img");
  console.log("  removed sharp — this build does not optimise images");
} else if (slim) {
  // Keeps the glibc x64 build alone. cPanel/CloudLinux hosts are glibc x86-64,
  // but "are" is doing a lot of work there: on an ARM or Alpine host this is
  // the difference between slower images and no images, so it stays opt-in.
  for (const rel of [
    "node_modules/@img/sharp-libvips-linuxmusl-x64",
    "node_modules/@img/sharp-linuxmusl-x64",
    "node_modules/@img/sharp-wasm32",
  ]) {
    freed += drop(rel);
  }
  console.log("  removed the musl and WebAssembly sharp builds (--slim)");
}
if (freed) console.log(`  ${(freed / 1024 / 1024).toFixed(0)} MB freed`);

// ── TARBALL ──────────────────────────────────────────────────────────────────
// Uploading the directory file-by-file through File Manager is hours; uploading
// one archive and pressing Extract is minutes.
rmSync(kTarball, { force: true });
try {
  execFileSync("tar", ["-czf", kTarball, "-C", kOut, "."], {
    stdio: "inherit",
  });
} catch (err) {
  console.warn(`\ncould not create the tarball (${err.message}).`);
  console.warn(
    "dist/cpanel is complete — archive it with whatever is at hand.\n",
  );
}

const size = existsSync(kTarball) ? statSync(kTarball).size : 0;
console.log(
  `\ndist/cpanel ready (${(dirSize(kOut) / 1024 / 1024).toFixed(0)} MB` +
    (size ? `, ${(size / 1024 / 1024).toFixed(0)} MB compressed` : "") +
    ").\n\nNext: docs/cpanel.md — upload, set the environment file, then `node preflight.js`.",
);
