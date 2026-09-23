// ── WHO WAITS IN THE APPROVAL QUEUE ──────────────────────────────────────────
// Registration approval was switched on after 213 accounts were mass-registered
// through Identity Toolkit's REST endpoint on invented addresses. It filters
// the door, and a Google account is not what it is filtering: Google proved the
// address before Firebase issued the token, so the moderator opening that row
// has nothing to check.
//
// Two things here are easy to break by accident and expensive to notice. The
// provider must come off the *verified token* — read it from the request body
// and the exemption becomes a field an attacker sets. And it must be decided at
// creation only: re-deciding on every sign-in would restore approval to an
// account a moderator had just taken it away from.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { kSelfApprovingProviders, skipsApprovalQueue } from "@/server/access";

const auth = readFileSync("src/server/auth.ts", "utf8");
const route = readFileSync("src/app/api/auth/session/route.ts", "utf8");

describe("the provider exemption", () => {
  it("lets Google through", () => {
    expect(skipsApprovalQueue("google.com")).toBe(true);
  });

  it("holds every other provider", () => {
    for (const provider of ["phone", "password", "anonymous", "facebook.com"]) {
      expect(skipsApprovalQueue(provider)).toBe(false);
    }
  });

  it("holds a token that names no provider at all", () => {
    // `sign_in_provider` is optional in the decoded type. Missing must read as
    // "review this", never as "trusted" — a thrown-together token is exactly
    // the case the queue exists for.
    expect(skipsApprovalQueue(undefined)).toBe(false);
    expect(skipsApprovalQueue(null)).toBe(false);
    expect(skipsApprovalQueue("")).toBe(false);
  });

  it("stays a deliberate list, not everything that proves an identifier", () => {
    // Phone proves a number, not a person, and SIMs are cheap in bulk. Adding
    // one here is a decision; this pins that it was made on purpose.
    expect([...kSelfApprovingProviders]).toEqual(["google.com"]);
  });
});

describe("how the exemption is wired", () => {
  it("takes the provider from the verified token", () => {
    // Not from the JSON body: that half of the exchange is written by the
    // caller, and this decides whether they skip moderation.
    expect(route).toContain(
      "const provider = decoded.firebase?.sign_in_provider",
    );
    const call = route.slice(route.indexOf("await ensureUserDoc("));
    expect(call).toContain("provider,");
  });

  it("still respects the approval switch for everyone else", () => {
    expect(auth).toContain(
      "const approved = !requireApproval || skipsApprovalQueue(data.provider);",
    );
  });

  it("decides it once, at creation", () => {
    // The returning-user branch must not touch `approved` — otherwise the next
    // sign-in silently undoes setUserApproved(uid, false).
    const from = auth.indexOf("if (snap.exists) {");
    const to = auth.indexOf("// A new account is approved on the spot");
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    expect(auth.slice(from, to)).not.toContain("approved");
  });
});
