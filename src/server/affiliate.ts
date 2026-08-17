import "server-only";

import { cache } from "react";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import {
  kCodeAlphabet,
  kCodeLength,
  kReferralCodePattern,
} from "@/lib/referral";
import {
  kDefaultAffiliateSettings,
  type AffiliateSettings,
  type Campaign,
  type Entrant,
  type LedgerEntry,
  type Payout,
} from "@/types/affiliate";

export const kAffiliateSettingsPath = "settings/affiliate";

/** Read once per request, and never allowed to fail into a broken page. */
export const getAffiliateSettings = cache(
  async (): Promise<AffiliateSettings> => {
    try {
      const snap = await adminDb().doc(kAffiliateSettingsPath).get();
      if (!snap.exists) return kDefaultAffiliateSettings;
      const stored = snap.data() as Partial<AffiliateSettings>;
      // Merged over the defaults rather than used raw: a settings document
      // written before a field existed must not read back as zero points per
      // referral.
      return {
        ...kDefaultAffiliateSettings,
        ...stored,
        channels: {
          ...kDefaultAffiliateSettings.channels,
          ...(stored.channels ?? {}),
        },
      };
    } catch (error) {
      console.error("[affiliate] settings read failed:", error);
      return kDefaultAffiliateSettings;
    }
  },
);

function randomCode(): string {
  let out = "";
  for (let i = 0; i < kCodeLength; i++) {
    out += kCodeAlphabet[Math.floor(Math.random() * kCodeAlphabet.length)];
  }
  return out;
}

/**
 * The code for an account, minted on first ask.
 *
 * Stored on the user document and mirrored in `referralCodes/{code}` so a link
 * resolves with one read by id instead of a query. The mirror is what makes the
 * uniqueness check a transaction rather than a hope.
 */
export async function ensureReferralCode(uid: string): Promise<string | null> {
  const db = adminDb();
  const userRef = db.collection("users").doc(uid);

  try {
    const existing = (await userRef.get()).data()?.referralCode as
      string | undefined;
    if (existing) return existing;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const codeRef = db.collection("referralCodes").doc(code);
      const won = await db.runTransaction(async (tx) => {
        const taken = await tx.get(codeRef);
        if (taken.exists) return false;
        tx.set(codeRef, { uid, at: Date.now() });
        tx.update(userRef, { referralCode: code });
        return true;
      });
      if (won) return code;
    }
    console.error("[affiliate] could not mint a free code for", uid);
    return null;
  } catch (error) {
    console.error("[affiliate] code mint failed:", error);
    return null;
  }
}

/** Who owns a code, or null. */
export async function referrerFor(code: string): Promise<string | null> {
  const clean = code.trim().toUpperCase();
  // Checked before the read: a document id is taken straight from a cookie
  // here, and an id containing a slash addresses a different collection.
  if (!kReferralCodePattern.test(clean)) return null;
  try {
    const snap = await adminDb().collection("referralCodes").doc(clean).get();
    return snap.exists ? ((snap.data()?.uid as string) ?? null) : null;
  } catch (error) {
    console.error("[affiliate] code lookup failed:", error);
    return null;
  }
}

/** One person's balance and standing. */
export async function affiliateSummary(uid: string): Promise<{
  code: string | null;
  points: number;
  qualified: number;
  invited: number;
}> {
  try {
    const db = adminDb();
    const [user, invitedSnap] = await Promise.all([
      db.collection("users").doc(uid).get(),
      db.collection("users").where("referredBy", "==", uid).count().get(),
    ]);
    const data = user.data() ?? {};
    return {
      code: (data.referralCode as string) ?? null,
      points: (data.points as number) ?? 0,
      qualified: (data.referralCount as number) ?? 0,
      invited: invitedSnap.data().count,
    };
  } catch (error) {
    console.error("[affiliate] summary failed:", error);
    return { code: null, points: 0, qualified: 0, invited: 0 };
  }
}

/** Everyone this account invited, and whether they have counted yet. */
export async function invitees(uid: string, max = 50) {
  try {
    const snap = await adminDb()
      .collection("users")
      .where("referredBy", "==", uid)
      .limit(max)
      .get();
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          displayName: (data.displayName as string) || "مستخدم",
          joinedAt: (data.createdAt as number) ?? 0,
          qualifiedAt: (data.referralQualifiedAt as number) ?? null,
        };
      })
      .sort((a, b) => b.joinedAt - a.joinedAt);
  } catch (error) {
    console.error("[affiliate] invitees read failed:", error);
    return [];
  }
}

