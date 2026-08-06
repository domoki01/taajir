"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MessageSquare, Paperclip, Trash2, UserRound } from "lucide-react";
import { addReply, deleteReply } from "@/server/actions/requests";
import { ListingChip } from "./ListingChip";
import type { RequestReply } from "@/types/request";

/** A reply plus the absolute date the server already formatted for it. */
export type ThreadReply = RequestReply & { createdAtLabel: string };

/** What the attach dropdown offers: the replier's own published ads. */
export type AttachableListing = { id: string; title: string };

export function RequestThread({
  requestId,
  replies,
  viewerUid,
  isStaff,
  myListings,
}: {
  requestId: string;
  replies: ThreadReply[];
  /** null when signed out — resolved on the server, so no auth flash. */
  viewerUid: string | null;
  isStaff: boolean;
  myListings: AttachableListing[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [listingId, setListingId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || text.trim().length < 2) return;
    setError(null);

    startTransition(async () => {
      const res = await addReply(requestId, text, listingId || null);
      if (res.ok) {
        setText("");
        setListingId("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function onDelete(replyId: string) {
    startTransition(async () => {
      const res = await deleteReply(requestId, replyId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const next = encodeURIComponent(`/demandes/${requestId}`);

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <MessageSquare className="size-5" />
        التعليقات
        {replies.length > 0 && (
          <span className="text-dim ltr-nums text-sm font-bold">
            ({replies.length})
          </span>
        )}
      </h2>

      {/* ── THREAD ───────────────────────────────────────────────────────── */}
      {replies.length === 0 ? (
        <p className="text-muted mt-3 text-sm">
          ما كاش تعليقات. إذا عندك واش يناسبه، كون أول واحد يجاوبه.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {replies.map((r) => (
            <li key={r.id} className="flex gap-3">
              <span className="bg-surface-soft relative size-9 shrink-0 overflow-hidden rounded-full">
                {r.authorPhotoUrl ? (
                  <Image
                    src={r.authorPhotoUrl}
                    alt=""
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                ) : (
                  <UserRound className="text-dim absolute inset-0 m-auto size-5" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                  {r.authorName}
                  {r.isOwner && (
                    <span className="bg-primary-soft text-primary rounded-full px-2 py-0.5 text-[11px] font-bold">
                      صاحب الطلب
                    </span>
                  )}
                  <time
                    dateTime={new Date(r.createdAt).toISOString()}
                    className="text-dim ltr-nums text-xs font-semibold"
                  >
                    {r.createdAtLabel}
                  </time>
                </p>
                <p className="text-muted mt-1 text-sm leading-relaxed whitespace-pre-line">
                  {r.text}
                </p>
                {r.listing && <ListingChip listing={r.listing} />}
              </div>

              {(r.authorUid === viewerUid || isStaff) && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onDelete(r.id)}
                  aria-label={`حذف تعليق ${r.authorName}`}
                  className="text-dim hover:text-danger shrink-0 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ── COMPOSER ─────────────────────────────────────────────────────── */}
      {viewerUid ? (
        <form onSubmit={onSubmit} className="mt-6">
          <label htmlFor="reply" className="sr-only">
            تعليقك
          </label>
          <textarea
            id="reply"
            rows={3}
            maxLength={800}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="جاوبه: واش عندك، وين، وبشحال…"
            className="rounded-input border-border focus:border-primary w-full border bg-white px-4 py-3 text-base outline-none"
          />

          {/* ── ATTACH ─────────────────────────────────────────────────────
              Only rendered for someone who actually has published ads. An
              empty dropdown labelled "شارك إعلان" tells a buyer the feature is
              broken rather than that it is not for them. */}
          {myListings.length > 0 && (
            <div className="mt-2">
              <label
                htmlFor="reply-listing"
                className="text-muted mb-1.5 flex items-center gap-1.5 text-xs font-bold"
              >
                <Paperclip className="size-3.5" />
                شارك واحد من إعلاناتك (اختياري)
              </label>
              <select
                id="reply-listing"
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                className="rounded-input border-border focus:border-primary w-full appearance-none border bg-white px-4 py-2.5 text-sm font-semibold outline-none"
              >
                <option value="">بلا إعلان</option>
                {myListings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p role="alert" className="text-danger mt-2 text-sm font-bold">
              {error}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending || text.trim().length < 2}
              className="bg-accent rounded-input px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {pending ? "…" : "علّق"}
            </button>
            <span className="text-dim ltr-nums text-xs">{text.length}/800</span>
          </div>

          <p className="text-dim mt-2 text-xs leading-relaxed">
            ممنوع تحط روابط. إذا عندك عقار، شاركه من القائمة فوق — هكذا يوصل
            للناس بالصورة والسعر.
          </p>
        </form>
      ) : (
        <div className="rounded-card border-border bg-surface-soft mt-6 border p-4 text-center">
          <p className="text-muted text-sm font-semibold">
            لازم تسجّل الدخول باش تعلّق.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link
              href={`/connexion?next=${next}`}
              className="bg-accent rounded-input px-5 py-2.5 text-sm font-bold text-white"
            >
              دخول
            </Link>
            <Link
              href={`/inscription?next=${next}`}
              className="rounded-input border-border border bg-white px-5 py-2.5 text-sm font-bold"
            >
              حساب جديد
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
