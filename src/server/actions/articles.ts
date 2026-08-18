"use server";

// ── ARTICLES ─────────────────────────────────────────────────────────────────
// Writing on the site's own masthead, and the thread underneath.
//
// Two different kinds of write live here and they are guarded differently: an
// article is staff-only and goes out in the site's name, while a comment is any
// signed-in reader. Both are written server-side for the same reason as every
// other collection — the author name on a comment is denormalized from the
// session, so a client that could write it could post as anybody.

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import {
  actorWith,
  getUser,
  hasPermission,
  kForbidden,
  requireUser,
} from "@/server/auth";
import { getAccessSettings, kNeedsApproval } from "@/server/access";
import { checkPolicy } from "@/lib/policy";
import { kTooFast, withinRate } from "@/server/rateLimit";
import {
  kReservedArticleSlugs,
  kSlugPattern,
  normaliseSlug,
  parseBody,
  readingMinutes,
  safeCoverUrl,
} from "@/lib/article";
import { kSiteName } from "@/lib/constants";
import type { ArticleStatus } from "@/types/article";

export type ArticleResult =
  | { ok: true; slug?: string }
  | { ok: false; error: string; needsAuth?: boolean };

const kCollection = "articles";

// ── EDITING ──────────────────────────────────────────────────────────────────

export type ArticleInput = {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  /** The raw textarea contents; parsed into blocks here, never stored as typed. */
  body: string;
  coverUrl: string | null;
  coverAlt: string;
  tags: string[];
  status: ArticleStatus;
};

export async function saveArticle(input: ArticleInput): Promise<ArticleResult> {
  const admin = await actorWith("articles.manage");
  if (!admin) return { ok: false, error: kForbidden };

  const title = input.title.trim();
  const excerpt = input.excerpt.trim();
  if (title.length < 10 || title.length > 120) {
    return { ok: false, error: "العنوان لازم بين 10 و120 حرف" };
  }
  if (excerpt.length < 20 || excerpt.length > 300) {
    return { ok: false, error: "الملخّص لازم بين 20 و300 حرف" };
  }

  const body = parseBody(input.body);
  if (body.length < 3) {
    return { ok: false, error: "المقال قصير برك — اكتب على الأقل 3 فقرات" };
  }

  // Latin and hyphenated, because an Arabic slug percent-encodes into
  // unreadable bytes and breaks the WhatsApp preview these articles are shared
  // through. Derived from the slug field if it is usable, never from the title.
  const slug = normaliseSlug(input.slug);
  if (!kSlugPattern.test(slug)) {
    return {
      ok: false,
      error:
        "الرابط لازم بحروف لاتينية وشرطات (مثال: marche-immobilier-algerie)",
    };
  }
  if (kReservedArticleSlugs.has(slug)) {
    return { ok: false, error: "هذا الرابط محجوز، اختر واحد آخر" };
  }

  const db = adminDb();
  // Uniqueness checked against the collection, not assumed: two articles
  // sharing a slug means one of them is unreachable, and which one is decided
  // by query order.
  const clash = await db
    .collection(kCollection)
    .where("slug", "==", slug)
    .limit(2)
    .get();
  if (clash.docs.some((d) => d.id !== input.id)) {
    return { ok: false, error: "كاين مقال بنفس الرابط" };
  }

  const now = Date.now();
  const ref = input.id
    ? db.collection(kCollection).doc(input.id)
    : db.collection(kCollection).doc();
  const existing = input.id ? (await ref.get()).data() : null;

  await ref.set(
    {
      slug,
      title,
      excerpt,
      body,
      coverUrl: safeCoverUrl(input.coverUrl),
      coverAlt: input.coverAlt.trim().slice(0, 140) || title,
      // The first publisher keeps the byline. An editor fixing a typo three
      // months later does not become the author of the piece.
      authorUid: (existing?.authorUid as string) ?? admin.uid,
      authorName: (existing?.authorName as string) ?? (admin.name || kSiteName),
      status: input.status,
      tags: input.tags
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 6),
      readMinutes: readingMinutes(body),
      // Set once, on the first publish: re-publishing after an edit must not
      // move the piece back to the top of the list or change its dateline.
      publishedAt:
        input.status === "published"
          ? ((existing?.publishedAt as number) ?? now)
          : null,
      createdAt: (existing?.createdAt as number) ?? now,
      updatedAt: now,
      commentCount: (existing?.commentCount as number) ?? 0,
    },
    { merge: true },
  );

  await audit(admin.uid, input.id ? "article.edit" : "article.create", slug);
  revalidatePath("/articles");
  revalidatePath(`/articles/${slug}`);
  revalidatePath("/admin/articles");
  return { ok: true, slug };
}

