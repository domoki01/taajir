"use client";

// ── MOBILE BOTTOM NAVIGATION ─────────────────────────────────────────────────
// The whole menu on a phone. The header is gone below `md`, so this is not a
// shortcut bar sitting under a top bar — it is the navigation, and every
// destination someone reaches often has to be in it.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import {
  isCurrent,
  isImmersiveRoute,
  kNavItems,
  kPublishHref,
} from "@/lib/nav";

export function BottomNav() {
  const pathname = usePathname();
  if (isImmersiveRoute(pathname)) return null;

  // The first match wins, so two destinations never both claim aria-current.
  const currentHref = kNavItems.find((i) => isCurrent(pathname, i))?.href;

  return (
    <>
      {/* Occupies the space the fixed bar hovers over, so the footer is never
          hidden underneath it. Kept inside this component rather than as
          padding on <body> — that would leave a gap on the immersive routes
          where the bar does not render. */}
      <div
        aria-hidden
        className="h-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden"
      />

      {/* Less translucent than a desktop header would be. This one sits over
          whatever is scrolling underneath it, and an 11px label stops being
          readable the moment a white card slides behind it. The blur keeps the
          glass feel, the opacity keeps the text. */}
      <nav
        aria-label="التنقّل السريع"
        className="rounded-t-sheet border-border bg-surface/95 shadow-lifted fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
          {kNavItems.slice(0, 2).map((item) => (
            <NavTab key={item.href} item={item} current={currentHref} />
          ))}

          {/* ── THE ACTION ────────────────────────────────────────────────
              Emerald belongs to filled action buttons and nothing else. This
              is the one thing in the bar you press to *do* something rather
              than to go somewhere, so it is the only green here; the moment a
              destination borrows the colour, this stops reading as a button. */}
          <li className="flex items-start">
            <Link
              href={kPublishHref}
              aria-label="نشر إعلان"
              className="bg-accent shadow-lifted ring-bg grid size-14 -translate-y-5 place-items-center rounded-full text-white ring-4 transition-transform hover:opacity-95 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <Plus className="size-7" strokeWidth={3} />
            </Link>
          </li>

          {kNavItems.slice(2).map((item) => (
            <NavTab key={item.href} item={item} current={currentHref} />
          ))}
        </ul>
      </nav>
    </>
  );
}

function NavTab({
  item,
  current,
}: {
  item: (typeof kNavItems)[number];
  current?: string;
}) {
  const active = item.href === current;

  return (
    <li className="flex-1">
      <Link
        href={item.href}
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
          <item.Icon className="size-5" strokeWidth={active ? 2.6 : 2} />
        </span>
        <span className="text-[11px] font-bold">{item.label}</span>
      </Link>
    </li>
  );
}
