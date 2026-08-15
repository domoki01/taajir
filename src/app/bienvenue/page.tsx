import type { Metadata } from "next";
import { PrelaunchLanding } from "@/components/launch/PrelaunchLanding";
import { getUser } from "@/server/auth";
import { getBranding } from "@/server/branding";

// Reads the session to decide whether the buttons go straight to the form or
// through sign-up, so it cannot be cached.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await getBranding();
  return {
    title: "ابدا من هنا",
    description: `${siteName} — عقارات الجزائر. قول واش تحبّ دير، وحنا نكمّلو معاك.`,
    // Not the page a search for "كراء شقة وهران" should land on: it answers a
    // question the searcher has already answered by searching.
    robots: { index: false, follow: true },
  };
}

/**
 * The funnel, on a URL of its own.
 *
 * While the site is held this is where `/` sends everyone. After the launch it
 * stays put, so a Facebook ad can point straight at the four buttons without
 * the home page having to be the funnel forever.
 */
export default async function WelcomePage() {
  return <PrelaunchLanding signedIn={(await getUser()) !== null} />;
}
