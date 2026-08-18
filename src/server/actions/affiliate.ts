"use server";

// ── REFERRALS ────────────────────────────────────────────────────────────────
// Spending points, asking to be paid, and the admin side of both. Awarding is
// not here — that happens inside the publish and moderation paths, in
// src/server/affiliate.ts, so a point can only come into existence as a
// consequence of something being approved.

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { actorWith, kForbidden, requireUser } from "@/server/auth";
import {
  ensureReferralCode,
  getAffiliateSettings,
  grantPoints,
  kAffiliateSettingsPath,
  linkPointsToday,
  liveCampaign,
  myEntry,
} from "@/server/affiliate";
import { kTooFast, withinRate } from "@/server/rateLimit";
import { encryptField, fieldEncryptionReady } from "@/server/crypto";
import type {
  AffiliateSettings,
  Campaign,
  CampaignLink,
  CampaignPrize,
  Entrant,
  LinkVisit,
  PayoutChannel,
  PrizeKind,
} from "@/types/affiliate";

/** The kinds the prize card knows how to draw when no image is uploaded. */
const kPrizeKinds: PrizeKind[] = [
  "binance",
  "playstore",
  "baridimob",
  "custom",
];

export type AffiliateResult =
  { ok: true; message?: string } | { ok: false; error: string };

/** Mint this account's code on demand, so the invite page can show a link. */
export async function myReferralCode(): Promise<string | null> {
  const user = await requireUser("/tableau-de-bord/parrainage");
  return ensureReferralCode(user.uid);
}

/**
 * Turn points into something.
 *
 * The two in-kind channels settle immediately — an ad slot and a week of
 * featuring cost the site nothing but a field — while the two cash channels
 * only ever record a request. Nobody is paid by a button.
 */
export async function redeem(
  channel: PayoutChannel,
  destination = "",
): Promise<AffiliateResult> {
  const user = await requireUser("/tableau-de-bord/parrainage");
  const settings = await getAffiliateSettings();
  if (!settings.enabled) {
    return { ok: false, error: "برنامج الدعوة ما زال ما تفعّلش." };
  }
  if (!settings.channels[channel]) {
    return { ok: false, error: "هذي الطريقة ما زالت مغلوقة." };
  }

  const price =
    channel === "listingSlot"
      ? settings.pointsPerListingSlot
      : channel === "featured"
        ? settings.pointsPerFeaturedWeek
        : settings.minPayoutPoints;

  const target = destination.trim();
  if (channel === "redotpay" || channel === "ccp") {
    if (target.length < 6 || target.length > 40) {
      return {
        ok: false,
        error:
          channel === "ccp"
            ? "اكتب رقم RIP صحيح (20 رقم)"
            : "اكتب معرّف RedotPay تاعك",
      };
    }
  }

  // Refused before any points move. A cash request whose destination could not
  // be encrypted must not be recorded at all — half-completing it would deduct
  // a balance and store a bank account in the clear.
  const needsSecret = channel === "redotpay" || channel === "ccp";
  if (needsSecret && !fieldEncryptionReady()) {
    console.error("[affiliate] payout refused: FIELD_ENCRYPTION_KEY missing");
    return { ok: false, error: "السحب معطّل مؤقّتاً. راسل المشرف." };
  }

  const db = adminDb();
  const userRef = db.collection("users").doc(user.uid);
  const now = Date.now();

  try {
    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.data();
      if (!data) throw new Error("NO_USER");
      if (data.isBanned === true) throw new Error("BANNED");

      const points = (data.points as number) ?? 0;
      if (points < price) throw new Error("SHORT");

      tx.update(userRef, {
        points: FieldValue.increment(-price),
        // Settled here for the in-kind channels; the cash ones only reserve the
        // points, so a balance cannot be spent twice while a request is open.
        ...(channel === "listingSlot"
          ? { listingQuota: FieldValue.increment(1) }
          : {}),
        ...(channel === "featured"
          ? { featuredQuota: FieldValue.increment(1) }
          : {}),
      });

      return { name: (data.displayName as string) || "مستخدم", points: price };
    });

    await db.collection("pointsLedger").add({
      uid: user.uid,
      delta: -price,
      reason:
        channel === "listingSlot"
          ? "redeem-listing"
          : channel === "featured"
            ? "redeem-featured"
            : "payout",
      note: channel,
      at: now,
    });

    // Every channel leaves a record, including the instant ones: "where did my
    // points go" has to be answerable from one list.
    await db.collection("payouts").add({
      uid: user.uid,
      ownerName: outcome.name,
      channel,
      points: price,
      amountDzd:
        channel === "redotpay" || channel === "ccp"
          ? Math.round(price * settings.dinarsPerPoint)
          : null,
      // The one field here worth stealing. Encrypted with a key that lives in
      // the environment, not in the database, so a dump of this collection is a
      // list of amounts rather than a list of bank accounts.
      destination: target ? encryptField(target) : null,
      status:
        channel === "listingSlot" || channel === "featured"
          ? "paid"
          : "requested",
      requestedAt: now,
      settledAt:
        channel === "listingSlot" || channel === "featured" ? now : null,
      settledBy: null,
    });

    revalidatePath("/tableau-de-bord/parrainage");
    return {
      ok: true,
      message:
        channel === "listingSlot"
          ? "زدنالك إعلان في حصّتك ✅"
          : channel === "featured"
            ? "زدنالك تمييز إعلان لمدّة أسبوع ✅"
            : "طلبك تسجّل. المشرف يراجعو ويدفعلك.",
    };
  } catch (error) {
    const code = (error as Error).message;
    if (code === "SHORT") return { ok: false, error: "رصيدك ما يكفيش" };
    if (code === "BANNED") return { ok: false, error: "حسابك موقّف" };
    console.error("[affiliate] redeem failed:", error);
    return { ok: false, error: "ما نجحش. عاود من بعد." };
  }
}

