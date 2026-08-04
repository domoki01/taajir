// ── SEED ─────────────────────────────────────────────────────────────────────
// Writes sample listings so the browse pages have something to show.
//
//   npm run seed              → live project, needs FIREBASE_SERVICE_ACCOUNT_JSON
//   npm run seed -- --emulator → local Firestore emulator, no credentials
//
// It has to go through the Admin SDK because security rules deny every client
// write to `listings` — which is the point of the design, not an obstacle to
// work around.

import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const useEmulator = process.argv.includes("--emulator");
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "newmokit";

if (useEmulator) {
  // Must be the SAME project id the app initializes with: the emulator keeps a
  // separate document namespace per project, so seeding under a different id
  // writes data the app will never see — and it fails silently, as an empty
  // result set rather than an error.
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  initializeApp({ projectId });
} else {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set.\n" +
        "Firebase Console → Project settings → Service accounts → Generate new\n" +
        "private key, then put the JSON on one line in .env.local.\n" +
        "Or run against the emulator: npm run seed -- --emulator",
    );
    process.exit(1);
  }
  const json = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  initializeApp({ credential: cert(JSON.parse(json)), projectId });
}

const db = getFirestore();

// ── HELPERS ──────────────────────────────────────────────────────────────────
// Duplicated from src/lib rather than imported: this script runs as plain ESM
// under node, with no bundler to resolve the "@/" alias. The bucket edges must
// stay in step with src/lib/price.ts — tests/unit/price.test.ts pins them.

const kSaleBuckets = [
  0, 2_000_000, 4_000_000, 6_000_000, 8_000_000, 12_000_000, 20_000_000,
  35_000_000, 60_000_000,
];
const kRentBuckets = [
  0, 15_000, 25_000, 35_000, 50_000, 80_000, 120_000, 200_000,
];
const kAreaBuckets = [0, 50, 70, 90, 120, 160, 250, 500];

const bucketIndex = (value, edges) => {
  let i = 0;
  while (i + 1 < edges.length && value >= edges[i + 1]) i++;
  return i;
};

const isRental = (t) => t === "location" || t === "vacances";
const priceBucket = (dzd, rental) =>
  `${rental ? "r" : "s"}_${bucketIndex(dzd, rental ? kRentBuckets : kSaleBuckets)}`;
const areaBucket = (m2) => `a_${bucketIndex(m2 ?? 0, kAreaBuckets)}`;

const tokenize = (text) =>
  [
    ...new Set(
      text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[ً-ْـ]/g, "")
        .replace(/[أإآٱ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length >= 3),
    ),
  ].slice(0, 40);

// ── SAMPLE LISTINGS ──────────────────────────────────────────────────────────
// Real communes, plausible prices, and paperwork values that reflect how these
// properties are actually advertised in Algeria.

