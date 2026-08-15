"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { PhoneAuth } from "@/components/auth/PhoneAuth";

type Mode = "signin" | "signup";

/**
 * Firebase error codes are opaque to a user reading Arabic. Anything not mapped
 * falls back to a generic message rather than leaking an English code.
 */
function humanize(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "الإيميل ولا كلمة السر غالطين";
    case "auth/email-already-in-use":
      return "هذا الإيميل عندو حساب من قبل. سجّل الدخول.";
    case "auth/weak-password":
      return "كلمة السر قصيرة — لازم 6 حروف على الأقل";
    case "auth/invalid-email":
      return "الإيميل ماشي صحيح";
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
  const next = params.get("next") || "/tableau-de-bord";
  // The other page must keep the destination, or someone who taps "عندك حساب؟"
  // mid-funnel signs in and lands on their dashboard instead of the form they
  // came for.
  const carry = `?next=${encodeURIComponent(next)}`;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Email and password are folded away rather than removed: they are what the
  // accounts created before this screen existed still sign in with. A phone
  // number is what someone arriving today actually has.
  const [showEmail, setShowEmail] = useState(false);

  /** Trade the Firebase ID token for a server session before navigating. */
  async function establishSession(user: User) {
    const idToken = await user.getIdToken();
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new Error("session");
    // refresh() so the server re-renders with the new cookie in place.
    router.replace(next);
    router.refresh();
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const cred =
        mode === "signup"
          ? await createUserWithEmailAndPassword(auth, email.trim(), password)
          : await signInWithEmailAndPassword(auth, email.trim(), password);

      if (mode === "signup" && name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
        // Force a token refresh so the session cookie carries the name.
        await cred.user.getIdToken(true);
      }
      await establishSession(cred.user);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      setError(humanize(code) || "وقع مشكل. عاود من جديد.");
      setBusy(false);
    }
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

  async function onReset() {
    if (!email.trim()) {
      setError("اكتب إيميلك الأول باش نرسلولك رابط");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setError(null);
      setNotice("رسّلنالك رابط في الإيميل باش تبدّل كلمة السر.");
    } catch (e) {
      setError(humanize((e as { code?: string }).code ?? ""));
    }
  }

  const field =
    "rounded-input border-border w-full border bg-white px-4 py-3 text-base outline-none focus:border-primary";

  return (
    <div className="space-y-4">
      {/* ── PHONE ──────────────────────────────────────────────────────────
          First, and not behind a toggle. Most people here have a phone number
          and no Gmail they remember the password to. */}
      <PhoneAuth onDone={establishSession} />

      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-dim text-xs font-semibold">ولا</span>
        <span className="bg-border h-px flex-1" />
      </div>

      <button
        type="button"
        onClick={onGoogle}
        disabled={busy}
        className="rounded-input border-border hover:border-primary w-full border bg-white py-3.5 text-sm font-bold transition-colors disabled:opacity-50"
      >
        كمّل بحساب Google
      </button>

      {!showEmail && (
        <button
          type="button"
          onClick={() => setShowEmail(true)}
          className="text-dim hover:text-primary w-full text-center text-xs font-bold underline"
        >
          {mode === "signup" ? "ولا بالإيميل وكلمة السر" : "دخول بالإيميل"}
        </button>
      )}

      {showEmail && (
        <form onSubmit={onSubmit} className="space-y-3 pt-1">
          {mode === "signup" && (
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-bold">
                الاسم
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className={field}
                placeholder="اسمك ولا اسم الوكالة"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-bold">
              الإيميل
            </label>
            <input
              id="email"
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={`${field} text-start`}
              placeholder="nom@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-bold"
            >
              كلمة السر
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              className={`${field} text-start`}
            />
            {mode === "signup" && (
              <p className="text-dim mt-1.5 text-xs">6 حروف على الأقل</p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="rounded-input border-border hover:border-primary w-full border bg-white py-3.5 text-sm font-bold transition-colors disabled:opacity-50"
          >
            {busy ? "..." : mode === "signup" ? "أنشئ الحساب" : "دخول"}
          </button>

          {mode === "signin" && (
            <button
              type="button"
              onClick={onReset}
              className="text-muted block w-full text-xs font-semibold underline"
            >
              نسيت كلمة السر
            </button>
          )}
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-input bg-danger/10 text-danger px-4 py-3 text-sm font-semibold"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-input bg-success/10 text-success px-4 py-3 text-sm font-semibold"
        >
          {notice}
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
