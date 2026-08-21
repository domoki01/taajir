import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { RequestWizard } from "@/components/requests/RequestWizard";
import { kIntentParam } from "@/lib/funnel";

export const metadata: Metadata = {
  title: "طلب جديد",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Posting a demand, as its own screen.
 *
 * Deliberately **not** behind `guardPrelaunch()`, unlike `/demandes` itself.
 * The feed is closed while the site is held — there is nothing to read yet —
 * but writing a demand is the entire point of the funnel, and the previous
 * version routed "حاب نشري" at the guarded feed, which bounced the visitor
 * straight back to the page they had just pressed a button on.
 *
 * Nor behind `requireUser()`, for the same reason one step further along. The
 * funnel sends people here who have never had an account, and a sign-up screen
 * in place of the form is a stranger being asked to register before being told
 * what for. `createRequest()` was always written to answer a signed-out caller
 * with `needsAuth` rather than a redirect, precisely so the account could be
 * asked for at the end with the answers already typed; this page blocking the
 * door up front is what made that branch unreachable.
 */
export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = sp[kIntentParam];
  const intent = (Array.isArray(raw) ? raw[0] : raw) ?? "";

  return (
    <main className="flex-1 px-4 py-4">
      <Container className="max-w-lg">
        <RequestWizard initialIntent={intent} />
      </Container>
    </main>
  );
}