const samples = [
  {
    slug: "kira-appartement-f3-bab-ezzouar",
    title: "شقة F3 للكراء في باب الزوار، قريبة من الترامواي",
    description:
      "شقة F3 في الطابق الثالث بعمارة نظيفة في باب الزوار، مساحتها 85 م².\nصالون وغرفتين ومطبخ مجهّز وحمّام. الشقة مشمّسة وهادئة، قريبة من محطة الترامواي والمحلات.\nالكراء 45.000 دج في الشهر، مع ضمان ثلاثة أشهر.",
    transactionType: "location",
    propertyType: "appartement",
    price: 45_000,
    priceUnit: "mois",
    areaBuilt: 85,
    roomsCode: "F3",
    bathrooms: 1,
    floor: 3,
    condition: "bon",
    paperwork: null,
    amenities: ["ascenseur", "chauffage", "proche-tram", "proche-commerces"],
    wilayaCode: 16,
    wilayaSlug: "alger",
    communeSlug: "bab-ezzouar",
    contactPhone: "+213555000001",
  },
  {
    slug: "vente-villa-oran-bir-el-djir",
    title: "فيلا للبيع في بئر الجير، وهران — 3 مستويات مع حديقة",
    description:
      "فيلا على ثلاثة مستويات في بئر الجير، مساحة الأرض 240 م² والمبني 320 م².\nخمس غرف، ثلاثة حمّامات، مطبخ واسع، كراج لسيارتين وحديقة أمامية.\nالوثائق كاملة: عقد موثق ودفتر عقاري. السعر قابل للتفاوض.",
    transactionType: "vente",
    propertyType: "villa",
    price: 38_000_000,
    priceUnit: "total",
    areaBuilt: 320,
    areaLand: 240,
    roomsCode: "F5",
    bathrooms: 3,
    condition: "bon",
    paperwork: "acte-notarie",
    amenities: ["garage", "jardin", "terrasse", "climatisation", "securite"],
    wilayaCode: 31,
    wilayaSlug: "oran",
    communeSlug: "bir-el-djir",
    isNegotiable: true,
    contactPhone: "+213555000002",
  },
  {
    slug: "vente-terrain-setif-el-eulma",
    title: "أرض للبيع في العلمة، سطيف — 200 م² صالحة للبناء",
    description:
      "قطعة أرض 200 م² في العلمة، واجهة 10 أمتار على طريق معبّد.\nصالحة للبناء، الماء والكهرباء والصرف الصحي على الحدود.\nشهادة حيازة، والتسوية جارية عند البلدية.",
    transactionType: "vente",
    propertyType: "terrain",
    price: 5_500_000,
    priceUnit: "total",
    areaLand: 200,
    paperwork: "certificat-possession",
    amenities: [],
    wilayaCode: 19,
    wilayaSlug: "setif",
    communeSlug: "el-eulma",
    isNegotiable: true,
    contactPhone: "+213555000003",
  },
  {
    slug: "kira-local-commercial-constantine",
    title: "محل تجاري للكراء في وسط قسنطينة، 45 م²",
    description:
      "محل تجاري 45 م² في شارع تجاري بوسط قسنطينة، واجهة زجاجية كبيرة.\nمناسب للملابس أو الخدمات. ماء وكهرباء وحمّام داخلي.\nالكراء 60.000 دج شهرياً.",
    transactionType: "location",
    propertyType: "local",
    price: 60_000,
    priceUnit: "mois",
    areaBuilt: 45,
    condition: "bon",
    paperwork: null,
    amenities: ["proche-commerces"],
    wilayaCode: 25,
    wilayaSlug: "constantine",
    communeSlug: "constantine",
    contactPhone: "+213555000004",
  },
  {
    slug: "vente-appartement-f2-alger-centre",
    title: "شقة F2 للبيع في الجزائر الوسطى، 62 م²",
    description:
      "شقة F2 مساحتها 62 م² في الطابق الثاني بعمارة قديمة مرمّمة في الجزائر الوسطى.\nغرفة وصالون ومطبخ وحمّام. قريبة من كل شيء: النقل، المدارس والمحلات.\nعقد موثق، الشقة خالية وجاهزة.",
    transactionType: "vente",
    propertyType: "appartement",
    price: 19_000_000,
    priceUnit: "total",
    areaBuilt: 62,
    roomsCode: "F2",
    bathrooms: 1,
    floor: 2,
    condition: "bon",
    paperwork: "acte-notarie",
    amenities: ["proche-ecole", "proche-commerces", "chauffe-eau"],
    wilayaCode: 16,
    wilayaSlug: "alger",
    communeSlug: "alger-centre",
    contactPhone: "+213555000005",
  },
];

// ── WRITE ────────────────────────────────────────────────────────────────────

const now = Date.now();
const batch = db.batch();

samples.forEach((sample, index) => {
  const id = `seed-${index + 1}`;
  const rental = isRental(sample.transactionType);
  const area = sample.areaBuilt ?? sample.areaLand ?? null;

  batch.set(db.collection("listings").doc(id), {
    id,
    slug: sample.slug,

    ownerUid: "seed-owner",
    ownerType: "individual",
    agencyId: null,
    ownerName: "مالك",
    ownerIsVerified: false,

    transactionType: sample.transactionType,
    saleForm: sample.transactionType === "vente" ? "definitif" : null,
    propertyType: sample.propertyType,
    housingProgram: null,

    price: sample.price,
    priceUnit: sample.priceUnit,
    priceOnRequest: false,
    isNegotiable: sample.isNegotiable ?? false,
    priceBucket: priceBucket(sample.price, rental),

    areaBuilt: sample.areaBuilt ?? null,
    areaLand: sample.areaLand ?? null,
    areaBucket: areaBucket(area),
    roomsCode: sample.roomsCode ?? null,
    bathrooms: sample.bathrooms ?? null,
    floor: sample.floor ?? null,
    condition: sample.condition ?? null,
    paperwork: sample.paperwork ?? null,
    amenities: sample.amenities,

    wilayaCode: sample.wilayaCode,
    wilayaSlug: sample.wilayaSlug,
    communeSlug: sample.communeSlug,
    quartier: null,
    geo: null,

    title: sample.title,
    description: sample.description,
    // No photos yet: image upload arrives with the posting form, and the card
    // and detail page both render a placeholder rather than a broken image.
    images: [],
    coverUrl: null,
    searchTokens: tokenize(
      `${sample.title} ${sample.communeSlug} ${sample.wilayaSlug}`,
    ),

    contactPhone: sample.contactPhone,
    showPhone: true,
    allowWhatsapp: true,

    status: "published",
    isFeatured: index === 0,
    pinnedUntil: null,
    createdAt: now - index * 3_600_000,
    publishedAt: now - index * 3_600_000,

    viewCount: 0,
  });
});

await batch.commit();
console.log(
  `> seeded ${samples.length} listings into ${useEmulator ? "the emulator" : projectId}`,
);
process.exit(0);
