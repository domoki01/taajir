import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import {
  kPropertyTypes,
  kTransactionFilterLabels,
  type PropertyType,
  type TransactionType,
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
 */
export async function getFilterSettings(): Promise<FilterSettings | null> {
  try {
    const snap = await adminDb().doc(kFilterSettingsPath).get();
    return snap.exists ? (snap.data() as FilterSettings) : null;
  } catch (error) {
    console.error("[filter] settings read failed:", error);
    return null;
  }
}

/**
 * Apply an order and a hidden set to a code-defined list of options.
 *
 * Ordered slugs come first in the admin's order; everything the settings
 * document does not mention keeps its code order behind them. Slugs that no
 * longer exist in the enum are dropped rather than rendered as blanks.
 */
function resolve<T extends string>(
  labels: Record<T, string>,
  order: T[] = [],
  hidden: T[] = [],
): FilterOption<T>[] {
  const all = Object.keys(labels) as T[];
  const known = new Set(all);
  const ranked = order.filter((s) => known.has(s));
  const rest = all.filter((s) => !ranked.includes(s));
  const hiddenSet = new Set(hidden);

  return [...ranked, ...rest].map((slug) => ({
    slug,
    label: labels[slug],
    hidden: hiddenSet.has(slug),
  }));
}

export type ResolvedFilterOptions = {
  transactionTypes: FilterOption<TransactionType>[];
  propertyTypes: FilterOption<PropertyType>[];
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
  const s = await getFilterSettings();
  return {
    version: s?.updatedAt ?? 0,
    transactionTypes: resolve(
      kTransactionFilterLabels,
      s?.transactionTypeOrder,
      s?.hiddenTransactionTypes,
    ),
    propertyTypes: resolve(
      kPropertyTypes,
      s?.propertyTypeOrder,
      s?.hiddenPropertyTypes,
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
