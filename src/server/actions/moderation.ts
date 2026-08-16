"use server";

// ── MODERATION AND OWNER EDITS ───────────────────────────────────────────────
// Every state change to a listing after creation. Clients cannot write the
// collection at all, so these actions are the only way status, promotion flags
// or content ever move — and each one re-checks the caller rather than trusting
// that it was reached through the right page.

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import {
  actorWith,
  hasPermission,
  kForbidden,
  requireUser,
} from "@/server/auth";
import { priceBucket, toDinars } from "@/lib/price";
import { checkPolicy } from "@/lib/policy";
import { notifyAuthor, notifyMatchingSearches } from "@/server/push";
import type { Listing } from "@/types/listing";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Refresh the public pages a listing appears on after it changes. */
function revalidateListing(
  listing: Pick<
    Listing,
    "id" | "slug" | "transactionType" | "propertyType" | "wilayaSlug"
  >,
) {
  revalidatePath(`/annonce/${listing.id}/${listing.slug}`);
  revalidatePath(`/${listing.transactionType}`);
  revalidatePath(`/${listing.transactionType}/${listing.propertyType}`);
  revalidatePath(
    `/${listing.transactionType}/${listing.propertyType}/${listing.wilayaSlug}`,
  );
  revalidatePath("/tableau-de-bord/annonces");
}

// ── ADMIN ────────────────────────────────────────────────────────────────────

export async function approveListing(id: string): Promise<ActionResult> {
  const admin = await actorWith("listings.moderate");
  if (!admin) return { ok: false, error: kForbidden };

  const ref = adminDb().collection("listings").doc(id);

  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "الإعلان ما كاينش" };
  const listing = snap.data() as Listing;

  const now = Date.now();
  await ref.update({
    status: "published",
    // Keep the original publication date on a re-approval, so an edited ad does
    // not jump back to the top of "الأحدث" and outrank genuinely newer ones.
    publishedAt: listing.publishedAt ?? now,
    rejectionReason: null,
    moderatedBy: admin.uid,
    moderatedAt: now,
    updatedAt: now,
  });

  await writeAudit(admin.uid, "approve", id, null);
  revalidateListing({ ...listing, id });

  // The owner has been waiting on a decision they cannot see the progress of.
  await notifyAuthor(listing.ownerUid, {
    title: "إعلانك تنشر ✅",
    body: listing.title,
    url: `/annonce/${id}/${listing.slug}`,
  });

  // Approval is the moment the ad becomes visible, so it is the only honest
  // moment to announce it: on submission the content is unmoderated, and a
  // rejected ad would have been announced and then vanished. Awaited so the
  // moderator's click covers the send, but it swallows its own failures — a
  // push that did not go out must never look like an approval that did not.
  await notifyMatchingSearches({ ...listing, id, status: "published" });

  return { ok: true };
}

export async function rejectListing(
  id: string,
  reason: string,
): Promise<ActionResult> {
  const admin = await actorWith("listings.moderate");
  if (!admin) return { ok: false, error: kForbidden };

  const trimmed = reason.trim();
  if (trimmed.length < 5) {
    // A rejection with no reason is indistinguishable from the ad vanishing;
    // the owner sees this text on their dashboard.
    return { ok: false, error: "اكتب سبب الرفض باش يفهم صاحب الإعلان" };
  }

  const ref = adminDb().collection("listings").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "الإعلان ما كاينش" };
  const listing = snap.data() as Listing;

  const now = Date.now();
  await ref.update({
    status: "rejected",
    rejectionReason: trimmed,
    moderatedBy: admin.uid,
    moderatedAt: now,
    updatedAt: now,
  });

  await writeAudit(admin.uid, "reject", id, trimmed);

  // The reason travels with the notice. "Your ad was refused" on its own sends
  // someone back to the form to make the same mistake again.
  await notifyAuthor(listing.ownerUid, {
    title: "إعلانك ما تنشرش",
    body: trimmed,
    url: "/tableau-de-bord/publications",
  });
  revalidateListing({ ...listing, id });
  return { ok: true };
}

export async function setFeatured(
  id: string,
  featured: boolean,
): Promise<ActionResult> {
  const admin = await actorWith("listings.moderate");
  if (!admin) return { ok: false, error: kForbidden };

  const ref = adminDb().collection("listings").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "الإعلان ما كاينش" };

  await ref.update({ isFeatured: featured, updatedAt: Date.now() });
  await writeAudit(admin.uid, featured ? "feature" : "unfeature", id, null);
  revalidateListing({ ...(snap.data() as Listing), id });
  return { ok: true };
}

/**
 * Moderation is the one place where a mistake is expensive and invisible, so
 * every decision is recorded with who made it. Rules make adminAudit read-only
 * to clients and unreadable to non-admins.
 */
async function writeAudit(
  actorUid: string,
  action: string,
  targetId: string,
  note: string | null,
) {
  await adminDb().collection("adminAudit").add({
    actorUid,
    action,
    targetType: "listing",
    targetId,
    note,
    at: Date.now(),
  });
}

