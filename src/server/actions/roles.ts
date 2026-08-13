"use server";

// ── ROLES AND PERMISSIONS ────────────────────────────────────────────────────
// The screen that decides what every other screen may do. Editable permissions
// mean an admin can take away their own access, so most of this file is the
// four guards that stop that from happening — see the plan's «الحواجز».

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { actorWith, kForbidden } from "@/server/auth";
import {
  getRoles,
  invalidateRolesCache,
  kRolesSettingsPath,
} from "@/server/permissions";
import {
  kAllPermissions,
  kDefaultRoles,
  kRoleIdPattern,
  kSuperAdminRole,
  type Permission,
  type RoleDefinition,
} from "@/lib/permissions";

export type RolesResult = { ok: true } | { ok: false; error: string };

export type RoleInput = { id: string; label: string; permissions: string[] };

const kValid = new Set<string>(kAllPermissions);

async function audit(actorUid: string, action: string, targetId: string) {
  await adminDb()
    .collection("adminAudit")
    .add({
      actorUid,
      action,
      targetType: "role",
      targetId,
      note: null,
      at: Date.now(),
    })
    .catch(() => {});
}

/** Write the whole map and drop the process cache so the next read is the truth. */
async function persist(roles: Record<string, RoleDefinition>, uid: string) {
  await adminDb()
    .doc(kRolesSettingsPath)
    .set({ roles, updatedAt: Date.now(), updatedBy: uid }, { merge: false });
  invalidateRolesCache();
  revalidatePath("/admin/roles");
  revalidatePath("/admin");
}

/** How many accounts are assigned this role. null when the count failed. */
async function usersWithRole(roleId: string): Promise<number | null> {
  try {
    const snap = await adminDb()
      .collection("users")
      .where("role", "==", roleId)
      .count()
      .get();
    return snap.data().count;
  } catch (error) {
    console.error("[roles] user count failed:", error);
    return null;
  }
}

/**
 * Save the permission matrix.
 *
 * Two guards live here. The super-admin's row is ignored entirely rather than
 * validated — it holds everything by definition, and `permissionsOf` would
 * override whatever was stored anyway, so accepting an edit to it would only
 * make the screen lie. And nobody may drop `roles.manage` from the role they
 * are signed in as: that is the one edit with no undo, since the screen that
 * would fix it is the screen you just locked.
 */
export async function saveRoles(input: RoleInput[]): Promise<RolesResult> {
  const actor = await actorWith("roles.manage");
  if (!actor) return { ok: false, error: kForbidden };

  const existing = await getRoles();
  const next: Record<string, RoleDefinition> = {};

  for (const row of input) {
    const id = row.id.trim();
    if (id === kSuperAdminRole) continue; // guard 1: untouchable.
    if (!kRoleIdPattern.test(id)) {
      return { ok: false, error: `معرّف دور ماشي صالح: ${id}` };
    }

    const label = row.label.trim();
    if (label.length < 2 || label.length > 40) {
      return { ok: false, error: "اسم الدور لازم بين حرفين و40 حرف" };
    }

    next[id] = {
      label,
      // Unknown strings are dropped rather than rejected: the catalogue can
      // shrink between a page render and its save, and a permission that no
      // longer exists guards nothing.
      permissions: [...new Set(row.permissions)].filter((p): p is Permission =>
        kValid.has(p),
      ),
      builtin: existing[id]?.builtin ?? false,
    };
  }

  // Guard 1 again, from the other side: the built-ins must all survive a save,
  // whatever the form posted, or users land on a role that no longer exists.
  for (const id of Object.keys(kDefaultRoles)) {
    if (!next[id]) next[id] = kDefaultRoles[id];
  }
  next[kSuperAdminRole] = kDefaultRoles[kSuperAdminRole];

  // Guard 2: you may not lock yourself out of this screen.
  const mine = next[actor.role];
  if (
    actor.role !== kSuperAdminRole &&
    (!mine || !mine.permissions.includes("roles.manage"))
  ) {
    return {
      ok: false,
      error: "ما تقدرش تشيل صلاحية الأدوار من دورك أنت — ما كاش رجوع",
    };
  }

  await persist(next, actor.uid);
  await audit(actor.uid, "role.save", "settings/roles");
  return { ok: true };
}

/** Add a role. The id lands in an auth token, so it is Latin and stable. */
export async function createRole(
  id: string,
  label: string,
): Promise<RolesResult> {
  const actor = await actorWith("roles.manage");
  if (!actor) return { ok: false, error: kForbidden };

  const roleId = id.trim().toLowerCase();
  if (!kRoleIdPattern.test(roleId)) {
    return {
      ok: false,
      error: "المعرّف: حروف لاتينية صغيرة وشرطات، من حرفين لـ24",
    };
  }

  const roles = await getRoles();
  if (roles[roleId]) return { ok: false, error: "الدور موجود من قبل" };

  const name = label.trim();
  if (name.length < 2 || name.length > 40) {
    return { ok: false, error: "اسم الدور لازم بين حرفين و40 حرف" };
  }

  // A new role starts with nothing. Anything else would hand out access as a
  // side effect of typing a name.
  await persist(
    { ...roles, [roleId]: { label: name, permissions: [], builtin: false } },
    actor.uid,
  );
  await audit(actor.uid, "role.create", roleId);
  return { ok: true };
}

/**
 * Remove a custom role.
 *
 * Guards 3 and 4: built-ins stay, and a role with people in it stays until they
 * are moved. Deleting it out from under them would leave those accounts holding
 * a claim that resolves to no permissions and no label — a silent demotion that
 * looks like a bug from every side.
 */
export async function deleteRole(id: string): Promise<RolesResult> {
  const actor = await actorWith("roles.manage");
  if (!actor) return { ok: false, error: kForbidden };

  const roles = await getRoles();
  const role = roles[id];
  if (!role) return { ok: true };
  if (role.builtin || id === kSuperAdminRole) {
    return { ok: false, error: "الأدوار الأساسية ما تتمسحش" };
  }
  if (id === actor.role) {
    return { ok: false, error: "ما تقدرش تمسح دورك أنت" };
  }

  const count = await usersWithRole(id);
  if (count === null) {
    return { ok: false, error: "ما قدرناش نعدّو الحسابات، عاود من بعد" };
  }
  if (count > 0) {
    return {
      ok: false,
      error: `فيه ${count} حساب على هذا الدور — بدّلهم الأوّل`,
    };
  }

  const next = { ...roles };
  delete next[id];
  await persist(next, actor.uid);
  await audit(actor.uid, "role.delete", id);
  return { ok: true };
}
