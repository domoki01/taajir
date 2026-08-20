// ── THE PAGE THAT CAN SEND MESSAGES ──────────────────────────────────────────
// /diagnostic mints a reCAPTCHA token and calls sendVerificationCode, which
// delivers a real SMS to whatever number is typed into it. It shipped open
// because at the time it only read state; the send step arrived later, and with
// it the only place on the site where an anonymous visitor could make this
// project send messages.
//
// Nothing about the page looks dangerous, which is why this is pinned rather
// than remembered.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/diagnostic/page.tsx", "utf8");
const doctor = readFileSync("src/components/auth/RecaptchaDoctor.tsx", "utf8");

/** Comments explain guards; only code is one. */
const code = page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("the diagnostic page", () => {
  it("is behind a staff guard", () => {
    expect(code).toContain("await requireStaff()");
  });

  it("is rendered per request, so the guard actually runs", () => {
    // A statically generated page would serve the same HTML to everybody and
    // the session check would never happen.
    expect(code).toContain('export const dynamic = "force-dynamic"');
  });

  it("is the only thing that reaches the send step", () => {
    // If this ever moves into a component reachable from elsewhere, the guard
    // above stops covering it.
    expect(doctor).toContain("accounts:sendVerificationCode");
    expect(page).toContain("RecaptchaDoctor");
  });

  it("stays out of search results", () => {
    expect(page).toContain("robots: { index: false, follow: false }");
  });
});
