"use client";

import { useEffect, useRef, useState } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updateProfile,
  type ConfirmationResult,
  type UserCredential,
} from "firebase/auth";
import { ArrowRight, Phone } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { formatLocal, kPhoneHint, toE164 } from "@/lib/phone";

type Step = "number" | "code" | "name";

/**
 * Sign in with an Algerian mobile number.
 *
 * Three steps, because a phone account arrives with no display name and
 * `ownerName` is stamped onto every ad at publish time — skipping the name step
 * would put "مستخدم" on every listing this route ever creates.
 *
 * The reCAPTCHA is invisible and mounted once. Firebase requires a verifier
 * even in invisible mode, and re-creating it between attempts leaves the old
 * widget attached to a DOM node that no longer exists.
 */
export function PhoneAuth({
  onDone,
}: {
  onDone: (cred: UserCredential) => Promise<void>;
}) {
  const [step, setStep] = useState<Step>("number");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifier = useRef<RecaptchaVerifier | null>(null);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const credential = useRef<UserCredential | null>(null);
  // Surfaced under the error message while this route is new. "وقع مشكل" alone
  // is unactionable from a phone with no console access — this is what turns a
  // screenshot into a diagnosis instead of another round of guessing.
  const [debugCode, setDebugCode] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      verifier.current?.clear();
      verifier.current = null;
    };
  }, []);

  function humanize(code: string): string {
    switch (code) {
      case "auth/operation-not-allowed":
        // The provider is off in the Firebase console. Say so plainly rather
        // than "something went wrong": it is the one error here that no amount
        // of retrying by the user will fix.
        return "التسجيل بالهاتف ما زال ما تفعّلش. استعمل حساب Google من تحت.";
      case "auth/invalid-phone-number":
        return "الرقم ماشي صحيح";
      case "auth/invalid-verification-code":
        return "الكود غالط. تأكّد وعاود.";
      case "auth/code-expired":
        return "الكود فات وقتو. اطلب واحد جديد.";
      case "auth/too-many-requests":
        return "حاولت برك مرات. استنى شوية وعاود.";
      case "auth/quota-exceeded":
        return "وصلنا للحد اليومي تع الرسائل. استعمل حساب Google.";
      case "auth/network-request-failed":
        return "مشكل في الاتصال بالأنترنت";
      case "auth/captcha-check-failed":
        return "فشل التحقّق. عاود تحميل الصفحة.";
      default:
        return "وقع مشكل. عاود من جديد.";
    }
  }

  async function sendCode() {
    const e164 = toE164(phone);
    if (!e164) {
      setError(kPhoneHint);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      verifier.current ??= new RecaptchaVerifier(auth, "recaptcha-holder", {
        size: "invisible",
      });
      confirmation.current = await signInWithPhoneNumber(
        auth,
        e164,
        verifier.current,
      );
      setStep("code");
    } catch (e) {
      const err = e as { code?: string; message?: string };
      console.error("[phone-auth] sendCode failed:", err);
      setError(humanize(err.code ?? ""));
      setDebugCode(err.code ?? err.message ?? null);
      // A failed attempt burns the widget; the next one needs a fresh instance.
      verifier.current?.clear();
      verifier.current = null;
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!confirmation.current) return;
    setBusy(true);
    setError(null);
    try {
      const cred = await confirmation.current.confirm(code.trim());
      credential.current = cred;

      // Someone who signed up here before already has a name; send them
      // straight through rather than asking again.
      if (cred.user.displayName) {
        await onDone(cred);
        return;
      }
      setStep("name");
    } catch (e) {
      const err = e as { code?: string; message?: string };
      console.error("[phone-auth] verifyCode failed:", err);
      setError(humanize(err.code ?? ""));
      setDebugCode(err.code ?? err.message ?? null);
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    const cred = credential.current;
    if (!cred) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("اكتب اسمك باش الناس تعرف مع من تتعامل");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateProfile(cred.user, { displayName: trimmed });
      // Force a token refresh so the session cookie carries the new name.
      await cred.user.getIdToken(true);
      await onDone(cred);
    } catch {
      setError("ما نجحش تسجيل الاسم. عاود.");
      setBusy(false);
    }
  }

  const field =
    "rounded-input border-border w-full border bg-white px-4 py-3.5 text-base outline-none focus:border-primary";
  const submit =
    "bg-accent rounded-input w-full py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

  return (
    <div className="space-y-3">
      {/* Firebase attaches the invisible widget here. */}
      <div id="recaptcha-holder" />

      {step === "number" && (
        <>
          <label htmlFor="phone" className="block text-sm font-bold">
            رقم الهاتف
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && sendCode()}
            placeholder="0661 23 45 67"
            className={`${field} ltr-nums text-start`}
          />
          <p className="text-dim text-xs">{kPhoneHint}</p>
          {error && <Alert code={debugCode}>{error}</Alert>}
          <button
            type="button"
            onClick={sendCode}
            disabled={busy || !phone.trim()}
            className={submit}
          >
            {busy ? "…" : "ابعثلي الكود"}
          </button>
        </>
      )}

      {step === "code" && (
        <>
          <button
            type="button"
            onClick={() => {
              setStep("number");
              setError(null);
              setCode("");
            }}
            className="text-dim hover:text-primary inline-flex items-center gap-1 text-xs font-bold"
          >
            <ArrowRight className="size-3.5" />
            بدّل الرقم
          </button>
          <label htmlFor="code" className="block text-sm font-bold">
            الكود اللي وصلك في{" "}
            <span className="ltr-nums">
              {formatLocal(toE164(phone) ?? phone)}
            </span>
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D+/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && !busy && verifyCode()}
            placeholder="123456"
            className={`${field} ltr-nums text-center text-2xl font-black tracking-[0.4em]`}
          />
          {error && <Alert code={debugCode}>{error}</Alert>}
          <button
            type="button"
            onClick={verifyCode}
            disabled={busy || code.length < 6}
            className={submit}
          >
            {busy ? "…" : "أكّد"}
          </button>
        </>
      )}

      {step === "name" && (
        <>
          <label htmlFor="pname" className="block text-sm font-bold">
            اسمك
          </label>
          <input
            id="pname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && saveName()}
            autoComplete="name"
            placeholder="اسمك ولا اسم الوكالة"
            className={field}
          />
          <p className="text-dim text-xs">يبان مع إعلاناتك وطلباتك.</p>
          {error && <Alert code={debugCode}>{error}</Alert>}
          <button
            type="button"
            onClick={saveName}
            disabled={busy || name.trim().length < 2}
            className={submit}
          >
            {busy ? "…" : "كمّل"}
          </button>
        </>
      )}

      {step === "number" && (
        <p className="text-dim flex items-center justify-center gap-1.5 pt-1 text-xs">
          <Phone className="size-3.5" />
          نبعثولك كود في رسالة، بلا كلمة سر.
        </p>
      )}
    </div>
  );
}

function Alert({
  children,
  code,
}: {
  children: React.ReactNode;
  code?: string | null;
}) {
  return (
    <div
      role="alert"
      className="rounded-input bg-danger/10 text-danger px-4 py-3 text-sm font-semibold"
    >
      {children}
      {code && (
        <p
          dir="ltr"
          className="text-dim mt-1 text-start text-[11px] font-normal"
        >
          {code}
        </p>
      )}
    </div>
  );
}
