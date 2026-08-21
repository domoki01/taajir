// ── SEARCH CONSOLE OWNERSHIP ─────────────────────────────────────────────────
// This tag fails silently in both directions. A missing or malformed one means
// Search Console keeps saying "propriété non validée" with no page to inspect —
// there is no error anywhere, just a dashboard that never fills in. And the
// shape is easy to get wrong: the value Google displays for the DNS method is
// the whole record, `google-site-verification=<token>`, while the meta tag
// wants the token by itself. Pasting the record verbatim yields a tag that
// looks right in view-source and verifies nothing.

import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const kRoot = resolve(import.meta.dirname, "../..");

/** The constant is read at module load, so each case needs a fresh module. */
async function tokenFor(value: string | undefined): Promise<string> {
  if (value === undefined)
    delete process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
  else process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION = value;
  vi.resetModules();
  return (await import("@/lib/constants")).kGoogleSiteVerification;
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
});

describe("kGoogleSiteVerification", () => {
  it("takes a bare token as it stands", async () => {
    expect(await tokenFor("Bab1MWRNxemvglKtF8cJgfIL08PchaTa6270QiT-CwI")).toBe(
      "Bab1MWRNxemvglKtF8cJgfIL08PchaTa6270QiT-CwI",
    );
  });

  it("strips the record name off a value copied from the DNS panel", async () => {
    expect(
      await tokenFor(
        "google-site-verification=Bab1MWRNxemvglKtF8cJgfIL08PchaTa6270QiT-CwI",
      ),
    ).toBe("Bab1MWRNxemvglKtF8cJgfIL08PchaTa6270QiT-CwI");
  });

  it("survives the whitespace a paste brings with it", async () => {
    expect(await tokenFor("  google-site-verification = abc123  ")).toBe(
      "abc123",
    );
  });

  it("is empty, not undefined, when nothing is configured", async () => {
    expect(await tokenFor(undefined)).toBe("");
    expect(await tokenFor("   ")).toBe("");
  });
});

describe("the deployed configuration", () => {
  const yaml = readFileSync(resolve(kRoot, "apphosting.yaml"), "utf8");

  it("declares the token at BUILD as well as RUNTIME", () => {
    // The home page is statically generated. A runtime-only value would be
    // absent from the very document Google fetches to check.
    const block = yaml
      .slice(yaml.indexOf("NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION"))
      .slice(0, 200);
    expect(block).toContain("BUILD");
    expect(block).toContain("RUNTIME");
  });

  it("stores the token without the record name in front of it", () => {
    const match = yaml.match(
      /NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION\s*\n\s*value:\s*(\S+)/,
    );
    expect(match).not.toBeNull();
    expect(match![1]).not.toContain("google-site-verification");
    expect(match![1].length).toBeGreaterThan(20);
  });
});

describe("the document head", () => {
  const layout = readFileSync(resolve(kRoot, "src/app/layout.tsx"), "utf8");

  it("hands the token to Next's metadata rather than hand-rolling a tag", () => {
    expect(layout).toContain("kGoogleSiteVerification");
    expect(layout).toMatch(/verification:/);
  });
});
