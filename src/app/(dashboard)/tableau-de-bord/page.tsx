import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Bell,
  ChartNoAxesColumn,
  CheckCircle2,
  Clock,
  Eye,
  Megaphone,
  PlusCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { adminDb } from "@/lib/firebase/admin";
import { isStaff, requireUser } from "@/server/auth";
import { getUserDoc } from "@/server/users";
import { ownerStats } from "@/server/stats";
import { kFreeListingQuota } from "@/lib/constants";
import { ListGroup, ListRow } from "@/components/app/ListGroup";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type { Listing } from "@/types/listing";

export const metadata: Metadata = {
  title: "حسابي",
  robots: { index: false, follow: false },
};

// Always fresh: these numbers are the answer to "did my ad go through?".
export const dynamic = "force-dynamic";

/**
 * The owner's own ads. Read through the Admin SDK because drafts, pending and
 * rejected ones are invisible to the public rules by design.
 *
 * Degrades to null rather than throwing: a dashboard that 500s right after
 * someone posts reads as having lost their work.
 */
async function myListings(uid: string): Promise<Listing[] | null> {
  try {
    const snap = await adminDb()
      .collection("listings")
      .where("ownerUid", "==", uid)
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Listing)
      .filter((l) => l.status !== "archived");
  } catch (error) {
    console.error("[dashboard] read failed:", error);
    return null;
  }
}

/** One number, said in as few pixels as it takes. */
function Stat({
  icon: Icon,
  label,
  value,
  tone = "",
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-card border-border bg-surface border p-3">
      <p className="text-dim flex items-center gap-1.5 text-[11px] font-bold">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className={`ltr-nums mt-1 text-xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

export default async function AccountPage() {
  const user = await requireUser();
  const [listings, profile] = await Promise.all([
    myListings(user.uid),
    getUserDoc(user.uid),
  ]);

  const stats = ownerStats(listings ?? [], {
    activeListingCount: profile?.activeListingCount ?? 0,
    listingQuota: profile?.listingQuota ?? kFreeListingQuota,
  });

  const remaining = Math.max(0, stats.listingQuota - stats.activeListingCount);
  const rejected = stats.byStatus.rejected ?? 0;
  const pending = stats.byStatus.pending ?? 0;
  const published = stats.byStatus.published ?? 0;

  return (
    <div className="pb-4">
      {/* ── WHO YOU ARE ──────────────────────────────────────────────────────
          An account screen opens on the account. The old one opened on four
          metric tiles under the word "لوحة التحكّم", which is a report, not a
          place you recognise as yours. */}
      <div className="mt-1 flex items-center gap-3">
        <span className="bg-primary text-surface grid size-14 shrink-0 place-items-center rounded-full text-xl font-black">
          {(user.name || "؟").trim().charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-black">{user.name || "مستخدم"}</p>
          <p className="text-dim ltr-nums truncate text-sm font-semibold">
            {profile?.phone ?? user.email ?? "—"}
          </p>
        </div>
      </div>

      {/* The first thing to press, at the top and unmissable. Publishing is why
          almost everybody opens this screen. */}
      <Link
        href="/publier"
        className="bg-accent rounded-card mt-4 flex items-center justify-center gap-2 py-3.5 text-sm font-bold text-white transition-opacity active:opacity-90"
      >
        <PlusCircle className="size-5" strokeWidth={2.5} />
        انشر إعلان جديد
      </Link>

      {rejected > 0 && (
        <Link
          href="/tableau-de-bord/annonces"
          className="rounded-card bg-danger/10 text-danger mt-3 block px-4 py-3 text-sm font-bold"
        >
          عندك {rejected} إعلان مرفوض — شوف السبب وعدّله
        </Link>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat
          icon={CheckCircle2}
          label="منشورة"
          value={String(published)}
          tone={published > 0 ? "text-success" : ""}
        />
        <Stat
          icon={Clock}
          label="في المراجعة"
          value={String(pending)}
          tone={pending > 0 ? "text-warning" : ""}
        />
        <Stat
          icon={Eye}
          label="مشاهدات"
          value={listings === null ? "—" : String(stats.views ?? 0)}
        />
      </div>

      {/* ── QUOTA ────────────────────────────────────────────────────────── */}
      <div className="rounded-card border-border bg-surface mt-3 border p-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-sm font-extrabold">الإعلانات المسموحة</p>
          <p className="text-dim ltr-nums ms-auto text-sm font-bold">
            {stats.activeListingCount} / {stats.listingQuota}
          </p>
        </div>
        <div className="bg-surface-soft mt-2 h-2 w-full overflow-hidden rounded-full">
          <div
            className={`h-full rounded-full ${
              remaining === 0 ? "bg-danger" : "bg-primary"
            }`}
            style={{
              width: `${Math.min(
                100,
                stats.listingQuota === 0
                  ? 100
                  : (stats.activeListingCount / stats.listingQuota) * 100,
              )}%`,
            }}
          />
        </div>
        <p className="text-muted mt-2 text-xs leading-relaxed">
          {remaining === 0
            ? "وصلت الحد. باش تنشر إعلان جديد، أغلق ولا امسح واحد من القدام."
            : `تقدر تنشر ${remaining} إعلان آخر.`}
        </p>
      </div>

      {/* ── WHERE EVERYTHING IS ───────────────────────────────────────────
          This list replaces the row of six pills that used to sit above every
          dashboard screen. Same destinations, in the shape a phone expects. */}
      <ListGroup title="المحتوى متاعي">
        <ListRow
          icon={Megaphone}
          label="إعلاناتي"
          hint="شوف حالة كل إعلان وعدّلو"
          value={listings === null ? undefined : String(listings.length)}
          href="/tableau-de-bord/annonces"
        />
        <ListRow
          icon={ChartNoAxesColumn}
          label="منشوراتي"
          hint="طلباتك وتعليقاتك"
          href="/tableau-de-bord/publications"
        />
        <ListRow
          icon={Bell}
          label="تنبيهاتي"
          hint="البحوث المحفوظة اللي توصلك"
          href="/tableau-de-bord/alertes"
        />
      </ListGroup>

      <ListGroup title="الحساب">
        <ListRow
          icon={UserRound}
          label="معلوماتي"
          hint={
            profile?.phone
              ? "الاسم، الهاتف والولاية"
              : "زيد رقم هاتفك باش يوصلوك الزبائن"
          }
          tone={profile?.phone ? "primary" : "warning"}
          href="/tableau-de-bord/profil"
        />
        <ListRow
          icon={BadgeCheck}
          label="ادعُ أصحابك"
          hint="اربح نقاط بكل واحد ينشر"
          href="/tableau-de-bord/parrainage"
        />
      </ListGroup>

      {isStaff(user) && (
        <ListGroup title="الإشراف">
          <ListRow
            icon={ShieldCheck}
            label="لوحة الإشراف"
            hint="المراجعة، الحسابات وإعدادات المنصّة"
            href="/admin"
          />
        </ListGroup>
      )}

      <div className="mt-5">
        <SignOutButton />
      </div>
    </div>
  );
}
