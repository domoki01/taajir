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
  type LedgerReason,
  type LinkVisit,
  type Payout,
  type PrizeClaim,
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

    await countTowardsLiveCampaign(award.referrer, {
      points: award.points,
      referrals: 1,
      at: now,
    });
  } catch (error) {
    // Swallowed on purpose: the post is already public by the time this runs.
    console.error("[affiliate] qualify failed:", error);
  }
}

/**
 * Pay somebody for their own post going public.
 *
 * Called from the same four places as qualifyReferral, and for the same reason:
 * what is being paid for is a post the public can see, which has cost its
 * author a real phone number, real content and — when the check was unsure — a
 * moderator's yes.
 *
 * It also keeps `publishCount`, which is the gate on link missions. That number
 * is the cheapest honest proof that an account is a person using the site
 * rather than a row in somebody's spreadsheet, and it is incremented even when
 * the daily cap pays nothing: contributing still counts towards being allowed
 * to earn, it just does not pay twice.
 *
 * Never throws, for the same reason as its sibling.
 */
export async function rewardPublish(uid: string): Promise<void> {
  try {
    const settings = await getAffiliateSettings();
    if (!settings.enabled) return;

    const db = adminDb();
    const ref = db.collection("users").doc(uid);
    const now = Date.now();

    const award = await db.runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data();
      if (!data || data.isBanned === true) return null;

      const dayStart = new Date().setHours(0, 0, 0, 0);
      const capDay = (data.publishDay as number) ?? 0;
      const paidToday =
        capDay === dayStart ? ((data.publishPaidCount as number) ?? 0) : 0;
      const capped = paidToday >= settings.dailyPublishCap;

      tx.update(ref, {
        publishCount: FieldValue.increment(1),
        ...(capped
          ? {}
          : {
              points: FieldValue.increment(settings.pointsPerPublish),
              publishDay: dayStart,
              publishPaidCount: paidToday + 1,
            }),
      });

      return capped ? null : settings.pointsPerPublish;
    });

    if (!award) return;

    await db.collection("pointsLedger").add({
      uid,
      delta: award,
      reason: "publish",
      at: now,
    });
    await countTowardsLiveCampaign(uid, {
      points: award,
      referrals: 0,
      at: now,
    });
  } catch (error) {
    console.error("[affiliate] publish reward failed:", error);
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
        .update({
          points: FieldValue.increment(-settings.perReferral),
          referrals: FieldValue.increment(-1),
        })
        .catch(() => {});
    }
  } catch (error) {
    console.error("[affiliate] clawback failed:", error);
  }
}

/**
 * Take a banned account out of the race entirely.
 *
 * Separate from clawbackReferral, which undoes what a banned account earned
 * *for somebody else*. This one is about what the banned account earned for
 * itself — the leaderboard place. Left alone, a farm caught mid-campaign keeps
 * the top row and the prize it was heading for, which is the one outcome that
 * would tell everyone honest that the race is not worth entering.
 */
export async function disqualifyFromLiveCampaign(uid: string): Promise<void> {
  try {
    const live = await liveCampaign();
    if (!live) return;
    await adminDb()
      .collection("campaigns")
      .doc(live.id)
      .collection("entrants")
      .doc(uid)
      .set({ disqualified: true }, { merge: true });
  } catch (error) {
    console.error("[affiliate] campaign disqualify failed:", error);
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

/**
 * Move somebody up the board.
 *
 * Only counts for an entrant who **joined** — an entry is an act, not a
 * side-effect of publishing an ad. Someone who never chose a prize is not in
 * the race, and putting them on the leaderboard anyway would be both confusing
 * and, once a prize is at stake, wrong.
 *
 * The unlock is checked here rather than on read, so the moment somebody
 * crosses the line is recorded with a timestamp. That timestamp is what
 * decides the order of claims when there are fewer prizes than winners.
 */
async function countTowardsLiveCampaign(
  uid: string,
  gain: { points: number; referrals: number; at: number },
) {
  try {
    const live = await liveCampaign();
    if (!live || gain.points <= 0) return;

    const ref = adminDb()
      .collection("campaigns")
      .doc(live.id)
      .collection("entrants")
      .doc(uid);

    await adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const entrant = snap.data() as Entrant | undefined;
      if (!entrant || entrant.disqualified) return;

      const points = (entrant.points ?? 0) + gain.points;
      tx.update(ref, {
        points,
        referrals: FieldValue.increment(gain.referrals),
        lastPointAt: gain.at,
        ...(entrant.unlockedAt == null && points >= live.prizeThreshold
          ? { unlockedAt: gain.at }
          : {}),
      });
    });
  } catch (error) {
    console.error("[affiliate] entrant bump failed:", error);
  }
}

