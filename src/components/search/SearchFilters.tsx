"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MapPin, Search, X } from "lucide-react";
import {
  getCommune,
  getCommunes,
  kWilayas,
  normalize,
  type Commune,
  type Wilaya,
} from "@/lib/geo";
import { kPropertyTypes, kTransactionFilterLabels } from "@/lib/enums";
import { searchHref } from "@/lib/searchHref";
import type { FilterOption } from "@/types/filterSettings";

/**
 * The site's one filter: deal, property type, wilaya, commune.
 *
 * Deal and type are plain <select>s — four and thirteen fixed options each,
 * which is exactly what a dropdown is for, and the native control gives the
 * phone its own picker for free. The wilaya is not: it accepts a name in Arabic
 * or French *or* the wilaya number, because that is how Algerians identify a
 * wilaya in practice — "16" is Alger to everyone, and plate numbers make the
 * code more familiar than the spelling. With 69 wilayas and up to 57 communes
 * in one of them, a dropdown means scrolling a list nobody can scan; typing two
 * digits is faster than any menu.
 *
 * The two dropdown lists arrive as props rather than being read from the enums
 * here: an admin decides which options the filter offers and in what order, and
 * that decision lives in Firestore. They fall back to the full code lists so a
 * caller that has not been updated — or a failed settings read — still renders
 * a working filter.
 */