export async function ledgerFor(uid: string, max = 30): Promise<LedgerEntry[]> {
  try {
    const snap = await adminDb()
      .collection("pointsLedger")
      .where("uid", "==", uid)
      .orderBy("at", "desc")
      .limit(max)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LedgerEntry);
  } catch (error) {
    console.error("[affiliate] ledger read failed:", error);
    return [];
  }
}

// ── THE AWARD ────────────────────────────────────────────────────────────────

/**
 * Count an invited account, once, when it first publishes something approved.
 *
 * Called from every path that makes a post public. Everything about it is
 * defensive, because this is where money — or its equivalent in free ads —
 * comes into existence:
 *
 * - the invited account is marked qualified inside the transaction, so two
 *   posts approved at the same moment cannot both pay;
 * - a referrer who has already been paid for this account is never paid twice;
 * - self-referral is impossible, since a signup cannot name itself;
 * - a daily cap bounds how fast one account can qualify referrals, which is
 *   what a farm would otherwise do in an afternoon.
 *
 * Never throws. A publish must not fail because a bonus could not be recorded.
 */
export async function qualifyReferral(newUserUid: string): Promise<void> {
  try {
    const settings = await getAffiliateSettings();
    if (!settings.enabled) return;

    const db = adminDb();
    const inviteeRef = db.collection("users").doc(newUserUid);
    const now = Date.now();

    const award = await db.runTransaction(async (tx) => {
      const snap = await tx.get(inviteeRef);
      const data = snap.data();
      if (!data) return null;

      const referrer = (data.referredBy as string) ?? null;
      if (!referrer || referrer === newUserUid) return null;
      // Already counted — this account publishes for the second time.
      if (data.referralQualifiedAt) return null;

      const referrerRef = db.collection("users").doc(referrer);
      const referrerSnap = await tx.get(referrerRef);
      const referrerData = referrerSnap.data();
      if (!referrerData) return null;
      // A suspended account keeps earning nothing.
      if (referrerData.isBanned === true) return null;

      // The cap is a rolling day, tracked on the referrer rather than counted
      // from the ledger: one field beats a range query on every publish.
      const dayStart = new Date().setHours(0, 0, 0, 0);
      const capDay = (referrerData.qualifyDay as number) ?? 0;
      const capCount =
        capDay === dayStart ? ((referrerData.qualifyCount as number) ?? 0) : 0;
      if (capCount >= settings.dailyQualifyCap) return null;

      const count = ((referrerData.referralCount as number) ?? 0) + 1;
      const bonus =
        settings.bonusEvery > 0 && count % settings.bonusEvery === 0
          ? settings.bonusPoints
          : 0;
      const points = settings.perReferral + bonus;

      tx.update(inviteeRef, { referralQualifiedAt: now });
      tx.update(referrerRef, {
        points: FieldValue.increment(points),
        referralCount: count,
        qualifyDay: dayStart,
        qualifyCount: capCount + 1,
      });

      return {
        referrer,
        points,
        bonus,
        count,
        name: (referrerData.displayName as string) || "مستخدم",
      };
    });

    if (!award) return;

    const db2 = adminDb();
    await db2.collection("pointsLedger").add({
      uid: award.referrer,
      delta: settings.perReferral,
      reason: "referral",
      refUid: newUserUid,
      at: now,
    });
    if (award.bonus > 0) {
      await db2.collection("pointsLedger").add({
        uid: award.referrer,
        delta: award.bonus,
        reason: "bonus",
        refUid: newUserUid,
        note: `${award.count}`,
        at: now,
      });
    }

    await countTowardsLiveCampaign(award.referrer, award.name, now);
  } catch (error) {
    // Swallowed on purpose: the post is already public by the time this runs.
    console.error("[affiliate] qualify failed:", error);
  }
}

/**
 * Undo a referral when the invited account turns out to be fake.
 *
 * Called when an account is banned. Without it the programme pays for exactly
 * the accounts it is meant to refuse, and a leaderboard keeps a cheat at the
 * top of it while the evidence sits in the ban reason.
 */
