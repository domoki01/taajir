// ── ENVIRONMENT FILE LOADER ──────────────────────────────────────────────────
// Shared by the Passenger entry point (app.js) and the preflight check, so that
// the thing being verified is the same thing that will be loaded at boot. A
// preflight reading the file differently from the server is worse than none.
//
// Deliberately not dotenv: the standalone bundle carries only what the build
// traced, so a runtime dependency here would mean installing a package by hand
// on the host — a step that gets skipped once and then debugged for an hour.
// The format understood is the one `.env.example` already uses.

"use strict";

const fs = require("node:fs");
const path = require("node:path");

// `.env.production` first, `env.production` second. The second name exists for
// one reason: cPanel's File Manager hides dot-files until you tick a checkbox
// in its settings, and an env file you cannot see is an env file you cannot fix
// from a phone.
const kEnvFiles = [".env.production", "env.production", ".env"];

/**
 * CRLF is stripped rather than kept as part of the value: an env file edited in
 * cPanel's File Manager from Windows comes back with \r\n, and a service
 * account key ending in an invisible carriage return fails signature validation
 * with an error that says nothing about line endings.
 */
function parseEnv(text) {
  const out = {};

  for (const rawLine of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line
      .slice(0, eq)
      .trim()
      .replace(/^export\s+/, "");
    if (!key) continue;

    let value = line.slice(eq + 1).trim();

    // Quotes are stripped, not interpreted. A value containing '#' therefore
    // has to be quoted, and a trailing unquoted comment is not supported — the
    // alternative is guessing whether a '#' inside a base64 blob starts a
    // comment, and guessing wrong corrupts a credential silently.
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted && value.length >= 2) value = value.slice(1, -1);

    out[key] = value;
  }

  return out;
}

/**
 * Applies the first env file found in `dir` to process.env and reports which
 * one it was. Returns null when there is none.
 */
function loadEnv(dir) {
  for (const name of kEnvFiles) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;

    const parsed = parseEnv(fs.readFileSync(file, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      // A variable set in cPanel's own form wins. That form is where a secret
      // belongs if the account is shared with anyone, and a file quietly
      // overriding it would make the UI a lie.
      if (process.env[key] === undefined) process.env[key] = value;
    }

    return { file, name, keys: Object.keys(parsed) };
  }

  return null;
}

module.exports = { kEnvFiles, parseEnv, loadEnv };
