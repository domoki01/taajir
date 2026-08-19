// ── THE ADMIN MAP ────────────────────────────────────────────────────────────
// This list is what the admin home screen draws its grouped rows from, and both
// ways it can break are silent: a group name nothing renders, or a permission
// that does not exist. Either makes a whole destination vanish for everybody,
// with no error anywhere.

import { describe, expect, it } from "vitest";
import { kAdminGroups, kAdminNav } from "@/app/admin/nav";
import { kAllPermissions } from "@/lib/permissions";

describe("admin navigation", () => {
  it("puts every destination in a group the sidebar draws", () => {
    // A group name that is not in kAdminGroups renders nowhere — the link would
    // simply vanish from the desktop sidebar without any error.
    for (const item of kAdminNav) {
      if (item.group === "") continue;
      expect(kAdminGroups).toContain(item.group);
    }
  });

  it("asks only for permissions that exist", () => {
    // A typo here is silent: the link disappears for everyone, including the
    // super-admin, and nothing anywhere reports it.
    for (const item of kAdminNav) {
      for (const need of item.need) {
        expect(kAllPermissions, `${item.href}: ${need}`).toContain(need);
      }
    }
  });

  it("has unique hrefs", () => {
    const hrefs = kAdminNav.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