export async function clawbackReferral(bannedUid: string): Promise<void> {
  try {
    const db = adminDb();
    const snap = await db.collection("users").doc(bannedUid).get();
    const data = snap.data();
    if (!data?.referredBy || !data.referralQualifiedAt) return;

    const referrer = data.referredBy as string;
    const settings = await getAffiliateSettings();
    const now = Date.now();

    await db
      .collection("users")
      .doc(referrer)
      .update({
        points: FieldValue.increment(-settings.perReferral),
        referralCount: FieldValue.increment(-1),
      });
    await db.collection("users").doc(bannedUid).update({
      referralQualifiedAt: null,
    });
    await db.collection("pointsLedger").add({
      uid: referrer,
      delta: -settings.perReferral,
      reason: "clawback",
      refUid: bannedUid,
      at: now,
    });

    const live = await liveCampaign();
    if (live) {
      await db
        .collection("campaigns")
        .doc(live.id)
        .collection("entrants")
        .doc(referrer)
        .update({ count: FieldValue.increment(-1) })
        .catch(() => {});
    }
  } catch (error) {
    console.error("[affiliate] clawback failed:", error);
  }
}

// ── CAMPAIGNS ────────────────────────────────────────────────────────────────

/** The one race currently running, if any. */
export async function liveCampaign(): Promise<Campaign | null> {
  try {
    const now = Date.now();
    const snap = await adminDb()
      .collection("campaigns")
      .where("status", "==", "live")
      .limit(5)
      .get();
    const running = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Campaign)
      .find((c) => c.startsAt <= now && c.endsAt >= now);
    return running ?? null;
  } catch (error) {
    console.error("[affiliate] live campaign read failed:", error);
    return null;
  }
}

async function countTowardsLiveCampaign(
  uid: string,
  displayName: string,
  at: number,
) {
  const live = await liveCampaign();
  if (!live) return;

  await adminDb()
    .collection("campaigns")
    .doc(live.id)
    .collection("entrants")
    .doc(uid)
    .set(
      {
        uid,
        displayName,
        count: FieldValue.increment(1),
        lastQualifiedAt: at,
      },
      { merge: true },
    )
    .catch((error) => console.error("[affiliate] entrant bump failed:", error));
}

/**
 * The dates a new campaign is proposed with: from now, for a fortnight.
 *
 * Computed here rather than in the admin page because a clock read is not a
 * render-time value — React's purity rule is right about that, and the fix is
 * to read it where the rest of the screen's data is read, not to hide the call.
 */
export function defaultCampaignWindow(): { startsAt: number; endsAt: number } {
  const now = Date.now();
  return { startsAt: now, endsAt: now + 14 * 24 * 60 * 60 * 1000 };
}

/** Every campaign, newest first, for the admin's list. */
export async function allCampaigns(max = 20): Promise<Campaign[]> {
  try {
    const snap = await adminDb()
      .collection("campaigns")
      .orderBy("createdAt", "desc")
      .limit(max)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Campaign);
  } catch (error) {
    console.error("[affiliate] campaigns read failed:", error);
    return [];
  }
}

/** Cash requests still waiting on a human. */
export async function pendingPayouts(max = 50): Promise<Payout[]> {
  try {
    const snap = await adminDb()
      .collection("payouts")
      .where("status", "==", "requested")
      .orderBy("requestedAt", "asc")
      .limit(max)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payout);
  } catch (error) {
    console.error("[affiliate] payouts read failed:", error);
    return [];
  }
}

/**
 * The standings.
 *
 * Ordered by count, then by who reached it first — the tie-break is ascending
 * `lastQualifiedAt`, which is both fair and decidable without a human.
 */
export async function standings(
  campaignId: string,
  max = 20,
): Promise<Entrant[]> {
  try {
    const snap = await adminDb()
      .collection("campaigns")
      .doc(campaignId)
      .collection("entrants")
      .orderBy("count", "desc")
      .orderBy("lastQualifiedAt", "asc")
      .limit(max)
      .get();
    return snap.docs
      .map((d) => d.data() as Entrant)
      .filter((e) => !e.disqualified);
  } catch (error) {
    console.error("[affiliate] standings read failed:", error);
    return [];
  }
}

/** Where one person stands, which is the number that makes them share again. */
export async function myStanding(
  campaignId: string,
  uid: string,
): Promise<{ count: number; rank: number | null }> {
  try {
    const db = adminDb();
    const mine = await db
      .collection("campaigns")
      .doc(campaignId)
      .collection("entrants")
      .doc(uid)
      .get();
    if (!mine.exists) return { count: 0, rank: null };

    const count = (mine.data()?.count as number) ?? 0;
    // Rank by counting those strictly ahead — one aggregation query rather than
    // reading a leaderboard that may be thousands long.
    const ahead = await db
      .collection("campaigns")
      .doc(campaignId)
      .collection("entrants")
      .where("count", ">", count)
      .count()
      .get();
    return { count, rank: ahead.data().count + 1 };
  } catch (error) {
    console.error("[affiliate] standing read failed:", error);
    return { count: 0, rank: null };
  }
}
