"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import {
  enablePush,
  pushState,
  type PushState,
} from "@/lib/firebase/messaging";

/**
 * "نبّهني كي ينشر" — offered where the promise was just made.
 *
 * Renders nothing at all when the browser cannot do it, when the VAPID key is
 * not configured, or when permission was already refused: a browser that has
 * been asked once and denied can never be asked again from script, so a button
 * that cannot work is worse than no button. The thank-you page reads fine
 * without it.
 */
export function NotifyOptIn() {
  // null until the first effect runs: the answer depends on browser APIs that
  // do not exist during SSR, so rendering a guess would be a hydration mismatch.
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pushState().then(setState);
  }, []);

  if (state === null) return null;
  if (
    state === "unsupported" ||
    state === "unconfigured" ||
    state === "denied"
  ) {
    return null;
  }

  if (state === "granted") {
    return (
      <p className="text-success flex items-center justify-center gap-2 text-sm font-bold">
        <BellRing className="size-4" />
        التنبيهات مشعولة — نعيّطولك كي ينشر.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await enablePush();
          if (res.ok) setState("granted");
          else {
            setError(res.error);
            setState(await pushState());
          }
          setBusy(false);
        }}
        className="rounded-input border-primary text-primary hover:bg-primary-soft inline-flex items-center gap-2 border px-5 py-3 text-sm font-bold transition-colors disabled:opacity-40"
      >
        <Bell className="size-4" />
        {busy ? "…" : "نبّهني كي ينشر"}
      </button>
      {error && (
        <p role="alert" className="text-danger mt-2 text-xs font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}
