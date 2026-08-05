"use server";

// ── COMMENTS ─────────────────────────────────────────────────────────────────
// Written only here, for the same reason listings are: the author's name and
// photo are denormalized onto each comment, and if a client could supply them
// anyone could post as a verified agency. The session decides who you are.

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getUser, requireUser } from "@/server/auth";
import type { Listing } from "@/types/listing";

export type CommentResult =
  { ok: true } | { ok: false; error: string; needsAuth?: boolean };

const kMinLength = 2;
const kMaxLength = 1000;

/** Posting requires an account — the whole point of the feature request. */
export async function addComment(
  listingId: string,
  text: string,
): Promise<CommentResult> {
  const user = await getUser();
  if (!user) {
    // Signalled rather than redirected: the form can then point at the sign-in
    // page while keeping what was typed.
    return { ok: false, error: "لازم تسجّل الدخول باش تعلّق", needsAuth: true };
  }

  const body = text.trim();
  if (body.length < kMinLength) return { ok: false, error: "اكتب تعليق" };
  if (body.length > kMaxLength) {
    return { ok: false, error: `التعليق طويل — أقصى ${kMaxLength} حرف` };
  }

  const db = adminDb();
  const listingRef = db.collection("listings").doc(listingId);
  const listingSnap = await listingRef.get();
  if (!listingSnap.exists) return { ok: false, error: "الإعلان ما كاينش" };

  const listing = listingSnap.data() as Listing;
  // Commenting on an unpublished ad would leak that it exists, and there is
  // nothing to discuss on one nobody can see.
  if (listing.status !== "published") {
    return { ok: false, error: "ما يمكنش التعليق على هذا الإعلان" };
  }

  const userSnap = await db.collection("users").doc(user.uid).get();
  const profile = userSnap.data() ?? {};
  if (profile.isBanned) return { ok: false, error: "حسابك موقّف" };

  const now = Date.now();
  await listingRef.collection("comments").add({
    listingId,
    authorUid: user.uid,
    authorName: (profile.displayName as string) || user.name || "مستخدم",
    authorPhotoUrl: (profile.photoURL as string) ?? null,
    isOwner: listing.ownerUid === user.uid,
    text: body,
    status: "visible",
    hiddenReason: null,
    createdAt: now,
    editedAt: null,
  });

  revalidatePath(`/annonce/${listingId}/${listing.slug}`);
  return { ok: true };
}

/** The author may remove their own; admins may remove any. */
export async function deleteComment(
  listingId: string,
  commentId: string,
): Promise<CommentResult> {
  const user = await requireUser();
  const db = adminDb();
  const ref = db
    .collection("listings")
    .doc(listingId)
    .collection("comments")
    .doc(commentId);

  const snap = await ref.get();
  if (!snap.exists) return { ok: true };

  const comment = snap.data()!;
  const isStaff = user.role === "admin" || user.role === "moderator";
  if (comment.authorUid !== user.uid && !isStaff) {
    return { ok: false, error: "ماشي تعليقك" };
  }

  await ref.delete();

  const listing = (await db.collection("listings").doc(listingId).get()).data();
  if (listing) revalidatePath(`/annonce/${listingId}/${listing.slug}`);
  return { ok: true };
}

/**
 * Admins hide rather than delete: a hidden comment stays available if the
 * decision is ever questioned, which matters when the person hidden is a paying
 * agency.
 */
export async function hideComment(
  listingId: string,
  commentId: string,
  reason: string,
): Promise<CommentResult> {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "moderator") {
    return { ok: false, error: "ماشي من صلاحياتك" };
  }

  const db = adminDb();
  await db
    .collection("listings")
    .doc(listingId)
    .collection("comments")
    .doc(commentId)
    .update({ status: "hidden", hiddenReason: reason.trim() || null });

  const listing = (await db.collection("listings").doc(listingId).get()).data();
  if (listing) revalidatePath(`/annonce/${listingId}/${listing.slug}`);
  return { ok: true };
}