export async function deleteArticle(id: string): Promise<ArticleResult> {
  const admin = await actorWith("articles.manage");
  if (!admin) return { ok: false, error: kForbidden };

  const db = adminDb();
  const ref = db.collection(kCollection).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };

  // The thread is a subcollection, which a document delete does not touch —
  // left behind, its comments are orphans no screen can reach or moderate.
  const comments = await ref.collection("articleComments").limit(300).get();
  await Promise.all(comments.docs.map((d) => d.ref.delete()));
  await ref.delete();

  await audit(admin.uid, "article.delete", (snap.data()?.slug as string) ?? id);
  revalidatePath("/articles");
  revalidatePath("/admin/articles");
  return { ok: true };
}

// ── THE THREAD ───────────────────────────────────────────────────────────────

/**
 * Commenting needs an account, which is the whole point of the request.
 *
 * Signalled rather than redirected, the same way listing comments are: the form
 * can then point at the sign-in page while keeping what was typed.
 */
export async function addArticleComment(
  articleId: string,
  text: string,
): Promise<ArticleResult> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "لازم تسجّل الدخول باش تعلّق", needsAuth: true };
  }

  const body = text.trim();
  if (body.length < 2) return { ok: false, error: "اكتب تعليق" };
  if (body.length > 1000) {
    return { ok: false, error: "التعليق طويل — أقصى 1000 حرف" };
  }

  // Same automatic check as everywhere else people write in public. Only the
  // refusing half applies: a comment has no queue to wait in, so "unsure"
  // means publish.
  const verdict = checkPolicy({ title: "", description: body });
  if (verdict.decision === "reject") {
    return { ok: false, error: verdict.reason };
  }
  if (!(await withinRate(user.uid, "comment"))) {
    return { ok: false, error: kTooFast };
  }

  const db = adminDb();
  const ref = db.collection(kCollection).doc(articleId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "المقال ما كاينش" };
  // Commenting on a draft would leak that it exists, and there is nothing to
  // discuss on a page nobody can read.
  if (snap.data()?.status !== "published") {
    return { ok: false, error: "ما يمكنش التعليق على هذا المقال" };
  }

  const profile =
    (await db.collection("users").doc(user.uid).get()).data() ?? {};
  if (profile.isBanned) return { ok: false, error: "حسابك موقّف" };
  const { requireApproval } = await getAccessSettings();
  if (requireApproval && profile.approved === false) {
    return { ok: false, error: kNeedsApproval };
  }

  await ref.collection("articleComments").add({
    articleId,
    authorUid: user.uid,
    authorName: (profile.displayName as string) || user.name || "مستخدم",
    authorPhotoUrl: (profile.photoURL as string) ?? null,
    text: body,
    status: "visible",
    hiddenReason: null,
    createdAt: Date.now(),
  });
  await ref.update({ commentCount: FieldValue.increment(1) });

  revalidatePath(`/articles/${snap.data()?.slug}`);
  return { ok: true };
}

/** The author may remove their own; staff may remove any. */
export async function deleteArticleComment(
  articleId: string,
  commentId: string,
): Promise<ArticleResult> {
  const user = await requireUser("/articles");
  const db = adminDb();
  const articleRef = db.collection(kCollection).doc(articleId);
  const ref = articleRef.collection("articleComments").doc(commentId);

  const snap = await ref.get();
  if (!snap.exists) return { ok: true };
  if (
    snap.data()?.authorUid !== user.uid &&
    !hasPermission(user, "comments.moderate")
  ) {
    return { ok: false, error: "ماشي تعليقك" };
  }

  await ref.delete();
  await articleRef.update({ commentCount: FieldValue.increment(-1) });

  const slug = (await articleRef.get()).data()?.slug;
  if (slug) revalidatePath(`/articles/${slug}`);
  revalidatePath("/admin/commentaires");
  return { ok: true };
}

/**
 * Staff hide rather than delete, as with listing comments: the decision stays
 * reviewable, which matters when the person hidden disputes it.
 */
export async function hideArticleComment(
  articleId: string,
  commentId: string,
  reason: string,
): Promise<ArticleResult> {
  const user = await actorWith("comments.moderate");
  if (!user) return { ok: false, error: kForbidden };

  const db = adminDb();
  await db
    .collection(kCollection)
    .doc(articleId)
    .collection("articleComments")
    .doc(commentId)
    .update({ status: "hidden", hiddenReason: reason.trim() || null });

  const slug = (await db.collection(kCollection).doc(articleId).get()).data()
    ?.slug;
  if (slug) revalidatePath(`/articles/${slug}`);
  revalidatePath("/admin/commentaires");
  return { ok: true };
}

async function audit(actorUid: string, action: string, note: string) {
  await adminDb()
    .collection("adminAudit")
    .add({
      actorUid,
      action,
      targetType: "article",
      targetId: note,
      note,
      at: Date.now(),
    })
    .catch(() => {});
}
