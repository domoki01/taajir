import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  LayoutGrid,
  MessageSquare,
  Newspaper,
  Palette,
  Rocket,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";
import { adminStats } from "@/server/stats";
import { hasPermission, requireStaff } from "@/server/auth";
import { ListGroup, ListRow } from "@/components/app/ListGroup";
import { kAdminGroups, kAdminNav, type AdminNavIcon } from "@/app/admin/nav";
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

/** The lucide component behind each named icon in the nav list. */
const kIcons: Record<AdminNavIcon, LucideIcon> = {
  overview: LayoutGrid,
  queue: Clock,
  comments: MessageSquare,
  users: Users,
  roles: ShieldCheck,
  promos: ImageIcon,
  taxonomy: SlidersHorizontal,
  articles: Newspaper,
  branding: Palette,
  launch: Rocket,
  affiliate: BadgeCheck,
  push: Bell,
  audit: ScrollText,
};

/** One line under each row: a label alone makes you open a screen to find out. */
const kHints: Record<AdminNavIcon, string> = {
  overview: "",
  queue: "الإعلانات اللي تستنّى قرار",
  comments: "راجع وخبّي التعليقات",
  users: "الأدوار، الحصص والحظر",
  roles: "شكون يقدر يدير واش",
  promos: "البانرات في الصفحات",
  taxonomy: "الفئات والفلاتر متاع البحث",
  articles: "اكتب وانشر مقالات",
  branding: "الاسم، اللوقو والألوان",
  launch: "غلق الموقع، العدّاد ومفتاح الفتح",
  affiliate: "النقاط، المسابقة والجوائز",
  push: "ابعث إشعار لكل المستعملين",
  audit: "كل قرار إشراف، مع صاحبه ووقته",
};

export default async function AdminHome() {
  const admin = await requireStaff();
  const [stats, audit] = await Promise.all([adminStats(), listAudit(6)]);

  const sections = kAdminNav.filter(
    ({ href, need }) =>
      href !== "/admin" &&
      (need.length === 0 || need.some((p) => hasPermission(admin, p))),
  );

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
      label: "منشورة",
      value: show(stats.published),
      href: "/vente",
      tone: "text-success",
    },
    {
      icon: Users,
      label: "الحسابات",
      value: show(stats.users),
      href: "/admin/utilisateurs",
      tone: "",
    },
    {
      icon: AlertTriangle,
      label: "موقّفة",
      value: show(stats.banned),
      href: "/admin/utilisateurs",
      tone: stats.banned ? "text-danger" : "",
    },
  ];

  return (
    <div className="pb-4">
      <h1 className="mt-1 text-xl font-black">نظرة عامة</h1>
      <p className="text-muted mt-1 text-sm font-semibold">
        حالة المنصة، وآخر ما دار فيها.
      </p>

      {/* Four numbers, not six: what a moderator opens this screen to check. The
          rest is one tap away in the list below. */}
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Link
              href={tile.href}
              className="rounded-card border-border bg-surface active:bg-surface-soft block border p-3 transition-colors"
            >
              <p className="text-dim flex items-center gap-1.5 text-[11px] font-bold">
                <tile.icon className="size-3.5" />
                {tile.label}
              </p>
              <p className={`ltr-nums mt-1 text-xl font-black ${tile.tone}`}>
                {tile.value}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {/* ── EVERY SCREEN, GROUPED ─────────────────────────────────────────
          The thirteen pills and the sidebar both lived here. A phone finds a
          destination in a list with an icon and a chevron, under a heading that
          says what kind of thing it is. */}
      {kAdminGroups.map((group) => {
        const rows = sections.filter((s) => s.group === group);
        if (rows.length === 0) return null;
        return (
          <ListGroup key={group} title={group}>
            {rows.map((row) => (
              <ListRow
                key={row.href}
                icon={kIcons[row.icon]}
                label={row.label}
                hint={kHints[row.icon]}
                href={row.href}
              />
            ))}
          </ListGroup>
        );
      })}

      {/* ── RECENT ACTIVITY ──────────────────────────────────────────────── */}
      <section className="mt-6">
        <h2 className="text-dim mb-2 px-1 text-xs font-extrabold">
          آخر العمليات
        </h2>
        {audit === null || audit.length === 0 ? (
          <p className="text-muted px-1 text-sm">
            {audit === null ? "ما قدرناش نجيبو السجلّ." : "ما دار والو بعد."}
          </p>
        ) : (
          <ul className="rounded-card border-border bg-surface overflow-hidden border">
            {audit.map((entry) => (
              <li
                key={entry.id}
                className="border-border flex flex-wrap items-center gap-2 border-t px-4 py-3 text-sm first:border-t-0"
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
