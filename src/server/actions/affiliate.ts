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
  kAffiliateSettingsPath,
} from "@/server/affiliate";
import type { AffiliateSettings, PayoutChannel } from "@/types/affiliate";

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
      destination: target || null,
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
  winners: number;
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

  const payload = {
    name,
    prize,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    winners,
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
