// ── GEOGRAPHY ────────────────────────────────────────────────────────────────
// Lookups over the committed dataset in src/data/geo. Everything keys off the
// SLUG, not the numeric code: Algeria renumbered its wilayas in 2026 and may do
// so again, but "bab-ezzouar" stays "bab-ezzouar" — which keeps URLs and any
// SEO equity attached to them stable across administrative reshuffles.

import communesByWilaya from "@/data/geo/communes.json";
import {
  kWilayaByCode,
  kWilayaBySlug,
  kWilayas,
  type Wilaya,
} from "@/data/geo/wilayas";

export type { Wilaya };
export { kWilayas };

export type Commune = {
  slug: string;
  nameAr: string;
  nameFr: string;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
};

const communes = communesByWilaya as Record<string, Commune[]>;

export function getWilaya(slugOrCode: string | number): Wilaya | undefined {
  return typeof slugOrCode === "number"
    ? kWilayaByCode.get(slugOrCode)
    : kWilayaBySlug.get(slugOrCode);
}

export function getCommunes(wilayaCode: number): Commune[] {
  return communes[String(wilayaCode)] ?? [];
}

export function getCommune(
  wilayaCode: number,
  communeSlug: string,
): Commune | undefined {
  return getCommunes(wilayaCode).find((c) => c.slug === communeSlug);
}

/**
 * "bab-ezzouar، الجزائر" — the Arabic commune name where we have it, falling
 * back to a de-slugged form. Printing the raw Latin slug inside Arabic prose
 * looks broken and reads worse, so the lookup is worth the pass over the list.
 */
export function placeLabel(wilayaSlug: string, communeSlug: string): string {
  const wilaya = getWilaya(wilayaSlug);
  const commune = wilaya ? getCommune(wilaya.code, communeSlug) : undefined;
  const communeName = commune?.nameAr ?? communeSlug.replace(/-/g, " ");
  return wilaya ? `${communeName}، ${wilaya.nameAr}` : communeName;
}

/**
 * Wilayas people actually search for, ordered by population weight rather than
 * by code, so the home page shortcuts are useful instead of alphabetical.
 */
export const kFeaturedWilayaSlugs = [
  "alger",
  "oran",
  "constantine",
  "setif",
  "annaba",
  "blida",
  "tizi-ouzou",
  "batna",
] as const;

export function getFeaturedWilayas(): Wilaya[] {
  return kFeaturedWilayaSlugs
    .map((slug) => kWilayaBySlug.get(slug))
    .filter((w): w is Wilaya => w !== undefined);
}

/**
 * Match a free-text query against wilaya names in either language, plus the
 * alias list — which carries the pre-2026 parent name, so someone typing
 * "M'sila" still finds Bou Saâda after it was split off.
 */
export function searchWilayas(query: string, limit = 8): Wilaya[] {
  const q = normalize(query);
  if (!q) return [];
  return kWilayas
    .filter(
      (w) =>
        normalize(w.nameFr).includes(q) ||
        normalize(w.nameAr).includes(q) ||
        w.aliases.some((a) => a.includes(q)),
    )
    .slice(0, limit);
}

/**
 * Fold a string for comparison: strip Arabic diacritics, unify the alef and
 * yaa/taa-marbuta variants people type inconsistently, and drop French accents.
 * Without this, "الجزائر" typed as "الجزاير" finds nothing.
 */
export function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Latin accents
    .replace(/[ً-ْـ]/g, "") // Arabic diacritics and tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/['’`]/g, "");
}
