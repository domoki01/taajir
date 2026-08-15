import { Container } from "@/components/layout/Container";
import { requireUser } from "@/server/auth";

/**
 * The publish wizard gets a bare shell, not the dashboard's.
 *
 * It lives outside the (dashboard) group on purpose: that layout puts a
 * greeting, four navigation links and a sign-out button above the form, which
 * on a phone is a screenful of chrome above a screen that is meant to ask one
 * question. Route groups do not appear in the URL, so /publier is unchanged.
 *
 * Authorisation still happens before anything renders — the Server Action
 * behind the submit button checks again independently.
 */
export default async function PublishLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser("/publier");

  return (
    <main className="flex-1 px-4 py-4">
      <Container className="max-w-lg px-0">{children}</Container>
    </main>
  );
}
