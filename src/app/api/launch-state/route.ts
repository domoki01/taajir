import { NextResponse } from "next/server";
import { getLaunchStatus } from "@/server/launch";

/**
 * What the countdown page polls.
 *
 * Deliberately tiny and public: it says whether the site is open and when it
 * plans to be, which is exactly what the closed page already tells every
 * visitor. Nothing about who is asking, so it needs no session and can be
 * answered without touching auth.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getLaunchStatus();
  return NextResponse.json(
    { state: status.state, launchAt: status.launchAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
