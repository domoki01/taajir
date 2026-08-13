import "server-only";

import { cache } from "react";
import { adminDb } from "@/lib/firebase/admin";
import {
  kPropertyTypes,
  kTransactionFilterLabels,
  kTransactionTypes,
} from "@/lib/enums";
import type { FilterOption, FilterSettings } from "@/types/filterSettings";

export const kFilterSettingsPath = "settings/filter";

/**
 * The filter's shape, as the admin last left it.
 *
 * Wrapped like every other read here, and for a sharper reason than usual: the
 * search filter is the first thing on the home page, and a settings read that
 * fails must fall back to the code defaults rather than leave the site with no
 * filter at all. A missing document is the normal state until an admin touches
 * the screen once.
 *
 * `cache` dedupes it per request. A page that renders twenty listing cards, a
 * filter and a breadcrumb asks for the taxonomy twenty-two times and pays for
 * one read.
 */
export const getFilterSettings = cache(
  async (): Promise<FilterSettings | null> => {
    try {
      const snap = await adminDb().doc(kFilterSettingsPath).get();
      return snap.exists ? (snap.data() as FilterSettings) : null;
    } catch (error) {
      console.error("[filter] settings read failed:", error);
      return null;
    }
  },
);

/** Latin, lowercase, no leading or trailing dash. Ends up in a URL path. */
export const kSlugPattern = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/;

/**
 * Every category the site knows about right now: the built-ins, renamed where
 * the admin renamed them, plus whatever they added.
 *
 * This — not `kPropertyTypes` — is what validation, forms, routes and the
 * sitemap must agree on. A custom category that the filter offers but the
 * router rejects is a 404 on a link the site itself printed.
 */
export type Taxonomy = {
  /** slug → label, in code order then custom order. */
  propertyTypes: Record<string, string>;
  /** Deals, worded for someone posting. Renameable, not extensible. */
  transactionTypes: Record<string, string>;
  /** The same deals, worded for someone searching. */
  transactionFilterLabels: Record<string, string>;
  /** Slugs the admin added, so the editor knows which rows it may delete. */
  customSlugs: string[];
  version: number;
};

function withLabels<T extends string>(
  base: Record<T, string>,
  overrides: Record<string, string> | undefined,
): Record<string, string> {
  const out: Record<string, string> = { ...base };
  if (!overrides) return out;
  for (const [slug, label] of Object.entries(overrides)) {
    // Only rename what exists. An override for a slug that has since left the
    // enum would otherwise resurrect it as a category with no code behind it.
    if (slug in out && typeof label === "string" && label.trim()) {
      out[slug] = label.trim();
    }
  }
  return out;
}

export const getTaxonomy = cache(async (): Promise<Taxonomy> => {
  const s = await getFilterSettings();

  const propertyTypes = withLabels(kPropertyTypes, s?.propertyLabels);
  const customSlugs: string[] = [];

  for (const c of s?.customPropertyTypes ?? []) {
    // Built-ins win a collision: a custom row that shadowed `appartement` would
    // silently rename a category that thousands of listings already point at.
    if (!c?.slug || c.slug in kPropertyTypes || !kSlugPattern.test(c.slug)) {
      continue;
    }
    propertyTypes[c.slug] = c.label?.trim() || c.slug;
    customSlugs.push(c.slug);
  }

  return {
    propertyTypes,
    transactionTypes: withLabels(kTransactionTypes, s?.transactionLabels),
    transactionFilterLabels: withLabels(
      kTransactionFilterLabels,
      s?.transactionLabels,
    ),
    customSlugs,
    version: s?.updatedAt ?? 0,
  };
});

/** The label for one slug, never blank — an unknown slug prints as itself. */
export function labelOf(map: Record<string, string>, slug: string): string {
  return map[slug] ?? slug;
}

/**
 * Apply an order and a hidden set to a resolved list of options.
 *
 * Ordered slugs come first in the admin's order; everything the settings
 * document does not mention keeps its code order behind them. Slugs that no
 * longer exist are dropped rather than rendered as blanks.
 */
function resolve(
  labels: Record<string, string>,
  order: string[] = [],
  hidden: string[] = [],
  custom: string[] = [],
): FilterOption<string>[] {
  const all = Object.keys(labels);
  const known = new Set(all);
  const ranked = order.filter((s) => known.has(s));
  const rest = all.filter((s) => !ranked.includes(s));
  const hiddenSet = new Set(hidden);
  const customSet = new Set(custom);

  return [...ranked, ...rest].map((slug) => ({
    slug,
    label: labels[slug],
    hidden: hiddenSet.has(slug),
    custom: customSet.has(slug),
  }));
}

export type ResolvedFilterOptions = {
  transactionTypes: FilterOption<string>[];
  propertyTypes: FilterOption<string>[];
  /**
   * When the settings were last written, 0 when they never were.
   *
   * The admin editor uses it as a React key. Without it, saving or resetting
   * re-renders the editor with fresh props while its useState keeps the old
   * rows — so "رجّع الافتراضي" would look like it did nothing until a full
   * page reload.
   */
  version: number;
};

/** Every option with its state — what the admin screen edits. */
export async function getAllFilterOptions(): Promise<ResolvedFilterOptions> {
  const [s, taxonomy] = await Promise.all([getFilterSettings(), getTaxonomy()]);
  return {
    version: taxonomy.version,
    transactionTypes: resolve(
      taxonomy.transactionFilterLabels,
      s?.transactionTypeOrder,
      s?.hiddenTransactionTypes,
    ),
    propertyTypes: resolve(
      taxonomy.propertyTypes,
      s?.propertyTypeOrder,
      s?.hiddenPropertyTypes,
      taxonomy.customSlugs,
    ),
  };
}

/**
 * Only the options the filter should offer, in order — what the public
 * dropdowns render.
 *
 * Hiding is a presentation decision and stops here. The slug stays valid
 * everywhere else: /vente/hangar/alger keeps resolving, an ad already
 * published as a hangar keeps its page and keeps appearing under "كل أنواع
 * العقار". A settings toggle that could make paid listings disappear would be a
 * far worse problem than one extra line in a dropdown.
 */
export async function getVisibleFilterOptions(): Promise<ResolvedFilterOptions> {
  const all = await getAllFilterOptions();
  return {
    version: all.version,
    transactionTypes: all.transactionTypes.filter((o) => !o.hidden),
    propertyTypes: all.propertyTypes.filter((o) => !o.hidden),
  };
}
