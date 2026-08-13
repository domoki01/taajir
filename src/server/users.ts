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

/**
 * How many accounts sit on each role.
 *
 * Aggregation queries rather than reads: the roles screen needs the numbers to
 * refuse deleting a role somebody is still on, and pulling every user document
 * to count them would make that screen the most expensive page on the site.
 */
export async function countUsersByRole(
  roleIds: string[],
): Promise<Record<string, number>> {
  const db = adminDb();
  const out: Record<string, number> = {};

  await Promise.all(
    roleIds.map(async (role) => {
      try {
        const snap = await db
          .collection("users")
          .where("role", "==", role)
          .count()
          .get();
        out[role] = snap.data().count;
      } catch (error) {
        console.error("[users] role count failed:", error);
      }
    }),
  );

  return out;
}

/**
 * Accounts waiting on registration approval, oldest first.
 *
 * Oldest first for the same reason the moderation queue is: a newest-first
 * queue starves its tail, and here the tail is somebody who signed up and has
 * been unable to post since.
 */
export async function listPendingUsers(max = 100): Promise<AppUser[] | null> {
  try {
    const snap = await adminDb()
      .collection("users")
      .where("approved", "==", false)
      .orderBy("createdAt", "asc")
      .limit(max)
      .get();
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as AppUser);
  } catch (error) {
    console.error("[users] pending list failed:", error);
    return null;
  }
}
