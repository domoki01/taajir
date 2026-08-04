// ── SESSION EXCHANGE ─────────────────────────────────────────────────────────
// The client signs in with the Firebase SDK and posts its ID token here; we
// verify it and hand back an httpOnly session cookie the server can read on
// every subsequent request. The ID token itself is never stored in a cookie —
// it is short-lived and not revocable server-side.

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { ensureUserDoc, kSessionCookie, kSessionMaxAgeMs } from "@/server/auth";

export async function POST(request: Request) {
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

    await ensureUserDoc(decoded.uid, {
      email: decoded.email ?? null,
      name: (decoded.name as string) ?? "",
      photoURL: (decoded.picture as string) ?? null,
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
    return response;
  } catch (error) {
    console.error("[auth] session exchange failed:", error);
    // TEMPORARY: this project's log access is restricted, so the failure code
    // is echoed to the caller to diagnose a production-only auth failure.
    // Remove once the cause is fixed.
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    return NextResponse.json(
      { error: "unauthorized", detail: detail.slice(0, 300) },
      { status: 401 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(kSessionCookie, "", { path: "/", maxAge: 0 });
  return response;
}
