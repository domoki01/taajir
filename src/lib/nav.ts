// ── SITE NAVIGATION ──────────────────────────────────────────────────────────
// One list of destinations, two presentations: a bottom bar on phones and the
// header menu on desktop. Defining it once is the point — a phone menu and a
// desktop menu that drift apart is how a site ends up with pages only half its
// users can find.

import {
  Home,
  Megaphone,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Extra path prefixes that should mark this destination as current. */
  also?: string[];
};

/**
 * Four, because the bottom bar seats five and the middle seat is the publish
 * button. Past that the labels stop being readable at 11px and the targets drop
 * under the 44px minimum.
 *
 * "حسابي" is the answer to "all the user's tools" — it opens the dashboard,
 * which already holds إعلاناتي، تنبيهاتي and معلوماتي. It is a plain link with
 * no auth check on purpose: requireUser() redirects a signed-out visitor to
 * /connexion?next=… by itself, and resolving the session here would pull
 * firebase/auth into the bundle of every page on the site to change one label.
 */
export const kNavItems: NavItem[] = [
  { href: "/", label: "الرئيسية", Icon: Home },
  {
    href: "/recherche",
    label: "بحث",
    Icon: Search,
    // The browse routes are "results" to the person looking at them, the same
    // as a search. Leaving them with no destination marked reads as a bug.
    also: ["/vente", "/location", "/vacances", "/echange"],
  },
  { href: "/demandes", label: "طلبات", Icon: Megaphone },
  { href: "/tableau-de-bord", label: "حسابي", Icon: UserRound },
];

export const kPublishHref = "/publier";

// ── THE FULL MAP ─────────────────────────────────────────────────────────────
// The bottom bar seats four destinations and the header shows the same four.
// Everything else the site has — the browse routes per deal, the five account
// screens, and the pages that say who we are and what the rules are — had no
// entrance at all once the footer came off. This is that entrance: one panel
// listing every page, grouped the way someone would ask for them.
//
// Grouped rather than one flat list on purpose. Fifteen links in a column is a
// wall; three short groups with headings is a map, and the headings are what
// tell a first-time visitor what kind of site this is.

export type MenuLink = { href: string; label: string };
export type MenuSection = { title: string; links: MenuLink[] };

/** Screens behind /tableau-de-bord. Listed for everyone: requireUser() sends a
 *  signed-out visitor to /connexion?next=… by itself, and resolving the session
 *  here would pull firebase/auth into every page's bundle to hide five links. */
export const kAccountLinks: MenuLink[] = [
  { href: "/tableau-de-bord", label: "لوحتي" },
  { href: "/tableau-de-bord/publications", label: "منشوراتي" },
  { href: "/tableau-de-bord/annonces", label: "إعلاناتي" },
  { href: "/tableau-de-bord/alertes", label: "تنبيهاتي" },
  { href: "/tableau-de-bord/profil", label: "معلوماتي" },
];

/** The pages the footer used to carry, and nothing else linked to. */
export const kInfoLinks: MenuLink[] = [
  { href: "/a-propos", label: "من نحن" },
  { href: "/aide", label: "المساعدة" },
  { href: "/securite", label: "نصائح الأمان" },
  { href: "/cgu", label: "شروط الاستعمال" },
  { href: "/confidentialite", label: "سياسة الخصوصية" },
];

/**
 * Browse destinations, built from the *live* taxonomy rather than the enums.
 * Categories are admin-editable and hideable, and a menu that offers one an
 * admin has hidden is a link to a page they deliberately took down.
 */
export function browseLinks(
  deals: Array<{ slug: string; label: string }>,
): MenuLink[] {
  return [
    { href: "/", label: "الرئيسية" },
    ...deals.map((d) => ({ href: `/${d.slug}`, label: d.label })),
    { href: "/recherche", label: "بحث متقدّم" },
    { href: "/demandes", label: "طلبات العقار" },
  ];
}

/**
 * Screens that own the bottom of the phone viewport themselves.
 *
 * The listing page pins the price and the call buttons there and the publish
 * form pins its submit button; both are the whole point of those screens. Two
 * stacked bars would eat a sixth of the viewport, so the nav stands down and a
 * back bar takes its place at the top.
 */
export function isImmersiveRoute(pathname: string): boolean {
  return [
    "/annonce/",
    "/publier",
    "/modifier",
    // The funnel and the two wizards behind it: one decision per screen, with
    // the button pinned to the thumb. A nav bar under that is a second row of
    // targets competing with the only one that matters.
    "/bienvenue",
    "/demandes/nouvelle",
    "/merci",
    // Sign-in and sign-up sit between a funnel button and the form it leads to.
    "/connexion",
    "/inscription",
  ].some((p) => pathname.includes(p));
}

export function isCurrent(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/";
  return [item.href, ...(item.also ?? [])].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
