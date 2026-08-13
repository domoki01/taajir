"use server";

// ── ADVERTISING BANNERS ──────────────────────────────────────────────────────
// The carousel on the home page. Only staff write here, and every action
// re-checks that rather than trusting it was reached through /admin — the page
// guard and the action guard protect against different mistakes.

import { revalidatePath } from "next/cache";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { actorWith, kForbidden } from "@/server/auth";
import type { Promo } from "@/types/promo";

export type PromoResult = { ok: true } | { ok: false; error: string };

const kMaxPromos = 10;

/**
 * An href built from stored text, so it gets the same treatment as any other
 * untrusted URL: `javascript:` and `data:` are executable in an href, and the
 * admin panel being staff-only is not a reason to leave that open.
 */
function safeLink(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  // A site-relative path is the common case — a banner usually points at an
  // agency's own listings on this site.
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function audit(
  actorUid: string,
  action: string,
  targetId: string,
  note: string | null,
) {
  await adminDb().collection("adminAudit").add({
    actorUid,
    action,
    targetType: "promo",
    targetId,
    note,
    at: Date.now(),
  });
}

function refreshHome() {
  revalidatePath("/");
  revalidatePath("/admin/publicites");
}

export type CreatePromoInput = {
  imageUrl: string;
  storagePath: string;
  width: number;
  height: number;
  linkUrl: string;
  title: string;
};

export async function createPromo(
  input: CreatePromoInput,
): Promise<PromoResult> {
  const admin = await actorWith("promos.manage");
  if (!admin) return { ok: false, error: kForbidden };

  const title = input.title.trim();
  if (title.length < 2) {
    // It is the alt text as well as the label, so an empty one costs a blind
    // visitor the whole slide.
    return {
      ok: false,
      error: "اكتب وصف قصير للإشهار (يستعمل كنص بديل للصورة)",
    };
  }

  const link = safeLink(input.linkUrl);
  if (!link) {
    return {
      ok: false,
      error:
        "الرابط ماشي صحيح — لازم يبدا بـ https:// ولا بـ / إذا كان داخل الموقع",
    };
  }

  if (!input.imageUrl || !input.storagePath) {
    return { ok: false, error: "ارفع صورة الإشهار" };
  }

  const db = adminDb();
  const existing = await db.collection("promos").count().get();
  if (existing.data().count >= kMaxPromos) {
    return { ok: false, error: `أقصى عدد إشهارات هو ${kMaxPromos}` };
  }

  // Appended to the end; the admin reorders afterwards.
  const last = await db
    .collection("promos")
    .orderBy("order", "desc")
    .limit(1)
    .get();
  const order = last.empty ? 0 : (last.docs[0].data().order as number) + 1;

  const now = Date.now();
  const ref = await db.collection("promos").add({
    imageUrl: input.imageUrl,
    storagePath: input.storagePath,
    width: Math.round(input.width) || 1200,
    height: Math.round(input.height) || 400,
    linkUrl: link,
    title,
    isActive: true,
    order,
    createdAt: now,
    updatedAt: now,
  });

  await audit(admin.uid, "promo.create", ref.id, title);
  refreshHome();
  return { ok: true };
}

export async function updatePromo(
  id: string,
  input: { title: string; linkUrl: string },
): Promise<PromoResult> {
  const admin = await actorWith("promos.manage");
  if (!admin) return { ok: false, error: kForbidden };

  const title = input.title.trim();
  if (title.length < 2) return { ok: false, error: "اكتب وصف قصير للإشهار" };

  const link = safeLink(input.linkUrl);
  if (!link) {
    return {
      ok: false,
      error:
        "الرابط ماشي صحيح — لازم يبدا بـ https:// ولا بـ / إذا كان داخل الموقع",
    };
  }

  await adminDb()
    .collection("promos")
    .doc(id)
    .update({ title, linkUrl: link, updatedAt: Date.now() });

  await audit(admin.uid, "promo.update", id, title);
  refreshHome();
  return { ok: true };
}

export async function setPromoActive(
  id: string,
  isActive: boolean,
): Promise<PromoResult> {
  const admin = await actorWith("promos.manage");
  if (!admin) return { ok: false, error: kForbidden };
  await adminDb()
    .collection("promos")
    .doc(id)
    .update({ isActive, updatedAt: Date.now() });

  await audit(admin.uid, isActive ? "promo.show" : "promo.hide", id, null);
  refreshHome();
  return { ok: true };
}

/**
 * Swap a banner with its neighbour.
 *
 * In a transaction because two banners sharing an `order` renders them in an
 * arbitrary sequence — which is exactly the complaint an agency that paid for
 * the first slot would make.
 */
export async function movePromo(
  id: string,
  direction: "up" | "down",
): Promise<PromoResult> {
  if (!(await actorWith("promos.manage"))) {
    return { ok: false, error: kForbidden };
  }
  const db = adminDb();

  // Outside the transaction body: Firestore retries that callback on
  // contention, and revalidating twice is pointless work.
  const result = await db.runTransaction<PromoResult>(async (tx) => {
    const all = await tx.get(db.collection("promos").orderBy("order"));
    const docs = all.docs;
    const index = docs.findIndex((d) => d.id === id);
    if (index === -1) return { ok: false, error: "الإشهار ما كاينش" };

    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= docs.length) return { ok: true };

    // Written back by position rather than by swapping the two stored values,
    // so a pair that already shares an order still comes out ordered.
    const now = Date.now();
    const reordered = [...docs];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];
    reordered.forEach((doc, i) => {
      tx.update(doc.ref, { order: i, updatedAt: now });
    });

    return { ok: true };
  });

  if (result.ok) refreshHome();
  return result;
}

export async function deletePromo(id: string): Promise<PromoResult> {
  const admin = await actorWith("promos.manage");
  if (!admin) return { ok: false, error: kForbidden };
  const db = adminDb();
  const ref = db.collection("promos").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };

  const promo = snap.data() as Promo;
  await ref.delete();

  // Best effort: an orphaned file costs pennies, a failed delete that blocks
  // removing a banner costs the admin the ability to pull a bad advert.
  if (promo.storagePath) {
    try {
      await adminStorage().bucket().file(promo.storagePath).delete();
    } catch (error) {
      console.error("[promos] could not delete the image file:", error);
    }
  }

  await audit(admin.uid, "promo.delete", id, promo.title ?? null);
  refreshHome();
  return { ok: true };
}
