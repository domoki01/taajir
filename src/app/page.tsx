import Link from "next/link";
import { Building, Home, LandPlot, Search, Store } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

// Placeholder taxonomy — replaced by lib/enums.ts once the listing schema lands.
const propertyTypes = [
  { slug: "appartement", label: "شقق", icon: Building },
  { slug: "villa", label: "فيلات", icon: Home },
  { slug: "terrain", label: "أراضي", icon: LandPlot },
  { slug: "local", label: "محلات", icon: Store },
];

export default function HomePage() {
  return (
    <>
      <Header />

      <main className="flex-1">
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className="from-accent-soft to-bg bg-gradient-to-b">
          <div className="mx-auto max-w-6xl px-4 py-14 text-center md:py-20">
            <h1 className="text-3xl leading-tight font-black tracking-tight text-balance md:text-5xl">
              دار، شقة ولا أرض — لقّاها في بلاصتها
            </h1>
            <p className="text-muted mx-auto mt-4 max-w-xl text-base leading-relaxed md:text-lg">
              آلاف الإعلانات للكراء والبيع في كل ولايات الوطن، من الملاك مباشرة
              ومن الوكالات الموثّقة.
            </p>

            <form
              action="/recherche"
              className="rounded-card shadow-soft mx-auto mt-8 flex max-w-2xl items-center gap-2 bg-white p-2"
            >
              <Search className="text-dim ms-2 size-5 shrink-0" />
              <input
                name="q"
                type="search"
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
                  className="rounded-card border-border bg-surface hover:border-accent hover:shadow-soft flex flex-col items-center gap-3 border p-6 transition-all"
                >
                  <span className="bg-accent-soft text-accent grid size-12 place-items-center rounded-[14px]">
                    <Icon className="size-6" strokeWidth={2.2} />
                  </span>
                  <span className="text-sm font-bold">{label}</span>
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
