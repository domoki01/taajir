// ── SPENDING POINTS, AGAINST A REAL FIRESTORE ────────────────────────────────
// The other half of the money path. `redeem` is a Server Action, so the two
// things it depends on that only exist inside a Next request — the session and
// the cache — are stubbed, and everything else is the real code against the
// emulator.

import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-taajir";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";

const kUid = "spender-uid";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/auth", () => ({
  requireUser: async () => ({
    uid: kUid,
    email: null,
    name: "منفق",
    role: "user",
    permissions: [],
  }),
  actorWith: async () => null,
  kForbidden: "ماشي من صلاحياتك",
}));

const { adminDb } = await import("@/lib/firebase/admin");
const { kAffiliateSettingsPath } = await import("@/server/affiliate");
const { redeem } = await import("@/server/actions/affiliate");

const db = adminDb();

const kSettings = {
  perReferral: 100,
  bonusEvery: 10,
  bonusPoints: 200,
  pointsPerListingSlot: 100,
  pointsPerFeaturedWeek: 150,
  dinarsPerPoint: 0.5,
  minPayoutPoints: 2000,
  dailyQualifyCap: 5,
  channels: { listingSlot: true, featured: true, redotpay: true, ccp: true },
  enabled: true,
  updatedAt: 1,
  updatedBy: "test",
};

async function spender(points: number, extra: Record<string, unknown> = {}) {
  await db
    .collection("users")
    .doc(kUid)
    .set({
      uid: kUid,
      displayName: "منفق",
      isBanned: false,
      points,
      listingQuota: 3,
      featuredQuota: 0,
      ...extra,
    });
}

const doc = async () => (await db.collection("users").doc(kUid).get()).data()!;

async function wipe(path: string) {
  const snap = await db.collection(path).limit(500).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

beforeEach(async () => {
  await Promise.all([wipe("users"), wipe("payouts"), wipe("pointsLedger")]);
  await db.doc(kAffiliateSettingsPath).set(kSettings);
});

describe("redeem", () => {
  it("turns points into an ad slot on the spot", async () => {
    await spender(250);

    const res = await redeem("listingSlot");

    expect(res.ok).toBe(true);
    const after = await doc();
    expect(after.points).toBe(150);
    expect(after.listingQuota).toBe(4);
    // The in-kind channels are settled, not requested: nobody waits on a human
    // for a field the site can write itself.
    const payouts = await db.collection("payouts").get();
    expect(payouts.docs[0].data()).toMatchObject({
      channel: "listingSlot",
      status: "paid",
      points: 100,
    });
  });

  it("refuses a balance that does not cover it, and changes nothing", async () => {
    await spender(50);

    const res = await redeem("listingSlot");

    expect(res).toMatchObject({ ok: false });
    const after = await doc();
    expect(after.points).toBe(50);
    expect(after.listingQuota).toBe(3);
    expect((await db.collection("payouts").get()).size).toBe(0);
  });

  it("holds the points the moment a cash request is made", async () => {
    await spender(2500);

    const res = await redeem("ccp", "00799999000123456789");

    expect(res.ok).toBe(true);
    // Deducted now, not on payment. Otherwise a balance of 2000 could be
    // requested to four different RIP numbers before a moderator looked once.
    expect((await doc()).points).toBe(500);
    const payout = (await db.collection("payouts").get()).docs[0].data();
    expect(payout).toMatchObject({
      channel: "ccp",
      status: "requested",
      points: 2000,
      amountDzd: 1000,
      destination: "00799999000123456789",
    });
  });

  it("refuses a cash request with no destination", async () => {
    await spender(2500);

    const res = await redeem("ccp", "  ");

    expect(res).toMatchObject({ ok: false });
    expect((await doc()).points).toBe(2500);
  });

  it("refuses a channel the admin has closed", async () => {
    await db
      .doc(kAffiliateSettingsPath)
      .set({ ...kSettings, channels: { ...kSettings.channels, ccp: false } });
    await spender(2500);

    const res = await redeem("ccp", "00799999000123456789");

    expect(res).toMatchObject({ ok: false });
    expect((await doc()).points).toBe(2500);
  });

  it("refuses everything while the programme is off", async () => {
    await db.doc(kAffiliateSettingsPath).set({ ...kSettings, enabled: false });
    await spender(250);

    expect(await redeem("listingSlot")).toMatchObject({ ok: false });
    expect((await doc()).points).toBe(250);
  });

  it("refuses a suspended account", async () => {
    await spender(250, { isBanned: true });

    expect(await redeem("listingSlot")).toMatchObject({ ok: false });
    expect((await doc()).points).toBe(250);
  });

  it("cannot be spent twice by two requests racing", async () => {
    await spender(150);

    // 150 points, two 100-point slots. The transaction is what makes exactly
    // one of these win; without it both read 150 and both succeed.
    const [a, b] = await Promise.all([
      redeem("listingSlot"),
      redeem("listingSlot"),
    ]);

    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const after = await doc();
    expect(after.points).toBe(50);
    expect(after.listingQuota).toBe(4);
  });
});
