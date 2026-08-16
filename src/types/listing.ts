import type {
  Amenity,
  Condition,
  HousingProgram,
  ListingStatus,
  Paperwork,
  PriceUnit,
  RoomCode,
  SaleForm,
  TransactionType,
} from "@/lib/enums";

/**
 * A property ad. Written only by Server Actions on the Admin SDK — see the
 * design note in firestore.rules for why clients never touch this collection.
 *
 * Fields marked "derived" are recomputed on every write from the fields above
 * them; nothing else may set them, and `scripts/reindex` can rebuild them all.
 */
export type Listing = {
  id: string;
  slug: string;

  // ── ownership ──────────────────────────────────────────────────────────────
  ownerUid: string;
  ownerType: "individual" | "agency";
  agencyId: string | null;
  /** derived — avoids a lookup per card */
  ownerName: string;
  ownerIsVerified: boolean;

  // ── classification ─────────────────────────────────────────────────────────
  transactionType: TransactionType;
  saleForm: SaleForm | null;
  /**
   * Category slug. A plain string, not the enum union: an admin can add
   * categories from /admin/filtre, so the set is decided at runtime and the
   * union would be a compile-time promise the data does not keep.
   */
  propertyType: string;
  housingProgram: HousingProgram | null;

  // ── money — always whole Algerian dinars, see lib/price.ts ─────────────────
  price: number;
  priceUnit: PriceUnit;
  priceOnRequest: boolean;
  isNegotiable: boolean;
  /** derived — the equality-class key that makes price filtering indexable */
  priceBucket: string;

  // ── physical ───────────────────────────────────────────────────────────────
  areaBuilt: number | null;
  areaLand: number | null;
  /** derived */
  areaBucket: string;
  roomsCode: RoomCode | null;
  bathrooms: number | null;
  floor: number | null;
  condition: Condition | null;
  paperwork: Paperwork | null;
  amenities: Amenity[];

  // ── location ───────────────────────────────────────────────────────────────
  wilayaCode: number;
  /** derived from the geo dataset — the URL segment */
  wilayaSlug: string;
  communeSlug: string;
  quartier: string | null;
  geo: { lat: number; lng: number } | null;

  // ── content ────────────────────────────────────────────────────────────────
  title: string;
  description: string;
  images: Array<{ url: string; w: number; h: number }>;
  /** derived — images[0], so a card needs no array access */
  coverUrl: string | null;
  /** derived — normalized tokens for array-contains-any search */
  searchTokens: string[];

  // ── contact ────────────────────────────────────────────────────────────────
  contactPhone: string | null;
  showPhone: boolean;
  allowWhatsapp: boolean;

  // ── lifecycle — server-controlled ──────────────────────────────────────────
  status: ListingStatus;
  /** Shown to the owner on their dashboard when a moderator rejects an ad. */
  rejectionReason: string | null;
  /**
   * Which policy rule sent this to the queue, or null when nothing did.
   *
   * Written by the automatic check at submission and read by the moderation
   * queue, so a moderator opens an ad already knowing what was flagged instead
   * of re-reading it looking for the problem.
   */
  policyRule?: string | null;
  /**
   * Cleared for the launch batch while `status` is still `pendingLaunch`.
   *
   * Separate from the status on purpose: an ad approved during the hold has to
   * stay invisible until the switch, and reusing `published` for "approved"
   * would put it on the site the moment a moderator clicked.
   */
  approvedForLaunch?: boolean;
  isFeatured: boolean;
  pinnedUntil: number | null;
  createdAt: number;
  publishedAt: number | null;

  // ── counters ───────────────────────────────────────────────────────────────
  viewCount: number;
};

/** What a results page needs. Keeps card rendering off the full document. */
export type ListingSummary = Pick<
  Listing,
  | "id"
  | "slug"
  | "title"
  | "price"
  | "priceUnit"
  | "priceOnRequest"
  | "propertyType"
  | "transactionType"
  | "roomsCode"
  | "areaBuilt"
  | "areaLand"
  | "wilayaSlug"
  | "communeSlug"
  | "coverUrl"
  | "isFeatured"
  | "publishedAt"
>;
