"use client";

// ── THE ASK, RIGHT AFTER SIGNING UP ──────────────────────────────────────────
// Permission to notify is a one-shot: a browser that has been asked and refused
// can never be asked again from script. So *when* it is asked is the whole
// design, and the moment after someone finishes creating an account is the best
// one the site has — they have just told us what they want, and the promise
// ("we will tell you when it appears") is fresh enough to be worth a yes.
//
// Never on a cold first visit, which is where sites burn this permission for
// good on someone who has no idea what they would be agreeing to.

import { useEffect, useState } from "react";
import { BellRing, Check } from "lucide-react";
import { claimFirstRunDialog, takeJustSignedUp } from "@/lib/firstRun";
import { Modal } from "@/components/pwa/Modal";

/**
 * Whether asking is worth anything, decided from the browser alone.
 *
 * Deliberately not `pushState()` from the messaging module. That answer is
 * better — it knows about the VAPID key and runs Firebase's own capability
 * check — but getting it means importing the messaging SDK, which pulls the
 * Firebase app into the bundle of every page this component sits on, and which
 * in one observed case never resolved at all: the SDK was waiting behind an
 * App Check attestation that could not reach reCAPTCHA, and the dialog silently
 * never appeared. A missed prompt is invisible, so this path is kept to APIs
 * the browser answers synchronously; the SDK is loaded on the click instead.
 */
function worthAsking(): boolean {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  // iOS Safari in a tab has Notification but no PushManager — there the honest
  // next step is installing, which the install dialog already asks for.
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }
  // "denied" can never be undone from script and "granted" is already answered.
  return Notification.permission === "default";
}

export function NotifyPrompt() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // On a timer rather than straight away, for two reasons: signing up ends in
    // a redirect, and a dialog that opens mid-navigation is a dialog nobody
    // reads; and the flag must not be consumed by a mount that is about to be
    // thrown away by that same redirect.
    const timer = window.setTimeout(() => {
      if (takeJustSignedUp() && worthAsking() && claimFirstRunDialog()) {
        setOpen(true);
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  async function allow() {
    setBusy(true);
    setError(null);
    // Loaded here, on the click: this is the first moment the SDK is actually
    // needed, and the click is also the user gesture the permission prompt
    // requires — so nothing is lost by waiting for the chunk.
    const { enablePush } = await import("@/lib/firebase/messaging");
    const res = await enablePush();
    setBusy(false);
    if (res.ok) {
      setDone(true);
      // Left up for a beat so the yes is acknowledged rather than the dialog
      // just vanishing.
      window.setTimeout(() => setOpen(false), 1400);
    } else {
      setError(res.error);
    }
  }

  if (!open) return null;

  return (
    <Modal title="نبّهك كي يجي عقار يناسبك؟" onClose={() => setOpen(false)}>
      <span
        className={`grid size-12 place-items-center rounded-full ${
          done ? "bg-success/15 text-success" : "bg-primary-soft text-primary"
        }`}
      >
        {done ? (
          <Check className="size-6" strokeWidth={3} />
        ) : (
          <BellRing className="size-6" />
        )}
      </span>

      {done ? (
        <>
          <h2 className="mt-3 text-lg font-black">تفعّلو ✅</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            يوصلك تنبيه كي يجي عقار يناسبك، وكي يتقرّر في منشوراتك.
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-3 text-lg leading-snug font-black">
            نبّهوك كي يجي عقار يناسبك؟
          </h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            نبعثولك إشعار كي يتنشر عقار يشبه اللي تحوّس عليه، وكي يتقرّر في
            إعلانك ولا طلبك. تقدر تطفيهم في أي وقت من «تنبيهاتي».
          </p>

          {error && (
            <p role="alert" className="text-danger mt-3 text-sm font-bold">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={allow}
            className="bg-accent rounded-input mt-4 flex w-full items-center justify-center gap-2 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <BellRing className="size-4" strokeWidth={2.6} />
            {busy ? "…" : "إي، نبّهوني"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setOpen(false)}
            className="text-dim hover:text-primary mt-2 w-full py-2 text-sm font-bold transition-colors"
          >
            ماشي دروك
          </button>
        </>
      )}
    </Modal>
  );
}
