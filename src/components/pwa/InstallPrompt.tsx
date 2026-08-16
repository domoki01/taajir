"use client";

// ── ADD TO HOME SCREEN ───────────────────────────────────────────────────────
// Installing is not a nicety here, it is the delivery channel. iOS Safari sends
// no web push at all to a site in a tab — none, at any permission level — so on
// an iPhone "notify me when a flat like this appears" only works once the site
// is on the home screen. Android gains less but still gains: an icon among the
// apps is what someone comes back through a week later.
//
// So the banner leads with the notification, not with "install our app". The
// install is the means; the alert is the thing worth having.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isImmersiveRoute } from "@/lib/nav";
import { BellRing, Download, Share, X } from "lucide-react";
import { useBranding } from "@/components/branding/BrandingProvider";

/** The event Chrome fires when it is willing to install. Not in lib.dom yet. */
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const kDismissedKey = "taajir.install.dismissed";
/** A month. Long enough not to nag, short enough to catch a change of mind. */
const kSnooze = 30 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS predates the media query and reports it here instead.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  // Chrome and Firefox on iOS cannot install either — only Safari can, so
  // instructions for anything else would be instructions for a menu with no
  // such item in it.
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export function InstallPrompt() {
  const pathname = usePathname();
  const { siteName } = useBranding();
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // Already installed — nothing to offer.

    const snoozedAt = Number(localStorage.getItem(kDismissedKey) ?? 0);
    if (snoozedAt && Date.now() - snoozedAt < kSnooze) return;

    // Chrome decides when the site is worth installing and fires this; holding
    // the event is the only way to show our own prompt later, from a click.
    function onPrompt(e: Event) {
      e.preventDefault();
      setEvent(e as InstallEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);

    // Safari never fires it, so iOS is offered instructions instead. Delayed a
    // beat: a banner that animates in before the page has painted reads as an
    // ad, and this one is asking for something.
    const timer = window.setTimeout(() => setIos(isIosSafari()), 2500);

    function onInstalled() {
      setGone(true);
      localStorage.setItem(kDismissedKey, String(Date.now()));
    }
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    setGone(true);
    localStorage.setItem(kDismissedKey, String(Date.now()));
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // Either way the browser will not offer this event again in this session.
    setGone(true);
    if (outcome === "dismissed") {
      localStorage.setItem(kDismissedKey, String(Date.now()));
    }
  }

  if (gone || (!event && !ios)) return null;

  return (
    <div
      role="dialog"
      aria-label="زيد الموقع في هاتفك"
      // Sits above the bottom nav, not under it, and clears the iPhone home
      // indicator. z-30 keeps it below the side menu's overlay.
      className="rounded-t-sheet border-border bg-surface shadow-lifted fixed inset-x-0 bottom-0 z-30 border-t p-4 md:inset-x-auto md:end-4 md:bottom-4 md:max-w-sm md:rounded-2xl md:border"
      // Clears the bottom nav where there is one. The funnel and the forms
      // stand it down, and reserving its height there would leave the banner
      // floating above a strip of nothing.
      style={{
        paddingBottom: isImmersiveRoute(pathname)
          ? "calc(1rem + env(safe-area-inset-bottom))"
          : "calc(1rem + env(safe-area-inset-bottom) + 4.5rem)",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="bg-primary-soft text-primary grid size-10 shrink-0 place-items-center rounded-full">
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug font-extrabold">
            زيد {siteName} في هاتفك
          </p>
          <p className="text-muted mt-1 text-xs leading-relaxed">
            {ios
              ? "باش يوصلوك التنبيهات كي يجي عقار يناسبك، لازم تزيد الموقع للشاشة الرئيسية."
              : "يفتح كيما تطبيق، ويوصلوك تنبيهات كي يجي عقار يناسب بحثك."}
          </p>

          {ios ? (
            <p className="text-dim mt-2 flex items-center gap-1.5 text-xs font-semibold">
              اضغط
              <Share className="text-primary size-4 shrink-0" />
              في الأسفل، ومن بعد «إضافة إلى الشاشة الرئيسية»
            </p>
          ) : (
            <button
              type="button"
              onClick={install}
              className="bg-accent rounded-input mt-3 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <Download className="size-4" strokeWidth={2.6} />
              زيدو
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="ماشي دروك"
          className="text-dim hover:text-primary -me-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
