import type { Metadata } from "next";
import { Search } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { listListings } from "@/server/listings";
import { getCommune, getWilaya } from "@/lib/geo";
import { SearchFilters } from "@/components/search/SearchFilters";
import { getTaxonomy, getVisibleFilterOptions } from "@/server/filterSettings";
import { guardPrelaunch } from "@/server/launch";

// Arbitrary query-string combinations must never enter the index — they would
// bury the canonical browse pages under thousands of near-duplicates.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "البحث",
  robots: { index: false, follow: true },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) || undefined;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const q = one(sp.q);
  const transactionType = one(sp.transaction);
  const propertyType = one(sp.type);
  const wilayaSlug = one(sp.wilaya);
  const communeSlug = one(sp.commune);

  const wilaya = wilayaSlug ? getWilaya(wilayaSlug) : undefined;
  // A commune is only meaningful inside its wilaya, and an unvalidated one would
  // silently return nothing rather than saying the place was not recognised.
  const commune =
    wilaya && communeSlug ? getCommune(wilaya.code, communeSlug) : undefined;

  await guardPrelaunch();

  const taxonomy = await getTaxonomy();

  const [listings, filterOptions] = await Promise.all([
    listListings({
      q,
      transactionType:
        transactionType && transactionType in taxonomy.transactionTypes
          ? transactionType
          : undefined,
      propertyType:
        propertyType && propertyType in taxonomy.propertyTypes
          ? propertyType
          : undefined,
      wilayaSlug: wilaya?.slug,
      communeSlug: commune?.slug,
    }),
    getVisibleFilterOptions(),
  ]);

  const place = commune
    ? `${commune.nameAr}، ${wilaya!.nameAr}`
    : wilaya
      ? wilaya.nameAr
      : null;

  return (
    <>
      <Header />

      <main className="flex-1 py-8">
        <Container>
          <h1 className="text-2xl font-black md:text-3xl">
            {place
              ? `إعلانات ${place}`
              : q
                ? `نتائج البحث عن «${q}»`
                : "كل الإعلانات"}
          </h1>

          <div className="rounded-card border-border bg-surface shadow-soft mt-5 border p-4">
            <SearchFilters
              initialTransaction={transactionType}
              initialType={propertyType}
              initialWilaya={wilaya?.slug}
              initialCommune={commune?.slug}
              transactionOptions={filterOptions.transactionTypes}
              propertyOptions={filterOptions.propertyTypes}
            />
          </div>

          <form
            action="/recherche"
            className="rounded-card shadow-soft border-border mt-3 flex items-center gap-2 border bg-white p-2"
          >
            <Search className="text-dim ms-2 size-5 shrink-0" />
            <input
              name="q"
              type="search"
              defaultValue={q ?? ""}
              placeholder="ابحث ببلدية، حي أو نوع العقار…"
              aria-label="البحث عن عقار"
              className="placeholder:text-dim min-w-0 flex-1 bg-transparent py-2 text-base outline-none"
            />
            <button
              type="submit"
              className="bg-accent rounded-input shrink-0 px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              بحث
            </button>
          </form>

          <p className="text-muted ltr-nums mt-4 text-sm font-semibold">
            {listings.length} إعلان
          </p>

          <div className="mt-4">
            <ListingGrid
              listings={listings}
              emptyTitle="ما لقينا والو"
              emptyBody="جرّب كلمات أقل، ولا تصفّح حسب الولاية من الصفحة الرئيسية."
            />
          </div>
        </Container>
      </main>

      <Footer />
    </>
  );
}
