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
  /**
   * Points for publishing something of your own that goes public.
   *
   * The second way in, and the one that makes the programme worth having for
   * somebody with no friends to invite: the site wants ads, so the site pays
   * for ads. Capped per day, because the cost of an ad to its author is a
   * photo and two minutes.
   */
  pointsPerPublish: number;
  dailyPublishCap: number;
  /**
   * The most link-visit points one account may earn in a day.
   *
   * Each link already pays once per account forever, so this only bites on a
   * campaign carrying many links at once — which is exactly when a farm would
   * try to sweep them all in one sitting.
   */
  dailyLinkPoints: number;
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

  /**
   * Offer the live campaign in a dialog the moment somebody finishes signing up.
   *
   * The best moment the site has to ask for anything: they have just chosen to
   * be here, and the race is the one thing on offer that is more interesting
   * than an empty dashboard. It shows only when a campaign is actually running,
   * so leaving it on costs nothing between campaigns.
   */
  contestPopup: boolean;

  /** The whole programme, off by default until an admin turns it on. */
  enabled: boolean;

  updatedAt: number;
  updatedBy: string;
};

export const kDefaultAffiliateSettings: AffiliateSettings = {
  perReferral: 100,
  pointsPerPublish: 20,
  dailyPublishCap: 3,
  dailyLinkPoints: 100,
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
  contestPopup: true,
  enabled: false,
  updatedAt: 0,
  updatedBy: "",
};

export type LedgerReason =
  | "referral"
  | "bonus"
  | "publish"
  | "link-visit"
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
 * What someone is racing for.
 *
 * A prize is picked at the moment of entering, not handed out at the end. That
 * is the whole psychological difference between "there is a prize" and "my
 * prize" — someone who has chosen the Binance card and watched a bar fill
 * towards it is in a different relationship with the site than someone waiting
 * to see what they win.
 *
 * `stock` is real and shown. Scarcity is the only honest source of urgency
 * here, and a race with unlimited prizes is not a race.
 */
export type PrizeKind = "binance" | "playstore" | "baridimob" | "custom";

export type CampaignPrize = {
  id: string;
  kind: PrizeKind;
  /** "بطاقة Binance بـ20$" */
  label: string;
  /** One line under it. */
  detail: string;
  /** Uploaded by the admin. Null falls back to the drawn card for its kind. */
  imageUrl: string | null;
  storagePath: string | null;
  stock: number;
  claimed: number;
};

/**
 * A link the admin wants visited, and what it pays.
 *
 * Every defence this has is server-side, because a Server Action is a public
 * endpoint and the browser is the attacker's own machine:
 *
 * - `dwellSeconds` is measured between two server timestamps, so the clock
 *   being lied to is not one of the failure modes;
 * - `answer`, when set, is a word only visible on the destination page, which
 *   is the difference between proving a visit and proving a wait;
 * - the visit document's id is `{uid}__{linkId}`, so one account is paid for
 *   one link exactly once, enforced by a transaction rather than by a check.
 *
 * The load-bearing one is the last: automation buys an attacker nothing an
 * honest visitor does not also get. That leaves multiplying accounts as the
 * only scalable attack, which is what the publish gate and the ban clawback
 * are for.
 */
export type CampaignLink = {
  id: string;
  label: string;
  url: string;
  points: number;
  dwellSeconds: number;
  /** Case- and space-insensitive when checked. Null means no question. */
  answer: string | null;
  active: boolean;
};

/** One account's attempt at one link. Never deleted — it is the "once" itself. */
export type LinkVisit = {
  uid: string;
  linkId: string;
  startedAt: number;
  claimedAt: number | null;
  points: number;
  /** Wrong answers, so a brute-force on a one-word question is bounded. */
  tries: number;
};

export type PrizeClaimStatus = "requested" | "sent" | "refused";

export type PrizeClaim = {
  id: string;
  campaignId: string;
  campaignName: string;
  uid: string;
  ownerName: string;
  prizeId: string;
  prizeLabel: string;
  /** A Binance id, a Google account, or a BaridiMob number — as typed. */
  destination: string;
  points: number;
  status: PrizeClaimStatus;
  note: string | null;
  requestedAt: number;
  settledAt: number | null;
  settledBy: string | null;
};

/**
 * A race: a deadline, a shelf of prizes, and a line to cross.
 *
 * Standings are kept as a counter per entrant rather than computed on read:
 * Firestore cannot group, and the leaderboard is the page people refresh.
 * Ties break on who reached the number first, which is unambiguous and needs
 * no judgement.
 *
 * Prizes and links are stored on the campaign document rather than in
 * subcollections. There are a handful of each, they are always read together
 * with the campaign, and editing them as one array is what lets the admin
 * screen save the whole race in one write.
 */
export type Campaign = {
  id: string;
  name: string;
  /** The old single-line prize text, kept as the headline above the shelf. */
  prize: string;
  startsAt: number;
  endsAt: number;
  /**
   * Points that unlock a prize.
   *
   * A leaderboard alone tells everyone below the top three that they have
   * already lost. A line to cross gives every entrant a target they control,
   * and turns the leaderboard from a verdict into a race worth staying in.
   */
  prizeThreshold: number;
  /** How many entrants may claim in total, across all prizes. */
  winners: number;
  prizes: CampaignPrize[];
  links: CampaignLink[];
  status: CampaignStatus;
  createdAt: number;
  createdBy: string;
};

export type Entrant = {
  uid: string;
  displayName: string;
  /** Points earned **inside this campaign**, which is what the board ranks. */
  points: number;
  /** Qualified referrals, kept separately because it reads well on the board. */
  referrals: number;
  lastPointAt: number;
  joinedAt: number;
  /** The prize this entrant is racing for. */
  prizeId: string | null;
  /** When they crossed the threshold. Null until they do. */
  unlockedAt: number | null;
  claimedAt: number | null;
  /** Set by an admin when an entry is disqualified; kept for the record. */
  disqualified?: boolean;
};

/**
 * What the sign-up dialog needs to make an offer worth reading.
 *
 * A flattened, read-only view of a live campaign rather than the campaign
 * itself: the dialog shows three cards and a number, and shipping the whole
 * document — every link, every answer to every mission — to a browser that only
 * needs the shelf would hand an entrant the questions before the race starts.
 */
export type ContestInvite = {
  campaignId: string;
  name: string;
  prize: string;
  threshold: number;
  endsAt: number;
  prizes: {
    id: string;
    kind: PrizeKind;
    label: string;
    detail: string;
    imageUrl: string | null;
    soldOut: boolean;
  }[];
};
