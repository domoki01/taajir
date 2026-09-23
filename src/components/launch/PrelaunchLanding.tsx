import Link from "next/link";
import Image from "next/image";
import { Building2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { IntentPicker } from "@/components/launch/IntentPicker";
import { getBranding } from "@/server/branding";

/**
 * The whole site while it is held: the mark, four buttons, nothing else.
 *
 * No header, no bottom nav, no footer, no countdown, no explanatory paragraph.
 * Every destination a menu would offer is closed, and a clock is a reason to
 * come back later rather than to answer now. What is left is one decision with
 * four answers, which is the only thing this page is for.
 *
 * The sign-in link is the single exception, small and at the bottom: without it
 * someone who already registered has no way back into their own account.
 */
export async function PrelaunchLanding({ signedIn }: { signedIn: boolean }) {
  const { siteName, logoUrl } = await getBranding();

  return (
    <main className="from-primary-soft to-bg flex flex-1 items-center bg-gradient-to-b py-10">
      <Container>
        <div className="mb-9 text-center">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={siteName}
              width={56}
              height={56}
              unoptimized
              className="mx-auto size-14 rounded-[18px] object-contain"
            />
          ) : (
            <span className="bg-primary mx-auto grid size-14 place-items-center rounded-[18px] text-white">
              <Building2 className="size-7" strokeWidth={2.4} />
            </span>
          )}
          <h1 className="mt-4 text-2xl font-black tracking-tight">
            {siteName}
          </h1>
        </div>

        <IntentPicker />

        <p className="text-dim mt-9 text-center text-xs">
          {signedIn ? (
            <Link href="/tableau-de-bord" className="hover:text-primary">
              شوف إعلاناتك وطلباتك
            </Link>
          ) : (
            <>
              عندك حساب؟{" "}
              <Link href="/connexion" className="hover:text-primary underline">
                دخول
              </Link>
            </>
          )}
        </p>
      </Container>
    </main>
  );
}
