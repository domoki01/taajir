import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/layout/Container";
import { AdminNav } from "@/components/admin/AdminNav";
import { kAdminNav } from "@/app/admin/nav";
import { hasPermission, requireStaff } from "@/server/auth";

/**
 * The admin shell: who you are, where you are, and the way back to the site.
 *
 * The nav is filtered rather than greyed out — a link to a screen that will
 * bounce you is worse than no link. Each page guards itself again, and so does
 * every Server Action behind it: this list decides what is *shown*, never what
 * is allowed. requireStaff redirects anyone holding no permission at all before
 * any child renders.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireStaff();

  const items = kAdminNav.filter(
    ({ need }) =>
      need.length === 0 || need.some((p) => hasPermission(admin, p)),
  );

  return (
    <>
      <Header />
      <main className="flex-1 py-6 md:py-8">
        <Container>
          {/* The identity line stands on its own. It used to share a row with
              the first nav button, which is why the panel opened on a title
              with a stray pill glued to it. */}
          <div className="border-border mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-4">
            <h1 className="text-lg font-black">لوحة الإشراف</h1>
            <p className="text-dim truncate text-xs font-semibold">
              {admin.email ?? admin.name}
            </p>
            <Link
              href="/"
              className="text-dim hover:text-primary ms-auto flex items-center gap-1.5 text-xs font-bold transition-colors"
            >
              <ExternalLink className="size-3.5" />
              شوف الموقع
            </Link>
          </div>

          <div className="md:flex md:items-start md:gap-8">
            <AdminNav items={items} />
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </Container>
      </main>
    </>
  );
}
