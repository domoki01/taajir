"use client";

// ── DESKTOP HEADER ───────────────────────────────────────────────────────────
// Desktop only. On a phone the bottom bar *is* the menu, and a branding bar
// above it would spend 64px of a small screen restating a logo.
//
// The destinations come from the same list the bottom bar renders, so the two
// cannot drift into a desktop menu and a phone menu that reach different pages.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { isCurrent, kNavItems, kPublishHref } from "@/lib/nav";
import { useBranding } from "@/components/branding/BrandingProvider";

export function Header() {
  const pathname = usePathname();
  const { siteName } = useBranding();

  return (
    <header className="bg-surface/90 border-border sticky top-0 z-40 hidden border-b backdrop-blur md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="bg-primary grid size-9 place-items-center rounded-[12px] text-white">
            <Building2 className="size-5" strokeWidth={2.4} />
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            {siteName}
          </span>
        </Link>

        <nav
          aria-label="التنقّل"
          className="text-muted ms-auto flex items-center gap-6 text-sm font-semibold"
        >
          {kNavItems.map((item) => {
            const active = isCurrent(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`transition-colors ${
                  active ? "text-primary font-extrabold" : "hover:text-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* "الوكالات" stays hidden until agency profiles exist — a link that
            404s is worse than no link. */}
        <Link
          href={kPublishHref}
          className="bg-accent rounded-input ms-1 inline-flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" strokeWidth={3} />
          نشر إعلان
        </Link>
      </div>
    </header>
  );
}
