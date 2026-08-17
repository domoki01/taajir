/**
 * The referral programme's shape.
 *
 * Two ideas carry the whole design.
 *
 * **Points are earned by a qualifying act, not by a signup.** A signup is free
 * to manufacture — a handful of SIM cards is all it takes — and a programme
 * that pays for them pays for nothing. A point is awarded when the invited
 * account publishes something that passes moderation, which costs a real phone
 * number, a real ad and a moderator's yes. What the referrer is paid for is a
 * user the marketplace actually gained.
 *
 * **Every point has a written cause.** The balance on a user document is a
 * cache; `pointsLedger` is the truth. Anything that grants or takes points
 * writes a row saying why, which is what makes a clawback possible and a
 * dispute answerable.
 */

/** What one referral is worth, and what points buy. All admin-editable. */
export type AffiliateSettings = {
  /** Points for one invited account that published and was approved. */
  perReferral: number;
  /** Extra points every time the referrer's qualified count crosses a multiple of `bonusEvery`. */
  bonusEvery: number;
  bonusPoints: number;

  /** Redemption prices, in points. */
  pointsPerListingSlot: number;
  pointsPerFeaturedWeek: number;
  /** Dinars per point, for the cash channels. */
  dinarsPerPoint: number;
  /** No payout request below this, in points. */
  minPayoutPoints: number;
  /** How many referrals one account may qualify per day, against farming. */
  dailyQualifyCap: number;

  /** Which redemption channels are open. Cash starts closed on purpose. */
  channels: {
    listingSlot: boolean;
    featured: boolean;
    redotpay: boolean;
    ccp: boolean;
  };

  /** The whole programme, off by default until an admin turns it on. */
  enabled: boolean;

  updatedAt: number;
  updatedBy: string;
};

export const kDefaultAffiliateSettings: AffiliateSettings = {
  perReferral: 100,
  bonusEvery: 10,
  bonusPoints: 200,
  pointsPerListingSlot: 100,
  pointsPerFeaturedWeek: 150,
  dinarsPerPoint: 0.5,
  minPayoutPoints: 2000,
  dailyQualifyCap: 5,
  channels: {
    listingSlot: true,
    featured: true,
    // Cash is built and shipped switched off. A public leaderboard with money
    // at the end of it is the strongest fraud magnet in this design, and it is
    // worth watching the in-kind version run first.
    redotpay: false,
    ccp: false,
  },
  enabled: false,
  updatedAt: 0,
  updatedBy: "",
};

export type LedgerReason =
  | "referral"
  | "bonus"
  | "campaign-prize"
  | "redeem-listing"
  | "redeem-featured"
  | "payout"
  | "clawback"
  | "admin";

export type LedgerEntry = {
  id: string;
  uid: string;
  /** Positive grants, negative spends. */
  delta: number;
  reason: LedgerReason;
  /** The invited account, for a referral or its clawback. */
  refUid?: string | null;
  campaignId?: string | null;
  note?: string | null;
  at: number;
};

export type PayoutChannel = "listingSlot" | "featured" | "redotpay" | "ccp";

export type PayoutStatus = "requested" | "paid" | "refused";

export type Payout = {
  id: string;
  uid: string;
  ownerName: string;
  channel: PayoutChannel;
  points: number;
  /** Only for the cash channels. */
  amountDzd?: number | null;
  /** A RedotPay id or an RIP number, as typed by the requester. */
  destination?: string | null;
  status: PayoutStatus;
  note?: string | null;
  requestedAt: number;
  settledAt?: number | null;
  settledBy?: string | null;
};

export type CampaignStatus = "draft" | "live" | "ended";

/**
 * A race, with a deadline and a prize.
 *
 * Standings are kept as a counter per entrant rather than computed on read:
 * Firestore cannot group, and the leaderboard is the page people refresh.
 * Ties break on who reached the number first, which is unambiguous and needs
 * no judgement.
 */
export type Campaign = {
  id: string;
  name: string;
  prize: string;
  startsAt: number;
  endsAt: number;
  winners: number;
  status: CampaignStatus;
  createdAt: number;
  createdBy: string;
};

export type Entrant = {
  uid: string;
  displayName: string;
  count: number;
  lastQualifiedAt: number;
  /** Set by an admin when an entry is disqualified; kept for the record. */
  disqualified?: boolean;
};