// ── THE RACE ─────────────────────────────────────────────────────────────────

/**
 * Enter, and pick what you are racing for.
 *
 * Choosing the prize is the entry, not a step after it. Someone who has picked
 * the Binance card and watched a bar fill towards it is in a different
 * relationship with the site than someone told there is a prize somewhere.
 *
 * The prize may be changed later only while the entrant has not yet unlocked —
 * after that the choice is what the claim is against, and swapping it would be
 * a way to take whichever prize still has stock left.
 */
export async function joinCampaign(prizeId: string): Promise<AffiliateResult> {
  const user = await requireUser("/concours");
  const campaign = await liveCampaign();
  if (!campaign) return { ok: false, error: "ما كاش مسابقة شغّالة دروك." };

  const prize = campaign.prizes?.find((p) => p.id === prizeId);
  if (!prize) return { ok: false, error: "اختر جائزة من القائمة" };
  if (prize.stock <= prize.claimed) {
    return { ok: false, error: "هذي الجائزة كملت. اختر وحدة أخرى." };
  }

  const db = adminDb();
  const ref = db
    .collection("campaigns")
    .doc(campaign.id)
    .collection("entrants")
    .doc(user.uid);

  try {
    await db.runTransaction(async (tx) => {
      const [entrantSnap, userSnap] = await Promise.all([
        tx.get(ref),
        tx.get(db.collection("users").doc(user.uid)),
      ]);
      const account = userSnap.data();
      if (!account) throw new Error("NO_USER");
      if (account.isBanned === true) throw new Error("BANNED");

      const existing = entrantSnap.data() as Entrant | undefined;
      if (existing?.disqualified) throw new Error("DISQUALIFIED");
      if (existing?.claimedAt) throw new Error("CLAIMED");
      if (existing?.unlockedAt) throw new Error("LOCKED_IN");

      tx.set(
        ref,
        {
          uid: user.uid,
          displayName: (account.displayName as string) || "مستخدم",
          prizeId,
          // Only on the first join, so re-picking a prize never resets a score.
          ...(existing
            ? {}
            : {
                points: 0,
                referrals: 0,
                lastPointAt: Date.now(),
                joinedAt: Date.now(),
                unlockedAt: null,
                claimedAt: null,
              }),
        },
        { merge: true },
      );
    });
  } catch (error) {
    const code = (error as Error).message;
    if (code === "BANNED") return { ok: false, error: "حسابك موقّف" };
    if (code === "DISQUALIFIED") {
      return { ok: false, error: "مشاركتك تشطبت من هذه المسابقة." };
    }
    if (code === "CLAIMED") {
      return { ok: false, error: "ديجا طلبت جائزتك في هذه المسابقة." };
    }
    if (code === "LOCKED_IN") {
      return {
        ok: false,
        error: "وصلت للهدف — الجائزة اللي اخترتها ما تتبدّلش دروك.",
      };
    }
    console.error("[affiliate] join failed:", error);
    return { ok: false, error: "ما نجحش. عاود من بعد." };
  }

  revalidatePath("/concours");
  return { ok: true, message: `دخلت السباق على ${prize.label} 🎯` };
}

