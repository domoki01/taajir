// ── THE AWARD PATH, AGAINST A REAL FIRESTORE ─────────────────────────────────
// Run with:
//
//   npm run test:affiliate
//
// The rules suite proves nobody can write these collections from a browser.
// This one proves the server writes them correctly — which is the other half,
// and the half where a mistake means paying twice for one signup, or paying a
// farm, or silently paying nobody at all.
//
// It imports the real modules rather than reimplementing them: a test that
// hand-rolls the transaction proves only that the test agrees with itself.
//
// Both files here share one emulator and the same collections, so the runner is
// given --no-file-parallelism. Two suites wiping `users` at the same time is a
// flake, not a finding.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-taajir";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";

const { adminDb } = await import("@/lib/firebase/admin");
const {
  clawbackReferral,
  ensureReferralCode,
  kAffiliateSettingsPath,
  qualifyReferral,
  referrerFor,
  standings,
} = await import("@/server/affiliate");

const db = adminDb();

const kReferrer = "referrer-uid";
const kInvitee = "invitee-uid";
const kSecond = "second-invitee-uid";

/** The defaults, with the programme switched on and a small cap to test it. */
const kSettings = {
  perReferral: 100,
  bonusEvery: 2,
  bonusPoints: 50,
  pointsPerListingSlot: 100,
  pointsPerFeaturedWeek: 150,
  dinarsPerPoint: 0.5,
  minPayoutPoints: 2000,
  dailyQualifyCap: 2,
  channels: { listingSlot: true, featured: true, redotpay: false, ccp: false },
  enabled: true,
  updatedAt: 1,
  updatedBy: "test",
};

