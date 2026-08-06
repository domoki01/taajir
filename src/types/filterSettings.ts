import type { PropertyType, TransactionType } from "@/lib/enums";

/**
 * Which options the site's filter offers, and in what order.
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

  updatedAt: number;
  updatedBy: string;
};

/** One row as the filter and the admin screen both consume it. */
export type FilterOption<T extends string> = {
  slug: T;
  label: string;
  hidden: boolean;
};