/**
 * Open a mission.
 *
 * The URL comes back from the server rather than sitting in the page, so what
 * gets opened and what gets claimed are the same link by construction. The
 * `startedAt` stamp written here is the *server's* clock, and the claim below
 * compares it against the server's clock again — the browser never gets to say
 * how long anything took.
 */
export async function startMission(
  linkId: string,
): Promise<
  { ok: true; url: string; seconds: number } | { ok: false; error: string }
> {
  const user = await requireUser("/concours");
  const campaign = await liveCampaign();
  if (!campaign) return { ok: false, error: "ما كاش مسابقة شغّالة دروك." };

  const link = campaign.links?.find((l) => l.id === linkId && l.active);
  if (!link) return { ok: false, error: "هذه المهمّة ما كاينتش" };

  const gate = await missionGate(user.uid, campaign.id);
  if (gate) return { ok: false, error: gate };

  const db = adminDb();
  const ref = db
    .collection("campaigns")
    .doc(campaign.id)
    .collection("visits")
    .doc(`${user.uid}__${linkId}`);

  const already = await ref.get();
  if (already.exists && already.data()?.claimedAt) {
    return { ok: false, error: "هذي المهمّة ديجا كمّلتها" };
  }

  // Overwrites any earlier start: re-opening a link restarts its timer, which
  // is what an honest visitor who closed the tab by accident needs, and costs
  // a cheat nothing they did not already have.
  await ref.set(
    {
      uid: user.uid,
      linkId,
      startedAt: Date.now(),
      claimedAt: null,
      points: link.points,
      tries: (already.data()?.tries as number) ?? 0,
    },
    { merge: true },
  );

  return { ok: true, url: link.url, seconds: link.dwellSeconds };
}

/**
 * Claim a mission's points.
 *
 * Everything that could be lied about is checked against something the browser
 * does not hold: the dwell against two server timestamps, the answer against
 * the campaign document, the "once" against a document id.
 */
export async function claimMission(
  linkId: string,
  answer = "",
): Promise<AffiliateResult> {
  const user = await requireUser("/concours");
  if (!(await withinRate(user.uid, "mission"))) {
    return { ok: false, error: kTooFast };
  }

  const campaign = await liveCampaign();
  if (!campaign) return { ok: false, error: "ما كاش مسابقة شغّالة دروك." };

  const link = campaign.links?.find((l) => l.id === linkId && l.active);
  if (!link) return { ok: false, error: "هذه المهمّة ما كاينتش" };

  const gate = await missionGate(user.uid, campaign.id);
  if (gate) return { ok: false, error: gate };

  const settings = await getAffiliateSettings();
  const earnedToday = await linkPointsToday(user.uid);
  if (earnedToday + link.points > settings.dailyLinkPoints) {
    return {
      ok: false,
      error: "وصلت للحد اليومي تاع نقاط الروابط. عاود غدوة.",
    };
  }

  const db = adminDb();
  const ref = db
    .collection("campaigns")
    .doc(campaign.id)
    .collection("visits")
    .doc(`${user.uid}__${linkId}`);

  try {
    await db.runTransaction(async (tx) => {
      const visit = (await tx.get(ref)).data() as LinkVisit | undefined;
      if (!visit?.startedAt) throw new Error("NOT_STARTED");
      if (visit.claimedAt) throw new Error("DONE");
      // Ten wrong answers and this link is spent for this account. A one-word
      // question is otherwise brute-forceable, and the whole point of the word
      // is that it can only come from the page.
      if ((visit.tries ?? 0) >= 10) throw new Error("BURNED");

      const waited = (Date.now() - visit.startedAt) / 1000;
      if (waited < link.dwellSeconds) throw new Error("TOO_SOON");

      if (link.answer) {
        const given = normalise(answer);
        if (!given) throw new Error("NO_ANSWER");
        if (given !== normalise(link.answer)) {
          tx.update(ref, { tries: FieldValue.increment(1) });
          throw new Error("WRONG");
        }
      }

      tx.update(ref, { claimedAt: Date.now(), points: link.points });
    });
  } catch (error) {
    const code = (error as Error).message;
    if (code === "NOT_STARTED")
      return { ok: false, error: "حلّ الرابط الأوّل" };
    if (code === "DONE")
      return { ok: false, error: "هذي المهمّة ديجا كمّلتها" };
    if (code === "BURNED") {
      return { ok: false, error: "غلطت بزاف في هذه المهمّة. حلّت." };
    }
    if (code === "TOO_SOON") {
      return {
        ok: false,
        error: `استنّى ${link.dwellSeconds} ثانية في الصفحة قبل ما تطلب النقاط.`,
      };
    }
    if (code === "NO_ANSWER") return { ok: false, error: "اكتب الكلمة" };
    if (code === "WRONG") {
      return { ok: false, error: "الكلمة ماشي صحيحة. عاود شوف الصفحة." };
    }
    console.error("[affiliate] mission claim failed:", error);
    return { ok: false, error: "ما نجحش. عاود من بعد." };
  }

  await grantPoints(user.uid, link.points, "link-visit", link.label);
  revalidatePath("/concours");
  return { ok: true, message: `+${link.points} نقطة 🎉` };
}

