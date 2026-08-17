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
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const clean = code.trim().toUpperCase();

  // A **relative** Location, built by hand rather than through
  // NextResponse.redirect(new URL(…, request.url)).
  //
  // That form worked locally and shipped a broken link: App Hosting runs the
  // app on Cloud Run behind a proxy, so `request.url` is the container's own
  // address and the absolute URL came out as `https://localhost:8080/bienvenue`
  // — every invited visitor sent to a dead address. Deriving the public origin
  // from x-forwarded-host would work, but a relative Location needs no host at
  // all: RFC 7231 allows it and every browser resolves it against the address
  // the visitor actually typed, which is the correct one by definition.
  const response = new NextResponse(null, {
    status: 307,
    headers: { location: kFunnelHome },
  });

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
