import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getUser } from "@/server/auth";
import { kFreeListingQuota } from "@/lib/constants";

export const metadata: Metadata = {
  title: "حساب جديد",
  robots: { index: false, follow: false },
};

export default async function SignUpPage() {
  if (await getUser()) redirect("/tableau-de-bord");

  return (
    <>
      <h1 className="mb-1 text-xl font-black">أنشئ حساب</h1>
      <p className="text-muted mb-6 text-sm">
        مجاني، وتقدر تنشر حتى {kFreeListingQuota} إعلانات.
      </p>
      <Suspense fallback={null}>
        <AuthForm mode="signup" />
      </Suspense>
      <p className="text-dim mt-5 text-center text-xs leading-relaxed">
        بإنشائك للحساب راك موافق على{" "}
        <Link href="/cgu" className="underline">
          شروط الاستعمال
        </Link>{" "}
        و{" "}
        <Link href="/confidentialite" className="underline">
          سياسة الخصوصية
        </Link>
        .
      </p>
    </>
  );
}
