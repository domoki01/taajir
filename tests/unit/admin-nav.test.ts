// ── THE ADMIN MAP ────────────────────────────────────────────────────────────
// Two things about this list are easy to break and invisible when broken: a
// destination that no role can reach, and an active state that lights the wrong
// tab. Both are what made the panel read as a pile of links.

import { describe, expect, it } from "vitest";
import { isCurrentAdmin, kAdminGroups, kAdminNav } from "@/app/admin/nav";
import { kAllPermissions } from "@/lib/permissions";

describe("admin navigation", () => {
  it("marks only the section being viewed", () => {
    expect(isCurrentAdmin("/admin/lancement", "/admin/lancement")).toBe(true);
    expect(isCurrentAdmin("/admin/lancement", "/admin/journal")).toBe(false);
  });

  it("does not light the overview on every other screen", () => {
    // The trap: "/admin" is a prefix of all twelve other hrefs.
    const lit = kAdminNav.filter((i) =>
      isCurrentAdmin("/admin/utilisateurs", i.href),
    );
    expect(lit.map((i) => i.href)).toEqual(["/admin/utilisateurs"]);
  });

  it("stays on a section for its sub-pages", () => {
    expect(isCurrentAdmin("/admin/articles/nouveau", "/admin/articles")).toBe(
      true,
    );
  });

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
