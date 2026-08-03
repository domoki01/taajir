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

        <nav className="text-muted me-auto hidden items-center gap-6 text-sm font-semibold md:flex">
          <Link href="/vente" className="hover:text-accent transition-colors">
            للبيع
          </Link>
          <Link
            href="/location"
            className="hover:text-accent transition-colors"
          >
            للكراء
          </Link>
          <Link href="/agences" className="hover:text-accent transition-colors">
            الوكالات
          </Link>
        </nav>

        <Link
          href="/publier"
          className="bg-accent rounded-input ms-auto inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 md:ms-0"
        >
          <Plus className="size-4" strokeWidth={3} />
          نشر إعلان
        </Link>
      </div>
    </header>
  );
}
