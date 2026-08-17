import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Clock } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/layout/Container";
import { getArticleBySlug, listArticleComments } from "@/server/articles";
import { getUser, hasPermission } from "@/server/auth";
import { ArticleThread } from "@/components/articles/ArticleThread";
import { kSiteName, kSiteUrl } from "@/lib/constants";
import { jsonLdScript } from "@/lib/jsonld";
import { richRuns } from "@/lib/article";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "المقال ما كاينش" };

  const url = `${kSiteUrl}/articles/${article.slug}`;
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt,
      url,
      publishedTime: article.publishedAt
        ? new Date(article.publishedAt).toISOString()
        : undefined,
      images: article.coverUrl ? [article.coverUrl] : undefined,
    },
    twitter: {
      card: article.coverUrl ? "summary_large_image" : "summary",
      title: article.title,
      description: article.excerpt,
      images: article.coverUrl ? [article.coverUrl] : undefined,
    },
  };
}

/** Text with its `**bold**` runs resolved. Strings in, elements out — no markup. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {richRuns(text).map((run, i) =>
        run.bold ? (
          <strong key={i} className="text-primary font-extrabold">
            {run.text}
          </strong>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  );
}

function day(at: number | null): string {
  if (!at) return "";
  return new Date(at).toLocaleDateString("ar-DZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getUser();
  // Staff see their own drafts at the real URL, which is the only sane way to
  // proof-read a piece before it goes out.
  const article = await getArticleBySlug(
    slug,
    hasPermission(user, "articles.manage"),
  );
  // notFound(), not a redirect: a 404 tells a crawler the URL is settled, while
  // a redirect keeps a dead link alive in the index for months.
  if (!article) notFound();

  const comments = await listArticleComments(article.id);
  const visible = comments.filter(
    (c) =>
      c.status === "visible" ||
      c.authorUid === user?.uid ||
      hasPermission(user, "comments.moderate"),
  );

  const url = `${kSiteUrl}/articles/${article.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt,
    inLanguage: "ar-DZ",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    image: article.coverUrl ? [article.coverUrl] : undefined,
    datePublished: article.publishedAt
      ? new Date(article.publishedAt).toISOString()
      : undefined,
    dateModified: new Date(article.updatedAt).toISOString(),
    author: { "@type": "Organization", name: kSiteName, url: kSiteUrl },
    publisher: { "@type": "Organization", name: kSiteName, url: kSiteUrl },
    commentCount: article.commentCount,
  };

  return (
    <>
      <Header />
      <main className="flex-1 py-8">
        <Container className="max-w-3xl">
          <Link
            href="/articles"
            className="text-dim hover:text-primary mb-4 inline-flex items-center gap-1.5 text-sm font-bold transition-colors"
          >
            <ArrowRight className="size-4" />
            كل المقالات
          </Link>

          {article.status !== "published" && (
            <p className="rounded-input bg-warning/10 text-warning mb-4 px-4 py-3 text-sm font-bold">
              هذا مقال مسوّدة — ما يشوفوهش غير المشرفين.
            </p>
          )}

          <article>
            <h1 className="text-2xl leading-tight font-black md:text-3xl">
              {article.title}
            </h1>

            <div className="text-dim ltr-nums mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {day(article.publishedAt)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                {article.readMinutes} د قراءة
              </span>
              <span>{article.authorName}</span>
            </div>

            {article.coverUrl && (
              <div className="rounded-card bg-surface-soft relative mt-5 aspect-[16/9] w-full overflow-hidden">
                <Image
                  src={article.coverUrl}
                  alt={article.coverAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, 48rem"
                  className="object-cover"
                  priority
                  unoptimized
                />
              </div>
            )}

            <p className="text-primary mt-6 text-base leading-loose font-bold">
              {article.excerpt}
            </p>

            {/* Blocks, never markup. Nothing an editor types becomes HTML — the
                body is data, and React escapes the text inside each element. */}
            <div className="mt-4">
              {article.body.map((block, i) =>
                block.type === "h2" ? (
                  <h2 key={i} className="mt-8 mb-2 text-lg font-extrabold">
                    <Rich text={block.text} />
                  </h2>
                ) : block.type === "li" ? (
                  <p
                    key={i}
                    className="text-muted relative ps-5 leading-loose before:absolute before:start-0 before:content-['•']"
                  >
                    <Rich text={block.text} />
                  </p>
                ) : block.type === "quote" ? (
                  <p
                    key={i}
                    className="border-primary bg-primary-soft rounded-card my-4 border-s-4 p-4 leading-loose font-bold"
                  >
                    <Rich text={block.text} />
                  </p>
                ) : (
                  <p key={i} className="text-muted mt-3 leading-loose">
                    <Rich text={block.text} />
                  </p>
                ),
              )}
            </div>

            {article.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-input bg-surface-soft text-dim px-3 py-1.5 text-xs font-bold"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </article>

          {/* The article exists to bring somebody here from a search; this is
              the one line that turns that visit into a use of the site. */}
          <div className="rounded-card border-primary bg-primary-soft mt-8 border p-5 text-center">
            <p className="font-extrabold">عندك عقار للكراء ولا للبيع؟</p>
            <p className="text-muted mt-1 text-sm leading-relaxed">
              انشر إعلانك مجاناً ووصل لناس يحوّسو في ولايتك.
            </p>
            <Link
              href="/publier"
              className="bg-accent rounded-input mt-3 inline-block px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              انشر إعلانك
            </Link>
          </div>

          <ArticleThread
            articleId={article.id}
            comments={visible}
            slug={article.slug}
            currentUid={user?.uid ?? null}
            mayModerate={hasPermission(user, "comments.moderate")}
            signedIn={!!user}
          />
        </Container>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
    </>
  );
}
