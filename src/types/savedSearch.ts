import type { TransactionType } from "@/lib/enums";

/**
 * A standing search a user asked to be told about.
 *
 * The wilaya is required and the commune optional, which is how people actually
 * describe what they are after ("شقة للكراء في باب الزوار"). A search with no
 * place would match every ad on the platform and turn the alert into spam that
 * gets notifications switched off for good.
 */
export type SavedSearch = {
  id: string;
  ownerUid: string;

  transactionType: TransactionType | null;
  propertyType: string | null;
  wilayaSlug: string;
  communeSlug: string | null;

  /** Arabic summary, built server-side so the list and the push agree. */
  label: string;
  /** Off keeps the search saved but silent. */
  notify: boolean;

  createdAt: number;
  lastNotifiedAt: number | null;
  matchCount: number;
};
