import "server-only";

import { adminDb } from "@/lib/firebase/admin";

export const kAccessSettingsPath = "settings/access";

export type AccessSettings = {
  /** New accounts must be approved by staff before they may publish anything. */
  requireApproval: boolean;
  updatedAt: number;
  updatedBy: string;
};

export const kNeedsApproval =
  "حسابك ما زال يستنّى تأكيد الإدارة. تقدر تتصفّح عادي، والنشر يتفكّ كي يتأكّد حسابك.";

const kOpen: AccessSettings = {
  requireApproval: false,
  updatedAt: 0,
  updatedBy: "",
};

/**
 * Off unless an admin turned it on.
 *
 * Same direction as the launch switch and for the same reason: a missing
 * document or a failed read must never be the thing that stops people posting.
 * Requiring approval is a decision, so it takes a decision.
 */
export async function getAccessSettings(): Promise<AccessSettings> {
  try {
    const snap = await adminDb().doc(kAccessSettingsPath).get();
    if (!snap.exists) return kOpen;
    const s = snap.data() as Partial<AccessSettings>;
    return {
      requireApproval: s.requireApproval === true,
      updatedAt: s.updatedAt ?? 0,
      updatedBy: s.updatedBy ?? "",
    };
  } catch (error) {
    console.error("[access] settings read failed:", error);
    return kOpen;
  }
}

/**
 * May this account publish — an ad, a demand, a comment, a reply?
 *
 * Deliberately not a session check. Approval gates *writing*, never reading or
 * signing in: an account waiting on review can browse the whole site, save a
 * search and set its alerts up, so the wait costs them nothing they would
 * notice except the one button. Gating the session instead would turn a
 * moderation queue into a locked door.
 */
export async function isApprovedToPublish(uid: string): Promise<boolean> {
  const { requireApproval } = await getAccessSettings();
  if (!requireApproval) return true;

  try {
    const snap = await adminDb().collection("users").doc(uid).get();
    // Absent means the field predates the switch. `approveEveryone` back-fills
    // it the moment the switch is thrown, so this is only reachable for a
    // document written in the gap — and true is the answer that does not
    // silently mute an existing user.
    return snap.data()?.approved !== false;
  } catch (error) {
    console.error("[access] approval read failed:", error);
    return true;
  }
}

/**
 * Mark every existing account approved.
 *
 * The fifth guard. Switching approval on with no back-fill would, in one click,
 * stop every current member of the platform from posting — thousands of people
 * who were approved by the act of the site being open when they joined. The
 * feature is meant to filter who arrives next, not to revoke what is already
 * there.
 *
 * Paged rather than one batch: Firestore caps a write batch at 500, and the
 * collection has no upper bound.
 */
export async function approveEveryone(): Promise<number> {
  const db = adminDb();
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let touched = 0;

  for (;;) {
    let q = db.collection("users").orderBy("__name__").limit(400);
    if (cursor) q = q.startAfter(cursor);

    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) batch.update(doc.ref, { approved: true });
    await batch.commit();

    touched += snap.size;
    cursor = snap.docs[snap.size - 1];
    if (snap.size < 400) break;
  }

  return touched;
}
