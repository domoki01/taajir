// ── DOMAIN VOCABULARY ────────────────────────────────────────────────────────
// The Algerian property market has categories a generic real-estate template
// does not: F-numbering for rooms, paperwork status as a headline filter, and
// the state housing programmes (AADL, LPP, LPA…) that people search by name.
// Keys are Latin and stable — they end up in URLs and Firestore documents.
// Labels are Arabic and may be reworded freely.

/** Kind of deal. */
export const kTransactionTypes = {
  vente: "بيع",
  location: "كراء",
  // Nightly/holiday rental is a genuinely separate market in the coastal
  // wilayas, with its own price unit — not a variant of monthly rent.
  vacances: "كراء بالليلة",
  echange: "مبادلة",
} as const;

export type TransactionType = keyof typeof kTransactionTypes;

/**
 * The same four deals, worded for someone searching rather than posting.
 *
 * A buyer and a seller are on opposite sides of one set of ads, so "شراء" is
 * not a filter value — filtering by it would ask for ads that do not exist.
 * It is named in the label because that is the word a buyer looks for.
 */
export const kTransactionFilterLabels: Record<TransactionType, string> = {
  vente: "للبيع / شراء",
  location: "للكراء",
  vacances: "كراء بالليلة",
  echange: "مبادلة",
};

/**
 * A demand, worded from the side of the person who wants something rather than
 * the person offering it.
 *
 * The slugs are the listing's own, so a request and the ads that answer it stay
 * one vocabulary: `vente` on a request means "I want to buy", which is exactly
 * what a `vente` ad offers.
 */
export const kRequestIntents = {
  vente: "نشري",
  location: "نكري",
} as const;

export type RequestIntent = keyof typeof kRequestIntents;

/** Sale form. Matters legally and to the buyer's financing. */
export const kSaleForms = {
  definitif: "بيع بالصيغة النهائية",
  vsp: "بيع على التصاميم", // Vente Sur Plan
  promotionnel: "ترقوي",
  encheres: "بيع بالمزاد",
} as const;

export type SaleForm = keyof typeof kSaleForms;

export const kPropertyTypes = {
  appartement: "شقة",
  villa: "فيلا",
  maison: "منزل",
  "niveau-villa": "مستوى في فيلا",
  studio: "استوديو",
  duplex: "دوبلكس",
  terrain: "أرض",
  "terrain-agricole": "أرض فلاحية",
  local: "محل تجاري",
  bureau: "مكتب",
  hangar: "مستودع",
  garage: "كراج",
  immeuble: "عمارة",
} as const;

export type PropertyType = keyof typeof kPropertyTypes;

/** Property types priced and searched by land area rather than built area. */
export const kLandPropertyTypes: string[] = ["terrain", "terrain-agricole"];

/**
 * Rooms use the Algerian F-nomenclature, where the number counts living rooms
 * plus bedrooms — an F3 has two bedrooms and a salon. Nobody here searches for
 * "2 bedrooms", so this is the primary control in the filter UI.
 */
export const kRoomCodes = {
  F1: "F1",
  F2: "F2",
  F3: "F3",
  F4: "F4",
  F5: "F5",
  F6: "F6",
  "F7+": "F7 وأكثر",
} as const;

export type RoomCode = keyof typeof kRoomCodes;

/**
 * Paperwork status. For an Algerian buyer this is a top-three filter, not a
 * detail: a flat with no notarised deed is a different asset at a different
 * price, and financing depends on it.
 */
export const kPaperwork = {
  "acte-notarie": "عقد موثق",
  "livret-foncier": "دفتر عقاري",
  "acte-administratif": "عقد إداري",
  "cahier-des-charges": "دفتر شروط",
  "certificat-possession": "شهادة الحيازة",
  "promesse-de-vente": "وعد بالبيع",
  "acte-non-notarie": "عقد عرفي",
  "en-cours": "بصدد التسوية",
  aucun: "بدون وثائق",
} as const;

export type Paperwork = keyof typeof kPaperwork;

/**
 * State housing programmes. Resale of AADL, LSP and social housing is legally
 * restricted for a period, so the listing form warns when one is selected.
 */
export const kHousingPrograms = {
  prive: "خاص",
  promotionnel: "ترقوي",
  aadl: "عدل (AADL)",
  lpp: "LPP",
  lpa: "LPA",
  lsp: "LSP",
  social: "اجتماعي",
} as const;

export type HousingProgram = keyof typeof kHousingPrograms;

/** Programmes whose resale is restricted — the form shows a legal warning. */
export const kRestrictedResalePrograms: string[] = ["aadl", "lsp", "social"];

export const kConditions = {
  neuf: "جديد",
  bon: "حالة جيدة",
  "a-renover": "يحتاج ترميم",
  brut: "خام",
} as const;

export type Condition = keyof typeof kConditions;

export const kAmenities = {
  ascenseur: "مصعد",
  garage: "كراج",
  jardin: "حديقة",
  terrasse: "شرفة",
  meuble: "مفروش",
  chauffage: "تدفئة",
  climatisation: "تكييف",
  "chauffe-eau": "سخان ماء",
  bache: "خزان ماء",
  securite: "أمن",
  "vue-mer": "إطلالة على البحر",
  piscine: "مسبح",
  cave: "قبو",
  fibre: "أنترنت فيبر",
  "proche-tram": "قرب الترامواي",
  "proche-ecole": "قرب مدرسة",
  "proche-commerces": "قرب المحلات",
} as const;

export type Amenity = keyof typeof kAmenities;

/** How the price is expressed. Derived from the transaction type. */
export const kPriceUnits = {
  total: "السعر الإجمالي",
  mois: "في الشهر",
  annee: "في السنة",
  nuit: "في الليلة",
  m2: "للمتر المربع",
} as const;

export type PriceUnit = keyof typeof kPriceUnits;

export function defaultPriceUnit(transaction: TransactionType): PriceUnit {
  switch (transaction) {
    case "location":
      return "mois";
    case "vacances":
      return "nuit";
    default:
      return "total";
  }
}

/** Lifecycle. Only `published` is publicly readable. */
export const kListingStatuses = {
  draft: "مسودة",
  pending: "في انتظار المراجعة",
  // Submitted while the site is held behind the pre-launch countdown. Hidden
  // from the public by the same rule as every other unpublished status, so
  // holding content costs nothing in firestore.rules.
  pendingLaunch: "محجوز للإطلاق",
  published: "منشور",
  rejected: "مرفوض",
  expired: "منتهي",
  sold: "تم البيع",
  rented: "تم الكراء",
  archived: "مؤرشف",
} as const;

export type ListingStatus = keyof typeof kListingStatuses;

/** Helper for building <select> options without repeating Object.entries. */
export function options<T extends Record<string, string>>(
  map: T,
): Array<{ value: keyof T; label: string }> {
  return Object.entries(map).map(([value, label]) => ({
    value: value as keyof T,
    label,
  }));
}
