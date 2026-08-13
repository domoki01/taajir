// ── PERMISSIONS ──────────────────────────────────────────────────────────────
// What a role may do. The catalogue is code, not data, because every entry
// names a real code path — a permission an admin could invent would guard
// nothing. What *is* data is which role holds which of them.

export const kPermissions = {
  "listings.moderate": "مراجعة الإعلانات",
  "comments.moderate": "إدارة التعليقات",
  "requests.moderate": "إدارة الطلبات",
  "promos.manage": "الإشهارات",
  "users.manage": "إدارة الحسابات",
  "users.approve": "تأكيد التسجيلات",
  "roles.manage": "الأدوار والصلاحيات",
  "taxonomy.edit": "الفئات والفلتر",
  "branding.edit": "الهوية والثيم",
  "launch.control": "الإطلاق",
  "audit.view": "السجلّ",
} as const;

export type Permission = keyof typeof kPermissions;

export const kAllPermissions = Object.keys(kPermissions) as Permission[];

/** The role every deployment starts with, and the only one that is untouchable. */
export const kSuperAdminRole = "admin";

export type RoleDefinition = {
  label: string;
  permissions: Permission[];
  /** Ships with the code. Cannot be deleted; only its permissions may move. */
  builtin: boolean;
};

/**
 * Defaults, used until an admin saves the roles screen once — and as the floor
 * the resolver falls back to if that document cannot be read.
 */
export const kDefaultRoles: Record<string, RoleDefinition> = {
  admin: { label: "مشرف عام", permissions: kAllPermissions, builtin: true },
  moderator: {
    label: "مشرف",
    permissions: [
      "listings.moderate",
      "comments.moderate",
      "requests.moderate",
      "promos.manage",
    ],
    builtin: true,
  },
  agency: { label: "وكالة", permissions: [], builtin: true },
  user: { label: "مستعمل", permissions: [], builtin: true },
};

/**
 * The super-admin holds every permission, always — including ones added to the
 * catalogue in a later release.
 *
 * This is the emergency door. An editable permission system means an admin can
 * take away their own access to the screen that grants access; if that were
 * possible for every role, one bad save would leave the site with nobody able
 * to administer it and no way back except a database edit. So one role is
 * beyond editing, and it is the one you are signed in as.
 */
export function permissionsOf(
  roleId: string,
  roles: Record<string, RoleDefinition>,
): Permission[] {
  if (roleId === kSuperAdminRole) return kAllPermissions;
  return roles[roleId]?.permissions ?? [];
}

export function can(permissions: string[], permission: Permission): boolean {
  return permissions.includes(permission);
}

/** A role id an admin typed. Latin and stable, because it lands in a token. */
export const kRoleIdPattern = /^[a-z][a-z0-9-]{1,23}$/;
