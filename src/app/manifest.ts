import type { MetadataRoute } from "next";
import { getBranding } from "@/server/branding";

/**
 * A manifest is not decoration here: iOS Safari has no web push at all until a
 * site is installed to the home screen, and it will not offer to install one
 * without a manifest declaring `display: standalone` and an icon. Given how much
 * of Algerian traffic is mobile, that is the difference between saved-search
 * alerts working for iPhone users and not existing for them.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { siteName, tagline } = await getBranding();

  return {
    name: `${siteName} — ${tagline}`,
    short_name: siteName,
    description:
      "منصة جزائرية لكراء وبيع العقارات: شقق، فيلات، أراضي ومحلات تجارية في كل ولايات الوطن.",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