/** Ask for the prize once the line is crossed. */
export async function claimPrize(
  destination: string,
): Promise<AffiliateResult> {
  const user = await requireUser("/concours");
  const campaign = await liveCampaign();
  if (!campaign) return { ok: false, error: "ما كاش مسابقة شغّالة دروك." };

  const target = destination.trim();
  if (target.length < 4 || target.length > 60) {
    return { ok: false, error: "اكتب وين نبعثولك الجائزة" };
  }
  // Checked before the prize is taken off the shelf: a claim that cannot store
  // its destination safely would consume stock and lose the address.
  if (!fieldEncryptionReady()) {
    console.error(
      "[affiliate] prize claim refused: FIELD_ENCRYPTION_KEY missing",
    );
    return { ok: false, error: "طلب الجائزة معطّل مؤقّتاً. راسل المشرف." };
  }

  const db = adminDb();
  const campaignRef = db.collection("campaigns").doc(campaign.id);
  const entrantRef = campaignRef.collection("entrants").doc(user.uid);

  let awarded: { label: string; points: number };
  try {
    awarded = await db.runTransaction(async (tx) => {
      const [entrantSnap, campaignSnap] = await Promise.all([
        tx.get(entrantRef),
        tx.get(campaignRef),
      ]);
      const entrant = entrantSnap.data() as Entrant | undefined;
      const live = campaignSnap.data() as Campaign | undefined;
      if (!entrant || !live) throw new Error("NOT_IN");
      if (entrant.disqualified) throw new Error("DISQUALIFIED");
      if (entrant.claimedAt) throw new Error("DONE");
      if ((entrant.points ?? 0) < live.prizeThreshold) throw new Error("SHORT");

      const prizes = live.prizes ?? [];
      const index = prizes.findIndex((p) => p.id === entrant.prizeId);
      if (index < 0) throw new Error("NO_PRIZE");
      const prize = prizes[index];
      if (prize.claimed >= prize.stock) throw new Error("OUT_OF_STOCK");

      // The overall cap, counted from the prizes themselves rather than kept as
      // a second number that could disagree with them.
      const claimedTotal = prizes.reduce((sum, p) => sum + p.claimed, 0);
      if (claimedTotal >= live.winners) throw new Error("FULL");

      const next = prizes.map((p, i) =>
        i === index ? { ...p, claimed: p.claimed + 1 } : p,
      );
      tx.update(campaignRef, { prizes: next });
      tx.update(entrantRef, { claimedAt: Date.now() });

      return { label: prize.label, points: entrant.points ?? 0 };
    });
  } catch (error) {
    const code = (error as Error).message;
    if (code === "NOT_IN")
      return { ok: false, error: "ما زلت ما دخلتش السباق" };
    if (code === "DISQUALIFIED") {
      return { ok: false, error: "مشاركتك تشطبت من هذه المسابقة." };
    }
    if (code === "DONE") return { ok: false, error: "ديجا طلبت جائزتك" };
    if (code === "SHORT") return { ok: false, error: "ما وصلتش للهدف" };
    if (code === "NO_PRIZE") return { ok: false, error: "اختر جائزة الأوّل" };
    if (code === "OUT_OF_STOCK") {
      return { ok: false, error: "هذي الجائزة كملت. اتصل بالمشرف." };
    }
    if (code === "FULL")
      return { ok: false, error: "الجوائز كملو في هذه المسابقة." };
    console.error("[affiliate] prize claim failed:", error);
    return { ok: false, error: "ما نجحش. عاود من بعد." };
  }

  await db.collection("prizeClaims").add({
    campaignId: campaign.id,
    campaignName: campaign.name,
    uid: user.uid,
    ownerName: user.name || "مستخدم",
    prizeId: (await entrantRef.get()).data()?.prizeId ?? null,
    prizeLabel: awarded.label,
    destination: encryptField(target),
    points: awarded.points,
    status: "requested",
    note: null,
    requestedAt: Date.now(),
    settledAt: null,
    settledBy: null,
  });

  revalidatePath("/concours");
  return { ok: true, message: "طلبك تسجّل. المشرف يراجعو ويبعثلك الجائزة." };
}

