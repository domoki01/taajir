import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { normalize } from "@/lib/geo";
import type { AppUser } from "@/types/user";

/** The caller's own profile document, for the dashboard. */
export async function getUserDoc(uid: string): Promise<AppUser | null> {
  try {
    const snap = await adminDb().collection("users").doc(uid).get();
    if (!snap.exists) return null;
    return { uid: snap.id, ...snap.data() } as AppUser;
  } catch (error) {
    console.error("[users] read failed:", error);
    return null;
  }
}

/**
 * Accounts for the admin screen, newest first.
 *
 * Search is done in memory over the fetched page rather than in Firestore.
 * Firestore has no substring or case-insensitive matching, so the alternative
 * is storing a second normalized copy of every name and email — a schema change
 * and a backfill to make a list of a few hundred accounts searchable. Revisit
 * when the user count makes a full page of results the wrong shape, not before.
 */
export async function listUsers(
  search = "",
  max = 200,
): Promise<AppUser[] | null> {
  try {
    const snap = await adminDb()
      .collection("users")
      .orderBy("createdAt", "desc")
      .limit(max)
      .get();

    const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as AppUser);
    const q = normalize(search.trim());
    if (!q) return users;

    return users.filter(
      (u) =>
        normalize(u.displayName ?? "").includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        u.uid === search.trim(),
    );
  } catch (error) {
    console.error("[users] list failed:", error);
    return null;
  }
}

export type AdminAuditEntry = {
  id: string;
  actorUid: string;
  action: string;
  targetType: string;
  targetId: string;
  note: string | null;
  at: number;
};

/** The moderation trail. Written by every admin action, read only here. */
export async function listAudit(max = 100): Promise<AdminAuditEntry[] | null> {
  try {
    const snap = await adminDb()
      .collection("adminAudit")
      .orderBy("at", "desc")
      .limit(max)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdminAuditEntry);
  } catch (error) {
    console.error("[audit] read failed:", error);
    return null;
  }
}
