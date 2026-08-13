/**
 * The colours an admin may repaint.
 *
 * A deliberately short list. Every token in `globals.css` could in principle be
 * editable, but most of them — the surface greys, the two secondary text
 * greys — are what hold the site's contrast at AA, and handing them over is
 * handing over the ability to make the whole site unreadable in one save. These
 * six are the ones that carry the brand.
 */
export const kBrandColors = {
  primary: "اللون الأساسي — العناوين، الروابط، الأسعار",
  primaryStrong: "الأساسي الغامق — التمرير والتشديد",
  primarySoft: "الأساسي الفاتح — خلفيات الشارات",
  accent: "لون الأزرار — نشر، اتصال، بحث",
  accentStrong: "لون الأزرار الغامق",
  accentSoft: "لون الأزرار الفاتح",
} as const;

export type BrandColor = keyof typeof kBrandColors;

/** The CSS custom property each one overrides. Must match `globals.css`. */
export const kColorVariables: Record<BrandColor, string> = {
  primary: "--color-primary",
  primaryStrong: "--color-primary-strong",
  primarySoft: "--color-primary-soft",
  accent: "--color-accent",
  accentStrong: "--color-accent-strong",
  accentSoft: "--color-accent-soft",
};

export type Branding = {
  siteName: string;
  tagline: string;
  /** Only the keys the admin actually changed. Absent means "use the build's". */
  colors: Partial<Record<BrandColor, string>>;
  /** A logo image, or null for the built-in mark. */
  logoUrl: string | null;
  updatedAt: number;
  updatedBy: string;
};

export const kHexPattern = /^#[0-9a-f]{6}$/i;
