import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Countdown } from "@/components/launch/Countdown";
import { getLaunchStatus } from "@/server/launch";
import { getUser } from "@/server/auth";
import { kSiteName } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "قريباً",
  description: `${kSiteName} — منصة العقارات في الجزائر. سجّل إعلانك ولا طلبك قبل الانطلاق.`,
};

export default async function LaunchPage() {
  const [status, user] = await Promise.all([getLaunchStatus(), getUser()]);

  // Nothing to wait for once the doors are open. Someone who bookmarked this
  // page, or who left the tab sitting here overnight, lands on the real site.
  if (status.state === "active") redirect("/");

  return (
    <main className="from-primary-soft to-bg flex flex-1 items-center bg-gradient-to-b py-12">
      <Container>
        <div className="mx-auto max-w-xl text-center">
          <span className="bg-primary mx-auto grid size-14 place-items-center rounded-[18px] text-white">
            <Building2 className="size-7" strokeWidth={2.4} />
          </span>
          <h1 className="mt-5 text-3xl font-black">{kSiteName}</h1>

          {user ? (
            <p
              role="status"
              className="rounded-card bg-success/10 text-success mt-5 flex items-start gap-2 p-4 text-start text-sm font-bold"
            >
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <span>
                تسجّل إعلانك/طلبك بنجاح ومجاناً. سينشر محتواك فور انطلاق
                المنصّة، وستتلقّى إشعاراً عند التشغيل الحيّ.
              </span>
            </p>
          ) : (
            <p className="text-muted mt-3 text-base leading-relaxed">
              المنصّة تتفتح قريباً. سجّل إعلانك ولا طلبك من دروك — ينشر أوّل
              يوم، ويوصلك إشعار كي نتفتحو.
            </p>
          )}

          <div className="mt-8">
            <Countdown launchAt={status.launchAt} />
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Link
              href="/"
              className="bg-accent rounded-input px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              {user ? "زيد إعلان ولا طلب آخر" : "سجّل إعلانك ولا طلبك"}
            </Link>
            {!user && (
              <Link
                href="/connexion?next=%2Flancement"
                className="rounded-input border-border border bg-white px-6 py-3 text-sm font-bold"
              >
                عندي حساب
              </Link>
            )}
          </div>

          <p className="text-dim mt-8 text-xs leading-relaxed">
            ما راح نبعثولك حتى إشعار غير كي تتفتح المنصّة.
          </p>
        </div>
      </Container>
    </main>
  );
}
