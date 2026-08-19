import { Header } from "@/components/layout/Header";
import { AppBar } from "@/components/app/AppBar";
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
      {/* Six identical pills used to sit here, on every screen in the section,
          wrapping into three ragged lines on a phone. The destinations moved
          into the grouped list on the account screen, where a phone expects to
          find them; what is left is the one thing a screen inside a section
          needs, which is the way back out of it. */}
      <AppBar root="/tableau-de-bord" label="حسابي" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-8">
        {children}
      </main>
    </>
  );
}
