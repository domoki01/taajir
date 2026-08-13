import { describe, expect, it } from "vitest";
import {
  can,
  kAllPermissions,
  kDefaultRoles,
  kRoleIdPattern,
  kSuperAdminRole,
  permissionsOf,
  type RoleDefinition,
} from "@/lib/permissions";

describe("permissionsOf", () => {
  it("gives the super-admin everything, whatever the document says", () => {
    // The emergency door. An admin who saves a broken roles table must still be
    // able to open the screen that fixes it.
    const sabotaged: Record<string, RoleDefinition> = {
      admin: { label: "مشرف عام", permissions: [], builtin: true },
    };
    expect(permissionsOf(kSuperAdminRole, sabotaged)).toEqual(kAllPermissions);
  });

  it("gives the super-admin everything even when the role is missing", () => {
    expect(permissionsOf(kSuperAdminRole, {})).toEqual(kAllPermissions);
  });

  it("gives an unknown role nothing", () => {
    expect(permissionsOf("nobody", kDefaultRoles)).toEqual([]);
  });

  it("reads a custom role's permissions from the table", () => {
    const roles: Record<string, RoleDefinition> = {
      ...kDefaultRoles,
      reviseur: {
        label: "مراجِع",
        permissions: ["listings.moderate"],
        builtin: false,
      },
    };
    expect(permissionsOf("reviseur", roles)).toEqual(["listings.moderate"]);
  });

  it("leaves ordinary users with no permissions by default", () => {
    expect(permissionsOf("user", kDefaultRoles)).toEqual([]);
    expect(permissionsOf("agency", kDefaultRoles)).toEqual([]);
  });

  it("does not let the built-in moderator manage roles or branding", () => {
    const moderator = permissionsOf("moderator", kDefaultRoles);
    expect(can(moderator, "listings.moderate")).toBe(true);
    expect(can(moderator, "roles.manage")).toBe(false);
    expect(can(moderator, "branding.edit")).toBe(false);
    expect(can(moderator, "users.manage")).toBe(false);
  });
});

describe("kRoleIdPattern", () => {
  it("accepts the ids an admin would reasonably type", () => {
    for (const id of ["reviseur", "front-desk", "agent2", "ab"]) {
      expect(kRoleIdPattern.test(id)).toBe(true);
    }
  });

  it("rejects anything that would not survive a token or a URL", () => {
    for (const id of ["A", "a", "Reviseur", "1agent", "-agent", "وكالة", ""]) {
      expect(kRoleIdPattern.test(id)).toBe(false);
    }
  });
});
