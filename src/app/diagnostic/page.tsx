import type { Metadata } from "next";
import { RecaptchaDoctor } from "@/components/auth/RecaptchaDoctor";

export const metadata: Metadata = {
  title: "فحص التسجيل",
  robots: { index: false, follow: false },
};

/**
 * A screen whose only job is to answer "why did that fail".
 *
 * Phone sign-in fails in the browser, before any request reaches Firebase, and
 * the SDK reports it as an unmapped internal number. Guessing from that number
 * has cost several rounds, each one a trip to somebody's phone and back. This
 * runs the same steps the sign-up form runs, one at a time, and prints what
 * each one actually did — so the next move comes from evidence instead of from
 * the next hypothesis.
 *
 * Nothing secret is on it: the Firebase web config is public by design, and
 * the page reads state rather than changing any.
 */
export default function DiagnosticPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="text-xl font-black">فحص التسجيل بالهاتف</h1>
      <p className="text-muted mt-1 text-sm leading-relaxed">
        هذي الصفحة تعيد نفس خطوات فورم التسجيل وحدة بوحدة، وتوري وين توقّفت
        بالضبط. صوّرها وابعثها.
      </p>
      <RecaptchaDoctor />
    </main>
  );
}
