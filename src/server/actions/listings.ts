"use server";

// ── LISTING WRITES ───────────────────────────────────────────────────────────
// The only path that writes to `listings`. Security rules deny every client
// write to that collection, so this is not one way of creating an ad — it is
// the way, and the quota check below cannot be bypassed from a browser console.

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser } from "@/server/auth";
import { isPrelaunch } from "@/server/launch";
import { getAccessSettings, kNeedsApproval } from "@/server/access";
import { getTaxonomy } from "@/server/filterSettings";
import { checkPolicy } from "@/lib/policy";
import { getCommune, getWilaya } from "@/lib/geo";
import { areaBucket, priceBucket, toDinars } from "@/lib/price";
import {
  unitIsRental,
  type PropertyType,
  type TransactionType,
} from "@/lib/enums";
import { kMaxImages } from "@/lib/constants";
import { buildListingSlug } from "@/lib/slug";
import type { PostState } from "@/server/actions/requests";

export type CreateListingResult =
  | { ok: true; id: string; slug: string; state: PostState }
  | { ok: false; error: string };

function tokenize(text: string): string[] {
  return [
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
}

export type ListingInput = {
  transactionType: string;
  propertyType: string;
  title: string;
  description: string;
  priceAmount: number;
  priceUnitInput: "dzd" | "million";
  priceOnRequest: boolean;
  isNegotiable: boolean;
  areaBuilt: number | null;
  areaLand: number | null;
  roomsCode: string | null;
  bathrooms: number | null;
  floor: number | null;
  condition: string | null;
  paperwork: string | null;
  amenities: string[];
  wilayaSlug: string;
  communeSlug: string;
  contactPhone: string;
  allowWhatsapp: boolean;
  images: Array<{ url: string; w: number; h: number }>;
};

export async function createListing(
  input: ListingInput,
): Promise<CreateListingResult> {
  const user = await requireUser("/publier");

  // ── validate ───────────────────────────────────────────────────────────────
  // Checked against the resolved taxonomy, not the enums: an admin can add
  // categories, and a form that offers one the action rejects is a dead button.
  const taxonomy = await getTaxonomy();
  if (!(input.transactionType in taxonomy.transactionTypes)) {
    return { ok: false, error: "نوع المعاملة ماشي صحيح" };
  }
  if (!(input.propertyType in taxonomy.propertyTypes)) {
    return { ok: false, error: "نوع العقار ماشي صحيح" };
  }
  const wilaya = getWilaya(input.wilayaSlug);
  if (!wilaya) return { ok: false, error: "الولاية ماشي صحيحة" };
  if (!getCommune(wilaya.code, input.communeSlug)) {
    return { ok: false, error: "البلدية ماشي صحيحة" };
  }

  const title = input.title.trim();
  if (title.length < 10) return { ok: false, error: "العنوان قصير برك" };
  if (title.length > 90) return { ok: false, error: "العنوان طويل برك" };

  const description = input.description.trim();
  if (description.length < 20) return { ok: false, error: "الوصف قصير برك" };
  if (description.length > 3000) return { ok: false, error: "الوصف طويل برك" };

  if (!/^\+?[0-9\s]{9,15}$/.test(input.contactPhone.trim())) {
    return { ok: false, error: "رقم الهاتف ماشي صحيح" };
  }

  const price = input.priceOnRequest
    ? 0
    : toDinars(input.priceAmount, input.priceUnitInput);
  if (!input.priceOnRequest && price <= 0) {
    return { ok: false, error: "اكتب سعر صحيح" };
  }

  if (input.images.length > kMaxImages) {
    return { ok: false, error: `أقصى عدد صور هو ${kMaxImages}` };
  }

  const transactionType = input.transactionType as TransactionType;
  const propertyType = input.propertyType as PropertyType;
  // From the taxonomy, not the slug: a deal an admin added declares its own
  // unit, and the code must not need to have heard of its name.
  const priceUnit = taxonomy.transactionUnits[transactionType] ?? "total";
  const rental = unitIsRental(priceUnit);
  const area = input.areaBuilt ?? input.areaLand ?? 0;

  const id = randomUUID().replace(/-/g, "").slice(0, 12);
  const slug = buildListingSlug({
    transactionType,
    propertyType,
    roomsCode: input.roomsCode as never,
    communeSlug: input.communeSlug,
    wilayaSlug: wilaya.slug,
  });
  const now = Date.now();
  // The automatic check, before the transaction and before anything is written.
  // Same reasoning as demands: the author is on the form, so a certain
  // violation is answered inline instead of becoming a row nobody asked for.
  const verdict = checkPolicy({ title, description });
  if (verdict.decision === "reject") {
    return { ok: false, error: verdict.reason };
  }

  // Read once, outside the transaction: the launch state is site configuration
  // that changes a handful of times ever, and a transaction that also had to
  // watch it would contend on one document for every ad posted.
  const held = await isPrelaunch();

  const db = adminDb();
  const userRef = db.collection("users").doc(user.uid);
  const listingRef = db.collection("listings").doc(id);

  // ── write ──────────────────────────────────────────────────────────────────
  // Quota check and listing creation share one transaction. Reading the count
  // and then writing separately would let two parallel submissions both pass a
  // check that only one of them should.
  const { requireApproval } = await getAccessSettings();

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error("NO_USER");

      const data = snap.data()!;
      if (data.isBanned) throw new Error("BANNED");
      if (requireApproval && data.approved === false) {
        throw new Error("UNAPPROVED");
      }

      const used = (data.activeListingCount as number) ?? 0;
      const quota = (data.listingQuota as number) ?? 0;
      if (used >= quota) throw new Error("QUOTA");

      tx.set(listingRef, {
        id,
        slug,

        ownerUid: user.uid,
        ownerType: data.agencyId ? "agency" : "individual",
        agencyId: data.agencyId ?? null,
        ownerName: data.displayName ?? "مستخدم",
        ownerIsVerified: false,

        transactionType,
        saleForm: transactionType === "vente" ? "definitif" : null,
        propertyType,
        housingProgram: null,

        price,
        priceUnit,
        priceOnRequest: input.priceOnRequest,
        isNegotiable: input.isNegotiable,
        priceBucket: priceBucket(price, rental),

        areaBuilt: input.areaBuilt,
        areaLand: input.areaLand,
        areaBucket: areaBucket(area),
        roomsCode: input.roomsCode,
        bathrooms: input.bathrooms,
        floor: input.floor,
        condition: input.condition,
        paperwork: input.paperwork,
        amenities: input.amenities,

        wilayaCode: wilaya.code,
        wilayaSlug: wilaya.slug,
        communeSlug: input.communeSlug,
        quartier: null,
        geo: null,

        title,
        description,
        images: input.images,
        coverUrl: input.images[0]?.url ?? null,
        searchTokens: tokenize(
          `${title} ${input.communeSlug} ${wilaya.slug} ${wilaya.nameAr}`,
        ),

        contactPhone: input.contactPhone.trim(),
        showPhone: true,
        allowWhatsapp: input.allowWhatsapp,

        // Every new ad waits for a human. Auto-publishing is the single biggest
        // lever a scammer has on a classifieds site in its first year. While
        // the site is held, it waits for the launch as well — same invisibility,
        // a different queue.
        //
        // A clean ad now publishes itself. What still reaches a human is what
        // the policy check was unsure about, which is the only sort of ad a
        // moderator can usefully add anything to.
        status: held
          ? "pendingLaunch"
          : verdict.decision === "review"
            ? "pending"
            : "published",
        publishedAt: !held && verdict.decision === "clean" ? now : null,
        policyRule: verdict.rule || null,
        approvedForLaunch: false,
        rejectionReason: null,
        isFeatured: false,
        pinnedUntil: null,
        createdAt: now,
        updatedAt: now,
        viewCount: 0,
      });

      tx.update(userRef, { activeListingCount: FieldValue.increment(1) });
    });
  } catch (error) {
    const code = (error as Error).message;
    if (code === "QUOTA") {
      return {
        ok: false,
        error: "وصلت للحد الأقصى من الإعلانات. حيّد إعلان قديم باش تنشر جديد.",
      };
    }
    if (code === "BANNED") return { ok: false, error: "حسابك موقّف" };
    if (code === "UNAPPROVED") return { ok: false, error: kNeedsApproval };
    console.error("[listings] create failed:", error);
    return { ok: false, error: "ما نجحش النشر. عاود من جديد." };
  }

  revalidatePath("/tableau-de-bord/annonces");
  return {
    ok: true,
    id,
    slug,
    state: held ? "held" : verdict.decision === "review" ? "review" : "live",
  };
}
