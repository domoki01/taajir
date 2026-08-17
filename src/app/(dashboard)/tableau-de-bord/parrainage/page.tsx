import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Gift, Trophy, UserCheck, Users } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getBranding } from "@/server/branding";
import {
  affiliateSummary,
  ensureReferralCode,
  getAffiliateSettings,
  invitees,
  ledgerFor,
  liveCampaign,
  myStanding,
} from "@/server/affiliate";
import { InviteCard } from "@/components/affiliate/InviteCard";
import { RedeemPanel } from "@/components/affiliate/RedeemPanel";
import { kSiteUrl } from "@/lib/constants";
import type { LedgerReason } from "@/types/affiliate";

export const metadata: Metadata = {
  title: "ادعُ أصحابك",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const kReasonLabels: Record<LedgerReason, string> = {
  referral: "دعوة نجحت",
  bonus: "مكافأة",
  "campaign-prize": "جائزة مسابقة",
  "redeem-listing": "بدّلتها بإعلان",
  "redeem-featured": "بدّلتها بتمييز",
  payout: "طلب سحب",
  clawback: "سحب دعوة ملغية",
  admin: "تعديل إداري",
};

function day(at: number): string {
  return new Date(at).toLocaleDateString("ar-DZ", {
    day: "numeric",
    month: "short",
  });
}

function Tile({
  icon: Icon,
  label,
  value,
  tone = "",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-card border-border bg-surface border p-4">
      <p className="text-dim flex items-center gap-2 text-xs font-bold">
        <Icon className="size-4" />
        {label}
      </p>
      <p className={`ltr-nums mt-2 text-2xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

/**
 * The invite screen.
 *
 * The number that matters is not "invited" but "counted" — an account that
 * signed up and never published earns nothing, and saying so plainly here is
 * what stops the programme feeling broken. So both are shown, side by side,
 * with the list underneath naming which is which.
 */
export default async function ReferralPage() {
  const user = await requireUser("/tableau-de-bord/parrainage");
  const settings = await getAffiliateSettings();

  // Minted on first visit rather than at signup: most accounts never open this
  // page, and a code nobody will share is a document nobody should pay for.
  const [code, summary, branding] = await Promise.all([
    ensureReferralCode(user.uid),
    affiliateSummary(user.uid),
    getBranding(),
  ]);

  const [list, ledger, campaign] = await Promise.all([
    invitees(user.uid),
    ledgerFor(user.uid),
    liveCampaign(),
  ]);
  const standing = campaign ? await myStanding(campaign.id, user.uid) : null;

  const waiting = list.filter((i) => !i.qualifiedAt).length;

  return (
    <div>
      <h1 className="text-2xl font-black">ادعُ أصحابك</h1>
      <p className="text-muted mt-1 text-sm leading-relaxed font-semibold">
        كل ما سجّل الناس من بعدك ونشرو، كل ما زاد رصيدك — والنقاط تبدّلها
        بإعلانات، بتمييز، ولا بجائزة كي تكون كاين مسابقة.
      </p>

      {!settings.enabled && (
        <p className="rounded-input bg-warning/10 text-warning mt-4 px-4 py-3 text-sm leading-relaxed font-bold">
          البرنامج ما زال ما تفعّلش رسمياً. تقدر تشارك رابطك من دروك — الدعوات
          تتسجّل، والنقاط تتحسب كي يتفعّل.
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
          {code ? (
            <InviteCard
              code={code}
              origin={kSiteUrl}
              siteName={branding.siteName}
            />
          ) : (
            <p className="rounded-input bg-danger/10 text-danger px-4 py-3 text-sm font-bold">
              ما نجحناش نجيبو كودك. عاود حمّل الصفحة.
            </p>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Tile
              icon={Gift}
              label="رصيدك"
              value={String(summary.points)}
              tone="text-primary"
            />
            <Tile
              icon={UserCheck}
              label="دعوات محسوبة"
              value={String(summary.qualified)}
              tone="text-success"
            />
            <Tile
              icon={Users}
              label="مسجّلين بيك"
              value={String(list.length)}
            />
          </div>

          {waiting > 0 && (
            <p className="rounded-input bg-surface-soft text-muted px-4 py-3 text-xs leading-relaxed font-semibold">
              عندك {waiting} واحد سجّلو بيك وما نشرو والو. الدعوة تتحسب كي ينشر
              صاحبها إعلان ولا طلب ويتقبل — قوللهم ينشرو.
            </p>
          )}
        </div>

        <div className="grid gap-4">
          {/* ── THE RACE ─────────────────────────────────────────────────── */}
          {campaign && (
            <Link
              href="/concours"
              className="rounded-card border-primary bg-primary-soft hover:shadow-soft block border p-4 transition-shadow"
            >
              <p className="text-primary flex items-center gap-2 text-sm font-extrabold">
                <Trophy className="size-4" />
                {campaign.name}
              </p>
              <p className="text-muted mt-1 text-xs leading-relaxed font-semibold">
                الجائزة: {campaign.prize} — تسالي {day(campaign.endsAt)}
              </p>
              {standing && standing.rank !== null && (
                <p className="text-primary ltr-nums mt-2 text-sm font-black">
                  ترتيبك {standing.rank} بـ{standing.count} دعوة
                </p>
              )}
            </Link>
          )}

          <div>
            <p className="mb-2 text-sm font-extrabold">بدّل نقاطك</p>
            <RedeemPanel points={summary.points} settings={settings} />
          </div>
        </div>
      </div>

      {/* ── WHO CAME THROUGH THE LINK ──────────────────────────────────────── */}
      {list.length > 0 && (
        <div className="rounded-card border-border bg-surface mt-6 border p-4">
          <p className="text-sm font-extrabold">اللي سجّلو بيك</p>
          <ul className="mt-3 divide-y divide-[var(--color-border)]">
            {list.map((i) => (
              <li
                key={i.uid}
                className="flex items-center gap-3 py-2.5 text-sm"
              >
                <span className="truncate font-bold">{i.displayName}</span>
                <span className="text-dim ltr-nums ms-auto shrink-0 text-xs font-semibold">
                  {day(i.joinedAt)}
                </span>
                <span
                  className={`rounded-input shrink-0 px-2 py-1 text-xs font-bold ${
                    i.qualifiedAt
                      ? "bg-success/15 text-success"
                      : "bg-surface-soft text-dim"
                  }`}
                >
                  {i.qualifiedAt ? "محسوبة" : "ما نشرش"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── WHERE THE POINTS CAME FROM AND WENT ────────────────────────────── */}
      {ledger.length > 0 && (
        <div className="rounded-card border-border bg-surface mt-4 border p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold">
            <Clock className="size-4" />
            حركة النقاط
          </p>
          <ul className="mt-3 divide-y divide-[var(--color-border)]">
            {ledger.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="truncate font-semibold">
                  {kReasonLabels[e.reason] ?? e.reason}
                </span>
                <span className="text-dim ltr-nums ms-auto shrink-0 text-xs font-semibold">
                  {day(e.at)}
                </span>
                <span
                  className={`ltr-nums shrink-0 text-sm font-black ${
                    e.delta >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {e.delta >= 0 ? `+${e.delta}` : e.delta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
