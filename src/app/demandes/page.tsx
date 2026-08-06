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
import { guardPrelaunch } from "@/server/launch";
import { getCommune, getWilaya } from "@/lib/geo";
import { formatFullDateTime } from "@/lib/datetime";

// The composer depends on who is asking, and reading the session opts the route
// out of caching anyway — so it is stated rather than discovered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "طلبات العقار",
  description:
    "طلبات الشراء والكراء في الجزائر: صفّي حسب الولاية والبلدية وشوف واش يحوّسو عليه الناس، ولا انشر طلبك أنت.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) || "";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await guardPrelaunch();

  const sp = await searchParams;

  // Validated against the dataset rather than passed through: an unknown slug
  // would run a query that can only ever return nothing, and read as a bug.
  const wilaya = getWilaya(one(sp.wilaya));
  // A commune only means anything inside its wilaya — the slugs are not unique
  // across the 69 of them.
  const commune = wilaya ? getCommune(wilaya.code, one(sp.commune)) : undefined;

  const [user, requests] = await Promise.all([
    getUser(),
    listRequests(wilaya?.slug, commune?.slug),
  ]);

  const where = commune
    ? `${commune.nameAr}، ${wilaya!.nameAr}`
    : (wilaya?.nameAr ?? "");

  return (
    <>
      <Header />
      <main className="flex-1 py-6 md:py-8">
        <Container>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <Megaphone className="text-primary size-6" />
            طلبات العقار
          </h1>
          <p className="text-muted mt-2 text-sm">
            صفّي حسب الولاية والبلدية وشوف واش يحوّسو عليه الناس — وإذا عندك
            عقار يناسبهم، علّق عليه.
          </p>

          {/* The filter leads, before the composer: most people arrive to read
              demands, not to write one. */}
          <div className="mt-5">
            <RequestFilter
              wilayaSlug={wilaya?.slug ?? ""}
              communeSlug={commune?.slug ?? ""}
            />
          </div>

          <div className="mt-4">
            <RequestComposer signedIn={user !== null} />
          </div>

          <div className="mt-6 flex items-baseline gap-2">
            <h2 className="font-extrabold">
              {where ? `طلبات ${where}` : "كل الطلبات"}
            </h2>
            <span className="text-dim ltr-nums text-sm font-bold">
              {requests.length}
            </span>
          </div>

          {requests.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title={
                  where ? `ما كاش طلبات في ${where}` : "ما كاش طلبات للدرك"
                }
                body={
                  where
                    ? "جرّب ولاية ولا بلدية أخرى، ولا كون أول واحد ينشر طلب هنا."
                    : "كون أول واحد ينشر طلب — واش تحوّس عليه، وفي أي بلدية."
                }
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-4">
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
