import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { kSiteName } from "@/lib/constants";

export function Header() {
  return (
    <header className="bg-surface/90 border-border sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="bg-accent grid size-9 place-items-center rounded-[12px] text-white">
            <Building2 className="size-5" strokeWidth={2.4} />
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            {kSiteName}
          </span>
        </Link>

        <nav className="text-muted ms-auto flex items-center gap-4 text-sm font-semibold sm:gap-6">
          <Link href="/vente" className="hover:text-accent transition-colors">
            للبيع
          </Link>
          <Link
            href="/location"
            className="hover:text-accent transition-colors"
          >
            للكراء
          </Link>
          <Link
            href="/recherche"
            className="hover:text-accent hidden transition-colors sm:inline"
          >
            بحث
          </Link>
        </nav>

        {/* "الوكالات" stays hidden until agency profiles exist — a link that
            404s is worse than no link. */}
        <Link
          href="/publier"
          className="bg-accent rounded-input ms-1 inline-flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 sm:px-4"
        >
          <Plus className="size-4" strokeWidth={3} />
          نشر إعلان
        </Link>
      </div>
    </header>
  );
}
