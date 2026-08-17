"use server";

// ── ACCOUNT ADMINISTRATION ───────────────────────────────────────────────────
// Roles, bans and quotas. All of these decide what somebody is allowed to do,
// so they sit behind `users.manage` — and handing out the super-admin role, or
// taking it away, needs `roles.manage` on top.

import { revalidatePath } from "next/cache";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { actorWith, hasPermission, kForbidden } from "@/server/auth";
import { getRoles } from "@/server/permissions";
import { kSuperAdminRole } from "@/lib/permissions";
import { approveEveryone, kAccessSettingsPath } from "@/server/access";
import {
  clawbackReferral,
  disqualifyFromLiveCampaign,
} from "@/server/affiliate";

export type UserResult = { ok: true } | { ok: false; error: string };

/** Any role id the roles document knows about. Validated per call, not here. */
export type Role = string;

/**
 * How many accounts still hold the super-admin role.
 *
 * Read from the `users` mirror rather than by walking every auth account: the
 * claim is the authority, but `setUserRole` writes both, and listing 100k users
 * to answer one question is not a trade worth making.
 */
async function superAdminCount(): Promise<number | null> {
  try {
    const snap = await adminDb()
      .collection("users")
      .where("role", "==", kSuperAdminRole)
      .count()
      .get();
    return snap.data().count;
  } catch (error) {
    console.error("[users] super-admin count failed:", error);
    return null;
  }
}

async function audit(
  actorUid: string,
  action: string,
  targetId: string,
  note: string | null,
) {
  await adminDb().collection("adminAudit").add({
    actorUid,
    action,
    targetType: "user",
    targetId,
    note,
    at: Date.now(),
  });
}

function refresh() {
  revalidatePath("/admin/utilisateurs");
  revalidatePath("/admin");
}

/**
 * The claim is the authority — firestore.rules and storage.rules read
 * `request.auth.token.role`, never the document. The document is a mirror for
 * the admin list, written second so a failure leaves the *stricter* state.
 *
 * Refresh tokens are revoked so the change lands on the next request instead of
 * whenever the current hour-long token happens to expire. getUser() verifies
 * with checkRevoked, so this logs the account out immediately.
 */
export async function setUserRole(
  uid: string,
  role: Role,
): Promise<UserResult> {
  const admin = await actorWith("users.manage");
  if (!admin) return { ok: false, error: kForbidden };

  const roles = await getRoles();
  if (!roles[role]) return { ok: false, error: "دور ماشي معروف" };
  if (uid === admin.uid) {
    // Removing your own admin rights cannot be undone from this screen — the
    // only way back is the CLI script and a service-account key.
    return { ok: false, error: "ما تقدرش تبدّل دورك أنت بنفسك" };
  }

  // The super-admin role carries every permission there is, including the one
  // that edits permissions. Granting or revoking it is therefore a roles
  // decision, not an accounts one — otherwise `users.manage` quietly contains
  // `roles.manage` by way of "promote a friend, ask them to promote you".
  const existing = await adminAuth()
    .getUser(uid)
    .catch(() => null);
  const current = existing?.customClaims?.role as string | undefined;
  const touchesSuperAdmin =
    role === kSuperAdminRole || current === kSuperAdminRole;
  if (touchesSuperAdmin && !hasPermission(admin, "roles.manage")) {
    return { ok: false, error: "دور المشرف العام يحتاج صلاحية الأدوار" };
  }

  // Guard: the site must keep at least one super-admin. Demoting the last one
  // leaves nobody able to edit roles, and the only way back is a service-account
  // key on a laptop.
  if (current === kSuperAdminRole && role !== kSuperAdminRole) {
    const remaining = await superAdminCount();
    if (remaining === null) {
      return { ok: false, error: "ما قدرناش نتأكّدو، عاود من بعد" };
    }
    if (remaining <= 1) {
      return { ok: false, error: "لازم يبقى مشرف عام واحد على الأقل" };
    }
  }

  try {
    // setCustomUserClaims replaces the whole claim object, so `banned` has to be
    // carried over — dropping it would silently unban an account by changing
    // its role.
    await adminAuth().setCustomUserClaims(uid, {
      role,
      banned: existing?.customClaims?.banned === true,
    });
    await adminAuth().revokeRefreshTokens(uid);
  } catch (error) {
    console.error("[users] claim update failed:", error);
    return { ok: false, error: "ما نجحش تغيير الدور" };
  }

  await adminDb()
    .collection("users")
    .doc(uid)
    .set({ role, updatedAt: Date.now() }, { merge: true });

  await audit(admin.uid, "user.role", uid, role);
  refresh();
  return { ok: true };
}

