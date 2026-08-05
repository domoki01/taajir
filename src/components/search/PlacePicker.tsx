"use client";

import { useMemo, useRef, useState } from "react";
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

/**
 * Wilaya then commune, as a pair of comboboxes.
 *
 * The wilaya box accepts a name in Arabic or French *or* the wilaya number,
 * because that is how Algerians identify a wilaya in practice — "16" is Alger
 * to everyone, and plate numbers make the code more familiar than the spelling.
 * With 69 wilayas and up to 57 communes in one of them, a plain <select> means
 * scrolling a list nobody can scan; typing two digits is faster than any menu.
 */
export function PlacePicker({
  initialWilaya,
  initialCommune,
  transaction,
}: {
  initialWilaya?: string;
  initialCommune?: string;
  /** When set, results land on the canonical browse route instead of /recherche. */
  transaction?: string;
}) {
  const router = useRouter();

  // Seeded from the URL so landing on a filtered page shows what is filtered,
  // rather than an empty picker above results that are already narrowed.
  const seedWilaya = initialWilaya
    ? (kWilayas.find((w) => w.slug === initialWilaya) ?? null)
    : null;

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

  function submit(w: Wilaya | null, c: Commune | null) {
    if (!w) return;
    if (transaction) {
      // Canonical, indexable route. A commune needs a property type ahead of it
      // to keep the segment order unambiguous.
      const parts = c
        ? [transaction, "appartement", w.slug, c.slug]
        : [transaction, "appartement", w.slug];
      router.push(`/${parts.join("/")}`);
      return;
    }
    const params = new URLSearchParams({ wilaya: w.slug });
    if (c) params.set("commune", c.slug);
    router.push(`/recherche?${params}`);
  }

  const box =
    "rounded-input border-border w-full border bg-white px-4 py-3 text-base outline-none focus:border-accent";

  return (
    <div className="space-y-2">
      {/* ── WILAYA ───────────────────────────────────────────────────────── */}
      {wilaya ? (
        <div className="rounded-input border-accent bg-accent-soft flex items-center gap-2 border px-4 py-3">
          <MapPin className="text-accent size-4 shrink-0" />
          <span className="text-accent font-bold">{wilaya.nameAr}</span>
          <span className="text-accent/70 ltr-nums text-xs font-bold">
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
            className="text-accent ms-auto"
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
            {communeMatches.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => {
                    setCommune(c);
                    setOpenList(null);
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
        disabled={!wilaya}
        onClick={() => submit(wilaya, commune)}
        className="bg-accent rounded-input inline-flex w-full items-center justify-center gap-2 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <Search className="size-4" strokeWidth={3} />
        {commune
          ? `شوف إعلانات ${commune.nameAr}`
          : wilaya
            ? `شوف إعلانات ${wilaya.nameAr}`
            : "اختر الولاية"}
      </button>
    </div>
  );
}
