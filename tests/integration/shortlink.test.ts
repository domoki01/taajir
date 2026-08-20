// ── THE SHORTENER, AGAINST A REAL FIRESTORE ──────────────────────────────────
// The unit tests hold the allowlist. This holds the half that only exists once
// there is a database: that the same destination always mints the same code —
// otherwise every share of the same ad is a new row and a different link — and
// that a code resolves back to exactly what it was minted for.

import { beforeEach, describe, expect, it } from "vitest";

process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-taajir";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";

const { adminDb } = await import("@/lib/firebase/admin");
const { kShortLinks, resolveShortLink, shortenPath } =
  await import("@/server/shortlink");
const { kShortCodePattern } = await import("@/lib/shortlink");

const db = adminDb();
const kPath = "/demandes/BodalBbKvTtVFa9xD5y2";
const kAd = "/annonce/abc123/شقة-f3";

beforeEach(async () => {
  const snap = await db.collection(kShortLinks).limit(500).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
});

describe("shortenPath", () => {
  it("mints a well-formed code and stores where it points", async () => {
    const code = await shortenPath(kPath, "275M8V");

    expect(code).not.toBeNull();
    expect(kShortCodePattern.test(code!)).toBe(true);
    expect(await resolveShortLink(code!)).toMatchObject({
      path: kPath,
      ref: "275M8V",
    });
  });

  it("returns the same code for the same share, without a second row", async () => {
    // Otherwise every visit to an ad mints another link, and the one already
    // circulating in a group becomes one of many.
    const first = await shortenPath(kPath, "275M8V");
    const second = await shortenPath(kPath, "275M8V");

    expect(second).toBe(first);
    expect((await db.collection(kShortLinks).get()).size).toBe(1);
  });

  it("gives two sharers of one ad two different links", async () => {
    // They have to resolve to different referral credit.
    const mine = await shortenPath(kPath, "275M8V");
    const yours = await shortenPath(kPath, "K7M2QX");
    const anonymous = await shortenPath(kPath, null);

    expect(new Set([mine, yours, anonymous]).size).toBe(3);
    expect((await resolveShortLink(yours!))?.ref).toBe("K7M2QX");
    expect((await resolveShortLink(anonymous!))?.ref).toBeNull();
  });

  it("keeps listings and demands apart", async () => {
    expect(await shortenPath(kAd, null)).not.toBe(
      await shortenPath(kPath, null),
    );
  });

  it("refuses to mint anything that is not shareable", async () => {
    for (const path of ["https://evil.example", "/admin", "/tableau-de-bord"]) {
      expect(await shortenPath(path, null), path).toBeNull();
    }
    expect((await db.collection(kShortLinks).get()).size).toBe(0);
  });
});

describe("resolveShortLink", () => {
  it("answers null for a code nobody minted", async () => {
    expect(await resolveShortLink("ZZZZZZZ")).toBeNull();
  });

  it("refuses a row whose destination is no longer allowed", async () => {
    // Checked on the way out as well as on the way in: this row decides where
    // a browser is sent, and a table entry is not a promise about its contents.
    await db
      .collection(kShortLinks)
      .doc("BBBBBBB")
      .set({ path: "https://evil.example", ref: null, createdAt: Date.now() });

    expect(await resolveShortLink("BBBBBBB")).toBeNull();
  });
});
