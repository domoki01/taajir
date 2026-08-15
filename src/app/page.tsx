import Link from "next/link";
import { redirect } from "next/navigation";
import { Building, Home, LandPlot, MapPin, Search, Store } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getFeaturedWilayas } from "@/lib/geo";
import { SearchFilters } from "@/components/search/SearchFilters";
import { getVisibleFilterOptions } from "@/server/filterSettings";
import { PromoCarousel } from "@/components/home/PromoCarousel";
import { listActivePromos } from "@/server/promos";
import { kFunnelHome } from "@/lib/funnel";
import { getLaunchStatus } from "@/server/launch";
import { getUser, isStaff } from "@/server/auth";
import { StaffHoldBanner } from "@/components/launch/StaffHoldBanner";

// Placeholder taxonomy — replaced by lib/enums.ts once the listing schema lands.
const propertyTypes = [
  { slug: "appartement", label: "شقق", icon: Building },
  { slug: "villa", label: "فيلات", icon: Home },
  { slug: "terrain", label: "أراضي", icon: LandPlot },
  { slug: "local", label: "محلات", icon: Store },
];

// Reading the launch state and the session makes this route dynamic, so the
// five-minute ISR window it used to have no longer applies. That is the price
// of a switch that takes effect the moment it is thrown: a cached home page
// would keep showing the funnel to some visitors and the site to others for
// minutes after launch.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const wilayas = getFeaturedWilayas();
  const [promos, filterOptions, launch, user] = await Promise.all([
    listActivePromos(),
    getVisibleFilterOptions(),
    getLaunchStatus(),
    getUser(),
  ]);

  const staff = isStaff(user);

  // Held: the funnel replaces the site. A redirect rather than rendering it
  // inline, so the funnel has one address — which is what lets the bottom nav
  // and the back bar stand down on it, and what lets an ad link straight to it
  // after the launch. Staff see the real site behind a banner, because
  // reviewing what is queued means opening the pages that hold it.
  if (launch.state === "prelaunch" && !staff) redirect(kFunnelHome);

  return (
    <>
      {launch.state === "prelaunch" && <StaffHoldBanner />}
      <Header />

      <main className="flex-1">
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className="from-primary-soft to-bg bg-gradient-to-b">
          <div className="mx-auto max-w-6xl px-4 py-14 text-center md:py-20">
            <h1 className="text-3xl leading-tight font-black tracking-tight text-balance md:text-5xl">
              دار، شقة ولا أرض — لقّاها في بلاصتها
            </h1>
            <p className="text-muted mx-auto mt-4 max-w-xl text-base leading-relaxed md:text-lg">
              آلاف الإعلانات للكراء والبيع في كل ولايات الوطن، من الملاك مباشرة
              ومن الوكالات الموثّقة.
            </p>

            <div className="rounded-card shadow-soft mx-auto mt-8 max-w-xl bg-white p-4 text-start">
              <SearchFilters
                transactionOptions={filterOptions.transactionTypes}
                propertyOptions={filterOptions.propertyTypes}
              />
            </div>

            <form
              action="/recherche"
              className="rounded-card shadow-soft mx-auto mt-3 flex max-w-xl items-center gap-2 bg-white p-2"
            >
              <Search className="text-dim ms-2 size-5 shrink-0" />
              <input
                name="q"
                type="search"
                placeholder="ولا ابحث بكلمة: حي، نوع العقار…"
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

            {promos.length > 0 && (
              <div className="mx-auto mt-8 max-w-3xl">
                <PromoCarousel promos={promos} />
              </div>
            )}
          </div>
        </section>

        {/* ── PROPERTY TYPES ───────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-xl font-extrabold md:text-2xl">
            تصفّح حسب النوع
          </h2>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {propertyTypes.map(({ slug, label, icon: Icon }) => (
              <li key={slug}>
                <Link
                  href={`/vente/${slug}`}
                  className="rounded-card border-border bg-surface hover:border-primary hover:shadow-soft flex flex-col items-center gap-3 border p-6 transition-all"
                >
                  <span className="bg-primary-soft text-primary grid size-12 place-items-center rounded-[14px]">
                    <Icon className="size-6" strokeWidth={2.2} />
                  </span>
                  <span className="text-sm font-bold">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ── WILAYAS ──────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <h2 className="text-xl font-extrabold md:text-2xl">
            الولايات الأكثر بحثاً
          </h2>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {wilayas.map((wilaya) => (
              <li key={wilaya.slug}>
                <Link
                  href={`/vente/appartement/${wilaya.slug}`}
                  className="rounded-input border-border bg-surface hover:border-primary flex items-center gap-2 border px-4 py-3 transition-colors"
                >
                  <MapPin className="text-primary size-4 shrink-0" />
                  <span className="truncate text-sm font-bold">
                    {wilaya.nameAr}
                  </span>
                  <span className="text-dim ltr-nums ms-auto text-xs font-semibold">
                    {String(wilaya.code).padStart(2, "0")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <Footer />
    </>
  );
}
