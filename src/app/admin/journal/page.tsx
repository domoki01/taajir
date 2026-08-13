import type { Metadata } from "next";
import { requirePermission } from "@/server/auth";
import { listAudit } from "@/server/users";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatFullDateTime } from "@/lib/datetime";

export const metadata: Metadata = {
  title: "سجلّ العمليات",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const actionLabels: Record<string, string> = {
  approve: "وافق على إعلان",
  reject: "رفض إعلان",
  feature: "ميّز إعلان",
  unfeature: "ألغى تمييز إعلان",
  delete: "مسح إعلان",
  "promo.create": "زاد إشهار",
  "promo.update": "عدّل إشهار",
  "promo.show": "بيّن إشهار",
  "promo.hide": "خبّى إشهار",
  "promo.delete": "مسح إشهار",
  "user.role": "بدّل دور مستخدم",
  "user.ban": "وقّف حساب",
  "user.unban": "رجّع حساب",
  "user.quota": "عدّل حصّة مستخدم",
};

const targetLabels: Record<string, string> = {
  listing: "إعلان",
  promo: "إشهار",
  user: "حساب",
};

export default async function AuditPage() {
  await requirePermission("audit.view", "/admin/journal");

  const entries = await listAudit(200);

  return (
    <div>
      <h1 className="text-2xl font-black">سجلّ العمليات</h1>
      <p className="text-muted mt-1 text-sm font-semibold">
        {entries === null ? "—" : `آخر ${entries.length} عملية`}
      </p>
      <p className="text-dim mt-2 text-xs leading-relaxed">
        كل قرار إشراف يتسجّل هنا مع صاحبه. السجلّ يُكتب من الخادم فقط ولا
        يُعدَّل ولا يُمسح — هذا اللي يخلّيه يعني شيئاً.
      </p>

      <div className="mt-6">
        {entries === null ? (
          <EmptyState
            title="ما قدرناش نجيبو السجلّ"
            body="وقع مشكل مؤقت. عاود تحميل الصفحة."
          />
        ) : entries.length === 0 ? (
          <EmptyState title="السجلّ فارغ" body="أول قرار إشراف يبان هنا." />
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-input border-border bg-surface border px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">
                    {actionLabels[entry.action] ?? entry.action}
                  </span>
                  <span className="text-dim text-xs">
                    {targetLabels[entry.targetType] ?? entry.targetType}
                  </span>
                  <span className="text-dim ltr-nums ms-auto text-xs">
                    {formatFullDateTime(entry.at)}
                  </span>
                </div>
                {entry.note && (
                  <p className="text-muted mt-1 text-xs">{entry.note}</p>
                )}
                <p
                  dir="ltr"
                  className="text-dim mt-1 text-start text-[11px] break-all"
                >
                  {entry.actorUid} → {entry.targetId}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
