import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestComposer } from "@/components/requests/RequestComposer";
import { RequestCard } from "@/components/requests/RequestCard";
import { RequestFilter } from "@/components/requests/RequestFilter";
import { listRequests } from "@/server/requests";
import { getUser } from "@/server/auth";
import { getWilaya } from "@/lib/geo";
import { formatFullDateTime } from "@/lib/datetime";

// The composer depends on who is asking, and reading the session opts the route
// out of caching anyway — so it is stated rather than discovered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "طلبات العقار",
  description:
    "طلبات الشراء والكراء في الجزائر: قول واش تحوّس عليه — شقة، فيلا، أرض ولا محل — واللي عنده العقار يجاوبك.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.wilaya) ? sp.wilaya[0] : sp.wilaya;
  // Validated against the dataset rather than passed through: an unknown slug
  // would run a query that can only ever return nothing, and read as a bug.
  const wilaya = raw ? getWilaya(raw) : undefined;

  const [user, requests] = await Promise.all([
    getUser(),
    listRequests(wilaya?.slug),
  ]);

  return (
    <>
      <Header />
      <main className="flex-1 py-8">
        <Container>
          <div className="flex flex-wrap items-end gap-4">
            <div className="me-auto">
              <h1 className="flex items-center gap-2 text-2xl font-extrabold">
                <Megaphone className="text-primary size-6" />
                طلبات العقار
              </h1>
              <p className="text-muted mt-2 text-sm">
                قول واش تحوّس عليه، واللي عنده العقار يجاوبك في التعليقات.
              </p>
            </div>
            <RequestFilter wilayaSlug={wilaya?.slug ?? ""} />
          </div>

          <div className="mt-6">
            <RequestComposer signedIn={user !== null} />
          </div>

          {requests.length === 0 ? (
            <div className="mt-8">
              <EmptyState
                title={
                  wilaya
                    ? `ما كاش طلبات في ${wilaya.nameAr}`
                    : "ما كاش طلبات للدرك"
                }
                body="كون أول واحد ينشر طلب — واش تحوّس عليه، وفي أي بلدية."
              />
            </div>
          ) : (
            <ul className="mt-8 space-y-4">
              {requests.map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  // Formatted here, in Africa/Algiers: doing it in the client
                  // component renders UTC on the server and local time in the
                  // browser, which React reports as a hydration mismatch.
                  createdAtLabel={formatFullDateTime(r.createdAt)}
                />
              ))}
            </ul>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}
