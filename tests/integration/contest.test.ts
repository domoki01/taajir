// ── THE RACE: MISSIONS, THE THRESHOLD, AND THE PRIZE ─────────────────────────
// Every defence the mission system claims, asserted against a real Firestore.
//
// The claims being tested, in the order they matter:
//   1. a link pays one account exactly once, ever;
//   2. the dwell is measured on the server, so a lying clock buys nothing;
//   3. the secret word must be right, and guessing it is bounded;
//   4. no link pays anybody who has not published something first;
//   5. two claims racing for the last prize cannot both win it.
//
// Each of those is a way somebody would take money out of the campaign, so each
// gets a test rather than a comment.

import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A prize claim stores a Binance handle or a BaridiMob number, so the action
// refuses to run without a key. Set before the imports below.
process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-taajir";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";

/** Flipped by the one test that asks what a signed-out visitor is offered. */
let signedIn = true;

const kUid = "racer-uid";
const kCampaign = "race-1";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const kSession = {
  uid: kUid,
  email: null,
  name: "متسابق",
  role: "user",
  permissions: [],
};

vi.mock("@/server/auth", () => ({
  requireUser: async () => kSession,
  getUser: async () => (signedIn ? kSession : null),
  actorWith: async () => null,
  kForbidden: "ماشي من صلاحياتك",
}));

const { adminDb } = await import("@/lib/firebase/admin");
const { kAffiliateSettingsPath } = await import("@/server/affiliate");
const { claimMission, claimPrize, contestInvite, joinCampaign, startMission } =
  await import("@/server/actions/affiliate");
const { decryptField } = await import("@/server/crypto");

const db = adminDb();

const kSettings = {
  perReferral: 100,
  pointsPerPublish: 20,
  dailyPublishCap: 3,
  dailyLinkPoints: 100,
  bonusEvery: 10,
  bonusPoints: 200,
  pointsPerListingSlot: 100,
  pointsPerFeaturedWeek: 150,
  dinarsPerPoint: 0.5,
  minPayoutPoints: 2000,
  dailyQualifyCap: 5,
  channels: { listingSlot: true, featured: true, redotpay: false, ccp: false },
  enabled: true,
  updatedAt: 1,
  updatedBy: "test",
};

const kPrizes = [
  {
    id: "binance-20",
    kind: "binance",
    label: "بطاقة Binance بـ20$",
    detail: "",
    imageUrl: null,
    storagePath: null,
    stock: 1,
    claimed: 0,
  },
  {
    id: "play-10",
    kind: "playstore",
    label: "بطاقة Google Play",
    detail: "",
    imageUrl: null,
    storagePath: null,
    stock: 2,
    claimed: 0,
  },
];

const kLinks = [
  {
    id: "fb",
    label: "صفحتنا في فيسبوك",
    url: "https://example.com/fb",
    points: 10,
    dwellSeconds: 5,
    answer: null,
    active: true,
  },
  {
    id: "quiz",
    label: "المقال",
    url: "https://example.com/post",
    points: 30,
    dwellSeconds: 5,
    answer: "تأجير",
    active: true,
  },
];