/**
 * The gate on every mission: you must have published something first.
 *
 * This is the anti-farm measure that actually scales. Each link already pays
 * one account once, so automating a click buys nothing an honest visitor does
 * not also get — the only attack worth running is many accounts. Requiring a
 * public post before any link pays puts a real phone number, real content and a
 * moderator between an attacker and the very first point.
 */
async function missionGate(
  uid: string,
  campaignId: string,
): Promise<string | null> {
  const entry = await myEntry(campaignId, uid);
  if (!entry) return "ادخل السباق الأوّل واختار جائزتك.";
  if (entry.disqualified) return "مشاركتك تشطبت من هذه المسابقة.";

  const account = (await adminDb().collection("users").doc(uid).get()).data();
  if (!account) return "حسابك ما كاينش";
  if (account.isBanned === true) return "حسابك موقّف";
  if (((account.publishCount as number) ?? 0) < 1) {
    return "لازم تنشر إعلان ولا طلب ويتقبل قبل ما تبدا تجمع من الروابط.";
  }
  return null;
}

/** Loose enough to forgive typing, strict enough to still be a secret. */
function normalise(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\sً-ْ]+/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىي]/g, "ي");
}

// ── ADMIN ────────────────────────────────────────────────────────────────────

export async function saveAffiliateSettings(
  input: Partial<AffiliateSettings>,
): Promise<AffiliateResult> {
  const admin = await actorWith("affiliate.manage");
  if (!admin) return { ok: false, error: kForbidden };

  const num = (v: unknown, min: number, max: number): number | null => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) return null;
    return Math.round(n * 100) / 100;
  };

  const perReferral = num(input.perReferral, 0, 100000);
  const pointsPerListingSlot = num(input.pointsPerListingSlot, 1, 100000);
  const dinarsPerPoint = num(input.dinarsPerPoint, 0, 1000);
  if (
    perReferral === null ||
    pointsPerListingSlot === null ||
    dinarsPerPoint === null
  ) {
    return { ok: false, error: "فيه رقم ماشي صحيح" };
  }

  await adminDb()
    .doc(kAffiliateSettingsPath)
    .set(
      {
        perReferral,
        bonusEvery: num(input.bonusEvery, 0, 1000) ?? 10,
        bonusPoints: num(input.bonusPoints, 0, 100000) ?? 0,
        pointsPerPublish: num(input.pointsPerPublish, 0, 100000) ?? 20,
        dailyPublishCap: num(input.dailyPublishCap, 1, 100) ?? 3,
        dailyLinkPoints: num(input.dailyLinkPoints, 0, 100000) ?? 100,
        pointsPerListingSlot,
        pointsPerFeaturedWeek:
          num(input.pointsPerFeaturedWeek, 1, 100000) ?? 150,
        dinarsPerPoint,
        minPayoutPoints: num(input.minPayoutPoints, 1, 1000000) ?? 2000,
        dailyQualifyCap: num(input.dailyQualifyCap, 1, 1000) ?? 5,
        channels: {
          listingSlot: input.channels?.listingSlot !== false,
          featured: input.channels?.featured !== false,
          redotpay: input.channels?.redotpay === true,
          ccp: input.channels?.ccp === true,
        },
        enabled: input.enabled === true,
        updatedAt: Date.now(),
        updatedBy: admin.uid,
      },
      { merge: false },
    );

  await audit(admin.uid, "affiliate.settings", input.enabled ? "on" : "off");
  revalidatePath("/admin/affiliation");
  revalidatePath("/tableau-de-bord/parrainage");
  return { ok: true };
}

