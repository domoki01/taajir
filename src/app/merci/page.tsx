import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { NotifyOptIn } from "@/components/launch/NotifyOptIn";
import { requireUser } from "@/server/auth";
import { getLaunchStatus } from "@/server/launch";
import { kFunnelHome } from "@/lib/funnel";

export const metadata: Metadata = {
  title: "شكراً",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The end of the funnel, and the only place that says what happens next.
 *
 * Before this page existed, publishing landed on a dashboard list and posting a
 * demand did nothing visible at all — a held demand is `pendingLaunch`, so it
 * is not in the feed the composer refreshed. Someone finished the form and saw
 * no evidence any of it had worked.
 */
export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser("/merci");

  const sp = await searchParams;
  const raw = sp.type;
  const type = (Array.isArray(raw) ? raw[0] : raw) ?? "annonce";
  const isRequest = type === "demande";
  const what = isRequest ? "طلبك" : "إعلانك";

  const { state } = await getLaunchStatus();
  const held = state === "prelaunch";

  return (
    <main className="from-primary-soft to-bg flex flex-1 items-center bg-gradient-to-b py-10">
      <Container className="max-w-lg">
        <div className="rounded-card border-border bg-surface shadow-soft border p-6 text-center">
          <span className="bg-success/15 text-success mx-auto grid size-16 place-items-center rounded-full">
            <CheckCircle2 className="size-9" strokeWidth={2.2} />
          </span>

          <h1 className="mt-5 text-2xl font-black">شكراً ليك!</h1>

          <p className="text-muted mt-3 leading-relaxed">
            {held ? (
              <>
                تسجّل {what} بنجاح ومجاناً. راه{" "}
                <strong>قيد المصادقة عليه</strong>، ويتنشر أوّل يوم من فتح
                المنصّة — ويوصلك تنبيه فور نشره.
              </>
            ) : (
              <>
                تسجّل {what} بنجاح. راه <strong>قيد المصادقة عليه</strong>،
                وسيتم تنبيهك فور نشره.
              </>
            )}
          </p>

          {/* The natural moment to ask: we have just promised a notification,
              and this is the one screen where that promise is fresh. */}
          <div className="mt-6">
            <NotifyOptIn />
          </div>

          <div className="mt-6 grid gap-2">
            <Link
              href={kFunnelHome}
              className="rounded-input border-primary text-primary hover:bg-primary-soft block border py-3.5 text-sm font-bold transition-colors"
            >
              زيد إعلان ولا طلب آخر
            </Link>
            <Link
              href={
                isRequest ? "/tableau-de-bord" : "/tableau-de-bord/annonces"
              }
              className="text-muted hover:text-primary block py-2 text-sm font-bold transition-colors"
            >
              شوف {what}
            </Link>
            {held && (
              <Link
                href="/lancement"
                className="text-dim hover:text-primary block py-1 text-xs font-semibold transition-colors"
              >
                شوف العدّاد
              </Link>
            )}
          </div>
        </div>
      </Container>
    </main>
  );
}
