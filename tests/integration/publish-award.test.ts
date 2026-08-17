// ── THE WIRE BETWEEN PUBLISHING AND EARNING ──────────────────────────────────
// affiliate.test.ts proves qualifyReferral is correct. This proves it is
// actually *called* — that posting a demand which goes straight to the feed
// pays the referrer, and that posting one which lands in the moderation queue
// does not pay anybody until a human says yes.
//
// That distinction is the whole anti-farm design, and it lives in two call
// sites rather than in the function, so it can only be checked here.

import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-taajir";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";

const kReferrer = "publish-referrer";
const kInvitee = "publish-invitee";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
// Push has no emulator, and a notification that did not send must never look
// like a publish that did not happen — which is exactly what the real module
// already assumes.
vi.mock("@/server/push", () => ({
  notifyAuthor: async () => {},
  notifyMatchingSearches: async () => {},
}));
vi.mock("@/server/auth", async () => {
  const real =
    await vi.importActual<typeof import("@/server/auth")>("@/server/auth");
  return {
    ...real,
    getUser: async () => ({
      uid: kInvitee,
      email: null,
      name: "مدعوّ",
      role: "user",
      permissions: [],
    }),
    requireUser: async () => ({
      uid: kInvitee,
      email: null,
      name: "مدعوّ",
      role: "user",
      permissions: [],
    }),
    // The moderator in the approval test. A single stub is enough: nothing here
    // is testing the permission check, which has its own coverage.
    actorWith: async () => ({
      uid: "moderator-uid",
      email: null,
      name: "مشرف",
      role: "moderator",
      permissions: ["requests.moderate"],
    }),
  };
});

const { adminDb } = await import("@/lib/firebase/admin");
const { kAffiliateSettingsPath } = await import("@/server/affiliate");
const { createRequest, approveRequest } =
  await import("@/server/actions/requests");

const db = adminDb();

const kSettings = {
  perReferral: 100,
  pointsPerPublish: 20,
  dailyPublishCap: 2,
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

const kDemand = {
  intent: "vente" as const,
  title: "نشري شقة F3 في باب الزوار",
  description: "ميزانية 800 مليون، الطابق ماشي مهم، نحوّس على شي حاجة قريبة.",
  wilayaSlug: "alger",
  communeSlug: "bab-ezzouar",
};

async function wipe(path: string) {
  const snap = await db.collection(path).limit(500).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

const points = async (uid: string) =>
  ((await db.collection("users").doc(uid).get()).data()?.points as number) ?? 0;

beforeEach(async () => {
  await Promise.all([
    wipe("users"),
    wipe("requests"),
    wipe("pointsLedger"),
    wipe("rateLimits"),
  ]);
  await db.doc(kAffiliateSettingsPath).set(kSettings);
  // The site is open and registrations are not gated, so a clean demand goes
  // straight to the feed — which is the case that pays.
  await db.doc("settings/launch").set({ state: "active", launchAt: null });
  await db.doc("settings/access").set({ requireApproval: false });

  const base = {
    isBanned: false,
    approved: true,
    points: 0,
    referralCount: 0,
    referredBy: null,
    referralQualifiedAt: null,
    createdAt: 1,
  };
  await db
    .collection("users")
    .doc(kReferrer)
    .set({ ...base, uid: kReferrer, displayName: "الداعي" });
  await db
    .collection("users")
    .doc(kInvitee)
    .set({
      ...base,
      uid: kInvitee,
      displayName: "مدعوّ",
      referredBy: kReferrer,
    });
});

describe("createRequest", () => {
  it("pays the referrer when the demand goes straight to the feed", async () => {
    const res = await createRequest(kDemand);

    expect(res).toMatchObject({ ok: true, state: "live" });
    expect(await points(kReferrer)).toBe(100);
  });

  it("pays nobody while the site is still held for launch", async () => {
    await db.doc("settings/launch").set({ state: "prelaunch", launchAt: null });

    const res = await createRequest(kDemand);

    // Held, not refused: the demand exists, it is simply not public yet, and a
    // referral for a post nobody can see is a referral for nothing.
    expect(res).toMatchObject({ ok: true, state: "held" });
    expect(await points(kReferrer)).toBe(0);
  });

  it("pays nobody for a demand the policy check held for review", async () => {
    const res = await createRequest({
      ...kDemand,
      // Off-topic, which is the class the check hands to a human rather than
      // refusing outright.
      description:
        "نحوّس على سكن، ونسقسي زادة على عقد عمل و التأشيرة للهجرة برّا.",
    });

    expect(res).toMatchObject({ ok: true, state: "review" });
    expect(await points(kReferrer)).toBe(0);
  });
});

describe("rewardPublish, through createRequest", () => {
  it("pays the author for their own post, and counts it", async () => {
    await createRequest(kDemand);

    // The author is paid separately from their referrer: the site wants ads,
    // so the site pays for ads.
    expect(await points(kInvitee)).toBe(20);
    const doc = (await db.collection("users").doc(kInvitee).get()).data();
    expect(doc?.publishCount).toBe(1);
  });

  it("stops paying at the daily cap but keeps counting the posts", async () => {
    await createRequest(kDemand);
    await createRequest({ ...kDemand, title: "نشري فيلا في حيدرة" });
    await createRequest({ ...kDemand, title: "نشري محلّ في وهران" });

    // dailyPublishCap is 2, so the third pays nothing…
    expect(await points(kInvitee)).toBe(40);
    // …but still counts towards publishCount, which is what opens the
    // mission gate. Contributing counts even when it does not pay twice.
    const doc = (await db.collection("users").doc(kInvitee).get()).data();
    expect(doc?.publishCount).toBe(3);
  });

  it("pays the author nothing for a post that is not public", async () => {
    await db.doc("settings/launch").set({ state: "prelaunch", launchAt: null });

    await createRequest(kDemand);

    expect(await points(kInvitee)).toBe(0);
    const doc = (await db.collection("users").doc(kInvitee).get()).data();
    expect(doc?.publishCount ?? 0).toBe(0);
  });
});

describe("approveRequest", () => {
  it("pays the referrer at the moment a moderator says yes", async () => {
    // Seeded as pending, the way the policy check leaves an uncertain post.
    const ref = await db.collection("requests").add({
      ownerUid: kInvitee,
      ownerName: "مدعوّ",
      intent: "vente",
      title: kDemand.title,
      description: kDemand.description,
      wilayaSlug: "alger",
      communeSlug: "bab-ezzouar",
      status: "pending",
      replyCount: 0,
      createdAt: Date.now(),
    });
    expect(await points(kReferrer)).toBe(0);

    const res = await approveRequest(ref.id);

    expect(res).toMatchObject({ ok: true });
    expect(await points(kReferrer)).toBe(100);
    expect(
      (await db.collection("requests").doc(ref.id).get()).data()?.status,
    ).toBe("visible");
  });

  it("does not pay a second time when a second demand is approved", async () => {
    const one = await createRequest(kDemand);
    expect(one).toMatchObject({ ok: true, state: "live" });
    expect(await points(kReferrer)).toBe(100);

    const two = await db.collection("requests").add({
      ownerUid: kInvitee,
      ownerName: "مدعوّ",
      intent: "location",
      title: "نكري استوديو في حسين داي",
      description: "نحوّس على استوديو مفروش، ميزانية معقولة، لمدّة طويلة.",
      wilayaSlug: "alger",
      communeSlug: "bab-ezzouar",
      status: "pending",
      replyCount: 0,
      createdAt: Date.now(),
    });
    await approveRequest(two.id);

    expect(await points(kReferrer)).toBe(100);
  });
});
