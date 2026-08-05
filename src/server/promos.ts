import "server-only";

import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { publicDb } from "@/lib/firebase/public";
import { adminDb } from "@/lib/firebase/admin";
import type { Promo } from "@/types/promo";

/**
 * Active banners for the home page, in the order the admin set.
 *
 * Read through the public SDK like every other public read, so `isActive` is
 * enforced by firestore.rules rather than by this where() clause alone.
 *
 * An advertising strip is the least important thing on the page: if this fails
 * the home page renders without it rather than 500ing.
 */
export async function listActivePromos(max = 10): Promise<Promo[]> {
  try {
    const snap = await getDocs(
      query(
        collection(publicDb(), "promos"),
        where("isActive", "==", true),
        orderBy("order", "asc"),
      ),
    );
    return snap.docs
      .slice(0, max)
      .map((d) => ({ id: d.id, ...d.data() }) as Promo);
  } catch (error) {
    console.error("[promos] read failed:", error);
    return [];
  }
}

/**
 * Every banner, active or not, for the admin screen. Uses the Admin SDK because
 * rules deliberately hide inactive banners from everyone — including admins,
 * whose reads all go through the server anyway.
 */
export async function listAllPromos(): Promise<Promo[]> {
  const snap = await adminDb().collection("promos").orderBy("order").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Promo);
}
