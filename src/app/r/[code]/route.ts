// ── THE INVITE LINK ──────────────────────────────────────────────────────────
// `taajir.dz/r/K7M2QX` — short enough to read aloud, and the only thing a
// referrer ever has to send. It records who invited whom in a cookie and gets
// out of the way; the attribution is settled later, at the session exchange,
// where the new account is actually created.
//
// A route handler rather than a page because there is nothing to show: the
// visitor asked for the site, not for a page about a code.

import { NextResponse, type NextRequest } from "next/server";
import { kFunnelHome } from "@/lib/funnel";
import {
  kReferralCookie,
  kReferralCookieMaxAgeMs,
  kReferralCodePattern,
} from "@/lib/referral";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const clean = code.trim().toUpperCase();

  const response = NextResponse.redirect(new URL(kFunnelHome, request.url));

  // Validated by shape alone, with no database read. This URL is public and
  // unauthenticated, so resolving every code that arrives here would hand a
  // stranger one Firestore read per request. A code that passes the shape but
  // belongs to nobody simply fails to resolve at signup, which costs nothing.
  if (!kReferralCodePattern.test(clean)) return response;

  response.cookies.set(kReferralCookie, clean, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: kReferralCookieMaxAgeMs / 1000,
  });
  return response;
}