export function SearchFilters({
  initialTransaction,
  initialType,
  initialWilaya,
  initialCommune,
  transactionOptions,
  propertyOptions,
}: {
  initialTransaction?: string;
  initialType?: string;
  initialWilaya?: string;
  initialCommune?: string;
  transactionOptions?: FilterOption<string>[];
  propertyOptions?: FilterOption<string>[];
}) {
  const deals =
    transactionOptions ??
    Object.entries(kTransactionFilterLabels).map(([slug, label]) => ({
      slug,
      label,
      hidden: false,
    }));
  const types =
    propertyOptions ??
    Object.entries(kPropertyTypes).map(([slug, label]) => ({
      slug,
      label,
      hidden: false,
    }));
  const router = useRouter();

  // Seeded from the URL so landing on a filtered page shows what is filtered,
  // rather than an empty picker above results that are already narrowed.
  const seedWilaya = initialWilaya
    ? (kWilayas.find((w) => w.slug === initialWilaya) ?? null)
    : null;

  // Validated against the lists actually on offer rather than against the code
  // enums, so a category an admin added seeds the picker like any other.
  const [transaction, setTransaction] = useState(
    initialTransaction && deals.some((d) => d.slug === initialTransaction)
      ? initialTransaction
      : "",
  );
  const [propertyType, setPropertyType] = useState(
    initialType && types.some((t) => t.slug === initialType) ? initialType : "",
  );

  const [wilaya, setWilaya] = useState<Wilaya | null>(seedWilaya);
  const [commune, setCommune] = useState<Commune | null>(
    seedWilaya && initialCommune
      ? (getCommune(seedWilaya.code, initialCommune) ?? null)
      : null,
  );

  const [wilayaQuery, setWilayaQuery] = useState("");
  const [communeQuery, setCommuneQuery] = useState("");
  const [openList, setOpenList] = useState<"wilaya" | "commune" | null>(null);
  const communeInput = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  // An open list sits over everything below it, including the search button, so
  // without this a click aimed at the button lands on a commune instead.
  useEffect(() => {
    if (!openList) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpenList(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenList(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openList]);

  const wilayaMatches = useMemo(() => {
    const q = normalize(wilayaQuery);
    if (!q) return kWilayas.slice(0, 8);
    return kWilayas
      .filter(
        (w) =>
          normalize(w.nameAr).includes(q) ||
          normalize(w.nameFr).includes(q) ||
          String(w.code) === q ||
          w.aliases.some((a) => a.includes(q)),
      )
      .slice(0, 10);
  }, [wilayaQuery]);

  const communeMatches = useMemo(() => {
    if (!wilaya) return [];
    const all = getCommunes(wilaya.code);
    const q = normalize(communeQuery);
    if (!q) return all.slice(0, 12);
    return all
      .filter(
        (c) =>
          normalize(c.nameAr).includes(q) || normalize(c.nameFr).includes(q),
      )
      .slice(0, 12);
  }, [wilaya, communeQuery]);

  function chooseWilaya(w: Wilaya) {
    setWilaya(w);
    setCommune(null);
    setWilayaQuery("");
    setCommuneQuery("");
    setOpenList(null);
    // The commune is the point of the exercise, so jump straight to it.
    requestAnimationFrame(() => communeInput.current?.focus());
  }

  function submit(
    w: Wilaya | null,
    c: Commune | null,
    deal: string = transaction,
    type: string = propertyType,
  ) {
    router.push(
      searchHref({
        transactionType: deal,
        propertyType: type,
        wilayaSlug: w?.slug,
        communeSlug: c?.slug,
      }),
    );
  }

  const box =
    "rounded-input border-border w-full border bg-white px-4 py-3 text-base outline-none focus:border-primary";
  // appearance-none so the native arrow does not sit on the wrong side in RTL;
  // the chevron below is placed with a logical property instead.
  const select = `${box} appearance-none pe-10 font-semibold`;

  return (
    <div ref={root} className="space-y-2">
      {/* ── DEAL AND PROPERTY TYPE ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <label htmlFor="filter-transaction" className="sr-only">
            نوع العملية
          </label>
          <select
            id="filter-transaction"
            value={transaction}
            onChange={(e) => setTransaction(e.target.value)}
            className={select}
          >
            <option value="">بيع ولا كراء</option>
            {deals.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="text-dim pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2" />
        </div>

        <div className="relative">
          <label htmlFor="filter-type" className="sr-only">
            نوع العقار
          </label>
          <select
            id="filter-type"
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className={select}
          >
            <option value="">كل أنواع العقار</option>
            {types.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="text-dim pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2" />
        </div>
      </div>

      {/* ── WILAYA ───────────────────────────────────────────────────────── */}
      {wilaya ? (
        <div className="rounded-input border-primary bg-primary-soft flex items-center gap-2 border px-4 py-3">
          <MapPin className="text-primary size-4 shrink-0" />
          <span className="text-primary font-bold">{wilaya.nameAr}</span>
          <span className="text-primary/70 ltr-nums text-xs font-bold">
            {String(wilaya.code).padStart(2, "0")}
          </span>
          <button
            type="button"
            aria-label="غيّر الولاية"
            onClick={() => {
              setWilaya(null);
              setCommune(null);
              setOpenList("wilaya");
            }}
            className="text-primary ms-auto"
          >
            <X className="size-4" strokeWidth={3} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={wilayaQuery}
            onChange={(e) => {
              setWilayaQuery(e.target.value);
              setOpenList("wilaya");
            }}
            onFocus={() => setOpenList("wilaya")}
            inputMode="text"
            aria-label="الولاية"
            placeholder="الولاية — اكتب الاسم ولا الرقم (مثلاً 16)"
            className={box}
          />
          {openList === "wilaya" && wilayaMatches.length > 0 && (
            <ul className="rounded-card border-border shadow-soft absolute z-20 mt-1 max-h-72 w-full overflow-auto border bg-white py-1">
              {wilayaMatches.map((w) => (
                <li key={w.slug}>
                  <button
                    type="button"
                    onClick={() => chooseWilaya(w)}
                    className="hover:bg-surface-soft flex w-full items-center gap-2 px-4 py-2.5 text-start text-sm font-semibold"
                  >
                    <span className="text-dim ltr-nums w-6 shrink-0 text-xs font-bold">
                      {String(w.code).padStart(2, "0")}
                    </span>
                    <span>{w.nameAr}</span>
                    <span className="text-dim ms-auto text-xs">{w.nameFr}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── COMMUNE ──────────────────────────────────────────────────────── */}
      <div className="relative">
        <input
          ref={communeInput}
          value={commune ? commune.nameAr : communeQuery}
          onChange={(e) => {
            setCommune(null);
            setCommuneQuery(e.target.value);
            setOpenList("commune");
          }}
          onFocus={() => setOpenList("commune")}
          disabled={!wilaya}
          aria-label="البلدية"
          placeholder={wilaya ? "البلدية (اختياري)" : "اختر الولاية الأول"}
          className={`${box} disabled:opacity-50`}
        />
        {!commune && (
          <ChevronDown className="text-dim pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2" />
        )}

        {openList === "commune" && wilaya && communeMatches.length > 0 && (
          <ul className="rounded-card border-border shadow-soft absolute z-20 mt-1 max-h-72 w-full overflow-auto border bg-white py-1">
            {/* The whole wilaya is a normal thing to want, and the list opens
                on top of the search button — so the way out has to be inside
                the list rather than under it. */}
            <li>
              <button
                type="button"
                onClick={() => {
                  setCommune(null);
                  setOpenList(null);
                  submit(wilaya, null);
                }}
                className="hover:bg-surface-soft text-primary border-border w-full border-b px-4 py-2.5 text-start text-sm font-bold"
              >
                كل بلديات {wilaya.nameAr}
              </button>
            </li>
            {communeMatches.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => {
                    setCommune(c);
                    setOpenList(null);
                    // Picking a commune is the end of the sentence, so it runs
                    // the search rather than waiting for the button.
                    submit(wilaya, c);
                  }}
                  className="hover:bg-surface-soft flex w-full items-center gap-2 px-4 py-2.5 text-start text-sm font-semibold"
                >
                  <span>{c.nameAr}</span>
                  <span className="text-dim ms-auto text-xs">{c.nameFr}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => submit(wilaya, commune)}
        className="bg-accent rounded-input inline-flex w-full items-center justify-center gap-2 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        <Search className="size-4" strokeWidth={3} />
        {commune
          ? `شوف إعلانات ${commune.nameAr}`
          : wilaya
            ? `شوف إعلانات ${wilaya.nameAr}`
            : "شوف الإعلانات"}
      </button>
    </div>
  );
}
