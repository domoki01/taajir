import type { Metadata } from "next";
import { requirePermission } from "@/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { listRecentComments } from "@/server/comments";
import { CommentRow } from "@/components/admin/CommentRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = {
  title: "التعليقات",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Titles for the listings the comments hang off, fetched in one getAll rather
 * than one read per comment — a page of 100 comments on 40 ads is 40 reads this
 * way and 100 the obvious way.
 */
async function listingTitles(
  ids: string[],
): Promise<Map<string, { title: string; slug: string }>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();

  try {
    const db = adminDb();
    const snaps = await db.getAll(
      ...unique.map((id) => db.collection("listings").doc(id)),
    );
    return new Map(
      snaps
        .filter((s) => s.exists)
        .map((s) => [
          s.id,
          {
            title: (s.data()?.title as string) ?? "",
            slug: (s.data()?.slug as string) ?? "",
          },
        ]),
    );
  } catch (error) {
    console.error("[comments] titles read failed:", error);
    return new Map();
  }
}

export default async function CommentsPage() {
  await requirePermission("comments.moderate", "/admin/commentaires");

  const comments = await listRecentComments();
  const titles = await listingTitles((comments ?? []).map((c) => c.listingId));

  const hidden = (comments ?? []).filter((c) => c.status === "hidden").length;

  return (
    <div>
      <h1 className="text-2xl font-black">التعليقات</h1>
      <p className="text-muted mt-1 text-sm font-semibold">
        {comments === null
          ? "—"
          : comments.length === 0
            ? "ما كاش تعليقات"
            : `${comments.length} تعليق${hidden ? ` · ${hidden} مخفي` : ""}`}
      </p>
      <p className="text-dim mt-2 text-xs leading-relaxed">
        الإخفاء يخلّي التعليق محفوظاً ويشيلو من الإعلان — أحسن من المسح لأن
        القرار يبقى قابل للمراجعة. المسح نهائي.
      </p>

      <div className="mt-6">
        {comments === null ? (
          <EmptyState
            title="ما قدرناش نجيبو التعليقات"
            body="وقع مشكل مؤقت. عاود تحميل الصفحة."
          />
        ) : comments.length === 0 ? (
          <EmptyState
            title="ما كاش تعليقات"
            body="التعليقات الجديدة على الإعلانات تبان هنا."
          />
        ) : (
          <ul className="space-y-3">
            {comments.map((comment) => {
              const listing = titles.get(comment.listingId);
              return (
                <CommentRow
                  key={`${comment.listingId}-${comment.id}`}
                  comment={comment}
                  createdAtLabel={formatDateTime(comment.createdAt)}
                  listingTitle={listing?.title ?? "إعلان"}
                  listingSlug={listing?.slug ?? ""}
                />
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
