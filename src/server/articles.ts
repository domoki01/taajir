import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type { Article, ArticleComment } from "@/types/article";

/**
 * Reads for the article pages.
 *
 * Every one of these degrades to empty or null rather than throwing. An article
 * page that 500s is worse than a missing article: the crawler that these pages
 * exist for treats a 500 as "come back later" and a 404 as "this is settled",
 * and the first is the one that keeps a broken URL in the index.
 */

const kCollection = "articles";

function shape(id: string, data: FirebaseFirestore.DocumentData): Article {
  return {
    id,
    slug: (data.slug as string) ?? id,
    title: (data.title as string) ?? "",
    excerpt: (data.excerpt as string) ?? "",
    body: (data.body as Article["body"]) ?? [],
    coverUrl: (data.coverUrl as string) ?? null,
    coverAlt: (data.coverAlt as string) ?? "",
    authorUid: (data.authorUid as string) ?? "",
    authorName: (data.authorName as string) ?? "تأجير",
    status: data.status === "published" ? "published" : "draft",
    tags: (data.tags as string[]) ?? [],
    readMinutes: (data.readMinutes as number) ?? 1,
    publishedAt: (data.publishedAt as number) ?? null,
    createdAt: (data.createdAt as number) ?? 0,
    updatedAt: (data.updatedAt as number) ?? 0,
    commentCount: (data.commentCount as number) ?? 0,
  };
}

/** Everything published, newest first. The index page and the sitemap. */
export async function listArticles(max = 50): Promise<Article[]> {
  try {
    const snap = await adminDb()
      .collection(kCollection)
      .where("status", "==", "published")
      .orderBy("publishedAt", "desc")
      .limit(max)
      .get();
    return snap.docs.map((d) => shape(d.id, d.data()));
  } catch (error) {
    console.error("[articles] list failed:", error);
    return [];
  }
}

/** Drafts included. The admin screen. */
export async function listAllArticles(max = 60): Promise<Article[]> {
  try {
    const snap = await adminDb()
      .collection(kCollection)
      .orderBy("updatedAt", "desc")
      .limit(max)
      .get();
    return snap.docs.map((d) => shape(d.id, d.data()));
  } catch (error) {
    console.error("[articles] admin list failed:", error);
    return [];
  }
}

/**
 * One article by its slug.
 *
 * A query rather than a read by id, because the slug is what the URL carries
 * and what a link shared on WhatsApp will still point at after the document id
 * has been forgotten. `includeDrafts` is how an editor previews their own work
 * without publishing it first.
 */
export async function getArticleBySlug(
  slug: string,
  includeDrafts = false,
): Promise<Article | null> {
  try {
    const snap = await adminDb()
      .collection(kCollection)
      .where("slug", "==", slug)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const article = shape(snap.docs[0].id, snap.docs[0].data());
    if (article.status !== "published" && !includeDrafts) return null;
    return article;
  } catch (error) {
    console.error("[articles] read failed:", error);
    return null;
  }
}

/**
 * The thread under an article.
 *
 * Named `articleComments`, not `comments`, and that is load-bearing: the
 * moderation screen runs a collection-group query over `comments`, and a second
 * subcollection by that name anywhere in the database would pour these into a
 * list whose every row links to a listing that does not exist.
 */
export async function listArticleComments(
  articleId: string,
  max = 100,
): Promise<ArticleComment[]> {
  try {
    const snap = await adminDb()
      .collection(kCollection)
      .doc(articleId)
      .collection("articleComments")
      .orderBy("createdAt", "asc")
      .limit(max)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ArticleComment);
  } catch (error) {
    console.error("[articles] comments read failed:", error);
    return [];
  }
}

/** Recent comments across every article, for the moderation screen. */
export async function recentArticleComments(
  max = 60,
): Promise<Array<ArticleComment & { articleSlug: string }>> {
  try {
    const snap = await adminDb()
      .collectionGroup("articleComments")
      .orderBy("createdAt", "desc")
      .limit(max)
      .get();
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<ArticleComment, "id">),
      // The parent's parent: articles/{id}/articleComments/{id}.
      articleSlug: d.ref.parent.parent?.id ?? "",
    }));
  } catch (error) {
    console.error("[articles] comment sweep failed:", error);
    return [];
  }
}
