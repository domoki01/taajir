import type { MetadataRoute } from "next";
import { kSiteUrl } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Free-form search results and (soon) private areas. Keeping them out
      // stops thousands of near-duplicate pages competing with the canonical
      // browse routes.
      disallow: ["/recherche", "/api/", "/compte/", "/admin/"],
    },
    sitemap: `${kSiteUrl}/sitemap.xml`,
  };
}
