// ── NO GUESSED KEYS ──────────────────────────────────────────────────────────
// A hard-coded App Check site key naming a reCAPTCHA key this project does not
// own was worse than no key at all: App Check starts Google's reCAPTCHA
// Enterprise script with whatever it is handed, and phone sign-in drives that
// same script through the same global. A wrong key cannot attest — it can only
// interfere with the thing the sign-up form depends on.
//
// The failure is silent by design (attestation errors are swallowed while
// enforcement is off), so nothing would report the key drifting back.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = readFileSync("src/lib/firebase/config.ts", "utf8");
const client = readFileSync("src/lib/firebase/client.ts", "utf8");

describe("the App Check site key", () => {
  it("has no hard-coded reCAPTCHA key as a fallback", () => {
    const at = config.indexOf("kAppCheckSiteKey");
    const decl = config.slice(at, at + 400);
    // reCAPTCHA site keys all start with this prefix.
    expect(decl).not.toMatch(/["']6L[\w-]{10,}["']/);
  });

  it("comes from the environment", () => {
    expect(config).toContain("NEXT_PUBLIC_FIREBASE_APPCHECK_KEY");
  });

  it("does not start App Check without one", () => {
    expect(client).toContain("if (!kAppCheckSiteKey) return;");
  });
});
