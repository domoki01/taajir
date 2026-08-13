"use client";

import { createContext, useContext } from "react";
import { kSiteName, kSiteTagline } from "@/lib/constants";

export type BrandingValue = {
  siteName: string;
  tagline: string;
  logoUrl: string | null;
};

const kFallback: BrandingValue = {
  siteName: kSiteName,
  tagline: kSiteTagline,
  logoUrl: null,
};

const BrandingContext = createContext<BrandingValue>(kFallback);

/**
 * The site's name and mark, for the client components that print them.
 *
 * Only the text travels — the colours are applied by a `<style>` tag in the
 * root layout, so no component has to know about them. Server components read
 * `getBranding()` directly instead of consuming this.
 */
export function BrandingProvider({
  value,
  children,
}: {
  value: BrandingValue;
  children: React.ReactNode;
}) {
  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

/** Falls back to the build's constants, so a component outside the provider still renders. */
export function useBranding(): BrandingValue {
  return useContext(BrandingContext);
}
