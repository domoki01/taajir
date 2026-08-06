import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { SearchFilters } from "@/components/search/SearchFilters";
import { getVisibleFilterOptions } from "@/server/filterSettings";
import { listListings } from "@/server/listings";
import { guardPrelaunch } from "@/server/launch";
import { getWilaya, kWilayas } from "@/lib/geo";
import {
  kPropertyTypes,
  kTransactionTypes,
  type PropertyType,
  type TransactionType,
} from "@/lib/enums";
import { kSiteName } from "@/lib/constants";

// The indexable browse pages — the ones a search for "كراء شقة باب الزوار" is
// meant to land on. Free-form filtering lives at /recherche, which is noindex,
// so the crawler only ever sees these clean, canonical combinations.
//
// Five minutes, matching the listing page. A longer window would be cheaper in
// reads, but it also means someone posts an ad and cannot find it on the very
// page they expect it — and at this volume the read cost is negligible. Once
// posting exists, the publish action will revalidate the affected paths
// directly and this becomes a backstop rather than the mechanism.
export const revalidate = 300;

type Params = { transaction: string; rest?: string[] };

/**
 * Resolve /vente/appartement/alger into a filter set, rejecting anything that
 * is not a real segment. Without this the route would happily generate an
 * unbounded number of empty pages for a crawler to walk.
 */
function parse(params: Params) {
  const transaction = params.transaction as TransactionType;
  if (!(transaction in kTransactionTypes)) return null;

  const [typeSlug, wilayaSlug, communeSlug] = params.rest ?? [];

  let propertyType: PropertyType | undefined;
  if (typeSlug) {
    if (!(typeSlug in kPropertyTypes)) return null;
    propertyType = typeSlug as PropertyType;
  }

  const wilaya = wilayaSlug ? getWilaya(wilayaSlug) : undefined;
  if (wilayaSlug && !wilaya) return null;

  return { transaction, propertyType, wilaya, communeSlug };
}

function heading(parsed: NonNullable<ReturnType<typeof parse>>) {
  const what = parsed.propertyType
    ? kPropertyTypes[parsed.propertyType]
    : "عقارات";
  const deal = kTransactionTypes[parsed.transaction];
  const where = parsed.wilaya ? ` في ${parsed.wilaya.nameAr}` : " في الجزائر";
  return `${what} لل${deal}${where}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const parsed = parse(await params);
  if (!parsed) return {};

  const title = heading(parsed);
  const path = [
    parsed.transaction,
    ...(parsed.propertyType ? [parsed.propertyType] : []),
    ...(parsed.wilaya ? [parsed.wilaya.slug] : []),
  ].join("/");

  return {
    title,
    description: `تصفّح إعلانات ${title} على ${kSiteName}: أسعار، مساحات، صور ووثائق، من الملاك مباشرة ومن الوكالات.`,
    alternates: { canonical: `/${path}` },
  };
}

export default async function BrowsePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const parsed = parse(await params);
  await guardPrelaunch();
  if (!parsed) notFound();

  const [listings, filterOptions] = await Promise.all([
    listListings({
      transactionType: parsed.transaction,
      propertyType: parsed.propertyType,
      wilayaSlug: parsed.wilaya?.slug,
      communeSlug: parsed.communeSlug,
    }),
    getVisibleFilterOptions(),
  ]);

  const title = heading(parsed);

  return (
    <>
      <Header />

      <main className="flex-1 py-8">
        <Container>
          <nav
            aria-label="مسار التصفّح"
            className="text-dim mb-3 text-xs font-semibold"
          >
            <Link href="/" className="hover:text-primary">
              الرئيسية
            </Link>
            <span className="mx-1.5">/</span>
            <Link
              href={`/${parsed.transaction}`}
              className="hover:text-primary"
            >
              {kTransactionTypes[parsed.transaction]}
            </Link>
            {parsed.wilaya && (
              <>
                <span className="mx-1.5">/</span>
                <span>{parsed.wilaya.nameAr}</span>
              </>
            )}
          </nav>

          <h1 className="text-2xl font-black md:text-3xl">{title}</h1>
          <p className="text-muted ltr-nums mt-1 text-sm font-semibold">
            {listings.length} إعلان
          </p>

          {/* Seeded from the path, so it reads as "this is what you are looking
              at" rather than an empty form above narrowed results. */}
          <div className="rounded-card border-border bg-surface shadow-soft mt-5 border p-4">
            <SearchFilters
              initialTransaction={parsed.transaction}
              initialType={parsed.propertyType}
              initialWilaya={parsed.wilaya?.slug}
              initialCommune={parsed.communeSlug}
              transactionOptions={filterOptions.transactionTypes}
              propertyOptions={filterOptions.propertyTypes}
            />
          </div>

          <div className="mt-6">
            <ListingGrid listings={listings} />
          </div>

          {/* Internal links are what get the long tail of wilaya pages crawled
              at all; without them these routes exist but are unreachable. */}
          <section className="mt-12">
            <h2 className="text-base font-extrabold">
              {kTransactionTypes[parsed.transaction]} حسب الولاية
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {kWilayas.slice(0, 24).map((w) => (
                <li key={w.slug}>
                  <Link
                    href={`/${parsed.transaction}/${parsed.propertyType ?? "appartement"}/${w.slug}`}
                    className="rounded-input border-border bg-surface hover:border-primary inline-block border px-3 py-1.5 text-xs font-semibold transition-colors"
                  >
                    {w.nameAr}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </Container>
      </main>

      <Footer />
    </>
  );
}
