import Link from "next/link";
import Image from "next/image";
import { MapPin, MessageSquare, UserRound } from "lucide-react";
import { getWilaya, placeLabel } from "@/lib/geo";
import { kRequestIntents } from "@/lib/enums";
import type { PropertyRequest } from "@/types/request";

/**
 * One demand in the feed.
 *
 * Two things drive the layout. It is **compact** — a feed is scanned, and a
 * card that fills the screen means one post per screen and nothing to compare
 * it against. And the reply is a **visible target**, because answering is the
 * whole point of the feed: the previous version made the entire card one big
 * link, which reads fine but never says out loud that you are allowed to write
 * back.
 *
 * The two are in tension — a link inside a link is invalid HTML — so the title
 * carries the link and stretches over the card with `after:absolute`, and the
 * reply pill sits above it on `relative z-10`. Tapping anywhere still opens
 * the thread; tapping the pill does the same thing but says so.
 *
 * The pill is outlined rather than filled: `accent` is for filled action
 * buttons, and twenty filled emerald buttons down a feed is exactly the case
 * the 60/30/10 split in CLAUDE.md warns about — past a few, none of them read
 * as a button any more.
 */
export function RequestCard({
  request,
  createdAtLabel,
}: {
  request: PropertyRequest;
  /** Relative — "من 5 د". Formatted on the server; see lib/datetime. */
  createdAtLabel: string;
}) {
  const where = request.communeSlug
    ? placeLabel(request.wilayaSlug, request.communeSlug)
    : (getWilaya(request.wilayaSlug)?.nameAr ?? request.wilayaSlug);

  const replies = request.replyCount ?? 0;

  return (
    <li className="rounded-card border-border bg-surface hover:border-primary focus-within:border-primary relative border p-3.5 transition-colors">
      {/* ── WHO ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <span className="bg-surface-soft relative size-8 shrink-0 overflow-hidden rounded-full">
          {request.ownerPhotoUrl ? (
            <Image
              src={request.ownerPhotoUrl}
              alt=""
              fill
              sizes="32px"
              className="object-cover"
            />
          ) : (
            <UserRound className="text-dim absolute inset-0 m-auto size-4" />
          )}
        </span>

        <p className="min-w-0 truncate text-xs font-bold">
          {request.ownerName}
          <span className="text-dim font-semibold"> · </span>
          <time
            dateTime={new Date(request.createdAt).toISOString()}
            className="text-dim ltr-nums font-semibold"
          >
            {createdAtLabel}
          </time>
        </p>

        <span className="bg-primary-soft text-primary ms-auto shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold">
          {kRequestIntents[request.intent]}
        </span>
      </div>

      {/* ── WHAT ────────────────────────────────────────────────────────── */}
      <h2 className="mt-2 line-clamp-2 text-[15px] leading-snug font-extrabold">
        <Link
          href={`/demandes/${request.id}`}
          className="after:absolute after:inset-0 after:content-['']"
        >
          {request.title}
        </Link>
      </h2>
      <p className="text-muted mt-1 line-clamp-2 text-[13px] leading-relaxed whitespace-pre-line">
        {request.description}
      </p>

      {/* ── WHERE, AND THE WAY IN ───────────────────────────────────────── */}
      <div className="mt-2.5 flex items-center gap-3">
        <span className="text-dim inline-flex min-w-0 items-center gap-1 text-xs font-bold">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{where}</span>
        </span>

        <Link
          href={`/demandes/${request.id}`}
          className="rounded-input border-border text-primary hover:border-primary hover:bg-primary-soft relative z-10 ms-auto inline-flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-xs font-bold transition-colors"
        >
          <MessageSquare className="size-3.5" strokeWidth={2.6} />
          {replies > 0 ? (
            <>
              <span className="ltr-nums">{replies}</span> تعليق
            </>
          ) : (
            "علّق"
          )}
        </Link>
      </div>
    </li>
  );
}
