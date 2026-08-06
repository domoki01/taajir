"use client";

// ── MOBILE BOTTOM NAVIGATION ─────────────────────────────────────────────────
// Until now every route lived in the sticky header. On a 390px phone that meant
// a logo, three links and a green button sharing 16 units of height — and the
// most important action on the site, publishing, sitting in the top corner
// furthest from the thumb. Algerian classifieds traffic is overwhelmingly
// mobile, so navigation belongs at the bottom of the screen.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Megaphone,
  Plus,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";

type Tab = {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Extra prefixes that should light this tab up. */
  also?: string[];
};

/**
 * Five is the ceiling: past that the labels stop being readable at 11px and the
 * targets drop under the 44px minimum.
 *
 * "حسابي" is the answer to "all the user's tools" — it opens the dashboard,
 * which already holds إعلاناتي، تنبيهاتي and معلوماتي. It is a plain link with
 * no auth check on purpose: `requireUser()` redirects a signed-out visitor to
 * /connexion?next=… by itself, and resolving the session here would pull
 * firebase/auth into the bundle of every page on the site for one label.
 */
const kTabs: Tab[] = [
  { href: "/", label: "الرئيسية", Icon: Home },
  {
    href: "/recherche",
    label: "بحث",
    Icon: Search,
    // The browse routes are "results" to the person looking at them, the same
    // as a search. Leaving them with no tab lit reads as the bar being broken.
    also: ["/vente", "/location", "/vacances", "/echange"],
  },
  { href: "/publier", label: "نشر", Icon: Plus },
  { href: "/demandes", label: "طلبات", Icon: Megaphone },
  { href: "/tableau-de-bord", label: "حسابي", Icon: UserRound },
];

/**
 * Routes that already own the bottom of the screen.
 *
 * The listing page pins the price and the call button there, and the publish
 * form pins its submit button; both are the whole point of those screens. Two
 * stacked bars would eat a sixth of a phone viewport, so the nav stands down.
 * Nothing is lost — the sticky header above still carries every link.
 */
const kHiddenOn = ["/annonce/", "/publier", "/modifier"];

function isActive(pathname: string, tab: Tab): boolean {
  if (tab.href === "/") return pathname === "/";
  const prefixes = [tab.href, ...(tab.also ?? [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function BottomNav() {
  const pathname = usePathname();
  if (kHiddenOn.some((p) => pathname.includes(p))) return null;

  // The first tab whose prefix matches, so /publier does not also light up as
  // a plain prefix of something else and two tabs never claim aria-current.
  const activeHref = kTabs.find((t) => isActive(pathname, t))?.href ?? null;

  return (
    <>
      {/* Occupies the space the fixed bar hovers over, so the footer is never
          hidden underneath it. Kept inside this component rather than as
          padding on <body> — that would leave a gap on the routes above where
          the bar does not render. */}
      <div
        aria-hidden
        className="h-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden"
      />

      {/* Less translucent than the header. That one sits over the top of a
          page; this one sits over whatever is scrolling underneath it, and an
          11px label stops being readable the moment a white card slides behind
          it. The blur keeps the glass feel, the opacity keeps the text. */}
      <nav
        aria-label="التنقّل السريع"
        className="rounded-t-sheet border-border bg-surface/95 shadow-lifted fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
          {kTabs.map((tab) => {
            const active = tab.href === activeHref;

            // ── THE ACTION ────────────────────────────────────────────────
            // Emerald belongs to filled action buttons and nothing else. This
            // is the one button in the bar you press to *do* something rather
            // than to go somewhere, so it is the only green here; the moment a
            // tab borrows the colour, this stops reading as a button at all.
            if (tab.href === "/publier") {
              return (
                <li key={tab.href} className="flex items-start">
                  <Link
                    href={tab.href}
                    aria-label="نشر إعلان"
                    className="bg-accent shadow-lifted ring-bg grid size-14 -translate-y-5 place-items-center rounded-full text-white ring-4 transition-transform hover:opacity-95 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <Plus className="size-7" strokeWidth={3} />
                  </Link>
                </li>
              );
            }

            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 py-2 transition-transform active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${
                    active ? "text-primary" : "text-dim"
                  }`}
                >
                  <span
                    className={`grid place-items-center rounded-full px-4 py-1 transition-colors ${
                      active ? "bg-primary-soft" : "bg-transparent"
                    }`}
                  >
                    <tab.Icon
                      className="size-5"
                      strokeWidth={active ? 2.6 : 2}
                    />
                  </span>
                  <span className="text-[11px] font-bold">{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
