"use server";

// ── PROPERTY REQUESTS ────────────────────────────────────────────────────────
// The demand side: someone posts what they are looking for, and others reply,
// optionally attaching one of their own ads.
//
// Written only here. The author name, the reply counter and — above all — the
// attached listing are derived from the session and re-checked against the
// database: a client that could write the attachment could staple its own ad's
// title to a link pointing anywhere, or advertise an ad it does not own.

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import {
  actorWith,
  getUser,
  hasPermission,
  kForbidden,
  requireUser,
} from "@/server/auth";
import { isPrelaunch } from "@/server/launch";
import { getAccessSettings, kNeedsApproval } from "@/server/access";
import { getCommune, getWilaya } from "@/lib/geo";
import { containsLink, kNoLinksMessage } from "@/lib/text";
import { checkPolicy } from "@/lib/policy";
import { notifyAuthor } from "@/server/push";
import { kMaxOpenRequests } from "@/lib/constants";
import type { Listing } from "@/types/listing";
import type { PropertyRequest, ReplyListing } from "@/types/request";

/**
 * What happened to a post, in the words the author needs to hear:
 * `live` is on the site now, `review` is waiting for a human, `held` is waiting
 * for the launch. The thank-you page cannot tell these apart on its own, and
 * telling someone their demand is "قيد المصادقة" when it is already published
 * is the sort of small lie that makes people repost.
 */
export type PostState = "live" | "review" | "held";

export type RequestResult =
  | { ok: true; id?: string; state?: PostState }
  | { ok: false; error: string; needsAuth?: boolean };

const kTitle = { min: 6, max: 90 };
const kBody = { min: 10, max: 600 };
const kReply = { min: 2, max: 800 };

type Actor =
  | { error: Extract<RequestResult, { ok: false }> }
  | { error?: never; uid: string; name: string; photo: string | null };

/**
 * Who is posting, with the display name and photo read from their profile
 * rather than taken from the request — the same rule as listing comments, and
 * for the same reason: otherwise anyone could reply as a verified agency.
 */
async function actor(): Promise<Actor> {
  const user = await getUser();
  if (!user) {
    // Signalled rather than redirected, so the form can offer a sign-in link
    // without throwing away what was typed.
    return {
      error: { ok: false, error: "لازم تسجّل الدخول", needsAuth: true },
    };
  }

  const profile =
    (await adminDb().collection("users").doc(user.uid).get()).data() ?? {};
  if (profile.isBanned) return { error: { ok: false, error: "حسابك موقّف" } };

  // Approval gates posting, and only posting — reading the feed, opening a
  // demand and signing in all stay open while the queue is worked through.
  const { requireApproval } = await getAccessSettings();
  if (requireApproval && profile.approved === false) {
    return { error: { ok: false, error: kNeedsApproval } };
  }

  return {
    uid: user.uid,
    name: (profile.displayName as string) || user.name || "مستخدم",
    photo: (profile.photoURL as string) ?? null,
  };
}

// ── REQUESTS ─────────────────────────────────────────────────────────────────

export type RequestInput = {
  intent: string;
  title: string;
  description: string;
  wilayaSlug: string;
  communeSlug: string;
};

