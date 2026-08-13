import type { MetadataRoute } from "next";
import { kSiteUrl } from "@/lib/constants";
import { getTaxonomy } from "@/server/filterSettings";
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
// Regenerated hourly, and immediately when a category is added — the sitemap is
// how a new /vente/{slug}/alger route gets crawled at all.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The live taxonomy, so a category an admin added is crawlable the same day
  // rather than the next deploy. Hidden ones are included on purpose: hiding
  // affects the filter, not whether the pages exist.
  const taxonomy = await getTaxonomy();

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

  for (const transaction of Object.keys(taxonomy.transactionTypes)) {
    entries.push({
      url: `${kSiteUrl}/${transaction}`,
      changeFrequency: "daily",
      priority: 0.9,
    });

    for (const propertyType of Object.keys(taxonomy.propertyTypes)) {
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
