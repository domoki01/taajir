"use server";

// ── SAVED SEARCHES ───────────────────────────────────────────────────────────
// "نبّهني بالإعلانات الجديدة اللي تشبه بحثي". Written here rather than from the
// client because the label and the place slugs are derived, and because these
// documents drive who gets a push — a client that could write them could
// subscribe someone else's account to anything.

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser } from "@/server/auth";
import { kMaxSavedSearches } from "@/lib/constants";
import { getCommune, getWilaya } from "@/lib/geo";
import { getTaxonomy, labelOf, type Taxonomy } from "@/server/filterSettings";

export type SavedSearchResult = { ok: true } | { ok: false; error: string };

export type SavedSearchInput = {
  transactionType: string;
  propertyType: string;
  wilayaSlug: string;
  communeSlug: string;
};

export async function createSavedSearch(
  input: SavedSearchInput,
): Promise<SavedSearchResult> {
  const user = await requireUser("/tableau-de-bord/alertes");

  const wilaya = getWilaya(input.wilayaSlug);
  if (!wilaya) {
    // Required, not optional: a placeless alert matches every ad on the site,
    // and the first flood is the last time that person leaves push enabled.
    return { ok: false, error: "اختر الولاية" };
  }

  const commune = input.communeSlug
    ? getCommune(wilaya.code, input.communeSlug)
    : undefined;
  if (input.communeSlug && !commune) {
    return { ok: false, error: "البلدية ماشي من هذه الولاية" };
  }

  // Validated against the resolved taxonomy so an alert can be saved for a
  // category the admin added — the filter offers it, so this must accept it.
  const taxonomy = await getTaxonomy();
  const transactionType =
    input.transactionType &&
    input.transactionType in taxonomy.transactionFilterLabels
      ? input.transactionType
      : null;
  const propertyType =
    input.propertyType && input.propertyType in taxonomy.propertyTypes
      ? input.propertyType
      : null;

  const db = adminDb();
  const mine = db.collection("savedSearches").where("ownerUid", "==", user.uid);
  const count = (await mine.count().get()).data().count;
  if (count >= kMaxSavedSearches) {
    return { ok: false, error: `أقصى عدد تنبيهات هو ${kMaxSavedSearches}` };
  }

  const wilayaSlug = wilaya.slug;
  const communeSlug = commune?.slug ?? null;

  // Same shape twice is the same alert; saving it again would double every push.
  const duplicate = await mine
    .where("wilayaSlug", "==", wilayaSlug)
    .where("communeSlug", "==", communeSlug)
    .get();
  if (
    duplicate.docs.some(
      (d) =>
        (d.data().transactionType ?? null) === transactionType &&
        (d.data().propertyType ?? null) === propertyType,
    )
  ) {
    return { ok: false, error: "عندك نفس التنبيه من قبل" };
  }

  await db.collection("savedSearches").add({
    ownerUid: user.uid,
    transactionType,
    propertyType,
    wilayaSlug,
    communeSlug,
    label: describeSearch(
      transactionType,
      propertyType,
      wilayaSlug,
      communeSlug,
      taxonomy,
    ),
    notify: true,
    createdAt: Date.now(),
    lastNotifiedAt: null,
    matchCount: 0,
  });

  revalidatePath("/tableau-de-bord/alertes");
  return { ok: true };
}

export async function deleteSavedSearch(
  id: string,
): Promise<SavedSearchResult> {
  const user = await requireUser("/tableau-de-bord/alertes");
  const ref = adminDb().collection("savedSearches").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };
  if (snap.data()?.ownerUid !== user.uid) {
    return { ok: false, error: "ماشي تنبيهك" };
  }

  await ref.delete();
  revalidatePath("/tableau-de-bord/alertes");
  return { ok: true };
}

/** Silence an alert without losing it — the common case after finding a place. */
export async function setSavedSearchNotify(
  id: string,
  notify: boolean,
): Promise<SavedSearchResult> {
  const user = await requireUser("/tableau-de-bord/alertes");
  const ref = adminDb().collection("savedSearches").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "التنبيه ما كاينش" };
  if (snap.data()?.ownerUid !== user.uid) {
    return { ok: false, error: "ماشي تنبيهك" };
  }

  await ref.update({ notify });
  revalidatePath("/tableau-de-bord/alertes");
  return { ok: true };
}

/**
 * "شقق للكراء في باب الزوار، الجزائر" — built once on the server so the list,
 * the confirmation and the push notification all say the same thing.
 */
function describeSearch(
  transactionType: string | null,
  propertyType: string | null,
  wilayaSlug: string,
  communeSlug: string | null,
  taxonomy: Taxonomy,
): string {
  const what = propertyType
    ? labelOf(taxonomy.propertyTypes, propertyType)
    : "عقارات";
  const deal = transactionType
    ? ` ${labelOf(taxonomy.transactionFilterLabels, transactionType)}`
    : "";

  // Not placeLabel(): that helper needs a commune and renders "، الجزائر" with
  // a stray comma when there is none, and a whole-wilaya alert is the common
  // case here.
  const wilaya = getWilaya(wilayaSlug);
  const commune =
    wilaya && communeSlug ? getCommune(wilaya.code, communeSlug) : undefined;
  const where = commune
    ? `${commune.nameAr}، ${wilaya!.nameAr}`
    : (wilaya?.nameAr ?? wilayaSlug);

  return `${what}${deal} في ${where}`;
}
