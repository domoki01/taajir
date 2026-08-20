// ── THE SHORTENER, AND THE HOLE IT WOULD BE ──────────────────────────────────
// A shortener is a redirector with a lookup table in front of it. The table
// decides where somebody's browser is sent, and it is written by a Server
// Action — so the allowlist on what may be shortened is the whole difference
// between a convenience and an open redirect wearing this site's own domain.
//
// The same trap `safeNext` exists for, one file over, reached from the other
// direction.

import { describe, expect, it } from "vitest";
import {
  kShortCodeLength,
  kShortCodePattern,
  shortLinkUrl,
  shortenablePath,
} from "@/lib/shortlink";
import { kCodeAlphabet } from "@/lib/referral";

describe("what may be shortened", () => {
  it("accepts the two things that are actually shared", () => {
    expect(shortenablePath("/annonce/abc123/شقة-f3-باب-الزوار")).toBe(true);
    expect(shortenablePath("/demandes/BodalBbKvTtVFa9xD5y2")).toBe(true);
  });

  it("refuses anything off-site", () => {
    for (const path of [
      "https://evil.example/steal",
      "//evil.example",
      "/\\evil.example",
      "http://taajirdz.com.evil.example",
    ]) {
      expect(shortenablePath(path), path).toBe(false);
    }
  });

  it("refuses paths that are not a listing or a demand", () => {
    for (const path of [
      "/admin",
      "/admin/utilisateurs",
      "/tableau-de-bord",
      "/api/auth/session",
      "/diagnostic",
      "/",
      "",
    ]) {
      expect(shortenablePath(path), path).toBe(false);
    }
  });

  it("refuses a query string or fragment smuggled into the path", () => {
    // The row stores a path and the route redirects to it verbatim; anything
    // that changes meaning after a ? or # has no business being in there.
    expect(shortenablePath("/demandes/abc?next=https://evil.example")).toBe(
      false,
    );
    expect(shortenablePath("/demandes/abc#@evil.example")).toBe(false);
  });
});

describe("the code", () => {
  it("uses only characters nobody misreads aloud", () => {
    // Same alphabet as referral codes: no 0/O, no 1/I.
    expect(kCodeAlphabet).not.toMatch(/[01OI]/);
    const sample = kCodeAlphabet.slice(0, kShortCodeLength);
    expect(kShortCodePattern.test(sample)).toBe(true);
  });

  it("refuses anything that is not exactly one", () => {
    expect(kShortCodePattern.test("SHORT")).toBe(false);
    expect(kShortCodePattern.test("abcdefg")).toBe(false);
    expect(kShortCodePattern.test("K7M2QX0")).toBe(false);
  });

  it("builds a url on the origin it was given", () => {
    expect(shortLinkUrl("https://taajirdz.com/", "K7M2QXB")).toBe(
      "https://taajirdz.com/s/K7M2QXB",
    );
  });
});
