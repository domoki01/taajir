import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/layout/Container";
import { requireAdmin } from "@/server/auth";

// requireAdmin redirects a non-admin away before any child renders. The Server
// Actions behind the buttons re-check independently — reaching this page is
// never treated as proof of anything.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

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
            {[
              ["/admin", "نظرة عامة"],
              ["/admin/moderation", "طابور المراجعة"],
              ["/admin/commentaires", "التعليقات"],
              ["/admin/utilisateurs", "الحسابات"],
              ["/admin/publicites", "الإشهارات"],
              ["/admin/filtre", "الفلتر"],
              ["/admin/lancement", "الإطلاق"],
              ["/admin/journal", "السجلّ"],
            ].map(([href, label]) => (
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
