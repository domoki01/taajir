"use server";

// ── SITE IDENTITY ────────────────────────────────────────────────────────────
// The name, the tagline, the logo and the six brand colours. Everything here is
// re-read on the next request, so a save repaints the site with no deploy.

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { actorWith, kForbidden } from "@/server/auth";
import { kBrandingSettingsPath } from "@/server/branding";
import {
  kColorVariables,
  kHexPattern,
  type BrandColor,
} from "@/types/branding";

export type BrandingResult = { ok: true } | { ok: false; error: string };

export type BrandingInput = {
  siteName: string;
  tagline: string;
  logoUrl: string;
  colors: Record<string, string>;
};

const kName = { min: 2, max: 30 };
const kTagline = { min: 3, max: 60 };

export async function saveBranding(
  input: BrandingInput,
): Promise<BrandingResult> {
  const user = await actorWith("branding.edit");
  if (!user) return { ok: false, error: kForbidden };

  const siteName = input.siteName.trim();
  if (siteName.length < kName.min || siteName.length > kName.max) {
    return {
      ok: false,
      error: `اسم الموقع لازم بين ${kName.min} و${kName.max} حرف`,
    };
  }

  const tagline = input.tagline.trim();
  if (tagline.length < kTagline.min || tagline.length > kTagline.max) {
    return {
      ok: false,
      error: `الوصف القصير لازم بين ${kTagline.min} و${kTagline.max} حرف`,
    };
  }

  const logoUrl = input.logoUrl.trim();
  if (logoUrl && !/^https:\/\/[^\s"'<>]+$/i.test(logoUrl)) {
    // https only, and no characters that could break out of an attribute. The
    // URL ends up as an <img src>, so "the admin typed it" is not enough.
    return { ok: false, error: "رابط الشعار لازم يبدا بـ https:// " };
  }

  const colors: Partial<Record<BrandColor, string>> = {};
  for (const [key, value] of Object.entries(input.colors)) {
    if (!(key in kColorVariables)) continue;
    const hex = value.trim().toLowerCase();
    if (!hex) continue; // Cleared: fall back to the build's colour.
    if (!kHexPattern.test(hex)) {
      return {
        ok: false,
        error: `اللون «${value}» ماشي صالح — استعمل #rrggbb`,
      };
    }
    colors[key as BrandColor] = hex;
  }

  await adminDb()
    .doc(kBrandingSettingsPath)
    .set(
      {
        siteName,
        tagline,
        logoUrl: logoUrl || null,
        colors,
        updatedAt: Date.now(),
        updatedBy: user.uid,
      },
      { merge: false },
    );

  await adminDb()
    .collection("adminAudit")
    .add({
      actorUid: user.uid,
      action: "branding",
      targetType: "settings",
      targetId: "branding",
      note: siteName,
      at: Date.now(),
    })
    .catch(() => {});

  // The root layout carries the palette and the name, so the whole tree is what
  // needs refreshing — a path revalidation alone would leave every other route's
  // cached HTML painted in the old colours.
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Back to the palette and the name the build ships with. */
export async function resetBranding(): Promise<BrandingResult> {
  const user = await actorWith("branding.edit");
  if (!user) return { ok: false, error: kForbidden };

  await adminDb().doc(kBrandingSettingsPath).delete();
  revalidatePath("/", "layout");
  return { ok: true };
}
