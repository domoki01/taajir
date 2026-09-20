<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\Permission;
use App\Models\Comment;
use App\Models\Listing;
use App\Models\User;
use App\Support\Links;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Comments under an ad.
 *
 * The author's name and photo come from the verified session, never from the
 * request — otherwise anyone could post as "وكالة موثّقة" and borrow its
 * credibility.
 */
final class CommentService
{
    /** Eight a minute. Enough for a conversation, not enough for a flood. */
    private const PER_MINUTE = 8;

    public function create(User $author, Listing $listing, string $text): Comment
    {
        $this->throttle($author);

        // Refused, never stripped. Silently editing what someone wrote is worse
        // than telling them why it was rejected, and a stripped link leaves a
        // sentence that no longer says anything.
        if (Links::present($text)) {
            throw ValidationException::withMessages(['text' => Links::refusalMessage()]);
        }

        return $listing->comments()->getQuery()->create([
            'listing_id' => $listing->id,
            'author_uid' => $author->uid,
            'author_name' => $author->display_name,
            'author_photo_url' => $author->photo_url,
            // A badge on the ad's own author, so a reader can tell the seller
            // from everyone else without cross-referencing names.
            'is_owner' => $author->uid === $listing->owner_uid,
            'text' => trim($text),
            'status' => 'visible',
            'created_at' => now(),
        ]);
    }

    /**
     * Hiding keeps the row.
     *
     * A moderator hides; the author deletes their own. The distinction matters:
     * a hidden comment can still be read by the person who wrote it and by the
     * moderators, which is what makes an appeal possible.
     */
    public function hide(User $actor, Comment $comment, string $reason): Comment
    {
        $this->authorise($actor, $comment);

        $comment->update(['status' => 'hidden', 'hidden_reason' => $reason]);

        return $comment;
    }

    public function delete(User $actor, Comment $comment): void
    {
        $this->authorise($actor, $comment);

        $comment->delete();
    }

    /** The author, or somebody holding the permission. Nobody else. */
    private function authorise(User $actor, Comment $comment): void
    {
        $allowed = $actor->uid === $comment->author_uid
            || $actor->hasPermission(Permission::CommentsModerate);

        abort_unless($allowed, 403);
    }

    private function throttle(User $author): void
    {
        $key = 'comment:'.$author->uid;

        if (RateLimiter::tooManyAttempts($key, self::PER_MINUTE)) {
            throw ValidationException::withMessages([
                'text' => __('community.too_fast', ['seconds' => RateLimiter::availableIn($key)]),
            ]);
        }

        RateLimiter::hit($key, 60);
    }
}
