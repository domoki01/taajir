"use client";

// ── THE SIDE MENU ────────────────────────────────────────────────────────────
// Every page on the site, in one panel, reachable from every screen.
//
// The site's navigation is four destinations: that is the right number for a
// bottom bar, and the wrong number for "show me what this site has". Removing
// the footer took the last link to the legal pages with it. This panel is the
// answer to both — the four stay where they are, and everything else lives one
// tap away instead of nowhere.
//
// One panel, two triggers. The header owns the desktop trigger and the mobile
// top bar owns the phone one, and the first version of this gave each of them
// its own copy — which put two `aria-modal` dialogs in the document on every
// page, one of them hidden only by `display:none`. The provider renders the
// panel once and hands both triggers the same switch.

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus, X } from "lucide-react";
import {
  browseLinks,
  kAccountLinks,
  kInfoLinks,
  kPublishHref,
  type MenuLink,
} from "@/lib/nav";
import { useBranding } from "@/components/branding/BrandingProvider";

export type Deal = { slug: string; label: string };

const MenuContext = createContext<{ open: () => void }>({ open: () => {} });

/** The hamburger. Rendered by whichever bar is on screen. */
export function SideMenuTrigger({ className = "" }: { className?: string }) {
  const { open } = useContext(MenuContext);
  return (
    <button
      type="button"
      onClick={open}
      aria-label="القائمة"
      aria-haspopup="dialog"
      className={`text-primary hover:bg-surface-soft grid size-10 place-items-center rounded-full transition-colors ${className}`}
    >
      <Menu className="size-6" strokeWidth={2.3} />
    </button>
  );
}

export function SideMenuProvider({
  deals,
  children,
}: {
  /** Visible transaction types, resolved on the server from the live taxonomy. */
  deals: Deal[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { siteName, tagline } = useBranding();
  const [isOpen, setIsOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  // Navigating is the whole purpose of the panel, so every link closes it —
  // through its own onClick rather than by watching the pathname. A link to the
  // page you are already on changes no path, so an effect keyed on `pathname`
  // would leave the panel sitting there looking stuck; a click handler fires
  // either way.
  const close = () => {
    setIsOpen(false);
    // Focus goes back where it came from, or the keyboard lands at the top of
    // the document with no idea what just happened.
    opener.current?.focus();
    opener.current = null;
  };

  const open = () => {
    opener.current = document.activeElement as HTMLElement | null;
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    // The page behind must not scroll under the panel — on a phone that reads
    // as the panel itself scrolling to nowhere.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        opener.current?.focus();
        opener.current = null;
      }
    }
    document.addEventListener("keydown", onKey);
    // Focus moves into the panel so the keyboard and the screen reader follow
    // it; without this, tabbing continues behind the overlay.
    panel.current?.focus();

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const tab = isOpen ? 0 : -1;

  return (
    <MenuContext.Provider value={{ open }}>
      {children}

      {/* Backdrop and panel stay mounted so the slide has something to animate
          from; `invisible` keeps them out of the tab order when shut. */}
      <div
        aria-hidden={!isOpen}
        className={`fixed inset-0 z-50 transition-opacity duration-200 motion-reduce:transition-none ${
          isOpen ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <button
          type="button"
          tabIndex={tab}
          aria-label="إغلاق القائمة"
          onClick={close}
          className="absolute inset-0 h-full w-full cursor-default bg-black/40"
        />

        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="قائمة الموقع"
          tabIndex={-1}
          className={`bg-surface absolute inset-y-0 start-0 flex w-[86%] max-w-xs flex-col shadow-2xl transition-transform duration-200 outline-none motion-reduce:transition-none ${
            isOpen
              ? "translate-x-0"
              : "ltr:-translate-x-full rtl:translate-x-full"
          }`}
        >
          <div className="border-border flex items-start gap-2 border-b px-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-lg leading-tight font-black">{siteName}</p>
              <p className="text-dim mt-0.5 text-xs leading-snug">{tagline}</p>
            </div>
            <button
              type="button"
              tabIndex={tab}
              onClick={close}
              aria-label="إغلاق"
              className="text-dim hover:text-primary -me-1 grid size-9 shrink-0 place-items-center rounded-full transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* The one filled button in the panel. Everything else is a link, so
              what someone is here to *do* stays visually separate from where
              they can go. */}
          <div className="px-4 pt-4">
            <Link
              href={kPublishHref}
              onClick={close}
              tabIndex={tab}
              className="bg-accent rounded-input flex items-center justify-center gap-2 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <Plus className="size-4" strokeWidth={3} />
              نشر إعلان
            </Link>
          </div>

          <nav
            aria-label="كل الصفحات"
            className="flex-1 overflow-y-auto px-2 py-3"
          >
            <Section
              title="تصفّح"
              links={browseLinks(deals)}
              pathname={pathname}
              tab={tab}
              onNavigate={close}
            />
            <Section
              title="حسابي"
              links={kAccountLinks}
              pathname={pathname}
              tab={tab}
              onNavigate={close}
            />
            <Section
              title="المنصّة"
              links={kInfoLinks}
              pathname={pathname}
              tab={tab}
              onNavigate={close}
            />
          </nav>

          <div className="border-border border-t px-4 py-3">
            <Link
              href="/inscription"
              onClick={close}
              tabIndex={tab}
              className="text-primary text-sm font-bold"
            >
              حساب جديد
            </Link>
            <span className="text-dim mx-2 text-sm">·</span>
            <Link
              href="/connexion"
              onClick={close}
              tabIndex={tab}
              className="text-primary text-sm font-bold"
            >
              دخول
            </Link>
          </div>
        </div>
      </div>
    </MenuContext.Provider>
  );
}

function Section({
  title,
  links,
  pathname,
  tab,
  onNavigate,
}: {
  title: string;
  links: MenuLink[];
  pathname: string;
  tab: 0 | -1;
  onNavigate: () => void;
}) {
  return (
    <div className="mb-1">
      <h2 className="text-dim px-3 pt-3 pb-1 text-[11px] font-extrabold tracking-wide">
        {title}
      </h2>
      <ul>
        {links.map((link) => {
          const current =
            link.href === "/"
              ? pathname === "/"
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={onNavigate}
                tabIndex={tab}
                aria-current={current ? "page" : undefined}
                className={`block rounded-[10px] px-3 py-2.5 text-[15px] transition-colors ${
                  current
                    ? "bg-primary-soft text-primary font-extrabold"
                    : "text-muted hover:bg-surface-soft font-semibold"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
