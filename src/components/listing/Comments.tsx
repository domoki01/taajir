"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MessageSquare, Trash2, UserRound } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { addComment, deleteComment } from "@/server/actions/comments";
import type { Comment } from "@/types/comment";

/** A comment plus the absolute date the server already formatted for it. */
export type ThreadComment = Comment & { createdAtLabel: string };

/** "قبل 5 دقائق" — Intl handles the Arabic plural forms we would get wrong. */
function timeAgo(ms: number): string {
  const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
  const diff = (ms - Date.now()) / 1000;
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diff) >= secs)
      return rtf.format(Math.round(diff / secs), unit);
  }
  return "الآن";
}

export function Comments({
  listingId,
  listingPath,
  comments,
}: {
  listingId: string;
  listingPath: string;
  comments: ThreadComment[];
}) {
  const router = useRouter();

  // Relative time is computed from Date.now(), which differs between the server
  // render and hydration — React discards the server HTML for the mismatched
  // subtree. So the first paint shows the absolute date the server formatted,
  // and this flips to "قبل 5 دقائق" once hydrated. Both are correct readings of
  // the same timestamp, so the swap is not a flash of wrong content.
  //
  // useSyncExternalStore rather than an effect: it is the one hook that takes a
  // separate server snapshot, so React knows the two renders differ on purpose
  // instead of finding out by comparing the DOM.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Resolved client-side so the page around it stays statically cached. Until
  // it settles, `undefined` means "unknown" and neither the composer nor the
  // sign-in prompt is shown — flashing one and replacing it with the other
  // reads as a bug.
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null)), []);
  const currentUid = uid ?? null;
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || text.trim().length < 2) return;
    setError(null);
    setNeedsAuth(false);

    startTransition(async () => {
      const res = await addComment(listingId, text);
      if (res.ok) {
        setText("");
        router.refresh();
      } else {
        setError(res.error);
        // The session can expire between loading the page and posting, so this
        // is checked on the response rather than assumed from the initial render.
        setNeedsAuth(res.needsAuth === true);
      }
    });
  }

  function onDelete(commentId: string) {
    startTransition(async () => {
      const res = await deleteComment(listingId, commentId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <MessageSquare className="size-5" />
        الأسئلة والتعليقات
        {comments.length > 0 && (
          <span className="text-dim ltr-nums text-sm font-bold">
            ({comments.length})
          </span>
        )}
      </h2>

      {/* ── THREAD ───────────────────────────────────────────────────────── */}
      {comments.length === 0 ? (
        <p className="text-muted mt-3 text-sm">
          ما كاش تعليقات. كون أول واحد يسأل صاحب الإعلان.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <div className="bg-surface-soft relative size-9 shrink-0 overflow-hidden rounded-full">
                {c.authorPhotoUrl ? (
                  <Image
                    src={c.authorPhotoUrl}
                    alt=""
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                ) : (
                  <UserRound className="text-dim absolute inset-0 m-auto size-5" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                  {c.authorName}
                  {c.isOwner && (
                    <span className="bg-primary-soft text-primary rounded-full px-2 py-0.5 text-[11px] font-bold">
                      صاحب الإعلان
                    </span>
                  )}
                  <time
                    dateTime={new Date(c.createdAt).toISOString()}
                    className="text-dim text-xs font-semibold"
                  >
                    {hydrated ? timeAgo(c.createdAt) : c.createdAtLabel}
                  </time>
                </p>
                <p className="text-muted mt-1 text-sm leading-relaxed whitespace-pre-line">
                  {c.text}
                </p>
              </div>

              {c.authorUid === currentUid && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onDelete(c.id)}
                  aria-label="حذف التعليق"
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
      {uid === undefined ? null : currentUid ? (
        <form onSubmit={onSubmit} className="mt-6">
          <label htmlFor="comment" className="sr-only">
            تعليقك
          </label>
          <textarea
            id="comment"
            rows={3}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="اسأل عن العقار: الطابق، الوثائق، وقت المعاينة…"
            className="rounded-input border-border focus:border-primary w-full border bg-white px-4 py-3 text-base outline-none"
          />

          {error && (
            <p role="alert" className="text-danger mt-2 text-sm font-bold">
              {error}{" "}
              {needsAuth && (
                <Link
                  href={`/connexion?next=${encodeURIComponent(listingPath)}`}
                  className="underline"
                >
                  سجّل الدخول
                </Link>
              )}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={pending || text.trim().length < 2}
              className="bg-accent rounded-input px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {pending ? "…" : "انشر التعليق"}
            </button>
            <span className="text-dim ltr-nums text-xs">
              {text.length}/1000
            </span>
          </div>

          <p className="text-dim mt-2 text-xs leading-relaxed">
            ما تكتبش رقم هاتفك ولا عنوانك في التعليق — التعليقات يشوفها الجميع.
          </p>
        </form>
      ) : (
        <div className="rounded-card border-border bg-surface-soft mt-6 border p-4 text-center">
          <p className="text-muted text-sm font-semibold">
            لازم تسجّل الدخول باش تعلّق.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link
              href={`/connexion?next=${encodeURIComponent(listingPath)}`}
              className="bg-accent rounded-input px-5 py-2.5 text-sm font-bold text-white"
            >
              دخول
            </Link>
            <Link
              href={`/inscription?next=${encodeURIComponent(listingPath)}`}
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
