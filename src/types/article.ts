/**
 * The editorial side of the site.
 *
 * Articles exist for one reason that is not editorial at all: a classifieds
 * site with nothing but listings has almost no text a search engine can index
 * against a question. Somebody typing "كيفاش نكري دار في الجزائر بلا سمسار"
 * is a future user, and today that query lands on a competitor's blog. These
 * pages are the answer, and they are static, long-lived and linkable — which is
 * everything a listing is not.
 *
 * **The body is blocks, not HTML.** Storing markup would mean rendering it, and
 * rendering stored markup means `dangerouslySetInnerHTML` over a field an admin
 * account can write — one compromised staff account away from script on every
 * page of the site. A block never becomes markup: it becomes a `<p>` with text
 * inside it, and React escapes the text.
 */

export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "li"; text: string }
  | { type: "quote"; text: string };

export type ArticleStatus = "draft" | "published";

export type Article = {
  id: string;
  /** Latin, French-derived, and the real identifier in the URL. */
  slug: string;
  title: string;
  /** One or two sentences. The meta description and the card summary. */
  excerpt: string;
  body: ArticleBlock[];
  coverUrl: string | null;
  coverAlt: string;
  authorUid: string;
  authorName: string;
  status: ArticleStatus;
  tags: string[];
  /** Derived from the body on save, never typed. */
  readMinutes: number;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
  commentCount: number;
};

export type ArticleComment = {
  id: string;
  articleId: string;
  authorUid: string;
  authorName: string;
  authorPhotoUrl: string | null;
  text: string;
  status: "visible" | "hidden";
  hiddenReason: string | null;
  createdAt: number;
};
