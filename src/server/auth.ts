// ── SERVER-SIDE AUTH ─────────────────────────────────────────────────────────
// Session cookies rather than client-only auth. The Firebase JS SDK keeps its
// token in IndexedDB where the server cannot see it, which would force every
// private page to render a spinner and then fetch. A session cookie lets a
// Server Component know who is asking before it renders anything.

import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { kFreeListingQuota } from "@/lib/constants";

/** Firebase Hosting's CDN forwards exactly one cookie name, so use it. */
export const kSessionCookie = "__session";
export const kSessionMaxAgeMs = 14 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  uid: string;
  email: string | null;
  name: string;
  role: "user" | "agency" | "moderator" | "admin";
};

/** The signed-in user, or null. Never throws — callers decide what to do. */
export async function getUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const session = jar.get(kSessionCookie)?.value;
  if (!session) return null;

  try {
    // checkRevoked: a banned or signed-out user must lose access on the next
    // request, not whenever their token happens to expire.
    const claims = await adminAuth().verifySessionCookie(session, true);
    return {
      uid: claims.uid,
      email: claims.email ?? null,
      name: (claims.name as string) ?? "",
      role: (claims.role as SessionUser["role"]) ?? "user",
    };
  } catch {
    return null;
  }
}

export async function requireUser(
  next = "/tableau-de-bord",
): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.role !== "admin" && user.role !== "moderator") redirect("/");
  return user;
}

/**
 * Stricter than requireAdmin, which also lets moderators through.
 *
 * Anything that hands out access itself needs this: a moderator who could edit
 * roles could make themselves an admin, which makes the distinction between the
 * two roles decorative. Same for quotas and bans — they decide who may do what.
 */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.role !== "admin") redirect("/admin");
  return user;
}

/**
 * Create the users/{uid} document on first sign-in.
 *
 * This runs on the server because the quota fields decide how many ads someone
 * may publish; a client that could write them could grant itself the paid tier.
 * Rules deny those fields too, so this is belt and braces.
 */
export async function ensureUserDoc(
  uid: string,
  data: { email: string | null; name: string; photoURL: string | null },
) {
  const ref = adminDb().collection("users").doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.update({ lastSeenAt: Date.now() });
    return;
  }

  await ref.set({
    uid,
    email: data.email,
    displayName: data.name || "مستخدم",
    photoURL: data.photoURL,
    phone: null,
    role: "user",
    agencyId: null,
    wilayaCode: null,
    activeListingCount: 0,
    listingQuota: kFreeListingQuota,
    featuredQuota: 0,
    isBanned: false,
    banReason: null,
    strikeCount: 0,
    notifyOnMessage: true,
    notifyOnSavedSearch: true,
    locale: "ar",
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  });
}
