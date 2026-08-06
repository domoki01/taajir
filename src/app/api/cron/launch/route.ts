import { NextResponse } from "next/server";
import { getLaunchStatus } from "@/server/launch";
import { runLaunch } from "@/server/launchRun";

/**
 * Fire the launch when the countdown reaches zero, with nobody watching.
 *
 * Needs a Cloud Scheduler job hitting it — App Hosting has no built-in cron —
 * with the CRON_SECRET as a bearer token. Until that job exists this route
 * simply never runs, and the launch stays where it already works: the admin's
 * switch. That is a deliberate ordering, not an oversight; an automated launch
 * that half-works is worse than one that plainly does not.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron not configured" }, { status: 503 });
  }

  // Constant-time-ish: compare after both are known-length strings. This guards
  // a switch that makes a whole site public, so it gets a real check rather
  // than an `includes`.
  const presented = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");
  if (
    !presented ||
    presented.length !== secret.length ||
    presented !== secret
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const status = await getLaunchStatus();
  if (status.state !== "prelaunch") {
    return NextResponse.json({ skipped: "already active" });
  }
  if (!status.timerElapsed) {
    return NextResponse.json({ skipped: "timer has not elapsed" });
  }

  const out = await runLaunch("cron");
  return NextResponse.json({ launched: true, ...out });
}