/** Mark a cash request paid or refused. The points were already deducted. */
export async function settlePayout(
  id: string,
  paid: boolean,
  note = "",
): Promise<AffiliateResult> {
  const admin = await actorWith("affiliate.manage");
  if (!admin) return { ok: false, error: kForbidden };

  const db = adminDb();
  const ref = db.collection("payouts").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "الطلب ما كاينش" };
  const payout = snap.data()!;
  if (payout.status !== "requested") return { ok: true };

  await ref.update({
    status: paid ? "paid" : "refused",
    note: note.trim() || null,
    settledAt: Date.now(),
    settledBy: admin.uid,
  });

  // Refusing gives the points back — they were taken when the request was made
  // so a balance could not be spent twice, not as a penalty.
  if (!paid) {
    await db
      .collection("users")
      .doc(payout.uid as string)
      .update({ points: FieldValue.increment(payout.points as number) });
    await db.collection("pointsLedger").add({
      uid: payout.uid,
      delta: payout.points,
      reason: "admin",
      note: "طلب سحب مرفوض",
      at: Date.now(),
    });
  }

  await audit(admin.uid, paid ? "payout.paid" : "payout.refused", id);
  revalidatePath("/admin/affiliation");
  return { ok: true };
}

export async function saveCampaign(input: {
  id?: string;
  name: string;
  prize: string;
  startsAt: number;
  endsAt: number;
  prizeThreshold: number;
  winners: number;
  prizes: CampaignPrize[];
  links: CampaignLink[];
  status: "draft" | "live" | "ended";
}): Promise<AffiliateResult> {
  const admin = await actorWith("affiliate.manage");
  if (!admin) return { ok: false, error: kForbidden };

  const name = input.name.trim();
  const prize = input.prize.trim();
  if (name.length < 3 || name.length > 60) {
    return { ok: false, error: "اسم الحملة لازم بين 3 و60 حرف" };
  }
  if (prize.length < 3 || prize.length > 80) {
    return { ok: false, error: "الجائزة لازم بين 3 و80 حرف" };
  }
  if (!Number.isFinite(input.startsAt) || !Number.isFinite(input.endsAt)) {
    return { ok: false, error: "التواريخ ماشي صحيحة" };
  }
  if (input.endsAt <= input.startsAt) {
    return { ok: false, error: "تاريخ النهاية لازم بعد البداية" };
  }
  const winners = Math.max(1, Math.min(50, Math.round(input.winners)));
  const prizeThreshold = Math.max(
    1,
    Math.min(1_000_000, Math.round(input.prizeThreshold)),
  );

  // Prizes and missions are validated field by field rather than trusted from
  // the form. This action is a public endpoint like every other, and a link
  // whose `points` arrived as 999999 would be a campaign anyone could win in a
  // click — the permission check above says *who* may write, not *what*.
  const prizes: CampaignPrize[] = [];
  for (const raw of input.prizes ?? []) {
    const label = String(raw.label ?? "").trim();
    if (!label) continue;
    if (label.length > 60) return { ok: false, error: "اسم جائزة طويل بزاف" };
    const stock = Math.max(
      0,
      Math.min(1000, Math.round(Number(raw.stock) || 0)),
    );
    const claimed = Math.max(0, Math.round(Number(raw.claimed) || 0));
    if (claimed > stock) {
      return { ok: false, error: `«${label}»: المخزون أقل من اللي تسحب` };
    }
    prizes.push({
      id: String(raw.id || crypto.randomUUID()),
      kind: kPrizeKinds.includes(raw.kind) ? raw.kind : "custom",
      label,
      detail: String(raw.detail ?? "")
        .trim()
        .slice(0, 80),
      imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
      storagePath: typeof raw.storagePath === "string" ? raw.storagePath : null,
      stock,
      claimed,
    });
  }

  const links: CampaignLink[] = [];
  for (const raw of input.links ?? []) {
    const label = String(raw.label ?? "").trim();
    const url = String(raw.url ?? "").trim();
    if (!label && !url) continue;
    if (!/^https?:\/\/\S+$/i.test(url)) {
      return { ok: false, error: `«${label || url}»: الرابط لازم يبدا بـhttp` };
    }
    links.push({
      id: String(raw.id || crypto.randomUUID()),
      label: label.slice(0, 60) || url,
      url,
      points: Math.max(
        1,
        Math.min(10_000, Math.round(Number(raw.points) || 1)),
      ),
      // Floor of five seconds: below that the wait proves nothing, and the
      // dwell is the only defence a link with no question has.
      dwellSeconds: Math.max(
        5,
        Math.min(600, Math.round(Number(raw.dwellSeconds) || 15)),
      ),
      answer:
        String(raw.answer ?? "")
          .trim()
          .slice(0, 40) || null,
      active: raw.active !== false,
    });
  }

  const db = adminDb();
  // One live race at a time. Two overlapping leaderboards would split the very
  // attention the campaign exists to concentrate, and a referral can only be
  // counted towards one of them anyway.
  if (input.status === "live") {
    const others = await db
      .collection("campaigns")
      .where("status", "==", "live")
      .get();
    const clash = others.docs.find((d) => d.id !== input.id);
    if (clash) {
      return { ok: false, error: "كاين حملة شغّالة. سكّرها الأوّل." };
    }
  }

  if (input.status === "live" && prizes.length === 0) {
    return { ok: false, error: "زيد جائزة وحدة على الأقل قبل ما تشعّلها" };
  }

  const payload = {
    name,
    prize,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    prizeThreshold,
    winners,
    prizes,
    links,
    status: input.status,
    createdAt: Date.now(),
    createdBy: admin.uid,
  };

  if (input.id) {
    await db
      .collection("campaigns")
      .doc(input.id)
      .set(payload, { merge: true });
  } else {
    await db.collection("campaigns").add(payload);
  }

  await audit(admin.uid, "affiliate.campaign", `${name}:${input.status}`);
  revalidatePath("/admin/affiliation");
  revalidatePath("/concours");
  return { ok: true };
}

