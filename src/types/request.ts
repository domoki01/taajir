/**
 * A demand posted by someone looking for property — "نشري شقة F3 في باب
 * الزوار". The mirror image of a listing: the whole site is supply, and this is
 * the one place demand is visible.
 *
 * Written only by Server Actions, like everything else here: the author name is
 * denormalized from the verified session, and the reply count is a counter no
 * client may set.
 */
export type PropertyRequest = {
  id: string;

  ownerUid: string;
  /** derived from the session — never client input */
  ownerName: string;
  ownerPhotoUrl: string | null;

  /**
   * What the poster wants to do, stored with the same values a listing uses so
   * a request and the ads that answer it speak one vocabulary: `vente` here
   * means "I want to buy", which is what a `vente` ad offers.
   */
  intent: "vente" | "location";

  title: string;
  description: string;

  /** Required. A placeless demand is not a demand anyone can answer. */
  wilayaSlug: string;
  communeSlug: string | null;

  /**
   * Hidden stays readable to its author and to admins, as with comments.
   * `pendingLaunch` is a demand posted while the site was held behind the
   * countdown — invisible until the launch publishes it.
   *
   * `pending` and `rejected` come from the automatic policy check at
   * submission: clean demands go straight to `visible`, a certain violation is
   * `rejected` with a reason its author can read, and anything uncertain waits
   * as `pending` for a human. All three of the non-visible states stay readable
   * to the author, so nobody is left wondering where their post went.
   */
  status: "visible" | "hidden" | "pending" | "rejected" | "pendingLaunch";
  hiddenReason: string | null;

  /** Why it was refused — shown to the author on «منشوراتي». */
  rejectionReason: string | null;
  /** The policy rule that decided it, or "" when a human did. For the audit. */
  policyRule: string | null;
  moderatedBy: string | null;
  moderatedAt: number | null;

  /** derived — kept on the document so a feed card needs no subcollection read */
  replyCount: number;

  createdAt: number;
};

/**
 * The listing a reply carries, denormalized at write time.
 *
 * Denormalized rather than joined because a thread of twenty replies would
 * otherwise be twenty document reads, and because the reply should keep saying
 * what was offered even if the ad is later edited or taken down.
 */
export type ReplyListing = {
  id: string;
  slug: string;
  title: string;
  price: number;
  priceOnRequest: boolean;
  coverUrl: string | null;
};

/**
 * A reply under a request — someone answering "I have what you are looking
 * for", optionally with one of their own ads attached.
 *
 * Stored as `requests/{id}/replies`, deliberately NOT named `comments`: the
 * admin moderation screen runs a collection-group query over `comments`, and a
 * second collection by that name would pour request replies into a list whose
 * every link points at a listing that does not exist.
 */
export type RequestReply = {
  id: string;
  requestId: string;

  authorUid: string;
  authorName: string;
  authorPhotoUrl: string | null;
  /** True when the replier is the person who posted the request. */
  isOwner: boolean;

  text: string;
  /** The ad the replier chose to share, if any. */
  listing: ReplyListing | null;

  status: "visible" | "hidden";
  hiddenReason: string | null;

  createdAt: number;
};
