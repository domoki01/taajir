/**
 * The `users/{uid}` document.
 *
 * The role also lives in a custom claim on the auth token, and *that* is what
 * security rules read — a get() inside a rule costs a billable read on every
 * evaluation. This field is a mirror kept for the admin screens, which need to
 * list and search roles without reading every token. The two are written
 * together by the same Server Action; if they ever disagree, the claim wins.
 */
export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string | null;
  phone: string | null;

  /** Role id. A plain string: an admin can define new roles from /admin/roles. */
  role: string;

  /**
   * May this account publish? Only meaningful while registration approval is
   * on; absent on documents written before the feature existed, which is read
   * as approved rather than blocked.
   */
  approved?: boolean;
  agencyId: string | null;
  wilayaCode: number | null;

  /** How many published ads count against the quota right now. */
  activeListingCount: number;
  listingQuota: number;
  featuredQuota: number;

  isBanned: boolean;
  banReason: string | null;
  strikeCount: number;

  notifyOnMessage: boolean;
  notifyOnSavedSearch: boolean;
  locale: string;

  createdAt: number;
  lastSeenAt: number;
};
