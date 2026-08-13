import "server-only";

import { cache } from "react";
import { adminDb } from "@/lib/firebase/admin";
import { kSiteName, kSiteTagline } from "@/lib/constants";
import {
  kColorVariables,
  kHexPattern,
  type BrandColor,
  type Branding,
} from "@/types/branding";

export const kBrandingSettingsPath = "settings/branding";

/**
 * The build's own identity, used until an admin saves the screen once — and as
 * the floor whenever the document cannot be read.
 *
 * `kSiteName` stays the fallback rather than being replaced: a settings read
 * that fails must leave the site named, not blank.
 */
const kDefault: Branding = {
  siteName: kSiteName,
  tagline: kSiteTagline,
  colors: {},
  logoUrl: null,
  updatedAt: 0,
  updatedBy: "",
};

export const getBranding = cache(async (): Promise<Branding> => {
  try {
    const snap = await adminDb().doc(kBrandingSettingsPath).get();
    if (!snap.exists) return kDefault;

    const b = snap.data() as Partial<Branding>;
    const colors: Partial<Record<BrandColor, string>> = {};
    for (const [key, value] of Object.entries(b.colors ?? {})) {
      // Validated on read as well as on write. The document is only writable by
      // the Admin SDK, but this string is interpolated into a <style> tag, and
      // "the writer checked it" is not the property you want a stylesheet to
      // depend on.
      if (key in kColorVariables && kHexPattern.test(String(value))) {
        colors[key as BrandColor] = String(value);
      }
    }

    return {
      siteName: b.siteName?.trim() || kSiteName,
      tagline: b.tagline?.trim() || kSiteTagline,
      colors,
      logoUrl: typeof b.logoUrl === "string" ? b.logoUrl : null,
      updatedAt: b.updatedAt ?? 0,
      updatedBy: b.updatedBy ?? "",
    };
  } catch (error) {
    console.error("[branding] settings read failed:", error);
    return kDefault;
  }
});

/**
 * The `<style>` body that repaints the site, or "" when nothing was changed.
 *
 * Overrides `:root` rather than touching `globals.css`: the build's palette
 * stays the default, and this layers on top at request time. Emitting nothing
 * when there are no overrides keeps the common case free.
 *
 * Safe to interpolate: every value has been matched against `#rrggbb`, so no
 * quote, brace or angle bracket can reach the document.
 */
export function brandingStyle(branding: Branding): string {
  const rules = Object.entries(branding.colors)
    .filter(([key, value]) => key in kColorVariables && kHexPattern.test(value))
    .map(([key, value]) => `${kColorVariables[key as BrandColor]}:${value}`);

  return rules.length ? `:root{${rules.join(";")}}` : "";
}
