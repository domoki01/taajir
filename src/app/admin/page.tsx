import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  UserRound,
  Users,
} from "lucide-react";
import { adminStats } from "@/server/stats";
import { listAudit } from "@/server/users";
import { formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = {
  title: "لوحة الإشراف",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** "—" rather than "0": a failed count and an empty collection are not the same. */
const show = (n: number | null) => (n === null ? "—" : String(n));

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

export default async function AdminHome() {
  const [stats, audit] = await Promise.all([adminStats(), listAudit(8)]);

  const tiles = [
    {
      icon: Clock,
      label: "في المراجعة",
      value: show(stats.pending),
      href: "/admin/moderation",
      tone: stats.pending ? "text-warning" : "",
    },
    {
      icon: CheckCircle2,
      label: "إعلانات منشورة",
      value: show(stats.published),
      href: "/vente",
      tone: "text-success",
    },
    {
      icon: AlertTriangle,
      label: "مرفوضة",
      value: show(stats.rejected),
      href: "/admin/moderation",
      tone: "",
    },
    {
      icon: Users,
      label: "الحسابات",
      value: show(stats.users),
      href: "/admin/utilisateurs",
      tone: "",
    },
    {
      icon: UserRound,
      label: "حسابات موقّفة",
      value: show(stats.banned),
      href: "/admin/utilisateurs",
      tone: stats.banned ? "text-danger" : "",
    },
    {
      icon: ImageIcon,
      label: "إشهارات",
      value: show(stats.promos),
      href: "/admin/publicites",
      tone: "",
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-black">نظرة عامة</h1>
      <p className="text-muted mt-1 text-sm font-semibold">
        حالة المنصة، وآخر ما دار فيها.
      </p>

      <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Link
              href={tile.href}
              className="rounded-card border-border bg-surface hover:border-primary block border p-4 transition-colors"
            >
              <p className="text-dim flex items-center gap-2 text-xs font-bold">
                <tile.icon className="size-4" />
                {tile.label}
              </p>
              <p className={`ltr-nums mt-2 text-2xl font-black ${tile.tone}`}>
                {tile.value}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {/* ── RECENT ACTIVITY ──────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-base font-extrabold">آخر العمليات</h2>
        {audit === null || audit.length === 0 ? (
          <p className="text-muted mt-2 text-sm">
            {audit === null ? "ما قدرناش نجيبو السجلّ." : "ما دار والو بعد."}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {audit.map((entry) => (
              <li
                key={entry.id}
                className="rounded-input border-border bg-surface flex flex-wrap items-center gap-2 border px-4 py-2.5 text-sm"
              >
                <span className="font-bold">
                  {actionLabels[entry.action] ?? entry.action}
                </span>
                {entry.note && (
                  <span className="text-muted truncate text-xs">
                    — {entry.note}
                  </span>
                )}
                <span className="text-dim ltr-nums ms-auto text-xs">
                  {formatDateTime(entry.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