// ── OWNER ────────────────────────────────────────────────────────────────────

export type EditListingInput = {
  id: string;
  title: string;
  description: string;
  priceAmount: number;
  priceUnitInput: "dzd" | "million";
  priceOnRequest: boolean;
  isNegotiable: boolean;
  contactPhone: string;
  allowWhatsapp: boolean;
};

/**
 * Owner edits, limited to the fields that do not change what the ad *is*.
 *
 * Price, wording and contact details can be corrected freely. Location and
 * property type cannot: they decide which browse pages and URL the ad lives on,
 * and letting an approved ad silently become a different property in a different
 * wilaya is exactly the bait-and-switch moderation exists to prevent. Changing
 * those means posting a new ad.
 */
export async function editListing(
  input: EditListingInput,
): Promise<ActionResult> {
  const user = await requireUser("/tableau-de-bord/annonces");
  const ref = adminDb().collection("listings").doc(input.id);

  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "الإعلان ما كاينش" };
  const listing = snap.data() as Listing;

  const isOwner = listing.ownerUid === user.uid;
  const isStaff = hasPermission(user, "listings.moderate");
  if (!isOwner && !isStaff) return { ok: false, error: "ماشي إعلانك" };

  const title = input.title.trim();
  if (title.length < 10 || title.length > 90) {
    return { ok: false, error: "العنوان لازم بين 10 و90 حرف" };
  }
  const description = input.description.trim();
  if (description.length < 20 || description.length > 3000) {
    return { ok: false, error: "الوصف لازم بين 20 و3000 حرف" };
  }

  // The same check the create path runs. Without it, editing is the way around
  // it: publish something clean, then rewrite it into whatever was refused at
  // creation. The edit does send a published ad back for review, but a demand
  // feed reader and a search crawler both see the new text meanwhile.
  const verdict = checkPolicy({ title, description });
  if (verdict.decision === "reject") {
    return { ok: false, error: verdict.reason };
  }
  if (!/^\+?[0-9\s]{9,15}$/.test(input.contactPhone.trim())) {
    return { ok: false, error: "رقم الهاتف ماشي صحيح" };
  }

  const price = input.priceOnRequest
    ? 0
    : toDinars(input.priceAmount, input.priceUnitInput);
  if (!input.priceOnRequest && price <= 0) {
    return { ok: false, error: "اكتب سعر صحيح" };
  }

  const rental =
    listing.transactionType === "location" ||
    listing.transactionType === "vacances";

  const now = Date.now();
  await ref.update({
    title,
    description,
    price,
    priceOnRequest: input.priceOnRequest,
    isNegotiable: input.isNegotiable,
    priceBucket: priceBucket(price, rental),
    contactPhone: input.contactPhone.trim(),
    allowWhatsapp: input.allowWhatsapp,
    updatedAt: now,
    // A published ad goes back through review after an edit — otherwise
    // approval could be won with clean copy and then replaced with anything.
    // Staff edits skip that, since a moderator is already the reviewer.
    ...(listing.status === "published" && !isStaff
      ? { status: "pending", moderatedBy: null, moderatedAt: null }
      : {}),
    ...(listing.status === "rejected"
      ? { status: "pending", rejectionReason: null }
      : {}),
  });

  revalidateListing({ ...listing, id: input.id });
  return { ok: true };
}

/** Soft delete: the document stays for audit, but leaves every public query. */
export async function deleteListing(id: string): Promise<ActionResult> {
  const user = await requireUser("/tableau-de-bord/annonces");
  const db = adminDb();
  const ref = db.collection("listings").doc(id);

  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "الإعلان ما كاينش" };
  const listing = snap.data() as Listing;

  const isOwner = listing.ownerUid === user.uid;
  const isStaff = hasPermission(user, "listings.moderate");
  if (!isOwner && !isStaff) return { ok: false, error: "ماشي إعلانك" };
  if (listing.status === "archived") return { ok: true };

  // The quota counter and the status move together: decrementing outside a
  // transaction can strand a user below their real count and block posting.
  await db.runTransaction(async (tx) => {
    tx.update(ref, { status: "archived", updatedAt: Date.now() });
    tx.update(db.collection("users").doc(listing.ownerUid), {
      activeListingCount: FieldValue.increment(-1),
    });
  });

  revalidateListing({ ...listing, id });
  return { ok: true };
}

/** Owner marks the deal done. Keeps the ad readable but out of the listings. */
export async function markListingClosed(id: string): Promise<ActionResult> {
  const user = await requireUser("/tableau-de-bord/annonces");
  const ref = adminDb().collection("listings").doc(id);

  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "الإعلان ما كاينش" };
  const listing = snap.data() as Listing;
  if (
    listing.ownerUid !== user.uid &&
    !hasPermission(user, "listings.moderate")
  ) {
    return { ok: false, error: "ماشي إعلانك" };
  }

  const closed =
    listing.transactionType === "vente" ? "sold" : ("rented" as const);
  await ref.update({ status: closed, updatedAt: Date.now() });

  revalidateListing({ ...listing, id });
  return { ok: true };
}
