import type { MetadataRoute } from "next";
import { kSiteUrl } from "@/lib/constants";
import { getTaxonomy } from "@/server/filterSettings";
import { kWilayas } from "@/lib/geo";
import { listArticles } from "@/server/articles";

/**
 * The browse pages are the crawlable surface of the site: a buyer reaches an ad
 * by searching "كراء شقة وهران", so every transaction × property type × wilaya
 * combination needs to be discoverable. That is ~1,800 URLs, well inside the
 * 50,000 limit of a single sitemap file.
 *
 * /recherche is deliberately excluded — it is noindex, and listing its infinite
 * query-string variants would bury these canonical pages.
 */
// Built per request rather than at deploy time.
//
// `revalidate` made this a static route, which Next generates during
// `next build` — where the database reads below have no credentials and fall
// back to empty. Both of them degrade quietly by design, so the failure showed
// up as a sitemap missing its articles rather than as a broken build.
//
// A sitemap is fetched by crawlers a handful of times a day. Two queries per
// fetch is nothing against shipping one that is silently incomplete.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The live taxonomy, so a category an admin added is crawlable the same day
  // rather than the next deploy. Hidden ones are included on purpose: hiding
  // affects the filter, not whether the pages exist.
  const [taxonomy, articles] = await Promise.all([
    getTaxonomy(),
    listArticles(200),
  ]);

  const staticPages = [
    "",
    // The demand feed itself, not the individual requests: those are
    // user-written, short-lived and turn over constantly, so listing them would
    // spend the crawl budget on pages that are gone by the next visit.
    "/demandes",
    "/articles",
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

  // Listed individually, unlike demands: an article is written once, stays
  // useful for years and is the page a search for "كيفاش نكري دار" should
  // land on. That is exactly the kind of URL a crawl budget is worth spending.
  for (const article of articles) {
    entries.push({
      url: `${kSiteUrl}/articles/${article.slug}`,
      lastModified: new Date(article.updatedAt),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

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
