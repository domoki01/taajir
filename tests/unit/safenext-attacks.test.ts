// ── THE "next" PARAMETER, UNDER ATTACK ───────────────────────────────────────
// It arrives in a link somebody clicked and is handed to the router the instant
// a session exists. That makes it the classic phishing lever on any site with a
// sign-in: send someone a real link to the real domain, and have the real site
// bounce them somewhere else once they have typed their credentials.
//
// The existing tests cover the shapes the guard was written for. These are the
// shapes attackers actually send — backslashes that browsers normalise to
// slashes, percent-encoded separators, whitespace before a scheme, a hostname
// that merely starts with ours.

import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/redirect";

const attacks = [
  "https://evil.example/steal",
  "//evil.example/steal",
  "/\\evil.example",
  "\\\\evil.example",
  "javascript:alert(1)",
  "  javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "https://taajirdz.com.evil.example/x",
  "/%2f%2fevil.example",
  "https:evil.example",
  " //evil.example",
];

describe("safeNext against redirect attacks", () => {
  for (const raw of attacks) {
    it(`refuses ${JSON.stringify(raw)}`, () => {
      const out = safeNext(raw);
      expect(out.startsWith("/")).toBe(true);
      expect(out.startsWith("//")).toBe(false);
      expect(out.toLowerCase()).not.toContain("evil.example");
      expect(out.toLowerCase()).not.toContain("javascript:");
      expect(out.toLowerCase()).not.toContain("data:");
    });
  }

  it("still allows an ordinary internal destination", () => {
    expect(safeNext("/tableau-de-bord/annonces")).toBe(
      "/tableau-de-bord/annonces",
    );
  });
});
