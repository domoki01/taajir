"use client";

// ── ADD TO HOME SCREEN ───────────────────────────────────────────────────────
// Installing is not a nicety here, it is the delivery channel. iOS Safari sends
// no web push at all to a site in a tab — none, at any permission level — so on
// an iPhone "notify me when a flat like this appears" only works once the site
// is on the home screen. Android gains less but still gains: an icon among the
// apps is what someone comes back through a week later.
//
// So the dialog leads with the notification, not with "install our app". The
// install is the means; the alert is the thing worth having.

import { useEffect, useState } from "react";
import { BellRing, Download, MoreVertical, Share } from "lucide-react";
import { useBranding } from "@/components/branding/BrandingProvider";
import {
  claimFirstRunDialog,
  installSnoozed,
  justSignedUpPending,
  snoozeInstall,
} from "@/lib/firstRun";
import { Modal } from "@/components/pwa/Modal";

/** The event Chrome fires when it is willing to install. Not in lib.dom yet. */
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** How the visitor's browser can install, which decides what we can show. */
type How = "prompt" | "ios" | "menu";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS predates the media query and reports it here instead.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

export function InstallPrompt() {
  const { siteName } = useBranding();
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [how, setHow] = useState<How | null>(null);

  useEffect(() => {
    if (isStandalone() || installSnoozed()) return;

    // Chrome decides when a site is worth installing and fires this; holding the
    // event is the only way to open the native prompt later, from a click.
    function onPrompt(e: Event) {
      e.preventDefault();
      setEvent(e as InstallEvent);
      // Held back if another first-run dialog already has this visit; the event
      // is kept, so the button still works when this one is shown later.
      if (justSignedUpPending() || !claimFirstRunDialog()) return;
      setHow("prompt");
    }
    window.addEventListener("beforeinstallprompt", onPrompt);

    // Shown on the first visit whether or not the browser has offered, because
    // it often has not: Chrome withholds the event behind its own engagement
    // heuristics, and Safari never fires it at all. Without this the dialog
    // would appear for almost nobody on their first visit — which is exactly
    // when it is worth asking. A beat's delay so it lands on a painted page
    // rather than on a blank one.
    const timer = window.setTimeout(() => {
      // Someone who signed up on this visit is about to be asked about
      // notifications, and two dialogs stacked on one screen is how both get
      // dismissed unread. That ask is the timely one — it belongs to the thing
      // they just did — so this one stands down and comes back another visit,
      // without burning its thirty-day snooze.
      if (justSignedUpPending() || !claimFirstRunDialog()) return;
      setHow((current) => current ?? (isIos() ? "ios" : "menu"));
    }, 1800);

    function onInstalled() {
      setHow(null);
      snoozeInstall();
    }
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  function close() {
    setHow(null);
    snoozeInstall();
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    setHow(null);
    // Snoozed either way: the browser will not hand back the event again in
    // this session, so re-asking now could only show instructions to someone
    // who has just answered.
    snoozeInstall();
    if (outcome === "accepted") return;
  }

  if (!how) return null;

  return (
    <Modal title={`زيد ${siteName} في هاتفك`} onClose={close}>
      <span className="bg-primary-soft text-primary grid size-12 place-items-center rounded-full">
        <BellRing className="size-6" />
      </span>

      <h2 className="mt-3 text-lg leading-snug font-black">
        زيد {siteName} في هاتفك
      </h2>
      <p className="text-muted mt-2 text-sm leading-relaxed">
        يفتح كيما تطبيق، ويوصلوك تنبيهات كي يجي عقار يناسب اللي تحوّس عليه — حتى
        كي يكون الموقع مسكّر.
      </p>

      {how === "prompt" && (
        <button
          type="button"
          onClick={install}
          className="bg-accent rounded-input mt-4 flex w-full items-center justify-center gap-2 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          <Download className="size-4" strokeWidth={2.6} />
          زيدو دروك
        </button>
      )}

      {how === "ios" && (
        <ol className="text-muted mt-4 space-y-2 text-sm leading-relaxed">
          <li className="flex items-center gap-2">
            <Share className="text-primary size-4 shrink-0" />
            اضغط زرّ المشاركة تحت
          </li>
          <li className="ps-6">ومن بعد «إضافة إلى الشاشة الرئيسية»</li>
        </ol>
      )}

      {how === "menu" && (
        <ol className="text-muted mt-4 space-y-2 text-sm leading-relaxed">
          <li className="flex items-center gap-2">
            <MoreVertical className="text-primary size-4 shrink-0" />
            حلّ قائمة المتصفّح
          </li>
          <li className="ps-6">
            واختار «تثبيت التطبيق» ولا «إضافة إلى الشاشة الرئيسية»
          </li>
        </ol>
      )}

      <button
        type="button"
        onClick={close}
        className="text-dim hover:text-primary mt-3 w-full py-2 text-sm font-bold transition-colors"
      >
        ماشي دروك
      </button>
    </Modal>
  );
}
