import "server-only";

import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getUser } from "@/server/auth";
import type { LaunchSettings, LaunchStatus } from "@/types/launch";

export const kLaunchSettingsPath = "settings/launch";

/**
 * `active` unless an admin has explicitly said otherwise.
 *
 * This default is load-bearing in one direction only. The site is live today;
 * defaulting to `prelaunch` would mean the deploy that ships this feature
 * closes the site on every visitor, and a transient Firestore error would close
 * it again later. Locking the public out is a decision, so it takes a decision
 * — a document an admin wrote — and never an absence or a failure.
 */
const kOpen: LaunchStatus = {
  state: "active",
  launchAt: null,
  launchedAt: null,
  updatedAt: 0,
  updatedBy: "",
  timerElapsed: false,
};

export async function getLaunchStatus(): Promise<LaunchStatus> {
  try {
    const snap = await adminDb().doc(kLaunchSettingsPath).get();
    if (!snap.exists) return kOpen;

    const s = snap.data() as LaunchSettings;
    return {
      state: s.state === "prelaunch" ? "prelaunch" : "active",
      launchAt: s.launchAt ?? null,
      launchedAt: s.launchedAt ?? null,
      updatedAt: s.updatedAt ?? 0,
      updatedBy: s.updatedBy ?? "",
      timerElapsed: s.launchAt != null && s.launchAt <= Date.now(),
    };
  } catch (error) {
    console.error("[launch] settings read failed:", error);
    return kOpen;
  }
}

export async function isPrelaunch(): Promise<boolean> {
  return (await getLaunchStatus()).state === "prelaunch";
}

/**
 * Keep the public out of the catalogue while the site is held.
 *
 * Called from the browse, search, listing and demand pages rather than from
 * `middleware.ts`: verifying a session cookie needs the Admin SDK, which does
 * not run on the edge, so middleware could only ever guess who is asking.
 *
 * Staff walk through. Someone has to be able to look at the site they are about
 * to launch, and reviewing the pending queue means opening the pages it holds.
 */
export async function guardPrelaunch(): Promise<void> {
  if (!(await isPrelaunch())) return;

  const user = await getUser();
  if (user?.role === "admin" || user?.role === "moderator") return;

  redirect("/");
}
