import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/layout/Container";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { getUser } from "@/server/auth";

// Authorisation lives in the pages, not in middleware: verifying a session
// cookie needs the Admin SDK, and every Server Action re-checks independently
// anyway.
//
// This layout used to call requireUser() itself, which looked like the safest
// possible arrangement and quietly broke every page under it. A layout renders
// before its children and — in the App Router — cannot know the pathname, so
// its redirect always sent people to /connexion?next=/tableau-de-bord no matter
// which screen they had asked for. The per-page requireUser("/tableau-de-bord/…")
// calls, each carrying the right destination, never ran.
//
// So the layout resolves the session but does not gate on it: when nobody is
// signed in it renders the child alone, and the child's own guard redirects
// with its own path. Nothing is rendered to a stranger either way — the pages
// under here fetch after they guard — and tests/unit/dashboard-guards.test.ts
// checks every page in this group actually carries that guard, which is a
// stronger promise than the one line above it used to make.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) return <>{children}</>;

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
              href="/tableau-de-bord/publications"
              className="rounded-input border-border bg-surface hover:border-primary border px-4 py-2 text-sm font-bold transition-colors"
            >
              منشوراتي
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
    </>
  );
}
