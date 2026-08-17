import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Clock, MessageSquare } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { listArticles } from "@/server/articles";
import { kSiteName, kSiteUrl } from "@/lib/constants";
import { jsonLdScript } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "المقالات",
  description: `نصائح ومقالات عن السوق العقاري في الجزائر: كيفاش تكري، كيفاش تبيع، والوثائق اللي تحتاجها — من ${kSiteName}.`,
  alternates: { canonical: `${kSiteUrl}/articles` },
};

/**
 * Rendered per request, not prerendered at build.
 *
 * With `revalidate` this route is static, which means it is built once during
 * `next build` — and the build container has no database credentials, so the
 * list comes back empty, gets cached, and the index page is blank for an hour
 * after every deploy. The read degrades quietly rather than failing the build,
 * which is exactly what makes that failure invisible.
 *
 * One indexed query per request is the right price for a page that has to show
 * an article the moment it is published.
 */
export const dynamic = "force-dynamic";

export function day(at: number | null): string {
  if (!at) return "";
  return new Date(at).toLocaleDateString("ar-DZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function ArticlesPage() {
  const articles = await listArticles();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `مدوّنة ${kSiteName}`,
    url: `${kSiteUrl}/articles`,
    inLanguage: "ar-DZ",
    blogPost: articles.map((a) => ({
      "@type": "BlogPosting",
      headline: a.title,
      description: a.excerpt,
      url: `${kSiteUrl}/articles/${a.slug}`,
      datePublished: a.publishedAt
        ? new Date(a.publishedAt).toISOString()
        : undefined,
    })),
  };

  return (
    <>
      <Header />
      <main className="flex-1 py-8">
        <Container className="max-w-3xl">
          <h1 className="text-2xl font-black md:text-3xl">المقالات</h1>
          <p className="text-muted mt-2 leading-relaxed">
            نصائح عملية على الكراء والبيع في الجزائر، الوثائق، والأسعار — مكتوبة
            باش تفيدك قبل ما تمضي.
          </p>

          {articles.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="ما كاش مقالات دروك"
                body="راح نكتبو قريب. في الأثناء، تصفّح الإعلانات ولا انشر إعلانك."
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articles/${article.slug}`}
                  className="rounded-card border-border bg-surface hover:border-primary hover:shadow-soft grid overflow-hidden border transition-all sm:grid-cols-[13rem_1fr]"
                >
                  {article.coverUrl && (
                    <span className="bg-surface-soft relative block h-40 w-full sm:h-full">
                      <Image
                        src={article.coverUrl}
                        alt={article.coverAlt}
                        fill
                        sizes="(max-width: 640px) 100vw, 13rem"
                        className="object-cover"
                        unoptimized
                      />
                    </span>
                  )}
                  <span className="block p-4">
                    <span className="block text-base leading-snug font-extrabold">
                      {article.title}
                    </span>
                    <span className="text-muted mt-1.5 block text-sm leading-relaxed">
                      {article.excerpt}
                    </span>
                    <span className="text-dim ltr-nums mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3.5" />
                        {day(article.publishedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {article.readMinutes} د قراءة
                      </span>
                      {article.commentCount > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="size-3.5" />
                          {article.commentCount}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Container>
      </main>

      {/* jsonLdScript, not JSON.stringify: a title carrying a `</script>` would
          otherwise close this tag and start executing. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
    </>
  );
}
