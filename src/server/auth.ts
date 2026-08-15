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
import { can, type Permission } from "@/lib/permissions";
import { permissionsForRole } from "@/server/permissions";
import { getAccessSettings } from "@/server/access";

/** Firebase Hosting's CDN forwards exactly one cookie name, so use it. */
export const kSessionCookie = "__session";
export const kSessionMaxAgeMs = 14 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  uid: string;
  email: string | null;
  name: string;
  /**
   * The role id from the token claim. A plain string rather than a union since
   * an admin can define new roles — the code branches on permissions, not on
   * this.
   */
  role: string;
  /** Resolved from the role at read time. The only thing worth branching on. */
  permissions: Permission[];
};

/** What an action tells a caller who may not do the thing they asked for. */
export const kForbidden = "ماشي من صلاحياتك";

/** The signed-in user, or null. Never throws — callers decide what to do. */
export async function getUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const session = jar.get(kSessionCookie)?.value;
  if (!session) return null;

  try {
    // checkRevoked: a banned or signed-out user must lose access on the next
    // request, not whenever their token happens to expire.
    const claims = await adminAuth().verifySessionCookie(session, true);
    const role = (claims.role as string) ?? "user";
    return {
      uid: claims.uid,
      email: claims.email ?? null,
      name: (claims.name as string) ?? "",
      role,
      permissions: await permissionsForRole(role),
    };
  } catch {
    return null;
  }
}

/** Does this session hold that permission? The one check every guard is built on. */
export function hasPermission(
  user: SessionUser | null | undefined,
  permission: Permission,
): boolean {
  return !!user && can(user.permissions, permission);
}

/** Staff for the purposes of "can see behind the curtain" — holds anything at all. */
export function isStaff(user: SessionUser | null | undefined): boolean {
  return !!user && user.permissions.length > 0;
}

export async function requireUser(
  next = "/tableau-de-bord",
): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(next)}`);
  return user;
}

/**
 * The door to /admin. Anyone holding at least one permission may come in.
 *
 * What they can *do* once inside is decided per screen by requirePermission,
 * and again, independently, by the Server Action behind every button. Reaching
 * a page is never treated as proof of anything.
 */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (!isStaff(user)) redirect("/");
  return user;
}

/**
 * Guard one admin screen.
 *
 * Someone holding other permissions is sent back to /admin, where the nav shows
 * what they *can* reach; someone holding none never belonged here and goes
 * home. Bouncing everyone to /admin would loop the second group forever.
 */
export async function requirePermission(
  permission: Permission,
  next = "/admin",
): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!can(user.permissions, permission))
    redirect(isStaff(user) ? "/admin" : "/");
  return user;
}

/**
 * The Server Action counterpart: null when the caller may not do this.
 *
 * Actions return an error rather than redirecting. Every export of a
 * "use server" module is a public endpoint that anything can POST to, and the
 * honest answer to an unauthorised POST is "no", not a navigation.
 */
export async function actorWith(
  permission: Permission,
): Promise<SessionUser | null> {
  const user = await getUser();
  return hasPermission(user, permission) ? user : null;
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
  data: {
    email: string | null;
    name: string;
    photoURL: string | null;
    phone?: string | null;
  },
) {
  const ref = adminDb().collection("users").doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    // A returning phone user whose document predates this field gets it filled
    // in, but a number they later edited in their profile is never overwritten.
    const fill = data.phone && !snap.data()?.phone ? { phone: data.phone } : {};
    await ref.update({ lastSeenAt: Date.now(), ...fill });
    return;
  }

  // A new account is approved on the spot unless the admin has switched
  // registration approval on. Written at creation rather than read live so the
  // publish gate is one field lookup, and so flipping the switch later never
  // retroactively mutes anybody — approveEveryone() handles the existing ones.
  const { requireApproval } = await getAccessSettings();

  await ref.set({
    uid,
    approved: !requireApproval,
    email: data.email,
    displayName: data.name || "مستخدم",
    photoURL: data.photoURL,
    phone: data.phone ?? null,
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
