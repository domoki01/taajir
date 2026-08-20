"use client";

// ── PICKING THE CODE OFF THE URL ─────────────────────────────────────────────
// A shared listing arrives as `/annonce/…?ref=CODE`. The page that renders it
// cannot set the cookie — in the App Router a Server Component may read cookies
// but never write them — so a Server Action does it, and this is what calls it.
//
// Mounted once in the root layout rather than on the pages that can be shared:
// the parameter is harmless everywhere and every page is a page somebody might
// paste. Doing nothing at all is the normal case, and it costs one read of the
// query string.

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { kRefParam } from "@/lib/share";
import { captureReferral } from "@/server/actions/affiliate";

export function ReferralCatcher() {
  const params = useSearchParams();
  const code = params.get(kRefParam);
  // The effect re-runs on every navigation that keeps the parameter; the code
  // itself only ever needs recording once per browser.
  const done = useRef<string | null>(null);

  useEffect(() => {
    if (!code || done.current === code) return;
    done.current = code;
    // Deliberately unawaited and never surfaced: the visitor came to look at a
    // flat, and a failed attribution is not their problem to see.
    void captureReferral(code).catch(() => {});
  }, [code]);

  return null;
}
