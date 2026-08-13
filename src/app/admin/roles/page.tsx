import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { requirePermission } from "@/server/auth";
import { getRoles } from "@/server/permissions";
import { countUsersByRole } from "@/server/users";
import { RolesEditor } from "@/components/admin/RolesEditor";

export const metadata: Metadata = {
  title: "الأدوار والصلاحيات",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const viewer = await requirePermission("roles.manage", "/admin/roles");
  const roles = await getRoles();
  const usage = await countUsersByRole(Object.keys(roles));

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-extrabold">
        <ShieldCheck className="text-primary size-5" />
        الأدوار والصلاحيات
      </h1>
      <p className="text-muted mt-2 text-sm leading-relaxed">
        كل دور وواش يقدر يدير. عيّن الأدوار للحسابات من صفحة «الحسابات».
      </p>

      {/* Keyed on the roles themselves so a save or a delete remounts the
          editor: its rows live in useState, which does not re-initialise when
          router.refresh() delivers new props. */}
      <RolesEditor
        key={Object.keys(roles).sort().join(",")}
        roles={roles}
        viewerRole={viewer.role}
        usage={usage}
      />
    </div>
  );
}
