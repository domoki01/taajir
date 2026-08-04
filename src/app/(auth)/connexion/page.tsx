import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getUser } from "@/server/auth";

export const metadata: Metadata = {
  title: "تسجيل الدخول",
  robots: { index: false, follow: false },
};

export default async function SignInPage() {
  if (await getUser()) redirect("/tableau-de-bord");

  return (
    <>
      <h1 className="mb-1 text-xl font-black">مرحبا بيك</h1>
      <p className="text-muted mb-6 text-sm">دخول لحسابك باش تسيّر إعلاناتك.</p>
      {/* useSearchParams needs a Suspense boundary in the App Router. */}
      <Suspense fallback={null}>
        <AuthForm mode="signin" />
      </Suspense>
    </>
  );
}
