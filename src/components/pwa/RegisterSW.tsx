"use client";

import { useEffect } from "react";

/**
 * Register the service worker on load.
 *
 * It used to be registered only when someone switched notifications on, which
 * was enough for push and not enough for anything else: a browser will not
 * offer to install a site that no worker controls, so the install prompt never
 * appeared, and on iOS — where push requires the site to be installed — that
 * made the whole chain impossible to start.
 *
 * Registration is cheap and idempotent; the browser reuses an existing one.
 * Failures are logged and swallowed: no worker means no install banner and no
 * push, which is exactly where the site was before, and never a broken page.
 */
export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // After load, so it never competes with the page's own first render for
    // bandwidth on a slow Algerian mobile connection.
    const register = () => {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .catch((error) => console.error("[sw] registration failed:", error));
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
