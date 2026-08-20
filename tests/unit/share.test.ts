// ── THE SHARED LINK ──────────────────────────────────────────────────────────
// Two things about a share link are silent when broken. A referral code that
// does not survive into the URL means every share is anonymous and nobody's
// points ever move — the feature looks like it works and pays nothing. And a
// code appended to the wrong place, or double-encoded on the way into a
// share intent, produces a link that opens the site but attributes to no one.

import { describe, expect, it } from "vitest";
import { kRefParam, shareHref, shareUrl } from "@/lib/share";
import { kReferralCodePattern } from "@/lib/referral";

const kOrigin = "https://taajirdz.com";
const kPath = "/annonce/abc123/شقة-f3";
const kCode = "K7M2QX";

describe("shareUrl", () => {
  it("attaches the code where the catcher looks for it", () => {
    const url = new URL(shareUrl(kOrigin, "/annonce/a/b", kCode));
    expect(url.searchParams.get(kRefParam)).toBe(kCode);
    expect(url.origin).toBe(kOrigin);
    expect(url.pathname).toBe("/annonce/a/b");
  });

  it("produces a plain link when nobody is signed in", () => {
    expect(shareUrl(kOrigin, "/annonce/a/b", null)).toBe(
      `${kOrigin}/annonce/a/b`,
    );
    expect(shareUrl(kOrigin, "/annonce/a/b")).not.toContain("?");
  });

  it("does not double up the slash between origin and path", () => {
    expect(shareUrl(`${kOrigin}/`, "/demandes/x")).toBe(
      `${kOrigin}/demandes/x`,
    );
  });

  it("emits a code the referral route would still accept", () => {
    // The two halves are validated by the same pattern; a code mangled on the
    // way out would be refused on the way back in, silently.
    const url = new URL(shareUrl(kOrigin, kPath, kCode));
    expect(kReferralCodePattern.test(url.searchParams.get(kRefParam)!)).toBe(
      true,
    );
  });
});

describe("shareHref", () => {
  const url = shareUrl(kOrigin, "/annonce/a/b", kCode);

  it("carries the full link, code and all, into WhatsApp", () => {
    const href = shareHref("whatsapp", url, "شقة F3");
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(href)).toContain(`${kRefParam}=${kCode}`);
  });

  it("hands Facebook the url parameter it actually reads", () => {
    const href = shareHref("facebook", url, "شقة F3");
    const u = new URL(href);
    expect(u.searchParams.get("u")).toBe(url);
  });

  it("keeps the link intact for Telegram", () => {
    const u = new URL(shareHref("telegram", url, "شقة F3"));
    expect(u.searchParams.get("url")).toBe(url);
  });

  it("escapes the text rather than letting it break the intent", () => {
    // A title with & or # in it would otherwise truncate the share payload.
    const href = shareHref("whatsapp", url, "شقة & دار #1");
    expect(href).not.toContain("&دار");
    expect(
      decodeURIComponent(new URL(href).searchParams.get("text")!),
    ).toContain("شقة & دار #1");
  });
});
