// ── PASSENGER ENTRY POINT (cPanel shared hosting) ────────────────────────────
// cPanel's "Setup Node.js App" runs the application under Phusion Passenger,
// which boots exactly one file and hands it the incoming requests. It does not
// run `npm start`, so `next start` never happens here — this file replaces it.
//
// It does two things the standalone bundle cannot do for itself:
//
//   1. Reads the environment file. Passenger takes variables from the cPanel
//      form, which is fine for two or three of them and unusable for a one-line
//      service-account JSON. A file next to this one is editable and survives
//      the app being restarted from the UI.
//
//   2. Boots `.next/standalone`'s own server, which starts listening the moment
//      it is required — hence the env file being read *first*, above the
//      require. A variable set after that line is one the server already missed.
//
// Passenger patches http.Server#listen, so the PORT the standalone server asks
// for is ignored and the process is attached to Passenger's own socket instead.
// Nothing here needs to know which port that is.

"use strict";

const { loadEnv } = require("./env.js");

const loaded = loadEnv(__dirname);

// Passenger routes stdout into the account's log file, so these lines are the
// only trace of which configuration a restarted app picked up.
console.log(
  loaded
    ? `[taajir] loaded ${loaded.keys.length} variables from ${loaded.name}`
    : `[taajir] no environment file found in ${__dirname} — running on defaults`,
);

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  // Not fatal: the public pages render, and refusing to boot would hide that.
  // Everything behind a login does not render, because outside Google's own
  // infrastructure there are no Application Default Credentials to fall back on
  // (src/lib/firebase/admin.ts).
  console.warn(
    "[taajir] FIREBASE_SERVICE_ACCOUNT_JSON is not set — sign-in, publishing and moderation will fail",
  );
}

require("./server.js");
