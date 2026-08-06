import type { Metadata } from "next";
import { SlidersHorizontal } from "lucide-react";
import { FilterEditor } from "@/components/admin/FilterEditor";
import { getAllFilterOptions } from "@/server/filterSettings";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = {
  title: "الفلتر",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminFilterPage() {
  // The layout already keeps moderators out of nothing — it admits them. This
  // page is site configuration rather than moderation, so it is admin-only, and
  // the Server Action behind the save button checks again independently.
  const user = await requireUser("/admin/filtre");
  const options = await getAllFilterOptions();

  if (user.role !== "admin") {
    return (
      <div className="rounded-card border-border bg-surface border p-6">
        <h1 className="text-xl font-extrabold">الفلتر</h1>
        <p className="text-muted mt-2 text-sm">
          تعديل فلتر الموقع من صلاحيات المشرف العام وحده.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-extrabold">
        <SlidersHorizontal className="text-primary size-5" />
        فلتر الموقع
      </h1>
      <p className="text-muted mt-2 text-sm">
        اختر الخيارات اللي تبان في الفلتر ورتّبها. التبديل يظهر في الصفحة
        الرئيسية وصفحات التصفّح والبحث.
      </p>

      {/* Keyed on the settings version so a save or a reset remounts the
          editor. Its rows live in useState, which does not re-initialise when
          router.refresh() delivers new props — without this, "رجّع الافتراضي"
          would look like it did nothing. */}
      <FilterEditor
        key={options.version}
        transactionTypes={options.transactionTypes}
        propertyTypes={options.propertyTypes}
      />
    </div>
  );
}
