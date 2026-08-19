"use client";

// ── THE SCREEN'S OWN BAR ─────────────────────────────────────────────────────
// An app tells you two things before you read anything: which screen you are on,
// and how to get out of it. This site told you neither — every screen under the
// dashboard and the admin opened with the same site header, then a wrapping row
// of links, then a heading somewhere in the content.
//
// The bar is sticky and holds one back affordance. It is deliberately not a
// title bar as well: the pages under it already open with their own heading, and
// an app that shows the same words twice on one screen reads as a template
// somebody forgot to fill in. This is the large-title arrangement — a slim bar
// to leave by, the name of the screen big underneath it.
//
// At a section root there is nowhere to go back to, so the bar shows the section
// name instead of a chevron and stays out of the way.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

export function AppBar({
  /** The screen this section returns to. */
  root,
  /** What the root is called, shown beside the chevron and at the root itself. */
  label,
  /** Optional trailing element: a sign-out button, an action. */
  action,
}: {
  root: string;
  label: string;
  action?: React.ReactNode;
}) {
  const pathname = usePathname();
  const atRoot = pathname === root;

  return (
    <div className="border-border bg-surface/95 sticky top-0 z-30 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
        {atRoot ? (
          <span className="text-base font-black">{label}</span>
        ) : (
          <Link
            href={root}
            className="text-muted hover:text-primary -ms-2 flex items-center gap-1 rounded-full px-2 py-2 text-sm font-bold transition-colors"
          >
            <ChevronRight className="size-5" strokeWidth={2.6} />
            {label}
          </Link>
        )}
        {action && <span className="ms-auto">{action}</span>}
      </div>
    </div>
  );
}
