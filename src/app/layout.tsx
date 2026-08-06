import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { kSiteName, kSiteTagline, kSiteUrl } from "@/lib/constants";
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

export const metadata: Metadata = {
  metadataBase: new URL(kSiteUrl),
  title: {
    default: `${kSiteName} — ${kSiteTagline}`,
    template: `%s | ${kSiteName}`,
  },
  description:
    "منصة جزائرية لكراء وبيع العقارات: شقق، فيلات، أراضي ومحلات تجارية في كل ولايات الوطن. ابحث حسب الولاية والبلدية والسعر، وانشر إعلانك مجاناً.",
  applicationName: kSiteName,
  openGraph: {
    type: "website",
    locale: "ar_DZ",
    siteName: kSiteName,
  },
};

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Both are mounted here rather than per page: every route composes its
            own Header and Footer, but they all share this root, so this is the
            only place that covers the dashboard and admin sections too. The
            back bar comes first because it is `sticky top-0` and has to sit
            ahead of the content it sticks above. */}
        <MobileTopBar />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
