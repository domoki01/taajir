import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
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
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