async function wipe(path: string) {
  const snap = await db.collection(path).limit(500).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function wipeCampaigns() {
  const snap = await db.collection("campaigns").limit(100).get();
  for (const campaign of snap.docs) {
    for (const sub of ["entrants", "visits"]) {
      const rows = await campaign.ref.collection(sub).limit(500).get();
      await Promise.all(rows.docs.map((d) => d.ref.delete()));
    }
    await campaign.ref.delete();
  }
}

const account = async () =>
  (await db.collection("users").doc(kUid).get()).data()!;

const entrant = async () =>
  (
    await db
      .collection("campaigns")
      .doc(kCampaign)
      .collection("entrants")
      .doc(kUid)
      .get()
  ).data();

/** Backdate a mission's start so its dwell is satisfied without waiting. */
async function backdate(linkId: string, seconds: number) {
  await db
    .collection("campaigns")
    .doc(kCampaign)
    .collection("visits")
    .doc(`${kUid}__${linkId}`)
    .update({ startedAt: Date.now() - seconds * 1000 });
}

beforeEach(async () => {
  signedIn = true;
  await Promise.all([
    wipe("users"),
    wipe("pointsLedger"),
    wipe("prizeClaims"),
    wipe("rateLimits"),
    wipeCampaigns(),
  ]);
  await db.doc(kAffiliateSettingsPath).set(kSettings);
  await db
    .collection("campaigns")
    .doc(kCampaign)
    .set({
      name: "سباق التجربة",
      prize: "اربح بطاقة",
      status: "live",
      startsAt: 0,
      endsAt: Date.now() + 86_400_000,
      prizeThreshold: 40,
      winners: 3,
      prizes: kPrizes,
      links: kLinks,
      createdAt: 1,
    });
  await db.collection("users").doc(kUid).set({
    uid: kUid,
    displayName: "متسابق",
    isBanned: false,
    points: 0,
    referralCount: 0,
    // Already published once, so the gate is open unless a test closes it.
    publishCount: 1,
    createdAt: 1,
  });
});

describe("joining", () => {
  it("records the chosen prize and starts at zero", async () => {
    const res = await joinCampaign("binance-20");

    expect(res.ok).toBe(true);
    expect(await entrant()).toMatchObject({
      uid: kUid,
      prizeId: "binance-20",
      points: 0,
      unlockedAt: null,
    });
  });

  it("refuses a prize that is not on the shelf", async () => {
    expect(await joinCampaign("nope")).toMatchObject({ ok: false });
    expect(await entrant()).toBeUndefined();
  });

  it("lets the prize be changed before the line is crossed", async () => {
    await joinCampaign("binance-20");
    await joinCampaign("play-10");
    expect((await entrant())?.prizeId).toBe("play-10");
  });

  it("does not reset the score when the prize is changed", async () => {
    await joinCampaign("binance-20");
    await startMission("fb");
    await backdate("fb", 10);
    await claimMission("fb");
    expect((await entrant())?.points).toBe(10);

    await joinCampaign("play-10");
    expect((await entrant())?.points).toBe(10);
  });
});

describe("missions", () => {
  it("pays once the dwell has actually elapsed", async () => {
    await joinCampaign("binance-20");
    const started = await startMission("fb");
    expect(started).toMatchObject({ ok: true, url: "https://example.com/fb" });

    await backdate("fb", 10);
    const res = await claimMission("fb");

    expect(res.ok).toBe(true);
    expect((await account()).points).toBe(10);
    expect((await entrant())?.points).toBe(10);
  });

  it("refuses a claim that comes back too fast", async () => {
    await joinCampaign("binance-20");
    await startMission("fb");

    // No backdating: the dwell is measured between two server timestamps, so
    // this is the case where a browser claims to have waited and had not.
    const res = await claimMission("fb");

    expect(res).toMatchObject({ ok: false });
    expect((await account()).points).toBe(0);
  });

  it("refuses a claim for a mission that was never opened", async () => {
    await joinCampaign("binance-20");

    const res = await claimMission("fb");

    expect(res).toMatchObject({ ok: false });
    expect((await account()).points).toBe(0);
  });

  it("pays a link exactly once, however many times it is claimed", async () => {
    await joinCampaign("binance-20");
    await startMission("fb");
    await backdate("fb", 10);

    expect((await claimMission("fb")).ok).toBe(true);
    expect((await claimMission("fb")).ok).toBe(false);
    // Re-opening it does not reopen the payment either.
    await startMission("fb");
    expect((await claimMission("fb")).ok).toBe(false);

    expect((await account()).points).toBe(10);
  });

  it("checks the secret word, and forgives only spelling", async () => {
    await joinCampaign("binance-20");
    await startMission("quiz");
    await backdate("quiz", 10);

    expect(await claimMission("quiz", "حاجة أخرى")).toMatchObject({
      ok: false,
    });
    expect((await account()).points).toBe(0);

    // Spaces and a stray hamza are forgiven; the word itself is not.
    expect((await claimMission("quiz", "  تاجير ")).ok).toBe(true);
    expect((await account()).points).toBe(30);
  });

  it("burns a mission after ten wrong answers", async () => {
    await joinCampaign("binance-20");
    await startMission("quiz");
    await backdate("quiz", 10);

    for (let i = 0; i < 10; i++) await claimMission("quiz", `guess-${i}`);
    // Right answer, too late: a one-word question is otherwise brute-forceable.
    expect(await claimMission("quiz", "تأجير")).toMatchObject({ ok: false });
    expect((await account()).points).toBe(0);
  });

  it("pays nobody who has not published anything", async () => {
    await joinCampaign("binance-20");
    await db.collection("users").doc(kUid).update({ publishCount: 0 });

    expect(await startMission("fb")).toMatchObject({ ok: false });
    expect((await account()).points).toBe(0);
  });

  it("pays nobody who has not entered the race", async () => {
    expect(await startMission("fb")).toMatchObject({ ok: false });
    expect(await claimMission("fb")).toMatchObject({ ok: false });
  });

  it("stops at the daily link-points cap", async () => {
    await db
      .doc(kAffiliateSettingsPath)
      .set({ ...kSettings, dailyLinkPoints: 10 });
    await joinCampaign("binance-20");

    await startMission("fb");
    await backdate("fb", 10);
    expect((await claimMission("fb")).ok).toBe(true);

    // 10 spent, and the next link costs 30 — over the cap, so refused whole.
    await startMission("quiz");
    await backdate("quiz", 10);
    expect(await claimMission("quiz", "تأجير")).toMatchObject({ ok: false });
    expect((await account()).points).toBe(10);
  });

  it("refuses a mission the admin switched off", async () => {
    await joinCampaign("binance-20");
    await db
      .collection("campaigns")
      .doc(kCampaign)
      .update({ links: [{ ...kLinks[0], active: false }, kLinks[1]] });

    expect(await startMission("fb")).toMatchObject({ ok: false });
  });
});

describe("the threshold and the prize", () => {
  it("unlocks the moment the line is crossed, and stamps when", async () => {
    await joinCampaign("binance-20");
    await startMission("quiz");
    await backdate("quiz", 10);
    await claimMission("quiz", "تأجير");
    expect((await entrant())?.unlockedAt).toBe(null);

    await startMission("fb");
    await backdate("fb", 10);
    await claimMission("fb");

    // 30 + 10 = 40, which is the threshold.
    expect((await entrant())?.points).toBe(40);
    expect((await entrant())?.unlockedAt).toBeGreaterThan(0);
  });

  it("refuses a claim from somebody short of the line", async () => {
    await joinCampaign("binance-20");
    await startMission("fb");
    await backdate("fb", 10);
    await claimMission("fb");

    expect(await claimPrize("binance-id-123")).toMatchObject({ ok: false });
    expect((await db.collection("prizeClaims").get()).size).toBe(0);
  });

  it("takes the prize off the shelf when it is claimed", async () => {
    await joinCampaign("binance-20");
    await db
      .collection("campaigns")
      .doc(kCampaign)
      .collection("entrants")
      .doc(kUid)
      .update({ points: 100, unlockedAt: Date.now() });

    const res = await claimPrize("binance-id-123");

    expect(res.ok).toBe(true);
    const campaign = (
      await db.collection("campaigns").doc(kCampaign).get()
    ).data()!;
    expect(campaign.prizes[0]).toMatchObject({ id: "binance-20", claimed: 1 });
    const claim = (await db.collection("prizeClaims").get()).docs[0].data();
    expect(claim).toMatchObject({
      uid: kUid,
      prizeId: "binance-20",
      status: "requested",
    });
    // The handle we would send money to is not readable in the document.
    expect(claim.destination).not.toContain("binance-id-123");
    expect(decryptField(claim.destination)).toBe("binance-id-123");
  });

  it("cannot be claimed twice by two requests racing", async () => {
    await joinCampaign("binance-20");
    await db
      .collection("campaigns")
      .doc(kCampaign)
      .collection("entrants")
      .doc(kUid)
      .update({ points: 100, unlockedAt: Date.now() });

    const [a, b] = await Promise.all([
      claimPrize("binance-id-123"),
      claimPrize("binance-id-123"),
    ]);

    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const campaign = (
      await db.collection("campaigns").doc(kCampaign).get()
    ).data()!;
    expect(campaign.prizes[0].claimed).toBe(1);
    expect((await db.collection("prizeClaims").get()).size).toBe(1);
  });

  it("refuses a prize whose stock is gone", async () => {
    await joinCampaign("binance-20");
    await db
      .collection("campaigns")
      .doc(kCampaign)
      .update({ prizes: [{ ...kPrizes[0], claimed: 1 }, kPrizes[1]] });
    await db
      .collection("campaigns")
      .doc(kCampaign)
      .collection("entrants")
      .doc(kUid)
      .update({ points: 100, unlockedAt: Date.now() });

    expect(await claimPrize("binance-id-123")).toMatchObject({ ok: false });
  });

  it("refuses everybody once the winners cap is reached", async () => {
    await joinCampaign("play-10");
    await db
      .collection("campaigns")
      .doc(kCampaign)
      .update({
        winners: 1,
        prizes: [{ ...kPrizes[0], claimed: 1 }, kPrizes[1]],
      });
    await db
      .collection("campaigns")
      .doc(kCampaign)
      .collection("entrants")
      .doc(kUid)
      .update({ points: 100, unlockedAt: Date.now() });

    // The Play card still has stock, but the campaign has already given out
    // the one prize it was allowed to.
    expect(await claimPrize("someone@example.com")).toMatchObject({
      ok: false,
    });
  });

  it("refuses a claim outright when no encryption key is set", async () => {
    const saved = process.env.FIELD_ENCRYPTION_KEY;
    delete process.env.FIELD_ENCRYPTION_KEY;
    await joinCampaign("binance-20");
    await db
      .collection("campaigns")
      .doc(kCampaign)
      .collection("entrants")
      .doc(kUid)
      .update({ points: 100, unlockedAt: Date.now() });

    // Refused before the prize leaves the shelf: a claim that cannot store its
    // destination safely must not consume stock and lose the address.
    expect(await claimPrize("binance-id-123")).toMatchObject({ ok: false });
    const campaign = (
      await db.collection("campaigns").doc(kCampaign).get()
    ).data()!;
    expect(campaign.prizes[0].claimed).toBe(0);
    process.env.FIELD_ENCRYPTION_KEY = saved;
  });

  it("refuses a disqualified entrant", async () => {
    await joinCampaign("binance-20");
    await db
      .collection("campaigns")
      .doc(kCampaign)
      .collection("entrants")
      .doc(kUid)
      .update({ points: 100, unlockedAt: Date.now(), disqualified: true });

    expect(await claimPrize("binance-id-123")).toMatchObject({ ok: false });
    expect(await startMission("fb")).toMatchObject({ ok: false });
  });
});

// ── THE SIGN-UP INVITATION ───────────────────────────────────────────────────
// A dialog nobody asked for, so every reason not to show it is a test. What is
// being protected here is the account that has *already* joined and the visitor
// between campaigns: showing either of them this is a bug, not a nuisance.

describe("contestInvite", () => {
  it("offers the live race, with the shelf and the line to cross", async () => {
    const offer = await contestInvite();

    expect(offer).toMatchObject({
      campaignId: kCampaign,
      name: "سباق التجربة",
      threshold: 40,
    });
    expect(offer!.prizes.map((p) => p.id)).toEqual(["binance-20", "play-10"]);
    expect(offer!.prizes[0].soldOut).toBe(false);
  });

  it("never ships the missions with it", async () => {
    // The dialog needs three cards and a number. The links carry the secret
    // words the missions are scored on, and handing those to a browser before
    // the race starts would answer every question in it.
    const offer = await contestInvite();

    const flat = JSON.stringify(offer);
    expect(flat).not.toContain("example.com");
    expect(flat).not.toContain("dwellSeconds");
    // The answer itself is the site's own name in this fixture, so a substring
    // search for it would prove nothing. The field is what must be absent.
    expect(flat).not.toContain("answer");
    expect(Object.keys(offer!)).not.toContain("links");
  });

  it("says nothing to somebody already racing", async () => {
    await joinCampaign("binance-20");

    expect(await contestInvite()).toBeNull();
  });

  it("says nothing when the admin switched the popup off", async () => {
    await db
      .doc(kAffiliateSettingsPath)
      .set({ ...kSettings, contestPopup: false });

    expect(await contestInvite()).toBeNull();
  });

  it("says nothing while the whole programme is off", async () => {
    await db.doc(kAffiliateSettingsPath).set({ ...kSettings, enabled: false });

    expect(await contestInvite()).toBeNull();
  });

  it("says nothing when the campaign has not started or has ended", async () => {
    await db
      .collection("campaigns")
      .doc(kCampaign)
      .update({ endsAt: Date.now() - 1000 });

    expect(await contestInvite()).toBeNull();
  });

  it("says nothing when every prize is gone", async () => {
    // A shelf with nothing left on it is not an invitation.
    await db
      .collection("campaigns")
      .doc(kCampaign)
      .update({
        prizes: kPrizes.map((p) => ({ ...p, claimed: p.stock })),
      });

    expect(await contestInvite()).toBeNull();
  });

  it("says nothing to a visitor with no session", async () => {
    signedIn = false;

    expect(await contestInvite()).toBeNull();
  });

  it("still offers when only some of the shelf is gone", async () => {
    await db
      .collection("campaigns")
      .doc(kCampaign)
      .update({
        prizes: [{ ...kPrizes[0], claimed: 1 }, kPrizes[1]],
      });

    const offer = await contestInvite();

    expect(offer!.prizes[0].soldOut).toBe(true);
    expect(offer!.prizes[1].soldOut).toBe(false);
  });
});
