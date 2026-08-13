import type { Metadata } from "next";
import { Palette } from "lucide-react";
import { requirePermission } from "@/server/auth";
import { getBranding } from "@/server/branding";
import { BrandingEditor } from "@/components/admin/BrandingEditor";

export const metadata: Metadata = {
  title: "الهوية والثيم",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  await requirePermission("branding.edit", "/admin/identite");
  const branding = await getBranding();

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-extrabold">
        <Palette className="text-primary size-5" />
        هوية الموقع
      </h1>
      <p className="text-muted mt-2 text-sm leading-relaxed">
        الاسم، الوصف، الشعار والألوان. التبديل يبان في الموقع كامل بلا نشر جديد.
      </p>

      {/* Keyed on the settings version: the editor's fields live in useState,
          which does not re-initialise when router.refresh() delivers new props,
          so «رجّع كلش للافتراضي» would otherwise look like it did nothing. */}
      <BrandingEditor key={branding.updatedAt} branding={branding} />
    </div>
  );
}
