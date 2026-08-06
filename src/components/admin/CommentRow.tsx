"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import {
  deleteComment,
  hideComment,
  showComment,
} from "@/server/actions/comments";
import type { Comment } from "@/types/comment";

export function CommentRow({
  comment,
  createdAtLabel,
  listingTitle,
  listingSlug,
}: {
  comment: Comment;
  /**
   * Formatted on the server, in Africa/Algiers. Formatting a date inside a
   * client component runs once during SSR in UTC and again in the browser in
   * the reader's zone; the two disagree and React throws away the server HTML
   * for the subtree.
   */
  createdAtLabel: string;
  listingTitle: string;
  listingSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null);
      const res = await work();
      if (res.ok) {
        setAsking(false);
        router.refresh();
      } else {
        setError(res.error ?? "وقع مشكل");
      }
    });
  }

  const hidden = comment.status === "hidden";
  const control =
    "rounded-input border-border hover:border-primary border bg-white px-3 py-2 text-sm font-bold transition-colors disabled:opacity-40";

  return (
    <li
      className={`rounded-card border-border bg-surface border p-4 ${
        hidden ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
            {comment.authorName}
            {comment.isOwner && (
              <span className="bg-primary-soft text-primary rounded-full px-2 py-0.5 text-[11px] font-bold">
                صاحب الإعلان
              </span>
            )}
            {hidden && (
              <span className="bg-danger/15 text-danger rounded-full px-2 py-0.5 text-[11px] font-bold">
                مخفي
              </span>
            )}
            <span className="text-dim ltr-nums text-xs font-semibold">
              {createdAtLabel}
            </span>
          </p>

          <p className="text-muted mt-1 text-sm leading-relaxed whitespace-pre-line">
            {comment.text}
          </p>

          {hidden && comment.hiddenReason && (
            <p className="text-danger mt-1 text-xs font-semibold">
              سبب الإخفاء: {comment.hiddenReason}
            </p>
          )}

          {listingSlug ? (
            <Link
              href={`/annonce/${comment.listingId}/${listingSlug}`}
              className="text-primary mt-2 inline-block truncate text-xs font-bold underline"
            >
              على: {listingTitle}
            </Link>
          ) : (
            <p className="text-dim mt-2 text-xs">على إعلان محذوف</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hidden ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => showComment(comment.listingId, comment.id))
              }
              className={`${control} text-success inline-flex items-center gap-1.5`}
            >
              <Eye className="size-4" />
              بيّنه
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setAsking((v) => !v)}
              className={`${control} inline-flex items-center gap-1.5`}
            >
              <EyeOff className="size-4" />
              خبّيه
            </button>
          )}

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("تمسح هذا التعليق نهائياً؟")) return;
              run(() => deleteComment(comment.listingId, comment.id));
            }}
            aria-label="امسح التعليق"
            className={`${control} hover:border-danger hover:text-danger`}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {asking && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-52 flex-1">
            <label
              htmlFor={`why-${comment.id}`}
              className="text-dim mb-1 block text-xs font-bold"
            >
              سبب الإخفاء
            </label>
            <input
              id={`why-${comment.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="رقم هاتف، إهانة، إشهار…"
              className="rounded-input border-border focus:border-primary w-full border bg-white px-3 py-2 text-sm outline-none"
            />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => hideComment(comment.listingId, comment.id, reason))
            }
            className="bg-accent rounded-input px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            أكّد الإخفاء
          </button>
          <button
            type="button"
            onClick={() => setAsking(false)}
            className={control}
          >
            إلغاء
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-danger mt-2 text-sm font-bold">
          {error}
        </p>
      )}
    </li>
  );
}
