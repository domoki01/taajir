import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { requireUser } from "@/server/auth";

// Authorisation lives here, not in middleware: verifying a session cookie needs
// the Admin SDK, and every Server Action re-checks independently anyway. This
// layer is what stops a private page rendering at all.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <>
      <Header />
      <main className="flex-1 py-8">
        <Container>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="me-auto">
              <p className="text-dim text-xs font-semibold">مرحبا</p>
              <p className="font-extrabold">{user.name || user.email}</p>
            </div>
            <Link
              href="/tableau-de-bord"
              className="rounded-input border-border bg-surface hover:border-primary border px-4 py-2 text-sm font-bold transition-colors"
            >
              نظرة عامة
            </Link>
            <Link
              href="/tableau-de-bord/annonces"
              className="rounded-input border-border bg-surface hover:border-primary border px-4 py-2 text-sm font-bold transition-colors"
            >
              إعلاناتي
            </Link>
            <Link
              href="/tableau-de-bord/alertes"
              className="rounded-input border-border bg-surface hover:border-primary border px-4 py-2 text-sm font-bold transition-colors"
            >
              تنبيهاتي
            </Link>
            <Link
              href="/tableau-de-bord/profil"
              className="rounded-input border-border bg-surface hover:border-primary border px-4 py-2 text-sm font-bold transition-colors"
            >
              معلوماتي
            </Link>
            <SignOutButton />
          </div>
          {children}
        </Container>
      </main>
      <Footer />
    </>
  );
}
