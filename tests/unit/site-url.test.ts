// ── ONE ADDRESS, IN TWO FILES ────────────────────────────────────────────────
// The origin the site hands out lives in apphosting.yaml; the redirect that
// retires the old one lives in next.config.ts. Nothing links the two, and both
// failure modes are silent: a stale origin poisons every invite link, every
// canonical tag and every OpenGraph URL without erroring anywhere, and a
// redirect pointing somewhere else sends real traffic to the wrong host.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const yaml = readFileSync("apphosting.yaml", "utf8");
const config = readFileSync("next.config.ts", "utf8");

/** The value of NEXT_PUBLIC_SITE_URL as App Hosting will read it. */
function deployedOrigin(): string {
  const at = yaml.indexOf("- variable: NEXT_PUBLIC_SITE_URL");
  expect(at, "NEXT_PUBLIC_SITE_URL is not declared").toBeGreaterThan(-1);
  const match = yaml.slice(at).match(/value:\s*(\S+)/);
  return match![1];
}

describe("the site's public origin", () => {
  it("is the custom domain, not the generated backend hostname", () => {
    const origin = deployedOrigin();
    expect(origin).toBe("https://taajirdz.com");
    expect(origin).not.toContain("hosted.app");
  });

  it("is an https origin with no trailing slash", () => {
    // Every use concatenates a path onto it — `${kSiteUrl}/annonce/…` — so a
    // trailing slash produces a double slash in links people paste and share.
    const origin = deployedOrigin();
    expect(origin.startsWith("https://")).toBe(true);
    expect(origin.endsWith("/")).toBe(false);
    expect(() => new URL(origin)).not.toThrow();
  });

  it("is available at build time, not only at runtime", () => {
    // Baked into the bundle by next/metadata; a RUNTIME-only value leaves the
    // build with the localhost fallback in every canonical tag.
    const block = yaml.slice(yaml.indexOf("- variable: NEXT_PUBLIC_SITE_URL"));
    const next = block.indexOf("- variable:", 1);
    const mine = next === -1 ? block : block.slice(0, next);
    expect(mine).toContain("BUILD");
    expect(mine).toContain("RUNTIME");
  });

  it("redirects the generated hostname to that same origin", () => {
    expect(config).toContain("taajir--newmokit.europe-west4.hosted.app");
    expect(config).toContain(`destination: "${deployedOrigin()}/:path*"`);
  });

  it("also matches the header the proxy actually sends", () => {
    // The Host header alone is not enough on App Hosting: it carries the Cloud
    // Run container's own address, so a host-only rule passes every local test
    // and matches nothing in production. The public name is in x-forwarded-host,
    // and this rule is the one that does the work on the live site.
    const at = config.indexOf("async redirects()");
    expect(config.slice(at)).toContain('key: "x-forwarded-host"');
  });

  it("matches the redirect on the host, never on the path alone", () => {
    // Without the host condition this rule would fire on the custom domain too
    // and redirect the site to itself, forever.
    const at = config.indexOf("async redirects()");
    expect(at).toBeGreaterThan(-1);
    expect(config.slice(at)).toContain('type: "host"');
  });
});
