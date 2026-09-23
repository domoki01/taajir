<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\Permission;
use App\Models\Article;
use App\Models\ArticleComment;
use App\Models\AuditEntry;
use App\Models\User;
use App\Support\ArticleBody;
use App\Support\Links;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * ── ARTICLES ─────────────────────────────────────────────────────────────────
 * Writing on the site's own masthead, and the thread underneath.
 *
 * Two different kinds of write live here and they are guarded differently: an
 * article is staff-only and goes out in the site's name, while a comment is any
 * signed-in reader. Both are written server-side for the same reason as
 * everything else — the author name on a comment is taken from the session, so
 * a client that could write it could post as anybody.
 *
 * Ported from src/server/actions/articles.ts.
 */
final class ArticleService
{
    /** Eight a minute, the same as the listing thread. */
    private const PER_MINUTE = 8;

    /** @throws ValidationException */
    public function save(User $actor, ?Article $article, array $input): Article
    {
        abort_unless($actor->hasPermission(Permission::ArticlesManage), 403);

        $body = ArticleBody::parse($input['body']);
        if (count($body) < 3) {
            throw ValidationException::withMessages(['body' => __('article.too_short')]);
        }

        // Derived from the slug field if it is usable, never from the title: an
        // Arabic title folds to nothing, and a slug quietly invented from one
        // is a URL nobody can read.
        $slug = ArticleBody::slug($input['slug']);
        if (! preg_match(ArticleBody::SLUG_PATTERN, $slug)) {
            throw ValidationException::withMessages(['slug' => __('article.bad_slug')]);
        }
        if (in_array($slug, ArticleBody::RESERVED, true)) {
            throw ValidationException::withMessages(['slug' => __('article.reserved_slug')]);
        }

        // Checked against the table, not assumed. Two articles sharing a slug
        // means one of them is unreachable, and which one is decided by query
        // order.
        $clash = Article::query()->where('slug', $slug)
            ->when($article !== null, fn ($q) => $q->whereKeyNot($article->id))
            ->exists();
        if ($clash) {
            throw ValidationException::withMessages(['slug' => __('article.slug_taken')]);
        }

        $title = trim($input['title']);
        $published = $input['status'] === 'published';

        $attributes = [
            'slug' => $slug,
            'title' => $title,
            'excerpt' => trim($input['excerpt']),
            'body' => $body,
            'cover_url' => ArticleBody::safeCoverUrl($input['cover_url'] ?? null),
            'cover_alt' => mb_substr(trim((string) ($input['cover_alt'] ?? '')), 0, 140) ?: $title,
            'status' => $published ? 'published' : 'draft',
            'tags' => array_slice(array_values(array_filter(array_map('trim', $input['tags'] ?? []))), 0, 6),
            'read_minutes' => ArticleBody::readingMinutes($body),
        ];

        if ($article === null) {
            // The first publisher keeps the byline. An editor fixing a typo
            // three months later does not become the author of the piece.
            $attributes['author_uid'] = $actor->uid;
            $attributes['author_name'] = $actor->display_name;
        }

        // Set once, on the first publish. Re-publishing after an edit must not
        // move the piece back to the top of the list or change its dateline.
        if ($published && ($article === null || $article->published_at === null)) {
            $attributes['published_at'] = now();
        }

        if ($article === null) {
            $article = Article::create($attributes);
        } else {
            $article->update($attributes);
        }

        AuditEntry::record($actor, $article->wasRecentlyCreated ? 'article.create' : 'article.edit', 'article', $slug);

        return $article;
    }

    public function delete(User $actor, Article $article): void
    {
        abort_unless($actor->hasPermission(Permission::ArticlesManage), 403);

        $slug = $article->slug;
        // The thread goes with it. Left behind, its comments are orphans no
        // screen can reach or moderate — the cascade on the foreign key does
        // this, and it is named here so it is not mistaken for an oversight.
        $article->delete();

        AuditEntry::record($actor, 'article.delete', 'article', $slug);
    }

    /**
     * A reader's comment on an article.
     *
     * @throws ValidationException
     */
    public function comment(User $user, Article $article, string $text): ArticleComment
    {
        // Commenting on a draft would leak that it exists, and there is nothing
        // to discuss on a page nobody can read.
        if (! $article->isPublished()) {
            throw ValidationException::withMessages(['text' => __('article.not_open')]);
        }

        // mayPublish() is approval and the ban in one question, and it is the
        // same one the publish wizard and the demand form ask.
        if (! $user->mayPublish()) {
            throw ValidationException::withMessages([
                'text' => __($user->is_banned ? 'listing.banned' : 'listing.awaiting_approval'),
            ]);
        }

        $key = 'article-comment:'.$user->uid;
        if (! RateLimiter::attempt($key, self::PER_MINUTE, fn () => true, 60)) {
            throw ValidationException::withMessages([
                'text' => __('community.too_fast', ['seconds' => RateLimiter::availableIn($key)]),
            ]);
        }

        $text = trim($text);

        // Refused, never stripped — the same rule the listing thread uses.
        // Silently editing what somebody wrote is worse than telling them why,
        // and a stripped link leaves a sentence that no longer says anything.
        if (Links::present($text)) {
            throw ValidationException::withMessages(['text' => Links::refusalMessage()]);
        }

        // The same automatic check as everywhere people write in public, but
        // only its refusing half: a comment has no queue to wait in, so
        // "unsure" means publish.
        $verdict = Policy::check('', $text);
        if ($verdict['decision'] === Policy::REJECT) {
            throw ValidationException::withMessages(['text' => $verdict['reason']]);
        }

        return DB::transaction(function () use ($user, $article, $text): ArticleComment {
            $comment = $article->comments()->create([
                'author_uid' => $user->uid,
                'author_name' => $user->display_name,
                'author_photo_url' => $user->photo_url,
                'text' => $text,
                'status' => 'visible',
                'created_at' => now(),
            ]);

            $article->increment('comment_count');

            return $comment;
        });
    }

    /** The author may remove their own; staff may remove any. */
    public function deleteComment(User $user, ArticleComment $comment): void
    {
        abort_unless(
            $comment->author_uid === $user->uid || $user->hasPermission(Permission::CommentsModerate),
            403,
        );

        DB::transaction(function () use ($comment): void {
            $article = $comment->article;
            $comment->delete();
            // Clamped: a count that has already drifted must not go negative
            // and start reading as "minus one comment".
            $article->update(['comment_count' => max(0, $article->comment_count - 1)]);
        });
    }

    /**
     * Staff hide rather than delete, as with listing comments: the decision
     * stays reviewable, which matters when the person hidden disputes it.
     */
    public function hideComment(User $actor, ArticleComment $comment, string $reason): void
    {
        abort_unless($actor->hasPermission(Permission::CommentsModerate), 403);

        $comment->update([
            'status' => 'hidden',
            'hidden_reason' => trim($reason) ?: null,
        ]);

        AuditEntry::record($actor, 'comment.hide', 'comment', (string) $comment->id, ['reason' => trim($reason)]);
    }
}