async function wipe(path: string) {
  const snap = await db.collection(path).limit(500).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

/**
 * Campaigns, and the entrants under them.
 *
 * Deleting a document does not delete its subcollections — in Firestore the
 * parent is barely a parent — so wiping `campaigns` alone leaves every
 * leaderboard row behind and the next test starts with someone already winning.
 */
async function wipeCampaigns() {
  const snap = await db.collection("campaigns").limit(100).get();
  for (const campaign of snap.docs) {
    const entrants = await campaign.ref.collection("entrants").limit(500).get();
    await Promise.all(entrants.docs.map((d) => d.ref.delete()));
    await campaign.ref.delete();
  }
}

async function user(uid: string, extra: Record<string, unknown> = {}) {
  await db
    .collection("users")
    .doc(uid)
    .set({
      uid,
      displayName: uid,
      isBanned: false,
      points: 0,
      referralCount: 0,
      referredBy: null,
      referralQualifiedAt: null,
      createdAt: 1,
      ...extra,
    });
}

const points = async (uid: string) =>
  ((await db.collection("users").doc(uid).get()).data()?.points as number) ?? 0;

const ledger = async (uid: string) =>
  (await db.collection("pointsLedger").where("uid", "==", uid).get()).docs.map(
    (d) => d.data(),
  );

beforeAll(async () => {
  // A settings read is cached per React request; these tests run outside one,
  // so each call re-reads and the document below is what they all see.
  await db.doc(kAffiliateSettingsPath).set(kSettings);
});

beforeEach(async () => {
  await Promise.all([
    wipe("users"),
    wipe("pointsLedger"),
    wipe("referralCodes"),
    wipeCampaigns(),
  ]);
  await db.doc(kAffiliateSettingsPath).set(kSettings);
});

describe("ensureReferralCode", () => {
  it("mints a code once and keeps returning the same one", async () => {
    await user(kReferrer);
    const first = await ensureReferralCode(kReferrer);
    const second = await ensureReferralCode(kReferrer);

    expect(first).toMatch(/^[23456789BCDFGHJKLMNPQRSTVWXYZ]{6}$/);
    expect(second).toBe(first);
    // The mirror is what makes a link resolve in one read by id.
    expect(await referrerFor(first!)).toBe(kReferrer);
    expect(await referrerFor(first!.toLowerCase())).toBe(kReferrer);
  });

  it("resolves nothing for a code shaped like a path", async () => {
    expect(await referrerFor("../users/admin")).toBe(null);
  });
});

describe("qualifyReferral", () => {
  it("pays the referrer once, with a ledger row naming the invitee", async () => {
    await user(kReferrer);
    await user(kInvitee, { referredBy: kReferrer });

    await qualifyReferral(kInvitee);

    expect(await points(kReferrer)).toBe(100);
    const rows = await ledger(kReferrer);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      delta: 100,
      reason: "referral",
      refUid: kInvitee,
    });
    // The invitee is stamped, which is what makes the second call a no-op.
    const stamp = (await db.collection("users").doc(kInvitee).get()).data();
    expect(stamp?.referralQualifiedAt).toBeGreaterThan(0);
  });

  it("does not pay twice when the same account publishes again", async () => {
    await user(kReferrer);
    await user(kInvitee, { referredBy: kReferrer });

    await qualifyReferral(kInvitee);
    await qualifyReferral(kInvitee);
    await qualifyReferral(kInvitee);

    expect(await points(kReferrer)).toBe(100);
    expect(await ledger(kReferrer)).toHaveLength(1);
  });

  it("pays the milestone bonus on the right referral", async () => {
    await user(kReferrer);
    await user(kInvitee, { referredBy: kReferrer });
    await user(kSecond, { referredBy: kReferrer });

    await qualifyReferral(kInvitee);
    await qualifyReferral(kSecond);

    // bonusEvery is 2, so the second referral carries 100 + 50.
    expect(await points(kReferrer)).toBe(250);
    const rows = await ledger(kReferrer);
    expect(rows.filter((r) => r.reason === "bonus")).toHaveLength(1);
  });

  it("stops at the daily cap", async () => {
    await user(kReferrer);
    for (const uid of ["a", "b", "c", "d"]) {
      await user(uid, { referredBy: kReferrer });
    }

    for (const uid of ["a", "b", "c", "d"]) await qualifyReferral(uid);

    // dailyQualifyCap is 2: the third and fourth earn nothing, and — the part
    // that matters — they are not stamped, so they can still count tomorrow.
    expect(await points(kReferrer)).toBe(250);
    const third = (await db.collection("users").doc("c").get()).data();
    expect(third?.referralQualifiedAt ?? null).toBe(null);
  });

  it("pays nothing while the programme is switched off", async () => {
    await db.doc(kAffiliateSettingsPath).set({ ...kSettings, enabled: false });
    await user(kReferrer);
    await user(kInvitee, { referredBy: kReferrer });

    await qualifyReferral(kInvitee);

    expect(await points(kReferrer)).toBe(0);
    expect(await ledger(kReferrer)).toHaveLength(0);
  });

  it("pays nothing for an account that names itself", async () => {
    await user(kInvitee, { referredBy: kInvitee });
    await qualifyReferral(kInvitee);
    expect(await points(kInvitee)).toBe(0);
  });

  it("pays nothing to a suspended referrer", async () => {
    await user(kReferrer, { isBanned: true });
    await user(kInvitee, { referredBy: kReferrer });

    await qualifyReferral(kInvitee);

    expect(await points(kReferrer)).toBe(0);
    // Not stamped either: the referral is unpaid, not spent.
    const stamp = (await db.collection("users").doc(kInvitee).get()).data();
    expect(stamp?.referralQualifiedAt ?? null).toBe(null);
  });

  it("counts towards the live campaign, and only the live one", async () => {
    await user(kReferrer);
    await user(kInvitee, { referredBy: kReferrer });
    await db
      .collection("campaigns")
      .doc("live-1")
      .set({
        name: "سباق",
        prize: "هاتف",
        status: "live",
        startsAt: 0,
        endsAt: Date.now() + 86_400_000,
        winners: 1,
        createdAt: 1,
      });
    await db
      .collection("campaigns")
      .doc("draft-1")
      .set({
        name: "مسوّدة",
        prize: "هاتف",
        status: "draft",
        startsAt: 0,
        endsAt: Date.now() + 86_400_000,
        winners: 1,
        createdAt: 1,
      });

    await qualifyReferral(kInvitee);

    const board = await standings("live-1");
    expect(board).toHaveLength(1);
    expect(board[0]).toMatchObject({ uid: kReferrer, count: 1 });
    expect(await standings("draft-1")).toHaveLength(0);
  });
});

describe("clawbackReferral", () => {
  it("takes the points back and unstamps the banned account", async () => {
    await user(kReferrer);
    await user(kInvitee, { referredBy: kReferrer });
    await qualifyReferral(kInvitee);
    expect(await points(kReferrer)).toBe(100);

    await clawbackReferral(kInvitee);

    expect(await points(kReferrer)).toBe(0);
    const rows = await ledger(kReferrer);
    expect(rows.filter((r) => r.reason === "clawback")).toHaveLength(1);
    const stamp = (await db.collection("users").doc(kInvitee).get()).data();
    expect(stamp?.referralQualifiedAt ?? null).toBe(null);
  });

  it("does nothing for an account that never counted", async () => {
    await user(kReferrer, { points: 500 });
    await user(kInvitee, { referredBy: kReferrer });

    await clawbackReferral(kInvitee);

    expect(await points(kReferrer)).toBe(500);
  });

  it("drops the banned account's referral out of the standings", async () => {
    await user(kReferrer);
    await user(kInvitee, { referredBy: kReferrer });
    await db
      .collection("campaigns")
      .doc("live-1")
      .set({
        name: "سباق",
        prize: "هاتف",
        status: "live",
        startsAt: 0,
        endsAt: Date.now() + 86_400_000,
        winners: 1,
        createdAt: 1,
      });

    await qualifyReferral(kInvitee);
    await clawbackReferral(kInvitee);

    const board = await standings("live-1");
    expect(board[0]?.count).toBe(0);
  });
});
