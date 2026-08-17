import { describe, expect, it } from "vitest";
import {
  kCodeAlphabet,
  kCodeLength,
  kReferralCodePattern,
  referralLink,
} from "@/lib/referral";

describe("referral code alphabet", () => {
  it("excludes every vowel", () => {
    // A random six-character string over an alphabet with vowels in it will,
    // sooner or later, spell something the site does not want to have minted
    // and sent to a stranger on WhatsApp.
    for (const vowel of "AEIOU") {
      expect(kCodeAlphabet).not.toContain(vowel);
    }
  });

  it("excludes the characters that get misread aloud", () => {
    for (const lookalike of "01OI") {
      expect(kCodeAlphabet).not.toContain(lookalike);
    }
  });

  it("leaves enough room that collisions stay rare", () => {
    // The mint retries five times on a clash; this is what makes five enough.
    expect(kCodeAlphabet.length ** kCodeLength).toBeGreaterThan(100_000_000);
  });
});

describe("kReferralCodePattern", () => {
  it("accepts a well-formed code", () => {
    expect(kReferralCodePattern.test("K7M2QX")).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(kReferralCodePattern.test("K7M2Q")).toBe(false);
    expect(kReferralCodePattern.test("K7M2QXZ")).toBe(false);
  });

  it("rejects lowercase, so a code has exactly one spelling", () => {
    expect(kReferralCodePattern.test("k7m2qx")).toBe(false);
  });

  it("rejects a path, which is the point of checking at all", () => {
    // The value is taken from a cookie and used as a document id. A slash in it
    // addresses a different collection entirely.
    expect(kReferralCodePattern.test("../../users/admin")).toBe(false);
    expect(kReferralCodePattern.test("K7M2Q/")).toBe(false);
    expect(kReferralCodePattern.test("")).toBe(false);
  });
});

describe("referralLink", () => {
  it("builds a link that survives being pasted into WhatsApp", () => {
    expect(referralLink("https://taajir.dz", "K7M2QX")).toBe(
      "https://taajir.dz/r/K7M2QX",
    );
  });

  it("does not double the slash when the origin carries one", () => {
    expect(referralLink("https://taajir.dz/", "K7M2QX")).toBe(
      "https://taajir.dz/r/K7M2QX",
    );
  });
});
