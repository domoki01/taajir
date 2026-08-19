"use client";

import { useEffect, useRef, useState } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updateProfile,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { ArrowRight, Phone } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { formatLocal, kPhoneHint, toE164 } from "@/lib/phone";

type Step = "number" | "code" | "name";

const kStorageMessage =
  "المتصفّح ما خلّاش الموقع يحفظ الدخول. اخرج من التصفّح الخفي ولا اسمح بحفظ بيانات الموقع، وعاود.";

/**
 * Sign in with an Algerian mobile number.
 *
 * Three steps, because a phone account arrives with no display name and
 * `ownerName` is stamped onto every ad at publish time — skipping the name step
 * would put "مستخدم" on every listing this route ever creates.
 *
 * The reCAPTCHA verifier is created once and never cleared until the
 * component unmounts — including after a failed attempt. Invisible reCAPTCHA
 * re-solves on every call to `signInWithPhoneNumber`, so the same instance is
 * meant to be reused across retries; the first version of this component
 * called `.clear()` on every failure (server errors included, not just
 * captcha ones), which leaves grecaptcha's own bookkeeping for that DOM node
 * out of sync with a freshly constructed verifier and the next attempt fails
 * immediately with "reCAPTCHA has already been rendered in this element".
 */
export function PhoneAuth({
  onDone,
}: {
  onDone: (user: User) => Promise<void>;
}) {
  const [step, setStep] = useState<Step>("number");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifier = useRef<RecaptchaVerifier | null>(null);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const signedIn = useRef<User | null>(null);
  // Surfaced under the error message while this route is new. "وقع مشكل" alone
  // is unactionable from a phone with no console access — this is what turns a
  // screenshot into a diagnosis instead of another round of guessing.
  const [debugCode, setDebugCode] = useState<string | null>(null);
  // The whole error, not just its code, for `?debug=1`. `auth/error-code:-39`
  // is the SDK relaying a number it did not recognise; the message and the
  // server's own response say which of a dozen unrelated causes it was, and
  // neither reaches a phone otherwise — Android has no DevTools, and Firebase
  // Auth does not log failed attempts to Cloud Logging either.
  const [debugDetail, setDebugDetail] = useState<string | null>(null);
  const showDebug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1";

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
      case "auth/web-storage-unsupported":
        return kStorageMessage;
      default:
        // Everything the SDK does not name — including the internal reCAPTCHA
        // codes that arrive as `auth/error-code:-39` with nothing else in them.
        // "Something went wrong, try again" is a dead end when trying again
        // does the same thing; Google sign-in is one button below and works, so
        // the message points at it rather than leaving somebody stranded on the
        // last screen before they had an account.
        return "ما نجحش إرسال الكود. جرّب «كمّل بحساب Google» من تحت، ولا عاود من بعد.";
    }
  }

  /**
   * IndexedDB failures arrive as a raw message with no `auth/` code —
   * "Database is closing", "Database is hidden", "UnknownError". They are
   * thrown *after* the credential is already verified with the server, so the
   * sign-in itself worked and only the local write failed. Worth its own
   * message: nothing about retrying the code will help, but leaving private
   * browsing will.
   */
  function isStorageFailure(err: { code?: string; message?: string }): boolean {
    const m = err.message ?? "";
    return (
      err.code === "auth/web-storage-unsupported" ||
      /database is (closing|hidden)|indexeddb|unknownerror/i.test(m)
    );
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
      setDebugCode(err.code ?? err.message ?? null);
      setDebugDetail(describeError(e));

      // grecaptcha itself throws this — no `.code`, just this exact message —
      // when a widget is asked to render into a container it already rendered
      // into. It means the verifier genuinely is stuck, so this is the one
      // failure that gets a fresh instance; every other failure leaves the
      // verifier alone (see the component doc comment) because the widget
      // itself is fine and a retry should just reuse it.
      if (err.message?.includes("already been rendered")) {
        verifier.current?.clear();
        verifier.current = null;
        setError("عاود اضغط، تصلّح لوحدها.");
      } else if (isStorageFailure(err)) {
        setError(kStorageMessage);
      } else {
        setError(humanize(err.code ?? ""));
      }
    } finally {
      setBusy(false);
    }
  }

  /** Signed in. Ask for a name if we do not have one, otherwise hand over. */
  async function proceed(user: User) {
    signedIn.current = user;
    // Someone who signed up here before already has a name; send them straight
    // through rather than asking again.
    if (user.displayName) {
      await onDone(user);
      return;
    }
    setStep("name");
  }

  async function verifyCode() {
    if (!confirmation.current) return;
    setBusy(true);
    setError(null);
    try {
      const cred = await confirmation.current.confirm(code.trim());
      await proceed(cred.user);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      console.error("[phone-auth] verifyCode failed:", err);
      setDebugCode(err.code ?? err.message ?? null);
      setDebugDetail(describeError(e));

      // The credential is verified with the server *before* Firebase tries to
      // persist it, so a storage failure can leave a perfectly good signed-in
      // user behind. Carry on with it rather than telling someone their correct
      // code was wrong — the session cookie is what the rest of the site reads,
      // and getting one only needs the user object we already have.
      if (isStorageFailure(err) && auth.currentUser) {
        try {
          await proceed(auth.currentUser);
          return;
        } catch (again) {
          console.error("[phone-auth] salvage failed:", again);
        }
      }

      setError(
        isStorageFailure(err) ? kStorageMessage : humanize(err.code ?? ""),
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    const user = signedIn.current;
    if (!user) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("اكتب اسمك باش الناس تعرف مع من تتعامل");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateProfile(user, { displayName: trimmed });
      // Force a token refresh so the session cookie carries the new name.
      await user.getIdToken(true);
      await onDone(user);
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
          {error && (
            <Alert code={debugCode} detail={showDebug ? debugDetail : null}>
              {error}
            </Alert>
          )}
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
          {error && (
            <Alert code={debugCode} detail={showDebug ? debugDetail : null}>
              {error}
            </Alert>
          )}
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
          {error && (
            <Alert code={debugCode} detail={showDebug ? debugDetail : null}>
              {error}
            </Alert>
          )}
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

/**
 * Everything the failure carries, flattened into something screenshot-able.
 *
 * Firebase wraps the interesting part twice: `customData.serverResponse` holds
 * what Identity Platform actually replied, and a reCAPTCHA failure may arrive
 * as a bare value with no `code` at all. Reading only `.code` is how a dozen
 * different causes all end up looking like one opaque number.
 */
function describeError(e: unknown): string {
  const err = e as {
    code?: string;
    message?: string;
    customData?: { serverResponse?: unknown; _tokenResponse?: unknown };
  };
  const parts: string[] = [];
  if (err?.code) parts.push(`code: ${err.code}`);
  if (err?.message) parts.push(`message: ${err.message}`);

  const server =
    err?.customData?.serverResponse ?? err?.customData?._tokenResponse;
  if (server) {
    try {
      parts.push(`server: ${JSON.stringify(server)}`);
    } catch {
      parts.push(`server: ${String(server)}`);
    }
  }
  if (parts.length === 0) {
    try {
      parts.push(`raw: ${JSON.stringify(e)}`);
    } catch {
      parts.push(`raw: ${String(e)}`);
    }
  }
  return parts.join("\n").slice(0, 1200);
}

function Alert({
  children,
  code,
  detail,
}: {
  children: React.ReactNode;
  code?: string | null;
  detail?: string | null;
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
      {/* Only under ?debug=1 — this is for reading off a phone screen during a
          diagnosis, not something to show someone trying to sign up. */}
      {detail && (
        <pre
          dir="ltr"
          className="text-dim bg-surface-soft rounded-input mt-2 max-h-60 overflow-auto p-2 text-start text-[10px] leading-relaxed font-normal whitespace-pre-wrap"
        >
          {detail}
        </pre>
      )}
    </div>
  );
}
