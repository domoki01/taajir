"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GoogleAuthProvider, signInWithPopup, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { PhoneAuth } from "@/components/auth/PhoneAuth";
import { safeNext } from "@/lib/redirect";
import { markJustSignedUp } from "@/lib/firstRun";
import { kPhoneSignupEnabled } from "@/lib/constants";

type Mode = "signin" | "signup";

/**
 * Firebase error codes are opaque to a user reading Arabic. Anything not mapped
 * falls back to a generic message rather than leaking an English code.
 */
function humanize(code: string): string {
  switch (code) {
    case "auth/account-exists-with-different-credential":
      return "هذا الإيميل عندو حساب. كمّل بـGoogle بنفس الإيميل.";
    case "auth/too-many-requests":
      return "حاولت برك مرات. استنى شوية وعاود.";
    case "auth/network-request-failed":
      return "مشكل في الاتصال بالأنترنت";
    case "auth/popup-closed-by-user":
      return "";
    default:
      return "وقع مشكل. عاود من جديد.";
  }
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  // Sanitised, not just defaulted: this value is handed to the router the
  // instant the session exists, and it comes from the link that was clicked.
  const next = safeNext(params.get("next"));
  // The other page must keep the destination, or someone who taps "عندك حساب؟"
  // mid-funnel signs in and lands on their dashboard instead of the form they
  // came for.
  const carry = `?next=${encodeURIComponent(next)}`;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Trade the Firebase ID token for a server session before navigating. */
  async function establishSession(user: User) {
    const idToken = await user.getIdToken();
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        body.code === "password-disabled" ? "password" : "session",
      );
    }

    // A brand-new account has the two timestamps equal — Firebase writes both
    // at creation. That is the difference between "welcome, may we notify you?"
    // and asking a returning user the same question every time they sign in.
    if (user.metadata.creationTime === user.metadata.lastSignInTime) {
      markJustSignedUp();
    }

    // refresh() so the server re-renders with the new cookie in place.
    router.replace(next);
    router.refresh();
  }

  async function onGoogle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await establishSession(cred.user);
    } catch (e) {
      const msg = humanize((e as { code?: string }).code ?? "");
      if (msg) setError(msg);
      setBusy(false);
    }
  }

  // Hidden for new accounts only, and only while Google's SMS backend is
  // refusing this project's codes. Someone signing *in* keeps the phone form
  // whatever the flag says: it is the only door thirty-five accounts have.
  const showPhone = mode === "signin" || kPhoneSignupEnabled;

  return (
    <div className="space-y-4">
      {/* ── PHONE ──────────────────────────────────────────────────────────
          First, and not behind a toggle. Most people here have a phone number
          and no Gmail they remember the password to. */}
      {showPhone && (
        <>
          <PhoneAuth onDone={establishSession} />

          <div className="flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            <span className="text-dim text-xs font-semibold">ولا</span>
            <span className="bg-border h-px flex-1" />
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onGoogle}
        disabled={busy}
        className={`rounded-input w-full py-3.5 text-sm font-bold transition-colors disabled:opacity-50 ${
          showPhone
            ? "border-border hover:border-primary border bg-white"
            : "bg-accent text-white hover:opacity-90"
        }`}
      >
        كمّل بحساب Google
      </button>

      {!showPhone && (
        <p className="text-muted text-center text-xs leading-relaxed">
          التسجيل برقم الهاتف موقّف مؤقّتاً — عندنا مشكل عند مزوّد الرسائل. سجّل
          بحساب Google دروك، وتقدر تزيد رقمك من «معلوماتي» من بعد.
        </p>
      )}

      {/* Email and password used to sit behind a toggle here. They are gone,
          not folded away: Firebase's password provider accepts any address
          anybody types and verifies none of them, and the live site was
          mass-registered through it — 213 accounts on invented addresses in
          under an hour. Google and phone both prove the identifier before a
          token is ever issued, and the session route refuses the password
          provider outright, so leaving the form would only offer a door the
          server no longer opens. */}
      <p className="text-dim pt-1 text-center text-xs leading-relaxed">
        كنت تدخل بالإيميل وكلمة السرّ؟ اضغط «كمّل بحساب Google» بنفس الإيميل —
        حسابك وإعلاناتك يبقاو كيما هم.
      </p>

      {error && (
        <p
          role="alert"
          className="rounded-input bg-danger/10 text-danger px-4 py-3 text-sm font-semibold"
        >
          {error}
        </p>
      )}
      <p className="text-muted pt-1 text-center text-sm">
        {mode === "signup" ? (
          <>
            عندك حساب؟{" "}
            <Link
              href={`/connexion${carry}`}
              className="text-primary font-bold"
            >
              دخول
            </Link>
          </>
        ) : (
          <>
            ما عندكش حساب؟{" "}
            <Link
              href={`/inscription${carry}`}
              className="text-primary font-bold"
            >
              أنشئ واحد
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
