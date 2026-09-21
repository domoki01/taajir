<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Follow;
use App\Models\Listing;
use App\Models\Notification;
use App\Models\PropertyRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * ── FOLLOWING, AND WHAT IT DELIVERS ──────────────────────────────────────────
 *
 * Following someone here means one thing: when they publish, you are told. The
 * telling is a row in `notifications`, read on the site — not the outbox, which
 * records messages meant to leave the site and has no provider behind it.
 *
 * Fan-out on write, in chunks. The alternative — asking "what has anyone I
 * follow published?" on every page view — is a join across two growing tables
 * on the hottest path on the site, to answer a question whose answer changes a
 * few times a day.
 */
final class Follows
{
    /** Notifications are inserted in batches rather than a row at a time. */
    private const CHUNK = 500;

    public function follow(User $follower, User $followed): bool
    {
        // Following yourself is not a thing anyone means to do, and it would
        // notify you about your own ads.
        if ($follower->uid === $followed->uid) {
            return false;
        }

        // firstOrCreate rather than create: the unique index already refuses a
        // second row, and a double-tapped button should be a no-op, not a 500.
        Follow::firstOrCreate(
            ['follower_uid' => $follower->uid, 'followed_uid' => $followed->uid],
            ['created_at' => now()],
        );

        return true;
    }

    public function unfollow(User $follower, User $followed): void
    {
        Follow::query()
            ->where('follower_uid', $follower->uid)
            ->where('followed_uid', $followed->uid)
            ->delete();
    }

    public function follows(?User $follower, User $followed): bool
    {
        if ($follower === null) {
            return false;
        }

        return Follow::query()
            ->where('follower_uid', $follower->uid)
            ->where('followed_uid', $followed->uid)
            ->exists();
    }

    public function followerCount(User $user): int
    {
        return Follow::query()->where('followed_uid', $user->uid)->count();
    }

    /**
     * Tell this listing's owner's followers about it.
     *
     * Called when an ad becomes publicly visible, not when it is written: an ad
     * in the moderation queue is not published, and notifying about one would
     * announce something nobody can open — and leak the contents of an ad a
     * moderator may be about to refuse.
     *
     * @return int notifications written
     */
    public function announceListing(Listing $listing): int
    {
        $owner = User::find($listing->owner_uid);

        if ($owner === null) {
            return 0;
        }

        return $this->fanOut(
            $owner,
            type: 'listing.published',
            title: __('follow.notify_listing', ['name' => $owner->display_name]),
            body: $listing->title,
            url: '/annonce/'.$listing->slug,
        );
    }

    /** Tell the owner's followers about a new demand. */
    public function announceRequest(PropertyRequest $request): int
    {
        $owner = User::find($request->owner_uid);

        if ($owner === null) {
            return 0;
        }

        return $this->fanOut(
            $owner,
            type: 'request.published',
            title: __('follow.notify_request', ['name' => $owner->display_name]),
            body: $request->title,
            url: '/demandes/'.$request->id,
        );
    }

    /** @return int rows written */
    private function fanOut(User $actor, string $type, string $title, string $body, string $url): int
    {
        $written = 0;
        $now = now();

        Follow::query()
            ->where('followed_uid', $actor->uid)
            // id as well as the column actually wanted: chunkById pages on the
            // primary key, and a select that omits it aborts the whole
            // operation rather than falling back to a plain chunk.
            ->select(['id', 'follower_uid'])
            ->chunkById(self::CHUNK, function ($followers) use (&$written, $actor, $type, $title, $body, $url, $now): void {
                $rows = $followers->map(fn ($follow) => [
                    'uid' => $follow->follower_uid,
                    'type' => $type,
                    'title' => $title,
                    'body' => mb_substr($body, 0, 300),
                    'url' => $url,
                    // Copied rather than joined: a notification has to still
                    // read correctly after the actor renames themselves, and
                    // the list is read far more often than it is written.
                    'actor_name' => $actor->display_name,
                    'actor_photo_url' => $actor->photo_url,
                    'created_at' => $now,
                ])->all();

                if ($rows !== []) {
                    DB::table('notifications')->insert($rows);
                    $written += count($rows);
                }
            });

        return $written;
    }

    /** @return int unread, for the badge */
    public function unreadCount(?User $user): int
    {
        if ($user === null) {
            return 0;
        }

        return Notification::query()->where('uid', $user->uid)->whereNull('read_at')->count();
    }

    public function markAllRead(User $user): void
    {
        Notification::query()
            ->where('uid', $user->uid)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
    }
}
