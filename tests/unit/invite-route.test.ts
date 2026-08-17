// ── /r/[code] ────────────────────────────────────────────────────────────────
// The route does no I/O at all, on purpose, which is what makes it testable
// without an emulator — and what keeps a public unauthenticated URL from
// costing a Firestore read per hit.

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/r/[code]/route";
import { kReferralCookie } from "@/lib/referral";

const visit = (code: string) =>
  GET(new NextRequest(`https://taajir.dz/r/${code}`), {
    params: Promise.resolve({ code }),
  });

describe("the invite link", () => {
  it("redirects with a relative Location, naming no host", async () => {
    const res = await visit("K7M2QX");

    expect(res.status).toBe(307);
    // The regression this exists for: building the target with
    // `new URL(kFunnelHome, request.url)` reads the container's own address
    // behind App Hosting's proxy, and shipped `https://localhost:8080/bienvenue`
    // to every invited visitor. A relative Location cannot name the wrong host
    // because it names none.
    const location = res.headers.get("location");
    expect(location).toBe("/bienvenue");
    expect(location).not.toMatch(/^https?:/);
  });

  it("records the code in a cookie the client cannot read", async () => {
    const res = await visit("K7M2QX");
    const cookie = res.cookies.get(kReferralCookie);

    expect(cookie?.value).toBe("K7M2QX");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    // Ninety days: someone sent a link on WhatsApp signs up when they next need
    // a flat, not in the same minute.
    expect(cookie?.maxAge).toBe(90 * 24 * 60 * 60);
  });

  it("uppercases a code typed in lowercase", async () => {
    const res = await visit("k7m2qx");
    expect(res.cookies.get(kReferralCookie)?.value).toBe("K7M2QX");
  });

  it("still redirects, but records nothing, for a code it does not recognise", async () => {
    for (const junk of ["notacode", "AEIOU1", "K7M2Q", "K7M2QXZ", "%2e%2e"]) {
      const res = await visit(junk);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("/bienvenue");
      expect(res.cookies.get(kReferralCookie)).toBeUndefined();
    }
  });
});