export async function createRequest(
  input: RequestInput,
): Promise<RequestResult> {
  const who = await actor();
  if (who.error) return who.error;

  const intent =
    input.intent === "vente" || input.intent === "location"
      ? input.intent
      : null;
  if (!intent) return { ok: false, error: "اختر: نشري ولا نكري" };

  const title = input.title.trim().replace(/\s+/g, " ");
  const description = input.description.trim();

  if (title.length < kTitle.min) return { ok: false, error: "اكتب عنوان أوضح" };
  if (title.length > kTitle.max) {
    return { ok: false, error: `العنوان طويل — أقصى ${kTitle.max} حرف` };
  }
  if (description.length < kBody.min) {
    return { ok: false, error: "اكتب وصف قصير باش الناس تفهم واش تحوّس عليه" };
  }
  if (description.length > kBody.max) {
    return { ok: false, error: `الوصف طويل — أقصى ${kBody.max} حرف` };
  }
  if (containsLink(title) || containsLink(description)) {
    return { ok: false, error: kNoLinksMessage };
  }

  const wilaya = getWilaya(input.wilayaSlug);
  if (!wilaya) return { ok: false, error: "اختر الولاية" };
  const commune = input.communeSlug
    ? getCommune(wilaya.code, input.communeSlug)
    : undefined;
  if (input.communeSlug && !commune) {
    return { ok: false, error: "البلدية ماشي من هذه الولاية" };
  }

  const db = adminDb();
  // A cap, because one person posting forty demands is the feed's failure mode
  // and there is no moderation queue in front of it.
  const mine = await db
    .collection("requests")
    .where("ownerUid", "==", who.uid)
    .where("status", "==", "visible")
    .count()
    .get();
  if (mine.data().count >= kMaxOpenRequests) {
    return {
      ok: false,
      error: `عندك ${kMaxOpenRequests} طلبات مفتوحة. امسح واحد باش تزيد آخر.`,
    };
  }

  // The automatic check, before anything is written.
  //
  // A certain violation is refused here and no document is created: the author
  // is looking at the form, so they get the reason immediately and can fix it,
  // and nothing accumulates. Writing a `rejected` row per attempt would let one
  // spammer fill the collection, and `kMaxOpenRequests` counts only visible
  // demands so it would not stop them.
  const verdict = checkPolicy({ title, description });
  if (verdict.decision === "reject") {
    return { ok: false, error: verdict.reason };
  }

  const held = await isPrelaunch();

  // Clean publishes itself; uncertain waits for a human. Held demands keep
  // their verdict either way — the launch batch should not be the first time
  // anyone looks at them.
  const status =
    verdict.decision === "review"
      ? "pending"
      : held
        ? "pendingLaunch"
        : "visible";

  const now = Date.now();
  const ref = await db.collection("requests").add({
    ownerUid: who.uid,
    ownerName: who.name,
    ownerPhotoUrl: who.photo,
    intent,
    title,
    description,
    wilayaSlug: wilaya.slug,
    communeSlug: commune?.slug ?? null,
    // Held demands are invisible until the launch publishes them, the same as
    // held listings — a feed with three posts in it on opening day is worse
    // than a feed that opens full.
    status,
    hiddenReason: null,
    rejectionReason: null,
    // Why it is waiting, when it is. Read by the moderation queue so a human
    // knows what the system flagged rather than re-reading the whole post.
    policyRule: verdict.rule || null,
    // The decision was the system's, so no moderator is named. A human who
    // later rules on it stamps their own uid here.
    moderatedBy: null,
    moderatedAt: null,
    replyCount: 0,
    createdAt: now,
  } satisfies Omit<PropertyRequest, "id">);

  revalidatePath("/demandes");
  return {
    ok: true,
    id: ref.id,
    state:
      status === "visible" ? "live" : status === "pending" ? "review" : "held",
  };
}

/** The author may remove their own; staff may remove any. */
export async function deleteRequest(id: string): Promise<RequestResult> {
  const user = await requireUser("/demandes");
  const ref = adminDb().collection("requests").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };

  const mayModerate = hasPermission(user, "requests.moderate");
  if (snap.data()?.ownerUid !== user.uid && !mayModerate) {
    return { ok: false, error: "ماشي طلبك" };
  }

  // The replies are a subcollection, which a document delete does not touch —
  // left behind they are orphans no screen can reach or moderate.
  const replies = await ref.collection("replies").limit(300).get();
  await Promise.all(replies.docs.map((d) => d.ref.delete()));
  await ref.delete();

  revalidatePath("/demandes");
  return { ok: true };
}

/**
 * Staff hide rather than delete, as with comments: the decision stays
 * reviewable, which matters when the person hidden disputes it.
 */
export async function hideRequest(
  id: string,
  reason: string,
): Promise<RequestResult> {
  const user = await actorWith("requests.moderate");
  if (!user) return { ok: false, error: kForbidden };

  await adminDb()
    .collection("requests")
    .doc(id)
    .update({ status: "hidden", hiddenReason: reason.trim() || null });

  revalidatePath("/demandes");
  revalidatePath(`/demandes/${id}`);
  return { ok: true };
}

/**
 * Publish a demand the automatic check was unsure about.
 *
 * The mirror of `approveListing`. A demand that has been sitting in the queue
 * is one its author has heard nothing about, so the decision is announced
 * either way.
 */
export async function approveRequest(id: string): Promise<RequestResult> {
  const user = await actorWith("requests.moderate");
  if (!user) return { ok: false, error: kForbidden };

  const ref = adminDb().collection("requests").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "الطلب ما كاينش" };
  const request = snap.data() as PropertyRequest;

  await ref.update({
    status: "visible",
    rejectionReason: null,
    moderatedBy: user.uid,
    moderatedAt: Date.now(),
  });

  await notifyAuthor(request.ownerUid, {
    title: "طلبك تنشر ✅",
    body: request.title,
    url: `/demandes/${id}`,
  });

  revalidatePath("/demandes");
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/admin/moderation");
  return { ok: true };
}

