"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  addPropertyType,
  deletePropertyType,
  resetFilterSettings,
  saveFilterSettings,
} from "@/server/actions/filterSettings";
import type { FilterOption } from "@/types/filterSettings";

type Row = { slug: string; label: string; hidden: boolean; custom?: boolean };

/**
 * The site's categories: what they are called, which ones show, in what order,
 * and — for the ones an admin added — whether they exist at all.
 *
 * Arrows rather than drag-and-drop: dragging needs a library, does not work
 * with a keyboard, and is awkward on the phone this admin will half the time be
 * holding. Two buttons per row do the same job and can be tabbed to.
 */
export function FilterEditor({
  transactionTypes,
  propertyTypes,
}: {
  transactionTypes: FilterOption<string>[];
  propertyTypes: FilterOption<string>[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [deals, setDeals] = useState<Row[]>(transactionTypes);
  const [types, setTypes] = useState<Row[]>(propertyTypes);

  const [newSlug, setNewSlug] = useState("");
  const [newLabel, setNewLabel] = useState("");

  function move(rows: Row[], set: (r: Row[]) => void, i: number, by: -1 | 1) {
    const j = i + by;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
    setSaved(false);
  }

  function toggle(rows: Row[], set: (r: Row[]) => void, i: number) {
    const next = [...rows];
    next[i] = { ...next[i], hidden: !next[i].hidden };
    set(next);
    setSaved(false);
  }

  function rename(
    rows: Row[],
    set: (r: Row[]) => void,
    i: number,
    label: string,
  ) {
    const next = [...rows];
    next[i] = { ...next[i], label };
    set(next);
    setSaved(false);
  }

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await work();
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error ?? "وقع مشكل");
      }
    });
  }

  const visible = (rows: Row[]) => rows.filter((r) => !r.hidden).length;

  return (
    <div className="mt-6 space-y-8">
      <Section
        title="نوع العملية"
        note="اللي يبان في أول خانة من الفلتر. التسمية تتبدّل؛ زيادة نوع عملية جديد لا — كل عملية عندها وحدة سعر وقواعد خاصة مكتوبة في الكود."
        rows={deals}
        count={visible(deals)}
        pending={pending}
        onMove={(i, by) => move(deals, setDeals, i, by)}
        onToggle={(i) => toggle(deals, setDeals, i)}
        onRename={(i, label) => rename(deals, setDeals, i, label)}
      />

      <Section
        title="نوع العقار"
        note="اللي يبان في ثاني خانة من الفلتر، وفي فورم النشر."
        rows={types}
        count={visible(types)}
        pending={pending}
        onMove={(i, by) => move(types, setTypes, i, by)}
        onToggle={(i) => toggle(types, setTypes, i)}
        onRename={(i, label) => rename(types, setTypes, i, label)}
        onDelete={(slug) => run(() => deletePropertyType(slug))}
      />

      {error && (
        <p role="alert" className="text-danger text-sm font-bold">
          {error}
        </p>
      )}

      {saved && (
        <p
          role="status"
          className="rounded-input bg-success/10 text-success flex items-center gap-2 px-4 py-3 text-sm font-bold"
        >
          <CheckCircle2 className="size-5 shrink-0" />
          تسجّل. الفلتر تبدّل في الموقع.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() =>
            run(() =>
              saveFilterSettings({
                transactionTypes: deals,
                propertyTypes: types,
              }),
            )
          }
          disabled={pending}
          className="bg-accent rounded-input px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "…" : "سجّل"}
        </button>
        <button
          type="button"
          onClick={() => run(() => resetFilterSettings())}
          disabled={pending}
          className="rounded-input border-border text-muted hover:border-primary inline-flex items-center gap-1.5 border bg-white px-4 py-3 text-sm font-bold transition-colors disabled:opacity-40"
        >
          <RotateCcw className="size-4" />
          رجّع الافتراضي
        </button>
      </div>

      <section className="rounded-card border-border bg-surface border p-4">
        <h2 className="font-extrabold">فئة عقار جديدة</h2>
        <p className="text-dim mt-1 text-xs leading-relaxed">
          المعرّف يدخل في الرابط{" "}
          <span className="ltr-nums">/vente/…/alger</span> وفي كل إعلان يتنشر
          تحتها، وما يتبدّلش من بعد — التسمية العربية وحدها تتبدّل. حروف لاتينية
          صغيرة وأرقام وشرطات.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold">
            المعرّف
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="chalet"
              dir="ltr"
              className="rounded-input border-border focus:border-primary mt-1 block w-40 border bg-white px-3 py-2 text-sm outline-none"
            />
          </label>
          <label className="text-xs font-bold">
            التسمية
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="شاليه"
              className="rounded-input border-border focus:border-primary mt-1 block w-40 border bg-white px-3 py-2 text-sm outline-none"
            />
          </label>
          <button
            type="button"
            disabled={pending || !newSlug.trim() || !newLabel.trim()}
            onClick={() =>
              run(async () => {
                const res = await addPropertyType(newSlug, newLabel);
                if (res.ok) {
                  setNewSlug("");
                  setNewLabel("");
                }
                return res;
              })
            }
            className="rounded-input border-primary text-primary hover:bg-primary-soft inline-flex items-center gap-1.5 border px-4 py-2 text-sm font-bold transition-colors disabled:opacity-40"
          >
            <Plus className="size-4" strokeWidth={3} />
            زيد الفئة
          </button>
        </div>
      </section>

      <p className="text-dim rounded-card border-border border border-dashed p-4 text-xs leading-relaxed">
        الإخفاء يمسّ الفلتر برك. الإعلانات المنشورة في نوع مخفي تبقى تخدم،
        وروابطها ما تنكسرش، ويلقاوها الناس تحت «كل أنواع العقار» — إخفاء يخلّي
        إعلانات مدفوعة تختفي هو مشكل أكبر بزاف من خيار زايد في قائمة. والمسح ما
        يخدمش على فئة فيها إعلانات: خبّيها.
      </p>
    </div>
  );
}

