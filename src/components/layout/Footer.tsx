import Link from "next/link";
import { kSiteName } from "@/lib/constants";

const links = [
  { href: "/a-propos", label: "من نحن" },
  { href: "/aide", label: "المساعدة" },
  { href: "/securite", label: "نصائح الأمان" },
  { href: "/cgu", label: "شروط الاستعمال" },
  { href: "/confidentialite", label: "الخصوصية" },
  // Shown to everyone, signed in or not. The footer renders on every page,
  // including the statically cached home and listing pages, and reading the
  // session here to hide it would opt the whole site out of that caching — a
  // steep price for one redundant link.
  { href: "/inscription", label: "حساب جديد" },
];

export function Footer() {
  return (
    <footer className="border-border bg-surface mt-auto border-t">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <nav className="text-muted flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="text-dim mt-6 text-xs leading-relaxed">
          {kSiteName} منصة لنشر الإعلانات العقارية، وليست طرفاً في أي معاملة بين
          المعلن والزبون. تحقّق دائماً من العقار والوثائق قبل دفع أي مبلغ.
        </p>
      </div>
    </footer>
  );
}
