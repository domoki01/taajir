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

  role: "user" | "agency" | "moderator" | "admin";
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
