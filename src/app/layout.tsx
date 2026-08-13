import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { BrandingProvider } from "@/components/branding/BrandingProvider";
import { brandingStyle, getBranding } from "@/server/branding";
import { kSiteUrl } from "@/lib/constants";
import "./globals.css";

// Self-hosted by Next at build time — no runtime request to Google, and no
// build-time curl of a .ttf (the sibling repo fetched fonts with `curl -sL`,
// which silently wrote an HTML error page as a font file when the URL moved).
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
});

// generateMetadata rather than a static export: the site's name is editable
// from /admin/identite, and the tab title is the most visible place it appears.
export async function generateMetadata(): Promise<Metadata> {
  const { siteName, tagline } = await getBranding();

  return {
    metadataBase: new URL(kSiteUrl),
    title: {
      default: `${siteName} — ${tagline}`,
      template: `%s | ${siteName}`,
    },
    description:
      "منصة جزائرية لكراء وبيع العقارات: شقق، فيلات، أراضي ومحلات تجارية في كل ولايات الوطن. ابحث حسب الولاية والبلدية والسعر، وانشر إعلانك مجاناً.",
    applicationName: siteName,
    openGraph: {
      type: "website",
      locale: "ar_DZ",
      siteName,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  // Required by the bottom nav: without it `env(safe-area-inset-bottom)` is
  // always 0, and the bar sits underneath the iPhone home indicator.
  viewportFit: "cover",
  // Deliberately NOT maximum-scale=1 / user-scalable=no. The sibling app
  // disabled pinch zoom, which fails WCAG 1.4.4 and hurts users reading
  // property details on small screens.
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const branding = await getBranding();
  const palette = brandingStyle(branding);

  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} h-full antialiased`}
    >
      {/* The admin's palette, layered over the build's @theme defaults rather
          than replacing them. Emitted only when something was actually changed,
          and every value has been matched against #rrggbb before it gets here.
          globals.css stays the source of truth for the shape of the palette. */}
      {palette && (
        <head>
          <style
            id="brand-palette"
            dangerouslySetInnerHTML={{ __html: palette }}
          />
        </head>
      )}
      <body className="flex min-h-full flex-col">
        <BrandingProvider
          value={{
            siteName: branding.siteName,
            tagline: branding.tagline,
            logoUrl: branding.logoUrl,
          }}
        >
          {/* Both are mounted here rather than per page: every route composes its
            own Header and Footer, but they all share this root, so this is the
            only place that covers the dashboard and admin sections too. The
            back bar comes first because it is `sticky top-0` and has to sit
            ahead of the content it sticks above. */}
          <MobileTopBar />
          {children}
          <BottomNav />
        </BrandingProvider>
      </body>
    </html>
  );
}
