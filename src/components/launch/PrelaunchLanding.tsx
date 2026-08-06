import Link from "next/link";
import { Building2 } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";
import { Countdown } from "@/components/launch/Countdown";
import { IntentPicker } from "@/components/launch/IntentPicker";
import { kSiteName } from "@/lib/constants";

/**
 * The whole site while it is held: one question, three answers, a clock.
 *
 * No header and no bottom nav — every destination they lead to is closed, and a
 * menu of doors that do not open is worse than no menu. The only ways out are
 * the three intents and the sign-in link.
 */
export function PrelaunchLanding({
  launchAt,
  signedIn,
}: {
  launchAt: number | null;
  signedIn: boolean;
}) {
  return (
    <>
      <main className="from-primary-soft to-bg flex-1 bg-gradient-to-b py-12 md:py-20">
        <Container>
          <div className="text-center">
            <span className="bg-primary mx-auto grid size-14 place-items-center rounded-[18px] text-white">
              <Building2 className="size-7" strokeWidth={2.4} />
            </span>
            <h1 className="mt-5 text-3xl font-black tracking-tight text-balance md:text-4xl">
              {kSiteName} — عقارات الجزائر، قريباً
            </h1>
            <p className="text-muted mx-auto mt-4 max-w-xl leading-relaxed">
              حنا نجمعو الإعلانات والطلبات قبل الانطلاق. سجّل من دروك وينشر
              محتواك أوّل يوم، ويوصلك إشعار كي تتفتح المنصّة.
            </p>

            <div className="mt-8">
              <Countdown launchAt={launchAt} />
            </div>
          </div>

          <h2 className="mt-12 text-center text-xl font-extrabold">
            ما هي غايتك العقارية اليوم؟
          </h2>
          <div className="mt-5">
            <IntentPicker />
          </div>

          <p className="text-dim mt-8 text-center text-xs">
            {signedIn ? (
              <Link href="/tableau-de-bord" className="hover:text-primary">
                شوف إعلاناتك وطلباتك المحجوزة
              </Link>
            ) : (
              <>
                عندك حساب؟{" "}
                <Link
                  href="/connexion"
                  className="hover:text-primary underline"
                >
                  دخول
                </Link>
              </>
            )}
          </p>
        </Container>
      </main>
      <Footer />
    </>
  );
}
