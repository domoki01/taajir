import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import {
  kDefaultRoles,
  permissionsOf,
  type Permission,
  type RoleDefinition,
} from "@/lib/permissions";

export const kRolesSettingsPath = "settings/roles";

/**
 * Every role and what it may do.
 *
 * Falls back to the code defaults when the document is absent or unreadable.
 * The direction matters: an admin whose Firestore read failed still gets their
 * permissions from `permissionsOf`, which hands the super-admin everything —
 * so a settings outage never locks the site's owner out of fixing it.
 */
export async function getRoles(): Promise<Record<string, RoleDefinition>> {
  try {
    const snap = await adminDb().doc(kRolesSettingsPath).get();
    if (!snap.exists) return kDefaultRoles;

    const stored = snap.data()?.roles as
      Record<string, RoleDefinition> | undefined;
    if (!stored || typeof stored !== "object") return kDefaultRoles;

    // The built-ins are merged back in rather than trusted from the document:
    // a save that dropped one would otherwise leave users assigned to a role
    // that no longer exists, with no permissions and no label.
    return { ...kDefaultRoles, ...stored };
  } catch (error) {
    console.error("[permissions] roles read failed:", error);
    return kDefaultRoles;
  }
}

/** What this role may do right now. */
export async function permissionsForRole(
  roleId: string,
): Promise<Permission[]> {
  return permissionsOf(roleId, await getRoles());
}
