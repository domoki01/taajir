import Link from "next/link";
import { Building2 } from "lucide-react";
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

        {/* "نشر إعلان" and "الوكالات" are intentionally absent until accounts
            and agency profiles exist. A link that 404s is worse than no link. */}
        <nav className="text-muted ms-auto flex items-center gap-5 text-sm font-semibold sm:gap-6">
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
            className="hover:text-accent transition-colors"
          >
            بحث
          </Link>
        </nav>
      </div>
    </header>
  );
}
