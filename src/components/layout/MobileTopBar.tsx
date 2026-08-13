"use client";

// ── MOBILE BACK BAR ──────────────────────────────────────────────────────────
// The header is gone below `md` and the bottom nav stands down on the listing
// page and the publish form, which would leave those two screens with no way
// out at all on a phone. This is the native answer: a detail screen loses the
// tab bar and gains a back affordance.
//
// It carries the site name as well, because the most common way anyone reaches
// a listing in Algeria is a WhatsApp link — arriving on a page with no
// indication of which site you are on is its own problem.

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { isImmersiveRoute } from "@/lib/nav";
import { useBranding } from "@/components/branding/BrandingProvider";

export function MobileTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { siteName } = useBranding();
  if (!isImmersiveRoute(pathname)) return null;

  function goBack() {
    // A listing opened straight from a WhatsApp link has nothing behind it, and
    // history.back() there walks the person out of the site entirely — which is
    // the single most common way a listing is opened in Algeria.
    //
    // Neither signal is sufficient alone. `document.referrer` does not update
    // on a client-side navigation, so it stays empty for someone who has been
    // browsing the site for ten minutes; and `history.length` counts the tab's
    // initial entry in some contexts, so 2 can still mean "nothing behind us".
    // Together they err towards the home page, which is a fine place to land.
    const cameFromHere = document.referrer.startsWith(window.location.origin);
    if (cameFromHere || window.history.length > 2) router.back();
    else router.push("/");
  }

  return (
    <div className="border-border bg-surface/95 sticky top-0 z-40 flex h-12 items-center gap-1 border-b px-2 backdrop-blur-xl md:hidden">
      <button
        type="button"
        onClick={goBack}
        aria-label="رجوع"
        className="text-primary grid size-10 place-items-center rounded-full transition-transform active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <ChevronRight className="size-6" strokeWidth={2.4} />
      </button>
      <Link href="/" className="text-sm font-extrabold tracking-tight">
        {siteName}
      </Link>
    </div>
  );
}