export async function setUserBanned(
  uid: string,
  isBanned: boolean,
  reason = "",
): Promise<UserResult> {
  const admin = await actorWith("users.manage");
  if (!admin) return { ok: false, error: kForbidden };
  if (uid === admin.uid) {
    return { ok: false, error: "ما تقدرش توقّف حسابك أنت بنفسك" };
  }

  const trimmed = reason.trim();
  if (isBanned && trimmed.length < 5) {
    // The reason is what the audit trail carries, and what anyone reviewing the
    // decision later has to go on.
    return { ok: false, error: "اكتب سبب التوقيف" };
  }

  try {
    // The `banned` claim is what notBanned() checks in the rules; `disabled`
    // stops the account signing in again at all.
    const existing = await adminAuth().getUser(uid);
    const role = (existing.customClaims?.role as string) ?? "user";
    await adminAuth().setCustomUserClaims(uid, { role, banned: isBanned });
    await adminAuth().updateUser(uid, { disabled: isBanned });
    await adminAuth().revokeRefreshTokens(uid);
  } catch (error) {
    console.error("[users] ban update failed:", error);
    return { ok: false, error: "ما نجحش تعديل حالة الحساب" };
  }

  await adminDb()
    .collection("users")
    .doc(uid)
    .set(
      {
        isBanned,
        banReason: isBanned ? trimmed : null,
        updatedAt: Date.now(),
      },
      { merge: true },
    );

  // Banning an account takes back the points it earned whoever invited it.
  // Without this the programme pays best for exactly the accounts it exists to
  // refuse, and a leaderboard keeps a cheat at the top of it while the evidence
  // sits in the ban reason. Unbanning does not re-award: a reversed decision is
  // rare, and paying twice for one account is worse than paying once too few.
  if (isBanned) {
    await clawbackReferral(uid);
    // And out of the race: a farm caught mid-campaign that keeps the top row
    // and the prize it was heading for tells everyone honest not to bother.
    await disqualifyFromLiveCampaign(uid);
  }

  await audit(
    admin.uid,
    isBanned ? "user.ban" : "user.unban",
    uid,
    trimmed || null,
  );
  refresh();
  return { ok: true };
}

/**
 * Raising a quota is how a paid plan is granted until the payment flow exists,
 * so it is deliberately an audited admin action rather than a field anyone can
 * write.
 */
export async function setUserQuota(
  uid: string,
  listingQuota: number,
  featuredQuota: number,
): Promise<UserResult> {
  const admin = await actorWith("users.manage");
  if (!admin) return { ok: false, error: kForbidden };

  const listing = Math.round(listingQuota);
  const featured = Math.round(featuredQuota);
  if (!Number.isFinite(listing) || listing < 0 || listing > 1000) {
    return { ok: false, error: "عدد الإعلانات المسموح ماشي صحيح" };
  }
  if (!Number.isFinite(featured) || featured < 0 || featured > 1000) {
    return { ok: false, error: "عدد الإعلانات المميّزة ماشي صحيح" };
  }

  await adminDb()
    .collection("users")
    .doc(uid)
    .set(
      { listingQuota: listing, featuredQuota: featured, updatedAt: Date.now() },
      { merge: true },
    );

  await audit(admin.uid, "user.quota", uid, `${listing}/${featured}`);
  refresh();
  return { ok: true };
}

// ── REGISTRATION APPROVAL ────────────────────────────────────────────────────

/** Let one waiting account publish, or put it back in the queue. */
export async function setUserApproved(
  uid: string,
  approved: boolean,
): Promise<UserResult> {
  const admin = await actorWith("users.approve");
  if (!admin) return { ok: false, error: kForbidden };

  await adminDb()
    .collection("users")
    .doc(uid)
    .set({ approved, updatedAt: Date.now() }, { merge: true });

  await audit(
    admin.uid,
    approved ? "user.approve" : "user.unapprove",
    uid,
    null,
  );
  refresh();
  return { ok: true };
}

/**
 * Switch registration approval on or off.
 *
 * Switching it *on* approves every account that already exists, in the same
 * action. Without that, one click would stop every current member of the
 * platform from posting — people who were approved by the fact that the site
 * was open when they joined. The feature filters who arrives next; it does not
 * revoke what is already there.
 */
export async function setRequireApproval(on: boolean): Promise<UserResult> {
  const admin = await actorWith("users.approve");
  if (!admin) return { ok: false, error: kForbidden };

  let note = on ? "on" : "off";
  if (on) {
    try {
      const touched = await approveEveryone();
      note = `on · ${touched} حساب موجود تأكّد`;
    } catch (error) {
      console.error("[access] back-fill failed:", error);
      // Refuse rather than switch on regardless: a half-applied back-fill is
      // exactly the state this guard exists to prevent.
      return {
        ok: false,
        error: "ما نجحناش نأكّدو الحسابات الموجودة — ما بدّلناش والو",
      };
    }
  }

  await adminDb()
    .doc(kAccessSettingsPath)
    .set(
      { requireApproval: on, updatedAt: Date.now(), updatedBy: admin.uid },
      { merge: false },
    );

  await audit(admin.uid, "access.approval", "settings/access", note);
  revalidatePath("/admin/utilisateurs");
  return { ok: true };
}
