import type { Metadata } from "next";
import { requirePermission } from "@/server/auth";
import { PromoManager } from "@/components/admin/PromoManager";
import { listAllPromos } from "@/server/promos";

export const metadata: Metadata = {
  title: "الإشهارات",
  robots: { index: false, follow: false },
};

// Reads the current banners on every visit; the admin has just changed them and
// a cached list would show them their own edit not taking effect.
export const dynamic = "force-dynamic";

export default async function PromosPage() {
  await requirePermission("promos.manage", "/admin/publicites");

  const promos = await listAllPromos().catch((error) => {
    console.error("[promos] admin read failed:", error);
    return [];
  });

  return (
    <>
      <h1 className="mb-1 text-xl font-black">إشهارات الصفحة الرئيسية</h1>
      <p className="text-muted mb-6 text-sm leading-relaxed">
        الصور اللي تبان في الكاروسال تحت الفلتر. كل صورة مربوطة برابط، وترتيبها
        هنا هو ترتيبها في الموقع.
      </p>
      <PromoManager promos={promos} />
    </>
  );
}
