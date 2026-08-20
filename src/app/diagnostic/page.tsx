import type { Metadata } from "next";
import { requireStaff } from "@/server/auth";
import { RecaptchaDoctor } from "@/components/auth/RecaptchaDoctor";

export const metadata: Metadata = {
  title: "فحص التسجيل",
  robots: { index: false, follow: false },
};

// The guard needs the session cookie, so this cannot be a static page.
export const dynamic = "force-dynamic";

/**
 * A screen whose only job is to answer "why did that fail".
 *
 * Staff only, and that is a correction rather than caution. It shipped open,
 * because it only read state — but it grew a step that mints a reCAPTCHA token
 * and calls sendVerificationCode, which is a real SMS to any Algerian number
 * typed into it. With phone sign-up now hidden from the form, an open page here
 * would have been the one place on the site where an anonymous visitor could
 * make this project send messages, which is exactly the toll-fraud shape the
 * region allowlist exists to narrow.
 *
 * Kept rather than deleted: the SMS backend is expected to come back, and the
 * next question — did it — is answered by this page in one press.
 */
export default async function DiagnosticPage() {
  await requireStaff();

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
