import type { Metadata } from "next";
import { requirePermission } from "@/server/auth";
import { listAllArticles } from "@/server/articles";
import { ArticleEditor } from "@/components/admin/ArticleEditor";

export const metadata: Metadata = {
  title: "المقالات",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminArticlesPage() {
  await requirePermission("articles.manage", "/admin/articles");
  const articles = await listAllArticles();

  return (
    <div>
      <h1 className="text-2xl font-black">المقالات</h1>
      <p className="text-muted mt-1 text-sm leading-relaxed font-semibold">
        المقالات هي الصفحات اللي تجيب الناس من قوقل. اكتب على أسئلة يسقسيو عليها
        بصح — الوثائق، الأسعار، وكيفاش يتفاداو النصب.
      </p>
      <div className="mt-6">
        <ArticleEditor articles={articles} />
      </div>
    </div>
  );
}