/** Mark a prize sent, or refuse it. */
export async function settlePrizeClaim(
  id: string,
  sent: boolean,
  note = "",
): Promise<AffiliateResult> {
  const admin = await actorWith("affiliate.manage");
  if (!admin) return { ok: false, error: kForbidden };

  const db = adminDb();
  const ref = db.collection("prizeClaims").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "الطلب ما كاينش" };
  const claim = snap.data()!;
  if (claim.status !== "requested") return { ok: true };

  await ref.update({
    status: sent ? "sent" : "refused",
    note: note.trim() || null,
    settledAt: Date.now(),
    settledBy: admin.uid,
  });

  // Refusing puts the prize back on the shelf and lets the entrant claim again.
  // A refusal is usually "you gave me the wrong Binance id", not a punishment,
  // and a stock decrement that survived it would quietly shrink the campaign.
  if (!sent) {
    const campaignRef = db.collection("campaigns").doc(claim.campaignId);
    await db
      .runTransaction(async (tx) => {
        const live = (await tx.get(campaignRef)).data() as Campaign | undefined;
        if (!live) return;
        const prizes = (live.prizes ?? []).map((p) =>
          p.id === claim.prizeId
            ? { ...p, claimed: Math.max(0, p.claimed - 1) }
            : p,
        );
        tx.update(campaignRef, { prizes });
        tx.update(campaignRef.collection("entrants").doc(claim.uid), {
          claimedAt: null,
        });
      })
      .catch((error) => console.error("[affiliate] restock failed:", error));
  }

  await audit(admin.uid, sent ? "prize.sent" : "prize.refused", id);
  revalidatePath("/admin/affiliation");
  revalidatePath("/concours");
  return { ok: true };
}

/** Take an entrant out of a race — for a farm caught mid-campaign. */
export async function disqualify(
  campaignId: string,
  uid: string,
): Promise<AffiliateResult> {
  const admin = await actorWith("affiliate.manage");
  if (!admin) return { ok: false, error: kForbidden };

  await adminDb()
    .collection("campaigns")
    .doc(campaignId)
    .collection("entrants")
    .doc(uid)
    .set({ disqualified: true }, { merge: true });

  await audit(admin.uid, "affiliate.disqualify", `${campaignId}:${uid}`);
  revalidatePath("/admin/affiliation");
  revalidatePath("/concours");
  return { ok: true };
}

async function audit(actorUid: string, action: string, note: string) {
  await adminDb()
    .collection("adminAudit")
    .add({
      actorUid,
      action,
      targetType: "affiliate",
      targetId: note,
      note,
      at: Date.now(),
    })
    .catch(() => {});
}