/** Refuse a demand, with a reason its author can read and act on. */
export async function rejectRequest(
  id: string,
  reason: string,
): Promise<RequestResult> {
  const user = await actorWith("requests.moderate");
  if (!user) return { ok: false, error: kForbidden };

  const trimmed = reason.trim();
  if (trimmed.length < 5) {
    // Same rule as listings: a refusal with no reason is indistinguishable from
    // the post vanishing, and the author has no way to fix what they were not
    // told about.
    return { ok: false, error: "اكتب سبب الرفض باش يفهم صاحب الطلب" };
  }

  const ref = adminDb().collection("requests").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "الطلب ما كاينش" };
  const request = snap.data() as PropertyRequest;

  await ref.update({
    status: "rejected",
    rejectionReason: trimmed,
    moderatedBy: user.uid,
    moderatedAt: Date.now(),
  });

  await notifyAuthor(request.ownerUid, {
    title: "طلبك ما تنشرش",
    body: trimmed,
    url: "/tableau-de-bord/publications",
  });

  revalidatePath("/demandes");
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/admin/moderation");
  return { ok: true };
}

// ── REPLIES ──────────────────────────────────────────────────────────────────

export async function addReply(
  requestId: string,
  text: string,
  listingId: string | null,
): Promise<RequestResult> {
  const who = await actor();
  if (who.error) return who.error;

  const body = text.trim();
  if (body.length < kReply.min) return { ok: false, error: "اكتب تعليق" };
  if (body.length > kReply.max) {
    return { ok: false, error: `التعليق طويل — أقصى ${kReply.max} حرف` };
  }
  if (containsLink(body)) return { ok: false, error: kNoLinksMessage };

  // Refusals only, as in comments: a reply is published immediately or not at
  // all, so there is nothing for a "review" verdict to mean here.
  const verdict = checkPolicy({ title: "", description: body });
  if (verdict.decision === "reject") {
    return { ok: false, error: verdict.reason };
  }

  const db = adminDb();
  const requestRef = db.collection("requests").doc(requestId);
  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) return { ok: false, error: "الطلب ما كاينش" };

  const request = requestSnap.data() as PropertyRequest;
  if (request.status !== "visible") {
    return { ok: false, error: "ما يمكنش التعليق على هذا الطلب" };
  }

  // The attachment is re-read from the database rather than trusted: the
  // dropdown only ever offers the replier's own published ads, but the action
  // is what enforces it. Otherwise a crafted call could put anyone's ad — or a
  // draft nobody can open — under someone else's request.
  let listing: ReplyListing | null = null;
  if (listingId) {
    const adSnap = await db.collection("listings").doc(listingId).get();
    const ad = adSnap.data() as Listing | undefined;
    if (!adSnap.exists || !ad) return { ok: false, error: "الإعلان ما كاينش" };
    if (ad.ownerUid !== who.uid) {
      return { ok: false, error: "تقدر تشارك غير إعلاناتك" };
    }
    if (ad.status !== "published") {
      return { ok: false, error: "تقدر تشارك غير إعلان منشور" };
    }
    listing = {
      id: adSnap.id,
      slug: ad.slug,
      title: ad.title,
      price: ad.price,
      priceOnRequest: ad.priceOnRequest,
      coverUrl: ad.coverUrl ?? null,
    };
  }

  await requestRef.collection("replies").add({
    requestId,
    authorUid: who.uid,
    authorName: who.name,
    authorPhotoUrl: who.photo,
    isOwner: request.ownerUid === who.uid,
    text: body,
    listing,
    status: "visible",
    hiddenReason: null,
    createdAt: Date.now(),
  });

  // A counter on the parent, so a feed card showing "12 تعليق" costs no
  // subcollection read per card.
  await requestRef.update({ replyCount: FieldValue.increment(1) });

  revalidatePath(`/demandes/${requestId}`);
  revalidatePath("/demandes");
  return { ok: true };
}

/** The author may remove their own; staff may remove any. */
export async function deleteReply(
  requestId: string,
  replyId: string,
): Promise<RequestResult> {
  const user = await requireUser(`/demandes/${requestId}`);
  const db = adminDb();
  const requestRef = db.collection("requests").doc(requestId);
  const ref = requestRef.collection("replies").doc(replyId);

  const snap = await ref.get();
  if (!snap.exists) return { ok: true };

  const mayModerate = hasPermission(user, "requests.moderate");
  if (snap.data()?.authorUid !== user.uid && !mayModerate) {
    return { ok: false, error: "ماشي تعليقك" };
  }

  await ref.delete();
  await requestRef
    .update({ replyCount: FieldValue.increment(-1) })
    .catch(() => {});

  revalidatePath(`/demandes/${requestId}`);
  revalidatePath("/demandes");
  return { ok: true };
}
