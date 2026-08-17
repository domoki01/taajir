import type { Metadata } from "next";
import { requirePermission } from "@/server/auth";
import {
  allCampaigns,
  defaultCampaignWindow,
  getAffiliateSettings,
  liveCampaign,
  pendingPayouts,
  pendingPrizeClaims,
  standings,
} from "@/server/affiliate";
import { AffiliatePanel } from "@/components/admin/AffiliatePanel";

export const metadata: Metadata = {
  title: "برنامج الدعوة",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AffiliateAdminPage() {
  await requirePermission("affiliate.manage", "/admin/affiliation");

  const [settings, payouts, prizeClaims, campaigns, live] = await Promise.all([
    getAffiliateSettings(),
    pendingPayouts(),
    pendingPrizeClaims(),
    allCampaigns(),
    liveCampaign(),
  ]);
  const board = live ? await standings(live.id) : [];

  return (
    <div>
      <h1 className="text-2xl font-black">برنامج الدعوة</h1>
      <p className="text-muted mt-1 text-sm leading-relaxed font-semibold">
        قيمة الدعوة، وين تتبدّل النقاط، والمسابقة.
      </p>
      <div className="mt-6">
        <AffiliatePanel
          settings={settings}
          payouts={payouts}
          prizeClaims={prizeClaims}
          campaigns={campaigns}
          live={live}
          board={board}
          defaults={defaultCampaignWindow()}
        />
      </div>
    </div>
  );
}
