// ── THE DOOR THAT MUST NOT CLOSE ─────────────────────────────────────────────
// Phone sign-up is switched off while Firebase's SMS backend refuses this
// project's codes. Sign-IN is a different question with a different answer:
// thirty-five accounts hold a phone number and nothing else — no email, no
// password — so hiding that form stops being a degraded experience and starts
// being a locked door with nobody on the other side.
//
// The two are one boolean apart in the same component, which is exactly the
// kind of thing a later edit collapses into one.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const form = readFileSync("src/components/auth/AuthForm.tsx", "utf8");
const yaml = readFileSync("apphosting.yaml", "utf8");

describe("hiding phone sign-up", () => {
  it("never hides it for someone signing in", () => {
    expect(form).toContain('mode === "signin" || kPhoneSignupEnabled');
  });

  it("gates the phone form on that decision, not on the flag directly", () => {
    // `showPhone` carries the sign-in exemption; the raw flag does not.
    expect(form).toContain("{showPhone && (");
    expect(form).not.toMatch(/\{kPhoneSignupEnabled && \(/);
  });

  it("still offers Google when the phone form is hidden", () => {
    // A sign-up screen with no way to sign up is worse than a broken one.
    const at = form.indexOf("{showPhone && (");
    expect(form.slice(at)).toContain("كمّل بحساب Google");
  });

  it("is declared at build time as well as at runtime", () => {
    // Read into a client component, so it is inlined at build; a RUNTIME-only
    // value would leave the bundle with the default and the flag would do
    // nothing at all.
    const at = yaml.indexOf("- variable: NEXT_PUBLIC_PHONE_SIGNUP");
    expect(at).toBeGreaterThan(-1);
    const next = yaml.indexOf("- variable:", at + 1);
    const block = next === -1 ? yaml.slice(at) : yaml.slice(at, next);
    expect(block).toContain("BUILD");
    expect(block).toContain("RUNTIME");
  });
});
