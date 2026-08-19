// ── THE ADMIN'S MAP ──────────────────────────────────────────────────────────
// Thirteen destinations is a lot, and the previous version rendered them as
// thirteen identical pills in one wrapping row. On a phone that is a wall: it
// filled the first screen, pushed the actual page below the fold, and gave no
// clue which of the thirteen you were currently looking at.
//
// Grouping is what makes a long list readable. Four groups, each answering a
// different question — what is on the site, who is on it, how it grows, and how
// it is configured — so the eye lands in a neighbourhood before it reads a
// label.
//
// Icons are named rather than imported here: this list is built on the server,
// where permissions are known, and a React component cannot cross that boundary
// into the client component that draws it.

import type { Permission } from "@/lib/permissions";

export type AdminNavIcon =
  | "overview"
  | "queue"
  | "comments"
  | "users"
  | "roles"
  | "promos"
  | "taxonomy"
  | "articles"
  | "branding"
  | "launch"
  | "affiliate"
  | "push"
  | "audit";

export type AdminNavGroup = "" | "المحتوى" | "الناس" | "النمو" | "المنصّة";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminNavIcon;
  group: AdminNavGroup;
  /** Any one of these opens the link. Empty means everyone who got this far. */
  need: Permission[];
};

export const kAdminNav: AdminNavItem[] = [
  { href: "/admin", label: "نظرة عامة", icon: "overview", group: "", need: [] },

  {
    href: "/admin/moderation",
    label: "طابور المراجعة",
    icon: "queue",
    group: "المحتوى",
    need: ["listings.moderate"],
  },
  {
    href: "/admin/commentaires",
    label: "التعليقات",
    icon: "comments",
    group: "المحتوى",
    need: ["comments.moderate"],
  },
  {
    href: "/admin/articles",
    label: "المقالات",
    icon: "articles",
    group: "المحتوى",
    need: ["articles.manage"],
  },
  {
    href: "/admin/filtre",
    label: "الفئات والفلتر",
    icon: "taxonomy",
    group: "المحتوى",
    need: ["taxonomy.edit"],
  },

  {
    href: "/admin/utilisateurs",
    label: "الحسابات",
    icon: "users",
    group: "الناس",
    need: ["users.manage", "users.approve"],
  },
  {
    href: "/admin/roles",
    label: "الأدوار",
    icon: "roles",
    group: "الناس",
    need: ["roles.manage"],
  },

  {
    href: "/admin/publicites",
    label: "الإشهارات",
    icon: "promos",
    group: "النمو",
    need: ["promos.manage"],
  },
  {
    href: "/admin/affiliation",
    label: "برنامج الدعوة",
    icon: "affiliate",
    group: "النمو",
    need: ["affiliate.manage"],
  },
  {
    href: "/admin/notifications",
    label: "إشعار عام",
    icon: "push",
    group: "النمو",
    need: ["push.broadcast"],
  },

  {
    href: "/admin/lancement",
    label: "الإطلاق",
    icon: "launch",
    group: "المنصّة",
    need: ["launch.control"],
  },
  {
    href: "/admin/identite",
    label: "الهوية",
    icon: "branding",
    group: "المنصّة",
    need: ["branding.edit"],
  },
  {
    href: "/admin/journal",
    label: "السجلّ",
    icon: "audit",
    group: "المنصّة",
    need: ["audit.view"],
  },
];

/** The order groups are drawn in, so the sidebar never depends on array order. */
export const kAdminGroups: Exclude<AdminNavGroup, "">[] = [
  "المحتوى",
  "الناس",
  "النمو",
  "المنصّة",
];

/**
 * Is this the section being viewed?
 *
 * `/admin` matches only itself. Every other href starts with it, so a plain
 * prefix test would light the overview tab on all thirteen screens — two active
 * tabs at once reads worse than none.
 */
export function isCurrentAdmin(pathname: string, href: string): boolean {
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
}
