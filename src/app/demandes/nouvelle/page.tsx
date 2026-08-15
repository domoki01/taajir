import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { RequestWizard } from "@/components/requests/RequestWizard";
import { requireUser } from "@/server/auth";
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
 */
export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = sp[kIntentParam];
  const intent = (Array.isArray(raw) ? raw[0] : raw) ?? "";

  // The destination is carried through sign-in, so someone arriving cold keeps
  // the answer they gave on the funnel instead of being asked for it twice.
  await requireUser(
    `/demandes/nouvelle${intent ? `?${kIntentParam}=${intent}` : ""}`,
  );

  return (
    <main className="flex-1 px-4 py-4">
      <Container className="max-w-lg">
        <RequestWizard initialIntent={intent} />
      </Container>
    </main>
  );
}
