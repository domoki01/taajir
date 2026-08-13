"use server";

// ── LAUNCH CONTROL ───────────────────────────────────────────────────────────
// Holding the site closed and opening it again. Site configuration of the most
// consequential kind, so it is `admin` only — a moderator reviews ads, they do
// not decide whether the public can see the site at all.

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { actorWith, kForbidden } from "@/server/auth";
import { kLaunchSettingsPath, getLaunchStatus } from "@/server/launch";
import { runLaunch } from "@/server/launchRun";
import type { LaunchState } from "@/types/launch";

export type LaunchResult =
  { ok: true; summary?: string } | { ok: false; error: string };

async function requireSiteAdmin() {
  return actorWith("launch.control");
}

/** Everything the switch touches, so one refresh shows the truth. */
function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/lancement");
  revalidatePath("/admin/lancement");
  revalidatePath("/admin/moderation");
}

// ── STATE ────────────────────────────────────────────────────────────────────

export async function setLaunchState(state: string): Promise<LaunchResult> {
  const user = await requireSiteAdmin();
  if (!user) return { ok: false, error: "هذا من صلاحيات المشرف العام وحده" };
  if (state !== "prelaunch" && state !== "active") {
    return { ok: false, error: "حالة ماشي صحيحة" };
  }

  const current = await getLaunchStatus();
  await adminDb()
    .doc(kLaunchSettingsPath)
    .set(
      {
        state: state as LaunchState,
        launchAt: current.launchAt,
        launchedAt: current.launchedAt,
        updatedAt: Date.now(),
        updatedBy: user.uid,
      },
      { merge: false },
    );

  await audit(user.uid, `state:${state}`, null);
  revalidateAll();
  return { ok: true };
}

/**
 * Set, extend or zero the countdown.
 *
 * Zeroing shows "the wait is over" and nothing more. Publishing is a separate,
 * deliberate act — a timer that fired while nobody was watching should never be
 * what makes a thousand unreviewed ads public.
 */
export async function setLaunchAt(at: number | null): Promise<LaunchResult> {
  const user = await requireSiteAdmin();
  if (!user) return { ok: false, error: "هذا من صلاحيات المشرف العام وحده" };
  if (at != null && (!Number.isFinite(at) || at < 0)) {
    return { ok: false, error: "تاريخ ماشي صحيح" };
  }

  const current = await getLaunchStatus();
  await adminDb().doc(kLaunchSettingsPath).set(
    {
      state: current.state,
      launchAt: at,
      launchedAt: current.launchedAt,
      updatedAt: Date.now(),
      updatedBy: user.uid,
    },
    { merge: false },
  );

  await audit(user.uid, "timer", at ? new Date(at).toISOString() : "cleared");
  revalidateAll();
  return { ok: true };
}

// ── THE SWITCH ───────────────────────────────────────────────────────────────

/**
 * The admin's switch. The work is in src/server/launchRun.ts — see the note
 * there for why it does not live in this file.
 */
export async function executeLaunch(): Promise<LaunchResult> {
  const user = await requireSiteAdmin();
  if (!user) return { ok: false, error: "هذا من صلاحيات المشرف العام وحده" };

  const out = await runLaunch(user.uid);
  revalidateAll();

  return {
    ok: true,
    summary: `نُشر ${out.published} إعلان، ${out.requeued} راحو للمراجعة، ${out.requests} طلب، و${out.notified} مستعمل في قائمة الإشعارات.`,
  };
}

/**
 * Approve a held listing without publishing it.
 *
 * The flag is separate from the status on purpose: an ad approved during the
 * hold must stay invisible until the switch, and reusing `published` for
 * "approved" would put it on the site the moment a moderator clicked.
 */
export async function approveForLaunch(
  id: string,
  approved: boolean,
): Promise<LaunchResult> {
  const user = await actorWith("listings.moderate");
  if (!user) return { ok: false, error: kForbidden };

  await adminDb()
    .collection("listings")
    .doc(id)
    .update({ approvedForLaunch: approved, updatedAt: Date.now() });

  await audit(user.uid, approved ? "hold-approve" : "hold-unapprove", id);
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/lancement");
  return { ok: true };
}

async function audit(actorUid: string, action: string, note: string | null) {
  await adminDb()
    .collection("adminAudit")
    .add({
      actorUid,
      action: `launch:${action}`,
      targetType: "settings",
      targetId: "launch",
      note,
      at: Date.now(),
    })
    .catch(() => {});
}
