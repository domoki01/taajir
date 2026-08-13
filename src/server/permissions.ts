import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import {
  kAllPermissions,
  kDefaultRoles,
  kSuperAdminRole,
  permissionsOf,
  type Permission,
  type RoleDefinition,
} from "@/lib/permissions";

export const kRolesSettingsPath = "settings/roles";

/**
 * Roles are resolved on every authenticated request, so they are cached in the
 * process rather than read from Firestore each time.
 *
 * Ten seconds, not a minute. The screen that writes roles busts its own cache,
 * so the admin doing the editing always sees the truth immediately — but an
 * instance that never handled the save only learns about it when the window
 * expires, and that is the window a newly promoted moderator spends staring at
 * an admin panel that will not let them in. Ten seconds is short enough that
 * nobody files a bug about it and still collapses a burst of requests into one
 * read. Failures are deliberately not cached, so a Firestore blip costs one
 * request rather than a window of degraded permissions.
 */
let cache: { roles: Record<string, RoleDefinition>; at: number } | null = null;
const kCacheMs = 10_000;

export function invalidateRolesCache() {
  cache = null;
}

/**
 * Every role and what it may do.
 *
 * Falls back to the code defaults when the document is absent or unreadable.
 * The direction matters: an admin whose Firestore read failed still gets their
 * permissions from `permissionsOf`, which hands the super-admin everything —
 * so a settings outage never locks the site's owner out of fixing it.
 */
export async function getRoles(): Promise<Record<string, RoleDefinition>> {
  if (cache && Date.now() - cache.at < kCacheMs) return cache.roles;

  try {
    const snap = await adminDb().doc(kRolesSettingsPath).get();
    const stored = snap.exists
      ? (snap.data()?.roles as Record<string, RoleDefinition> | undefined)
      : undefined;

    // The built-ins are merged back in rather than trusted from the document:
    // a save that dropped one would otherwise leave users assigned to a role
    // that no longer exists, with no permissions and no label.
    const roles =
      stored && typeof stored === "object"
        ? { ...kDefaultRoles, ...stored }
        : kDefaultRoles;

    cache = { roles, at: Date.now() };
    return roles;
  } catch (error) {
    console.error("[permissions] roles read failed:", error);
    return kDefaultRoles;
  }
}

/** What this role may do right now. */
export async function permissionsForRole(
  roleId: string,
): Promise<Permission[]> {
  // The super-admin holds everything unconditionally, so answering costs no
  // read at all — which also means the emergency door still opens while
  // Firestore is down.
  if (roleId === kSuperAdminRole) return kAllPermissions;
  return permissionsOf(roleId, await getRoles());
}

/** Role ids an admin may assign, newest custom roles included. */
export async function listRoleIds(): Promise<string[]> {
  return Object.keys(await getRoles());
}
