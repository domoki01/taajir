import Link from "next/link";
import Image from "next/image";
import { MapPin, MessageSquare, UserRound } from "lucide-react";
import { getWilaya, placeLabel } from "@/lib/geo";
import { kRequestIntents } from "@/lib/enums";
import type { PropertyRequest } from "@/types/request";

/**
 * One demand in the feed.
 *
 * The whole card is a link to the thread rather than a card with a link in it:
 * on a phone the target is the post, and a 44px "شوف التعليقات" button at the
 * bottom of every card is both harder to hit and noisier to read.
 */
export function RequestCard({
  request,
  createdAtLabel,
}: {
  request: PropertyRequest;
  createdAtLabel: string;
}) {
  const where = request.communeSlug
    ? placeLabel(request.wilayaSlug, request.communeSlug)
    : (getWilaya(request.wilayaSlug)?.nameAr ?? request.wilayaSlug);

  return (
    <li>
      <Link
        href={`/demandes/${request.id}`}
        className="rounded-card border-border bg-surface hover:border-primary block border p-5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="bg-surface-soft relative size-9 shrink-0 overflow-hidden rounded-full">
            {request.ownerPhotoUrl ? (
              <Image
                src={request.ownerPhotoUrl}
                alt=""
                fill
                sizes="36px"
                className="object-cover"
              />
            ) : (
              <UserRound className="text-dim absolute inset-0 m-auto size-5" />
            )}
          </span>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{request.ownerName}</p>
            <time
              dateTime={new Date(request.createdAt).toISOString()}
              className="text-dim ltr-nums text-xs font-semibold"
            >
              {createdAtLabel}
            </time>
          </div>

          <span className="bg-primary-soft text-primary ms-auto shrink-0 rounded-full px-3 py-1 text-xs font-extrabold">
            {kRequestIntents[request.intent]}
          </span>
        </div>

        <h2 className="mt-3 font-extrabold">{request.title}</h2>
        <p className="text-muted mt-1 line-clamp-3 text-sm leading-relaxed whitespace-pre-line">
          {request.description}
        </p>

        <div className="text-dim mt-3 flex flex-wrap items-center gap-4 text-xs font-bold">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            {where}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="size-3.5" />
            <span className="ltr-nums">{request.replyCount ?? 0}</span> تعليق
          </span>
        </div>
      </Link>
    </li>
  );
}
