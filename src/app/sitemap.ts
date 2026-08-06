import type { MetadataRoute } from "next";
import { kSiteUrl } from "@/lib/constants";
import { kPropertyTypes, kTransactionTypes } from "@/lib/enums";
import { kWilayas } from "@/lib/geo";

/**
 * The browse pages are the crawlable surface of the site: a buyer reaches an ad
 * by searching "كراء شقة وهران", so every transaction × property type × wilaya
 * combination needs to be discoverable. That is ~1,800 URLs, well inside the
 * 50,000 limit of a single sitemap file.
 *
 * /recherche is deliberately excluded — it is noindex, and listing its infinite
 * query-string variants would bury these canonical pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    "",
    // The demand feed itself, not the individual requests: those are
    // user-written, short-lived and turn over constantly, so listing them would
    // spend the crawl budget on pages that are gone by the next visit.
    "/demandes",
    "/aide",
    "/a-propos",
    "/securite",
    "/cgu",
    "/confidentialite",
  ];

  const entries: MetadataRoute.Sitemap = staticPages.map((path) => ({
    url: `${kSiteUrl}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.4,
  }));

  for (const transaction of Object.keys(kTransactionTypes)) {
    entries.push({
      url: `${kSiteUrl}/${transaction}`,
      changeFrequency: "daily",
      priority: 0.9,
    });

    for (const propertyType of Object.keys(kPropertyTypes)) {
      entries.push({
        url: `${kSiteUrl}/${transaction}/${propertyType}`,
        changeFrequency: "daily",
        priority: 0.7,
      });

      for (const wilaya of kWilayas) {
        entries.push({
          url: `${kSiteUrl}/${transaction}/${propertyType}/${wilaya.slug}`,
          changeFrequency: "daily",
          priority: 0.6,
        });
      }
    }
  }

  return entries;
}
