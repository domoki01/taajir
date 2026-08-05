"use server";

// ── ACCOUNT ADMINISTRATION ───────────────────────────────────────────────────
// Roles, bans and quotas. All of these decide what somebody is allowed to do,
// so they need requireSuperAdmin rather than requireAdmin — a moderator able to
// edit roles is a moderator able to become an admin.

import { revalidatePath } from "next/cache";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin } from "@/server/auth";

export type UserResult = { ok: true } | { ok: false; error: string };

const kRoles = ["user", "agency", "moderator", "admin"] as const;
export type Role = (typeof kRoles)[number];

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
  const admin = await requireSuperAdmin();

  if (!kRoles.includes(role)) return { ok: false, error: "دور ماشي معروف" };
  if (uid === admin.uid) {
    // Removing your own admin rights cannot be undone from this screen — the
    // only way back is the CLI script and a service-account key.
    return { ok: false, error: "ما تقدرش تبدّل دورك أنت بنفسك" };
  }

  try {
    await adminAuth().setCustomUserClaims(uid, { role });
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
  const admin = await requireSuperAdmin();
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
  const admin = await requireSuperAdmin();

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
