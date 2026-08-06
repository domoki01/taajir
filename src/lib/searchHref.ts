/**
 * The URL for a set of filters.
 *
 * Prefers the canonical `/vente/appartement/alger/bab-ezzouar` route: it is
 * indexable, cached, and the one a shared link should land on. That shape can
 * only carry a *specific* deal and type though — there is no path segment
 * meaning "any" — so a partial selection falls back to `/recherche`, which can
 * express anything and is noindex for exactly that reason.
 *
 * Lives here rather than in the filter component because saved-search alerts
 * link to the same results, and two copies of this rule would drift into two
 * different URLs for one search.
 */
export function searchHref(filters: {
  transactionType?: string | null;
  propertyType?: string | null;
  wilayaSlug?: string | null;
  communeSlug?: string | null;
}): string {
  const deal = filters.transactionType || "";
  const type = filters.propertyType || "";
  const wilaya = filters.wilayaSlug || "";
  const commune = wilaya ? filters.communeSlug || "" : "";

  if (deal && (type || !wilaya)) {
    const parts = [deal];
    if (type) parts.push(type);
    if (wilaya) parts.push(wilaya);
    if (commune) parts.push(commune);
    return `/${parts.join("/")}`;
  }

  const params = new URLSearchParams();
  if (deal) params.set("transaction", deal);
  if (type) params.set("type", type);
  if (wilaya) params.set("wilaya", wilaya);
  if (commune) params.set("commune", commune);
  return `/recherche${params.size ? `?${params}` : ""}`;
}
