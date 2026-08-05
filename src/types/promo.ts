/**
 * A paid banner in the home-page carousel.
 *
 * Kept out of `listings` on purpose: these are advertising slots sold to
 * agencies, not property. They must never appear in search results, never be
 * counted against a quota, and never carry a price or a wilaya — putting them
 * in the same collection would mean excluding them from every listing query
 * forever, and one forgotten `where` would leak an advert into the results.
 */
export type Promo = {
  id: string;

  imageUrl: string;
  /** Kept so deleting the banner can delete the file rather than orphan it. */
  storagePath: string;
  /** Intrinsic size of the uploaded image, for next/image. */
  width: number;
  height: number;

  /**
   * Where the banner sends you. Validated server-side to http(s) or a
   * site-relative path — an admin panel is not a reason to let a
   * `javascript:` URL into an href.
   */
  linkUrl: string;
  /** Doubles as the alt text, so it describes the advert rather than naming it. */
  title: string;

  isActive: boolean;
  /** Ascending. Gaps are fine; only the relative order is meaningful. */
  order: number;

  createdAt: number;
  updatedAt: number;
};
