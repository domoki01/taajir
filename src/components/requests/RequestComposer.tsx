"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Send, X } from "lucide-react";
import { createRequest } from "@/server/actions/requests";
import { getCommunes, kWilayas } from "@/lib/geo";
import { kRequestIntents } from "@/lib/enums";

/**
 * The "status" box at the top of the feed.
 *
 * Modelled on a social composer rather than the site's listing form on purpose:
 * someone posting a demand has nothing to upload, no price to justify and no
 * paperwork to declare. Four fields is the whole ask, and anything longer would
 * be answered by not posting at all.
 */
export function RequestComposer({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Collapsed by default. Most people arrive here to read other people's
  // demands, not to write one, and a five-field form at the top pushes the
  // whole list below the fold on a phone.
  const [open, setOpen] = useState(false);

  const [intent, setIntent] = useState<"vente" | "location">("vente");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [wilayaSlug, setWilayaSlug] = useState("");
  const [communeSlug, setCommuneSlug] = useState("");

  const communes = useMemo(() => {
    const wilaya = kWilayas.find((w) => w.slug === wilayaSlug);
    return wilaya ? getCommunes(wilaya.code) : [];
  }, [wilayaSlug]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);

    startTransition(async () => {
      const res = await createRequest({
        intent,
        title,
        description,
        wilayaSlug,
        communeSlug,
      });
      if (res.ok) {
        setTitle("");
        setDescription("");
        setCommuneSlug("");
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const field =
    "rounded-input border-border focus:border-primary w-full border bg-white px-4 py-3 text-base outline-none";
  const select = `${field} appearance-none font-semibold`;

  if (!signedIn) {
    return (
      <div className="rounded-card border-border bg-surface border p-5 text-center">
        <p className="font-bold">حاب تنشر طلب؟</p>
        <p className="text-muted mt-1 text-sm">
          سجّل الدخول وقول واش تحوّس عليه — الناس اللي عندها العقار تجاوبك.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href="/connexion?next=%2Fdemandes"
            className="bg-accent rounded-input px-5 py-2.5 text-sm font-bold text-white"
          >
            دخول
          </Link>
          <Link
            href="/inscription?next=%2Fdemandes"
            className="rounded-input border-border border bg-white px-5 py-2.5 text-sm font-bold"
          >
            حساب جديد
          </Link>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-card border-border bg-surface hover:border-primary flex w-full items-center gap-3 border border-dashed p-4 text-start transition-colors"
      >
        <span className="bg-accent grid size-9 shrink-0 place-items-center rounded-full text-white">
          <Plus className="size-5" strokeWidth={3} />
        </span>
        <span>
          <span className="block text-sm font-extrabold">انشر طلب</span>
          <span className="text-dim block text-xs">
            قول واش تحوّس عليه ووين، والناس تجاوبك.
          </span>
        </span>
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-card border-border bg-surface shadow-soft border p-5"
    >
      <div className="mb-3 flex items-center">
        <h2 className="me-auto font-extrabold">طلب جديد</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="إغلاق"
          className="text-dim hover:text-primary grid size-8 place-items-center rounded-full transition-colors"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* ── INTENT ───────────────────────────────────────────────────────────
          Two segmented buttons rather than a dropdown: it is the first decision
          and there are exactly two answers, so making it visible costs one row
          and saves a tap. */}
      <div className="border-border inline-flex overflow-hidden rounded-full border">
        {Object.entries(kRequestIntents).map(([slug, label]) => (
          <button
            key={slug}
            type="button"
            aria-pressed={intent === slug}
            onClick={() => setIntent(slug as "vente" | "location")}
            className={`px-5 py-2 text-sm font-extrabold transition-colors ${
              intent === slug
                ? "bg-primary text-white"
                : "text-muted hover:bg-surface-soft bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <label htmlFor="req-title" className="sr-only">
        العنوان
      </label>
      <input
        id="req-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={90}
        placeholder={
          intent === "vente"
            ? "مثلاً: نشري شقة F3 في باب الزوار"
            : "مثلاً: نكري شقة F2 مفروشة في حيدرة"
        }
        className={`${field} mt-3 font-bold`}
      />

      <label htmlFor="req-body" className="sr-only">
        وصف قصير
      </label>
      <textarea
        id="req-body"
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={600}
        placeholder="وصف قصير: الميزانية، عدد الغرف، الطابق، وقتاش تحتاجه…"
        className={`${field} mt-2`}
      />

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor="req-wilaya" className="sr-only">
            الولاية
          </label>
          <select
            id="req-wilaya"
            value={wilayaSlug}
            onChange={(e) => {
              setWilayaSlug(e.target.value);
              // A commune from the previous wilaya would be refused by the
              // server; clearing it is the only sane reading of the change.
              setCommuneSlug("");
            }}
            className={select}
          >
            <option value="">اختر الولاية</option>
            {kWilayas.map((w) => (
              <option key={w.slug} value={w.slug}>
                {String(w.code).padStart(2, "0")} — {w.nameAr}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="req-commune" className="sr-only">
            البلدية
          </label>
          <select
            id="req-commune"
            value={communeSlug}
            onChange={(e) => setCommuneSlug(e.target.value)}
            disabled={!wilayaSlug}
            className={`${select} disabled:opacity-50`}
          >
            <option value="">كل بلديات الولاية</option>
            {communes.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nameAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-danger mt-3 text-sm font-bold">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-accent rounded-input inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Send className="size-4" strokeWidth={2.6} />
          {pending ? "…" : "انشر الطلب"}
        </button>
        <p className="text-dim text-xs">
          ممنوع تحط روابط. ما تكتبش رقم هاتفك — الطلب يشوفه الجميع.
        </p>
      </div>
    </form>
  );
}
