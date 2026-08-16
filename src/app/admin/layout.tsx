import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/layout/Container";
import { hasPermission, requireStaff } from "@/server/auth";
import type { Permission } from "@/lib/permissions";

/**
 * Every admin destination, and the one permission that opens it.
 *
 * The nav is filtered rather than greyed out: a link to a screen that will
 * bounce you is worse than no link. Each page guards itself again, and so does
 * every Server Action behind it — this list decides what is *shown*, never what
 * is allowed.
 */
const kAdminNav: Array<{
  href: string;
  label: string;
  /** Any one of these opens the link. Empty means everyone who got this far. */
  need: Permission[];
}> = [
  { href: "/admin", label: "نظرة عامة", need: [] },
  {
    href: "/admin/moderation",
    label: "طابور المراجعة",
    need: ["listings.moderate"],
  },
  {
    href: "/admin/commentaires",
    label: "التعليقات",
    need: ["comments.moderate"],
  },
  {
    href: "/admin/utilisateurs",
    label: "الحسابات",
    need: ["users.manage", "users.approve"],
  },
  { href: "/admin/roles", label: "الأدوار", need: ["roles.manage"] },
  { href: "/admin/publicites", label: "الإشهارات", need: ["promos.manage"] },
  { href: "/admin/filtre", label: "الفئات والفلتر", need: ["taxonomy.edit"] },
  { href: "/admin/identite", label: "الهوية", need: ["branding.edit"] },
  { href: "/admin/lancement", label: "الإطلاق", need: ["launch.control"] },
  {
    href: "/admin/notifications",
    label: "إشعار عام",
    need: ["push.broadcast"],
  },
  { href: "/admin/journal", label: "السجلّ", need: ["audit.view"] },
];

// requireStaff redirects anyone holding no permission at all away before any
// child renders. The Server Actions behind the buttons re-check independently —
// reaching this page is never treated as proof of anything.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireStaff();

  return (
    <>
      <Header />
      <main className="flex-1 py-8">
        <Container>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <p className="me-auto text-sm font-extrabold">
              لوحة الإشراف
              <span className="text-dim ms-2 text-xs font-semibold">
                {admin.email}
              </span>
            </p>
            {kAdminNav
              .filter(
                ({ need }) =>
                  need.length === 0 ||
                  need.some((p) => hasPermission(admin, p)),
              )
              .map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-input border-border bg-surface hover:border-primary border px-4 py-2 text-sm font-bold transition-colors"
                >
                  {label}
                </Link>
              ))}
          </div>
          {children}
        </Container>
      </main>
    </>
  );
}
