import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronRight, EyeOff, MapPin, UserRound } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/layout/Container";
import {
  RequestThread,
  type ThreadReply,
} from "@/components/requests/RequestThread";
import { DeleteRequestButton } from "@/components/requests/DeleteRequestButton";
import {
  getReplies,
  getRequest,
  listMyPublishedListings,
} from "@/server/requests";
import { getUser, hasPermission } from "@/server/auth";
import { kDefaultShareImage } from "@/lib/constants";
import { ShareButtons } from "@/components/share/ShareButtons";
import { getWilaya, placeLabel } from "@/lib/geo";
import { formatFullDateTime } from "@/lib/datetime";
import { kRequestIntents } from "@/lib/enums";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const request = await getRequest(id);
  if (!request || request.status !== "visible") {
    return { title: "الطلب ما كاينش", robots: { index: false } };
  }
  return {
    title: request.title,
    description: request.description.slice(0, 160),
    alternates: { canonical: `/demandes/${id}` },
    // A demand has no photo by design, so every shared one takes the brand
    // card. Without it a demand pasted into a group is a grey rectangle.
    openGraph: {
      type: "article",
      title: request.title,
      description: request.description.slice(0, 200).replace(/\s+/g, " "),
      images: [kDefaultShareImage],
    },
  };
}

export default async function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [request, user] = await Promise.all([getRequest(id), getUser()]);
  if (!request) notFound();

  const staff = hasPermission(user, "requests.moderate");
  const isOwner = user?.uid === request.ownerUid;
  // A hidden request stays visible to its author and to staff. Anyone else gets
  // the same 404 as a request that never existed — a "this was hidden" page
  // tells a spammer exactly which post was caught.
  if (request.status !== "visible" && !isOwner && !staff) notFound();

  const [replies, myListings] = await Promise.all([
    getReplies(id),
    user ? listMyPublishedListings(user.uid) : Promise.resolve([]),
  ]);

  const thread: ThreadReply[] = replies.map((r) => ({
    ...r,
    createdAtLabel: formatFullDateTime(r.createdAt),
  }));

  const where = request.communeSlug
    ? placeLabel(request.wilayaSlug, request.communeSlug)
    : (getWilaya(request.wilayaSlug)?.nameAr ?? request.wilayaSlug);

  return (
    <>
      <Header />
      <main className="flex-1 py-8">
        <Container>
          <Link
            href="/demandes"
            className="text-muted hover:text-primary inline-flex items-center gap-1 text-sm font-bold transition-colors"
          >
            <ChevronRight className="size-4" />
            كل الطلبات
          </Link>

          <article className="rounded-card border-border bg-surface mt-4 border p-5">
            {request.status !== "visible" && (
              <p className="rounded-input bg-warning/10 text-warning mb-4 flex items-center gap-2 px-4 py-3 text-sm font-bold">
                <EyeOff className="size-4 shrink-0" />
                هذا الطلب مخفي. ما يشوفوهش غير أنت والإدارة.
              </p>
            )}

            <div className="flex items-center gap-3">
              <span className="bg-surface-soft relative size-10 shrink-0 overflow-hidden rounded-full">
                {request.ownerPhotoUrl ? (
                  <Image
                    src={request.ownerPhotoUrl}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                ) : (
                  <UserRound className="text-dim absolute inset-0 m-auto size-5" />
                )}
              </span>

              <div className="min-w-0">
                <p className="truncate font-bold">{request.ownerName}</p>
                <time
                  dateTime={new Date(request.createdAt).toISOString()}
                  className="text-dim ltr-nums text-xs font-semibold"
                >
                  {formatFullDateTime(request.createdAt)}
                </time>
              </div>

              <span className="bg-primary-soft text-primary ms-auto shrink-0 rounded-full px-3 py-1 text-xs font-extrabold">
                {kRequestIntents[request.intent]}
              </span>
            </div>

            <h1 className="mt-4 text-xl font-extrabold">{request.title}</h1>
            <p className="text-muted mt-2 leading-relaxed whitespace-pre-line">
              {request.description}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-dim inline-flex items-center gap-1.5 text-sm font-bold">
                <MapPin className="size-4" />
                {where}
              </span>
              {(isOwner || staff) && (
                <span className="ms-auto">
                  <DeleteRequestButton id={id} />
                </span>
              )}
            </div>
          </article>

          <RequestThread
            requestId={id}
            replies={thread}
            viewerUid={user?.uid ?? null}
            isStaff={staff}
            myListings={myListings.map((l) => ({ id: l.id, title: l.title }))}
          />

          {/* After the thread, like the listing page puts it after the
              comments. Answering a demand is what this page is for; sharing is
              what somebody does once they have read it and thought of a cousin.
              Above the thread it was neither — just the thing standing between
              the demand and the box for replying to it. */}
          <div className="mt-8">
            <ShareButtons path={`/demandes/${id}`} text={request.title} />
          </div>
        </Container>
      </main>
    </>
  );
}
