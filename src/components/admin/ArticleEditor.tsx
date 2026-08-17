"use client";

// ── THE EDITOR ───────────────────────────────────────────────────────────────
// One textarea and four fields, on purpose. A rich-text editor stores markup,
// and markup an admin account can write has to be rendered back — which is
// script on every page of the site, one compromised staff login away. The three
// prefixes below buy the structure a article needs and store data instead.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { ExternalLink, ImagePlus, Plus, Trash2 } from "lucide-react";
import { storage } from "@/lib/firebase/client";
import { shrinkImage } from "@/lib/image";
import { deleteArticle, saveArticle } from "@/server/actions/articles";
import { normaliseSlug, toRaw } from "@/lib/article";
import type { Article } from "@/types/article";

const kField =
  "rounded-input border-border focus:border-primary mt-1 w-full border bg-white px-3 py-2.5 text-sm outline-none";

type Form = {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverUrl: string | null;
  coverAlt: string;
  tags: string;
  status: "draft" | "published";
};

const kBlank: Form = {
  slug: "",
  title: "",
  excerpt: "",
  body: "",
  coverUrl: null,
  coverAlt: "",
  tags: "",
  status: "draft",
};

function formOf(article: Article): Form {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    body: toRaw(article.body),
    coverUrl: article.coverUrl,
    coverAlt: article.coverAlt,
    tags: article.tags.join("، "),
    status: article.status,
  };
}

export function ArticleEditor({ articles }: { articles: Article[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(kBlank);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save(status: Form["status"]) {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const res = await saveArticle({
        ...form,
        status,
        // Split on both commas, because an Arabic keyboard produces the Arabic
        // one and nobody should have to notice which.
        tags: form.tags
          .split(/[،,]/)
          .map((t) => t.trim())
          .filter(Boolean),
      });
      if (res.ok) {
        setSaved(res.slug ?? "");
        setForm((f) => ({ ...f, status }));
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  async function onPickCover(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const { blob } = await shrinkImage(file, { maxEdge: 1400 });
      const path = `articles/${crypto.randomUUID()}.webp`;
      const snap = await uploadBytes(ref(storage, path), blob, {
        contentType: "image/webp",
      });
      set("coverUrl", await getDownloadURL(snap.ref));
    } catch (e) {
      console.error(e);
      setError("ما نجحش رفع الصورة. تأكّد من الاتصال وعاود.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-5">
      {error && (
        <p className="rounded-input bg-danger/10 text-danger px-4 py-3 text-sm font-bold">
          {error}
        </p>
      )}
      {saved !== null && (
        <p className="rounded-input bg-success/10 text-success px-4 py-3 text-sm font-bold">
          تسجّل ✅{" "}
          {saved && (
            <a
              href={`/articles/${saved}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              شوفو
            </a>
          )}
        </p>
      )}

      <section className="rounded-card border-border bg-surface border p-4">
        <div className="flex items-center gap-3">
          <p className="text-sm font-extrabold">
            {form.id ? "تعديل مقال" : "مقال جديد"}
          </p>
          {form.id && (
            <button
              type="button"
              onClick={() => setForm(kBlank)}
              className="rounded-input border-border hover:border-primary ms-auto flex items-center gap-1.5 border px-3 py-1.5 text-xs font-bold transition-colors"
            >
              <Plus className="size-3.5" />
              جديد
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-3">
          <label className="text-xs font-bold">
            العنوان
            <input
              value={form.title}
              onChange={(e) => {
                set("title", e.target.value);
              }}
              maxLength={120}
              placeholder="كيفاش تكري دار في الجزائر بلا ما تتغلب"
              className={kField}
            />
          </label>

          <label className="text-xs font-bold">
            الرابط (لاتيني)
            <input
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              onBlur={(e) => set("slug", normaliseSlug(e.target.value))}
              dir="ltr"
              placeholder="louer-un-logement-en-algerie"
              className={`${kField} ltr-nums`}
            />
            <span className="text-dim mt-1 block text-xs font-semibold">
              /articles/{form.slug || "…"}
            </span>
          </label>

          <label className="text-xs font-bold">
            الملخّص (يبان في قوقل وفي البطاقة)
            <textarea
              value={form.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              rows={2}
              maxLength={300}
              className={kField}
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
            <div>
              <span className="bg-surface-soft rounded-input block h-24 w-full overflow-hidden">
                {form.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.coverUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </span>
              <label className="text-dim mt-1 flex cursor-pointer items-center justify-center gap-1.5 text-center text-xs font-bold">
                <ImagePlus className="size-3.5" />
                {uploading ? "راه يرفع…" : "صورة الغلاف"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickCover}
                />
              </label>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-bold">
                وصف الصورة (للـSEO وللقارئ الكفيف)
                <input
                  value={form.coverAlt}
                  onChange={(e) => set("coverAlt", e.target.value)}
                  maxLength={140}
                  className={kField}
                />
              </label>
              <label className="text-xs font-bold">
                الوسوم، مفصولة بفاصلة
                <input
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  placeholder="كراء، نصائح، الجزائر"
                  className={kField}
                />
              </label>
            </div>
          </div>

          <label className="text-xs font-bold">
            المقال
            <textarea
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              rows={18}
              className={`${kField} leading-loose`}
            />
            <span className="text-dim mt-1 block text-xs leading-relaxed font-semibold">
              سطر فارغ = فقرة جديدة · <b>##</b> عنوان فرعي · <b>-</b> نقطة ·{" "}
              <b>&gt;</b> اقتباس. ما كاش HTML، وهذا مقصود: نصّ يتحوّل لـHTML هو
              سكريبت في كل صفحة تاع الموقع.
            </span>
          </label>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={pending || uploading}
            onClick={() => save("draft")}
            className="rounded-input border-primary text-primary hover:bg-primary-soft border py-3 text-sm font-bold transition-colors disabled:opacity-50"
          >
            سجّل كمسوّدة
          </button>
          <button
            type="button"
            disabled={pending || uploading}
            onClick={() => save("published")}
            className="bg-accent rounded-input py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "راه يسجّل…" : "انشر"}
          </button>
        </div>
      </section>

      <section className="rounded-card border-border bg-surface border p-4">
        <p className="text-sm font-extrabold">كل المقالات</p>
        {articles.length === 0 ? (
          <p className="text-dim mt-2 text-xs font-semibold">ما كاش مقالات.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-border)]">
            {articles.map((article) => (
              <li
                key={article.id}
                className="flex items-center gap-3 py-2.5 text-sm"
              >
                <button
                  type="button"
                  onClick={() => setForm(formOf(article))}
                  className="hover:text-primary min-w-0 truncate text-start font-bold transition-colors"
                >
                  {article.title}
                </button>
                <span
                  className={`rounded-input ms-auto shrink-0 px-2 py-1 text-xs font-bold ${
                    article.status === "published"
                      ? "bg-success/15 text-success"
                      : "bg-surface-soft text-dim"
                  }`}
                >
                  {article.status === "published" ? "منشور" : "مسوّدة"}
                </span>
                <a
                  href={`/articles/${article.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="شوفو"
                  className="text-dim hover:text-primary shrink-0 transition-colors"
                >
                  <ExternalLink className="size-4" />
                </a>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (form.id === article.id) setForm(kBlank);
                    startTransition(async () => {
                      const res = await deleteArticle(article.id);
                      if (res.ok) router.refresh();
                      else setError(res.error);
                    });
                  }}
                  aria-label="امسح"
                  className="text-dim hover:text-danger shrink-0 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
