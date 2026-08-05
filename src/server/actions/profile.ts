"use server";

// ── OWN PROFILE ──────────────────────────────────────────────────────────────
// The fields a user may change about themselves. Everything that decides what
// they are allowed to *do* — role, quota, ban state, counters — is absent here
// on purpose and denied by firestore.rules as well.

import { revalidatePath } from "next/cache";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireUser } from "@/server/auth";
import { getWilaya } from "@/lib/geo";

export type ProfileResult = { ok: true } | { ok: false; error: string };

export type ProfileInput = {
  displayName: string;
  phone: string;
  wilayaSlug: string;
  notifyOnMessage: boolean;
  notifyOnSavedSearch: boolean;
};

/**
 * Algerian mobiles are 05/06/07 plus eight digits. Landlines are 0 plus eight.
 * Accepts the +213 form too, since that is what a phone's contact card gives
 * you, and stores the local form because that is what a caller dials.
 */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[\s.\-()]/g, "");
  if (!digits) return "";
  const local = digits.startsWith("+213")
    ? `0${digits.slice(4)}`
    : digits.startsWith("00213")
      ? `0${digits.slice(5)}`
      : digits;
  if (!/^0(5|6|7)\d{8}$/.test(local) && !/^0\d{8}$/.test(local)) return null;
  return local;
}

export async function updateMyProfile(
  input: ProfileInput,
): Promise<ProfileResult> {
  const user = await requireUser("/tableau-de-bord/profil");

  const displayName = input.displayName.trim();
  if (displayName.length < 2) {
    return { ok: false, error: "اكتب اسمك ولا اسم الوكالة" };
  }
  if (displayName.length > 60) {
    return { ok: false, error: "الاسم طويل بزاف" };
  }

  const phone = normalizePhone(input.phone);
  if (phone === null) {
    return { ok: false, error: "رقم الهاتف ماشي صحيح — مثال: 0555 12 34 56" };
  }

  // The slug is the identifier, not the number: wilaya codes moved with the
  // 2026 reorganisation and will move again.
  let wilayaCode: number | null = null;
  if (input.wilayaSlug) {
    const wilaya = getWilaya(input.wilayaSlug);
    if (!wilaya) return { ok: false, error: "الولاية ماشي معروفة" };
    wilayaCode = wilaya.code;
  }

  await adminDb()
    .collection("users")
    .doc(user.uid)
    .update({
      displayName,
      phone: phone || null,
      wilayaCode,
      notifyOnMessage: input.notifyOnMessage,
      notifyOnSavedSearch: input.notifyOnSavedSearch,
      updatedAt: Date.now(),
    });

  // Kept in step with the auth record so the name on a new comment, and the one
  // in the dashboard header, come out the same.
  await adminAuth().updateUser(user.uid, { displayName });

  revalidatePath("/tableau-de-bord/profil");
  revalidatePath("/tableau-de-bord");
  return { ok: true };
}
