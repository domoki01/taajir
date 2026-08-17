"use client";

// ── THE THREAD UNDER AN ARTICLE ──────────────────────────────────────────────
// Signed-in readers only, which is the whole shape of the feature: an open
// comment box on an indexable page is a link-spam target, and the account
// requirement is what makes a nuisance traceable and bannable.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { EyeOff, MessageSquare, Trash2 } from "lucide-react";
import {
  addArticleComment,
  deleteArticleComment,
  hideArticleComment,
} from "@/server/actions/articles";
import type { ArticleComment } from "@/types/article";

function when(at: number): string {
  return new Date(at).toLocaleDateString("ar-DZ", {
    day: "numeric",
    month: "short",
  });
}

export function ArticleThread({
  articleId,
  comments,
  slug,
  currentUid,
  mayModerate,
  signedIn,
}: {
  articleId: string;
  comments: ArticleComment[];
  slug: string;
  currentUid: string | null;
  mayModerate: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNeedsAuth(false);
    startTransition(async () => {
      const res = await addArticleComment(articleId, text);
      if (res.ok) {
        setText("");
        router.refresh();
      } else {
        setError(res.error);
        // The typed text is kept on purpose: a session that expired mid-write
        // must not cost somebody the paragraph they just wrote.
        setNeedsAuth(res.needsAuth === true);
      }
    });
  }

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await work();
      if (res.ok) router.refresh();
      else setError(res.error ?? "ما نجحش");
    });
  }

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <MessageSquare className="size-5" />
        التعليقات
        {comments.length > 0 && (
          <span className="text-dim ltr-nums text-sm font-bold">
            ({comments.length})
          </span>
        )}
      </h2>

      {signedIn ? (
        <form onSubmit={submit} className="mt-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="اكتب رأيك…"
            className="rounded-input border-border focus:border-primary w-full border bg-white px-4 py-3 text-sm leading-relaxed outline-none"
          />
          <button
            type="submit"
            disabled={pending || text.trim().length < 2}
            className="bg-accent rounded-input mt-2 px-6 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "راه يبعث…" : "علّق"}
          </button>
        </form>
      ) : (
        <div className="rounded-card border-border bg-surface mt-4 border p-5 text-center">
          <p className="text-muted text-sm leading-relaxed font-semibold">
            التعليق للمسجّلين برك. سجّل دخولك باش تشارك رأيك.
          </p>
          <Link
            href={`/connexion?next=${encodeURIComponent(`/articles/${slug}`)}`}
            className="bg-accent rounded-input mt-3 inline-block px-6 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            سجّل الدخول
          </Link>
        </div>
      )}

      {error && (
        <p className="rounded-input bg-danger/10 text-danger mt-3 px-4 py-3 text-sm font-bold">
          {error}
          {needsAuth && (
            <Link
              href={`/connexion?next=${encodeURIComponent(`/articles/${slug}`)}`}
              className="ms-2 underline"
            >
              سجّل الدخول
            </Link>
          )}
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-dim mt-4 text-sm font-semibold">
          ما كاش تعليقات. كون أوّل واحد.
        </p>
      ) : (
        <ul className="mt-5 grid gap-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className={`rounded-card border-border bg-surface border p-4 ${
                comment.status === "hidden" ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="bg-surface-soft relative size-8 shrink-0 overflow-hidden rounded-full">
                  {comment.authorPhotoUrl && (
                    <Image
                      src={comment.authorPhotoUrl}
                      alt=""
                      fill
                      sizes="32px"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </span>
                <span className="truncate text-sm font-bold">
                  {comment.authorName}
                </span>
                <span className="text-dim ltr-nums ms-auto shrink-0 text-xs font-semibold">
                  {when(comment.createdAt)}
                </span>

                {(comment.authorUid === currentUid || mayModerate) && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => deleteArticleComment(articleId, comment.id))
                    }
                    aria-label="امسح التعليق"
                    className="text-dim hover:text-danger shrink-0 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                {mayModerate && comment.status === "visible" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        hideArticleComment(articleId, comment.id, "مخالف"),
                      )
                    }
                    aria-label="خبّي التعليق"
                    className="text-dim hover:text-warning shrink-0 transition-colors disabled:opacity-40"
                  >
                    <EyeOff className="size-4" />
                  </button>
                )}
              </div>

              <p className="text-muted mt-2 text-sm leading-relaxed whitespace-pre-line">
                {comment.text}
              </p>
              {comment.status === "hidden" && (
                <p className="text-warning mt-1 text-xs font-bold">
                  هذا التعليق مخبّي — يشوفوه غير صاحبو والمشرفين.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
