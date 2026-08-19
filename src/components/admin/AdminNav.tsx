"use client";

// ── WHERE YOU ARE, AND WHERE ELSE YOU CAN GO ─────────────────────────────────
// Two shapes for one list, because a phone and a desktop want opposite things
// from thirteen links.
//
// On a phone it is a single row that scrolls sideways, showing the current
// section as a filled pill. One line instead of a five-line wall, and the page
// underneath starts where it should — at the top of the screen.
//
// From `md` up there is room for the real answer: a sidebar with the groups
// named, so the whole map is visible at once and the eye lands in a
// neighbourhood before it reads a label.
//
// The active state is the part that was missing entirely. A panel that cannot
// tell you which of its thirteen screens you are on reads as a pile of links,
// which is exactly what it looked like.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  Clock,
  Image as ImageIcon,
  LayoutGrid,
  MessageSquare,
  Newspaper,
  Palette,
  Rocket,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  isCurrentAdmin,
  kAdminGroups,
  type AdminNavIcon,
  type AdminNavItem,
} from "@/app/admin/nav";

/** Named on the server, resolved here — components do not cross that boundary. */
const kIcons: Record<AdminNavIcon, LucideIcon> = {
  overview: LayoutGrid,
  queue: Clock,
  comments: MessageSquare,
  users: Users,
  roles: ShieldCheck,
  promos: ImageIcon,
  taxonomy: SlidersHorizontal,
  articles: Newspaper,
  branding: Palette,
  launch: Rocket,
  affiliate: BadgeCheck,
  push: Bell,
  audit: ScrollText,
};

export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  const active = useRef<HTMLAnchorElement | null>(null);

  // A one-line strip that scrolls is only an improvement while the line you are
  // on is on screen. Landing on the tenth section and seeing the first three is
  // the same "where am I" as having no active state at all.
  useEffect(() => {
    active.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  return (
    <>
      {/* ── PHONE: one scrolling row ──────────────────────────────────────── */}
      <nav
        aria-label="أقسام الإشراف"
        className="-mx-4 mb-5 overflow-x-auto px-4 pb-1 md:hidden [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <ul className="flex w-max items-center gap-2">
          {items.map((item) => {
            const Icon = kIcons[item.icon];
            const here = isCurrentAdmin(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  ref={here ? active : undefined}
                  aria-current={here ? "page" : undefined}
                  className={`rounded-input flex items-center gap-2 border px-3.5 py-2 text-sm font-bold whitespace-nowrap transition-colors ${
                    here
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={2.4} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── DESKTOP: a sidebar with the groups named ──────────────────────── */}
      <nav aria-label="أقسام الإشراف" className="hidden w-56 shrink-0 md:block">
        <div className="sticky top-24 space-y-5">
          {["" as const, ...kAdminGroups].map((group) => {
            const rows = items.filter((i) => i.group === group);
            if (rows.length === 0) return null;
            return (
              <div key={group || "top"}>
                {group && (
                  <p className="text-dim mb-2 px-3 text-xs font-extrabold">
                    {group}
                  </p>
                )}
                <ul className="space-y-1">
                  {rows.map((item) => {
                    const Icon = kIcons[item.icon];
                    const here = isCurrentAdmin(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={here ? "page" : undefined}
                          className={`rounded-input flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold transition-colors ${
                            here
                              ? "bg-primary-soft text-primary"
                              : "text-muted hover:bg-surface-soft hover:text-primary"
                          }`}
                        >
                          <Icon className="size-4 shrink-0" strokeWidth={2.4} />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>
    </>
  );
}
