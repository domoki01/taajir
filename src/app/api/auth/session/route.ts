// ── SESSION EXCHANGE ─────────────────────────────────────────────────────────
// The client signs in with the Firebase SDK and posts its ID token here; we
// verify it and hand back an httpOnly session cookie the server can read on
// every subsequent request. The ID token itself is never stored in a cookie —
// it is short-lived and not revocable server-side.

import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { ensureUserDoc, kSessionCookie, kSessionMaxAgeMs } from "@/server/auth";
import { referrerFor } from "@/server/affiliate";
import { kReferralCookie } from "@/lib/referral";

export async function POST(request: NextRequest) {
  let idToken: string | undefined;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!idToken) {
    return NextResponse.json({ error: "missing token" }, { status: 400 });
  }

  try {
    const decoded = await adminAuth().verifyIdToken(idToken, true);

    // ── THE PROVIDER GATE ────────────────────────────────────────────────────
    // Enforced here, not in the sign-up form, because the form is not a gate.
    // The Firebase web API key is public by design and the Identity Toolkit
    // REST endpoint accepts it from anywhere, so removing a button removes a
    // button — an attacker calls accounts:signUp directly and never sees the
    // page. This route is the only place the whole site actually trusts: no
    // session cookie, no account, whatever exists in Auth.
    //
    // The live site was mass-registered from that endpoint — 213 accounts in
    // under an hour, on invented addresses — which is what this closes.
    //
    // Email/password is refused outright rather than merely required to be
    // verified: an unverified address is a claim on somebody else's inbox, and
    // the launch mail-out would have delivered to every one of them. Google and
    // phone both prove the identifier before Firebase ever issues the token.
    const provider = decoded.firebase?.sign_in_provider;
    if (provider === "password") {
      return NextResponse.json(
        { error: "provider disabled", code: "password-disabled" },
        { status: 403 },
      );
    }

    // Settled here rather than at the click, because this is the first moment
    // an account exists to attach it to. The code is only resolved when the
    // cookie is present, so an ordinary sign-in costs no extra read.
    const invite = request.cookies.get(kReferralCookie)?.value;
    const referredBy = invite ? await referrerFor(invite) : null;

    await ensureUserDoc(decoded.uid, {
      email: decoded.email ?? null,
      name: (decoded.name as string) ?? "",
      photoURL: (decoded.picture as string) ?? null,
      // Present only for accounts created through phone sign-in. It is the one
      // way to reach those users, and the publish form prefills the contact
      // field from it rather than asking for a number they just typed.
      phone: (decoded.phone_number as string) ?? null,
      // Recorded so the mail-out can refuse anything unproven, rather than
      // trusting that this route is the only way an account was ever made.
      emailVerified: decoded.email_verified === true,
      // Read from the verified token, never from the client: it decides whether
      // this account has to wait for a moderator, so it has to come from the
      // half of the exchange the caller cannot write.
      provider,
      referredBy,
    });

    const cookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: kSessionMaxAgeMs,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(kSessionCookie, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: kSessionMaxAgeMs / 1000,
    });
    // Spent. Leaving it would re-offer the same code to whoever signs in on
    // this device next — a shared phone in a cybercafé is not unusual here.
    if (invite)
      response.cookies.set(kReferralCookie, "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    // Never echo the underlying error to the caller: it can carry project ids,
    // token contents and SDK internals. The server log is the place for it.
    console.error("[auth] session exchange failed:", error);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(kSessionCookie, "", { path: "/", maxAge: 0 });
  return response;
}
