import type { PropertyType, TransactionType } from "@/lib/enums";

/** A category an admin added, on top of the ones that ship with the code. */
export type CustomPropertyType = {
  /** Latin, `^[a-z0-9-]+$`, unique. Lands in URLs and in every listing document. */
  slug: string;
  label: string;
};

/**
 * Which options the site's filter offers, in what order, and under what names.
 *
 * Stored as *deviations* from the code defaults rather than as the full list.
 * That is the whole design: a property type added to `kPropertyTypes` later
 * shows up on its own, visible, at the end — instead of silently missing
 * because a settings document written months earlier never heard of it.
 */
export type FilterSettings = {
  /** Slugs the admin switched off. Everything else is shown. */
  hiddenPropertyTypes: PropertyType[];
  hiddenTransactionTypes: TransactionType[];

  /**
   * Slugs in the admin's order. Anything absent keeps its code order and
   * follows behind, so a partial list is a valid list.
   */
  propertyTypeOrder: PropertyType[];
  transactionTypeOrder: TransactionType[];

  /**
   * Renamed categories, slug → Arabic label.
   *
   * Only the label moves. The slug is in every URL and every listing document,
   * so changing it is a migration and a pile of dead links; changing what it is
   * *called* is free and is what an admin actually wants when they say the
   * wording is wrong.
   */
  propertyLabels?: Record<string, string>;
  transactionLabels?: Record<string, string>;

  /** Categories the admin invented. Deals are not extensible — see the editor. */
  customPropertyTypes?: CustomPropertyType[];

  updatedAt: number;
  updatedBy: string;
};

/** One row as the filter and the admin screen both consume it. */
export type FilterOption<T extends string> = {
  slug: T;
  label: string;
  hidden: boolean;
  /** Added by an admin, so it may be renamed freely and deleted when unused. */
  custom?: boolean;
};
