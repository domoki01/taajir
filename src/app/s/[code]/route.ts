// ── THE SHORT LINK ───────────────────────────────────────────────────────────
// `/s/K7M2QX` — one line in a Facebook post instead of four.
//
// A route handler rather than a page, for the same reason `/r/CODE` is one:
// there is nothing to show. It resolves, records who sent the visitor, and gets
// out of the way.
//
// Facebook and WhatsApp follow the redirect and read the destination's own
// OpenGraph tags, so the preview is the ad's photo and title — the short link
// costs nothing in the card.

import { NextResponse, type NextRequest } from "next/server";
import { kReferralCookie, kReferralCookieMaxAgeMs } from "@/lib/referral";
import { kShortCodePattern } from "@/lib/shortlink";
import { resolveShortLink } from "@/server/shortlink";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const clean = code.trim().toUpperCase();

  // A **relative** Location, built by hand. App Hosting runs this on Cloud Run
  // behind a proxy, so `request.url` is the container's own address — building
  // an absolute URL from it once shipped an invite link pointing at
  // https://localhost:8080. A relative Location needs no host at all: every
  // browser resolves it against the address the visitor actually typed.
  if (!kShortCodePattern.test(clean)) {
    return new NextResponse(null, { status: 307, headers: { location: "/" } });
  }

  const link = await resolveShortLink(clean);
  if (!link) {
    return new NextResponse(null, { status: 307, headers: { location: "/" } });
  }

  const response = new NextResponse(null, {
    status: 307,
    headers: { location: link.path },
  });

  // The same rule as the `?ref=` catcher: the first person to send you here
  // keeps the credit, so an existing cookie is never overwritten.
  if (link.ref && !request.cookies.get(kReferralCookie)?.value) {
    response.cookies.set(kReferralCookie, link.ref, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(kReferralCookieMaxAgeMs / 1000),
    });
  }

  return response;
}
