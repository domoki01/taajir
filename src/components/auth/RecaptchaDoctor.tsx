"use client";

// ── WHAT ACTUALLY HAPPENS, STEP BY STEP ──────────────────────────────────────
// The sign-up form does four things before an SMS is ever asked for: it reads
// the project's reCAPTCHA policy, loads Google's script, renders an invisible
// widget, and asks that widget for a token. When any of them fails the SDK
// reports one unmapped number and nothing else.
//
// So each step runs on its own here and prints its own result. The one that
// stops is the bug, and the error is printed with every field it carries rather
// than just `.code` — the interesting part has repeatedly been somewhere else.

import { useState } from "react";
import { RecaptchaVerifier } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { firebaseConfig } from "@/lib/firebase/config";

type Step = { name: string; ok: boolean | null; detail: string };

/** Everything an unknown throwable carries, flattened so it can be read. */
function explain(e: unknown): string {
  const err = e as {
    code?: string;
    message?: string;
    name?: string;
    customData?: Record<string, unknown>;
  };
  const bits: string[] = [];
  if (err?.name) bits.push(`name: ${err.name}`);
  if (err?.code) bits.push(`code: ${err.code}`);
  if (err?.message) bits.push(`message: ${err.message}`);
  if (err?.customData) {
    try {
      bits.push(`customData: ${JSON.stringify(err.customData).slice(0, 500)}`);
    } catch {}
  }
  if (bits.length === 0) bits.push(String(e).slice(0, 300));
  return bits.join("\n");
}

export function RecaptchaDoctor() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);

  function push(name: string, ok: boolean | null, detail: string) {
    setSteps((s) => [...s, { name, ok, detail }]);
  }

  async function run() {
    setSteps([]);
    setBusy(true);

    // 1 — the browser itself.
    const g = window as unknown as { grecaptcha?: { enterprise?: unknown } };
    push(
      "المتصفّح",
      true,
      [
        `cookies: ${navigator.cookieEnabled}`,
        `serviceWorker: ${"serviceWorker" in navigator}`,
        `grecaptcha قبل: ${g.grecaptcha ? "موجود" : "ماشي موجود"}`,
        `enterprise قبل: ${g.grecaptcha?.enterprise ? "موجود" : "ماشي موجود"}`,
        navigator.userAgent.slice(0, 90),
      ].join("\n"),
    );

    // 2 — the policy the SDK reads before it does anything else.
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v2/recaptchaConfig?key=${firebaseConfig.apiKey}&clientType=CLIENT_TYPE_WEB&version=RECAPTCHA_ENTERPRISE`,
      );
      const body = await res.text();
      push(
        "إعدادات reCAPTCHA من السيرفر",
        res.ok,
        `${res.status}\n${body.slice(0, 400)}`,
      );
    } catch (e) {
      push("إعدادات reCAPTCHA من السيرفر", false, explain(e));
    }

    // 3 — building the verifier. Cheap, and it can fail on its own.
    let verifier: RecaptchaVerifier | null = null;
    try {
      verifier = new RecaptchaVerifier(auth, "doctor-holder", {
        size: "invisible",
      });
      push("إنشاء RecaptchaVerifier", true, "تمّ");
    } catch (e) {
      push("إنشاء RecaptchaVerifier", false, explain(e));
    }

    // 4 — rendering the widget. This is where Google's script is fetched.
    if (verifier) {
      try {
        const id = await verifier.render();
        push("رسم الودجت (تحميل سكريبت قوقل)", true, `widget id: ${id}`);
      } catch (e) {
        push("رسم الودجت (تحميل سكريبت قوقل)", false, explain(e));
      }

      // 5 — the token itself: the step the sign-up form dies on.
      try {
        const token = await verifier.verify();
        push(
          "جلب التوكن",
          true,
          `طول التوكن: ${token.length}\n${token.slice(0, 40)}…`,
        );
      } catch (e) {
        push("جلب التوكن", false, explain(e));
      }
    }

    const after = window as unknown as {
      grecaptcha?: { enterprise?: unknown };
    };
    push(
      "بعد المحاولة",
      null,
      [
        `grecaptcha: ${after.grecaptcha ? "موجود" : "ماشي موجود"}`,
        `enterprise: ${after.grecaptcha?.enterprise ? "موجود" : "ماشي موجود"}`,
        `سكريبتات reCAPTCHA محمّلة: ${
          [...document.querySelectorAll("script")]
            .map((s) => s.src)
            .filter((s) => s.includes("recaptcha"))
            .join(" | ") || "ولا واحد"
        }`,
      ].join("\n"),
    );

    setBusy(false);
  }

  return (
    <div className="mt-5">
      <div id="doctor-holder" />

      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="bg-accent rounded-input w-full py-3.5 text-sm font-bold text-white transition-opacity active:opacity-90 disabled:opacity-50"
      >
        {busy ? "راه يفحص…" : "ابدا الفحص"}
      </button>

      <ul className="mt-4 space-y-2">
        {steps.map((s, i) => (
          <li
            key={i}
            className="rounded-card border-border bg-surface border p-3"
          >
            <p className="flex items-center gap-2 text-sm font-extrabold">
              <span
                className={
                  s.ok === null
                    ? "text-dim"
                    : s.ok
                      ? "text-success"
                      : "text-danger"
                }
              >
                {s.ok === null ? "•" : s.ok ? "✓" : "✗"}
              </span>
              {s.name}
            </p>
            <pre
              dir="ltr"
              className="text-muted mt-1.5 overflow-x-auto text-start text-[11px] leading-relaxed whitespace-pre-wrap"
            >
              {s.detail}
            </pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