// ── ENTERING, AND THE MISSIONS ───────────────────────────────────────────────

/** One entrant's row, or null when they have not joined. */
export async function myEntry(
  campaignId: string,
  uid: string,
): Promise<Entrant | null> {
  try {
    const snap = await adminDb()
      .collection("campaigns")
      .doc(campaignId)
      .collection("entrants")
      .doc(uid)
      .get();
    return snap.exists ? (snap.data() as Entrant) : null;
  } catch (error) {
    console.error("[affiliate] entry read failed:", error);
    return null;
  }
}

/** Which links this account has already been paid for, and which are pending. */
export async function myVisits(
  campaignId: string,
  uid: string,
): Promise<Record<string, LinkVisit>> {
  try {
    const snap = await adminDb()
      .collection("campaigns")
      .doc(campaignId)
      .collection("visits")
      .where("uid", "==", uid)
      .limit(60)
      .get();
    const out: Record<string, LinkVisit> = {};
    for (const doc of snap.docs) {
      const visit = doc.data() as LinkVisit;
      out[visit.linkId] = visit;
    }
    return out;
  } catch (error) {
    console.error("[affiliate] visits read failed:", error);
    return {};
  }
}

/** Points already earned from links today, for the daily cap. */
export async function linkPointsToday(uid: string): Promise<number> {
  try {
    const dayStart = new Date().setHours(0, 0, 0, 0);
    const snap = await adminDb()
      .collection("pointsLedger")
      .where("uid", "==", uid)
      .where("at", ">=", dayStart)
      .orderBy("at", "desc")
      .limit(100)
      .get();
    return snap.docs
      .map((d) => d.data())
      .filter((row) => row.reason === "link-visit")
      .reduce((sum, row) => sum + ((row.delta as number) ?? 0), 0);
  } catch (error) {
    console.error("[affiliate] link cap read failed:", error);
    // Fails closed: an unreadable cap must not read as "no cap".
    return Number.MAX_SAFE_INTEGER;
  }
}

/**
 * Record the points a mission paid.
 *
 * Split out because both the referral path and this one need the same three
 * writes — balance, ledger, board — and the board bump has to happen after the
 * balance, never instead of it.
 */
export async function grantPoints(
  uid: string,
  delta: number,
  reason: LedgerReason,
  note?: string,
): Promise<void> {
  const now = Date.now();
  await adminDb()
    .collection("users")
    .doc(uid)
    .update({ points: FieldValue.increment(delta) });
  await adminDb()
    .collection("pointsLedger")
    .add({
      uid,
      delta,
      reason,
      note: note ?? null,
      at: now,
    });
  await countTowardsLiveCampaign(uid, { points: delta, referrals: 0, at: now });
}

/**
 * The dates a new campaign is proposed with: from now, for a fortnight.
 *
 * Computed here rather than in the admin page because a clock read is not a
 * render-time value — React's purity rule is right about that, and the fix is
 * to read it where the rest of the screen's data is read, not to hide the call.
 */
/** The server's clock, for a client component that ticks from it. */
export function serverNow(): number {
  return Date.now();
}

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

/** Prize claims still waiting on a human. */
export async function pendingPrizeClaims(max = 50): Promise<PrizeClaim[]> {
  try {
    const snap = await adminDb()
      .collection("prizeClaims")
      .where("status", "==", "requested")
      .orderBy("requestedAt", "asc")
      .limit(max)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PrizeClaim);
  } catch (error) {
    console.error("[affiliate] prize claims read failed:", error);
    return [];
  }
}

/**
 * The standings.
 *
 * Ordered by points, then by who reached the number first — the tie-break is
 * ascending `lastPointAt`, which is both fair and decidable without a human.
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
      .orderBy("points", "desc")
      .orderBy("lastPointAt", "asc")
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
): Promise<{ points: number; rank: number | null }> {
  try {
    const db = adminDb();
    const mine = await db
      .collection("campaigns")
      .doc(campaignId)
      .collection("entrants")
      .doc(uid)
      .get();
    if (!mine.exists) return { points: 0, rank: null };

    const points = (mine.data()?.points as number) ?? 0;
    // Rank by counting those strictly ahead — one aggregation query rather than
    // reading a leaderboard that may be thousands long.
    const ahead = await db
      .collection("campaigns")
      .doc(campaignId)
      .collection("entrants")
      .where("points", ">", points)
      .count()
      .get();
    return { points, rank: ahead.data().count + 1 };
  } catch (error) {
    console.error("[affiliate] standing read failed:", error);
    return { points: 0, rank: null };
  }
}
