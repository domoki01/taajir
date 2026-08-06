import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  PlusCircle,
  UserRound,
} from "lucide-react";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser } from "@/server/auth";
import { getUserDoc } from "@/server/users";
import { ownerStats } from "@/server/stats";
import { kFreeListingQuota } from "@/lib/constants";
import type { Listing } from "@/types/listing";

export const metadata: Metadata = {
  title: "لوحة التحكّم",
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

function Tile({
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
    <div className="rounded-card border-border bg-surface border p-4">
      <p className="text-dim flex items-center gap-2 text-xs font-bold">
        <Icon className="size-4" />
        {label}
      </p>
      <p className={`ltr-nums mt-2 text-2xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
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

  return (
    <div>
      <h1 className="text-2xl font-black">لوحة التحكّم</h1>
      <p className="text-muted mt-1 text-sm font-semibold">
        نظرة سريعة على إعلاناتك وحسابك.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          icon={CheckCircle2}
          label="منشورة"
          value={String(stats.byStatus.published ?? 0)}
          tone="text-success"
        />
        <Tile
          icon={Clock}
          label="في المراجعة"
          value={String(pending)}
          tone={pending > 0 ? "text-warning" : ""}
        />
        <Tile
          icon={AlertTriangle}
          label="مرفوضة"
          value={String(rejected)}
          tone={rejected > 0 ? "text-danger" : ""}
        />
        <Tile
          icon={Eye}
          label="مجموع المشاهدات"
          value={listings === null ? "—" : String(stats.views ?? 0)}
        />
      </div>

      {/* ── QUOTA ────────────────────────────────────────────────────────── */}
      <div className="rounded-card border-border bg-surface mt-4 border p-4">
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

      {/* ── WHAT TO DO NEXT ──────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link
          href="/publier"
          className="rounded-card border-border bg-surface hover:border-primary flex items-center gap-3 border p-4 transition-colors"
        >
          <span className="bg-primary-soft text-primary grid size-10 shrink-0 place-items-center rounded-[12px]">
            <PlusCircle className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-bold">انشر إعلان جديد</span>
            <span className="text-dim block text-xs">
              صور، سعر، ووثائق — يظهر بعد المراجعة
            </span>
          </span>
        </Link>

        <Link
          href="/tableau-de-bord/profil"
          className="rounded-card border-border bg-surface hover:border-primary flex items-center gap-3 border p-4 transition-colors"
        >
          <span className="bg-primary-soft text-primary grid size-10 shrink-0 place-items-center rounded-[12px]">
            <UserRound className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-bold">معلوماتي</span>
            <span className="text-dim block text-xs">
              {profile?.phone
                ? "الاسم، الهاتف والولاية"
                : "زيد رقم هاتفك باش يوصلوك الزبائن"}
            </span>
          </span>
        </Link>
      </div>

      {rejected > 0 && (
        <p className="rounded-input bg-danger/10 text-danger mt-4 px-4 py-3 text-sm font-bold">
          عندك {rejected} إعلان مرفوض.{" "}
          <Link href="/tableau-de-bord/annonces" className="underline">
            شوف السبب وعدّله
          </Link>
        </p>
      )}
    </div>
  );
}