function Section({
  title,
  note,
  rows,
  count,
  pending,
  onMove,
  onToggle,
  onRename,
  onDelete,
}: {
  title: string;
  note: string;
  rows: Row[];
  count: number;
  pending: boolean;
  onMove: (i: number, by: -1 | 1) => void;
  onToggle: (i: number) => void;
  onRename: (i: number, label: string) => void;
  onDelete?: (slug: string) => void;
}) {
  return (
    <section>
      <h2 className="flex items-baseline gap-2 font-extrabold">
        {title}
        <span className="text-dim ltr-nums text-xs font-bold">
          {count}/{rows.length} ظاهر
        </span>
      </h2>
      <p className="text-dim mt-1 text-xs leading-relaxed">{note}</p>

      <ul className="rounded-card border-border bg-surface mt-3 divide-y overflow-hidden border">
        {rows.map((row, i) => (
          <li
            key={row.slug}
            className={`flex items-center gap-2 px-3 py-2.5 ${
              row.hidden ? "bg-surface-soft" : ""
            }`}
          >
            <span className="ltr-nums text-dim w-6 shrink-0 text-center text-xs font-bold">
              {i + 1}
            </span>

            <span className="me-auto min-w-0">
              <input
                value={row.label}
                onChange={(e) => onRename(i, e.target.value)}
                disabled={pending}
                aria-label={`تسمية ${row.slug}`}
                className={`rounded-input border-border focus:border-primary w-36 border bg-white px-2 py-1 text-sm font-bold outline-none disabled:opacity-40 ${
                  row.hidden ? "text-dim" : ""
                }`}
              />
              <span className="text-dim ltr-nums mt-0.5 block text-[11px]">
                {row.slug}
                {row.custom ? " · مخصّصة" : ""}
              </span>
            </span>

            <button
              type="button"
              disabled={pending || i === 0}
              onClick={() => onMove(i, -1)}
              aria-label={`طلّع ${row.label}`}
              className="text-dim hover:text-primary grid size-8 place-items-center rounded-full transition-colors disabled:opacity-25"
            >
              <ChevronUp className="size-4" strokeWidth={2.6} />
            </button>
            <button
              type="button"
              disabled={pending || i === rows.length - 1}
              onClick={() => onMove(i, 1)}
              aria-label={`نزّل ${row.label}`}
              className="text-dim hover:text-primary grid size-8 place-items-center rounded-full transition-colors disabled:opacity-25"
            >
              <ChevronDown className="size-4" strokeWidth={2.6} />
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() => onToggle(i)}
              aria-pressed={!row.hidden}
              aria-label={`${row.hidden ? "ورّي" : "خبّي"} ${row.label}`}
              className={`rounded-input inline-flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 ${
                row.hidden
                  ? "border-border text-dim bg-white"
                  : "border-primary bg-primary-soft text-primary"
              }`}
            >
              {row.hidden ? (
                <EyeOff className="size-3.5" strokeWidth={3} />
              ) : (
                <Eye className="size-3.5" strokeWidth={3} />
              )}
              {row.hidden ? "مخفي" : "ظاهر"}
            </button>

            {onDelete && row.custom && (
              <button
                type="button"
                disabled={pending}
                onClick={() => onDelete(row.slug)}
                aria-label={`امسح ${row.label}`}
                className="text-danger hover:bg-danger/10 grid size-8 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
