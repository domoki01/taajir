<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\ListingStatus;
use App\Models\AuditEntry;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * What a moderator can do to an ad, and the bookkeeping each action owes.
 *
 * Two things every one of these must get right. The owner's
 * `active_listing_count` has to follow the ad in and out of the statuses that
 * count against a quota — a rejection that forgets to decrement leaves someone
 * permanently unable to post. And every action writes an audit row, because a
 * decision that cannot be questioned later is one nobody can appeal.
 */
final class ModerationService
{
    public function approve(User $actor, Listing $listing): Listing
    {
        return DB::transaction(function () use ($actor, $listing) {
            // During the pre-launch hold, approving does NOT publish. The ad
            // stays invisible and is cleared for the batch instead; reusing
            // `published` here would put it on the site the moment this button
            // was clicked.
            if ($listing->status === ListingStatus::PendingLaunch->value) {
                $listing->update(['approved_for_launch' => true, 'rejection_reason' => null]);
                AuditEntry::record($actor, 'listing.approve_for_launch', 'listing', $listing->id);

                return $listing;
            }

            $this->applyStatus($listing, ListingStatus::Published, [
                'rejection_reason' => null,
                'policy_rule' => null,
                // Set once, the first time an ad goes live, and never again.
                //
                // `status` is what makes an ad invisible; `published_at` is the
                // historical fact of when it first appeared. Rejecting and
                // archiving deliberately leave it alone — clearing it would
                // conflate the two, and a moderator who rejected something by
                // mistake and fixed it two minutes later would have shuffled a
                // month-old ad back to the top of "الأحدث".
                'published_at' => $listing->published_at ?? now(),
            ]);

            AuditEntry::record($actor, 'listing.approve', 'listing', $listing->id);

            return $listing;
        });
    }

    public function reject(User $actor, Listing $listing, string $reason): Listing
    {
        return DB::transaction(function () use ($actor, $listing, $reason) {
            $this->applyStatus($listing, ListingStatus::Rejected, [
                // Shown to the owner on their dashboard. A rejection with no
                // reason is one they cannot act on, so they post it again.
                'rejection_reason' => $reason,
            ]);

            AuditEntry::record($actor, 'listing.reject', 'listing', $listing->id, ['reason' => $reason]);

            return $listing;
        });
    }

    public function feature(User $actor, Listing $listing, bool $featured): Listing
    {
        $listing->update(['is_featured' => $featured]);
        AuditEntry::record($actor, $featured ? 'listing.feature' : 'listing.unfeature', 'listing', $listing->id);

        return $listing;
    }

    public function archive(User $actor, Listing $listing): Listing
    {
        return DB::transaction(function () use ($actor, $listing) {
            $this->applyStatus($listing, ListingStatus::Archived);
            AuditEntry::record($actor, 'listing.archive', 'listing', $listing->id);

            return $listing;
        });
    }

    /**
     * Move an ad between statuses and keep the owner's counter honest.
     *
     * The counter tracks how many ads occupy a quota slot, so it moves only
     * when the ad crosses the boundary between statuses that count and statuses
     * that do not — not on every edit.
     *
     * @param  array<string, mixed>  $extra
     */
    private function applyStatus(Listing $listing, ListingStatus $to, array $extra = []): void
    {
        $from = ListingStatus::from($listing->status);

        $listing->update(['status' => $to->value] + $extra);

        if ($from->countsAgainstQuota() === $to->countsAgainstQuota()) {
            return;
        }

        $owner = User::query()->lockForUpdate()->find($listing->owner_uid);
        if ($owner === null) {
            return;
        }

        if ($to->countsAgainstQuota()) {
            $owner->increment('active_listing_count');

            return;
        }

        // Never below zero. A counter that goes negative hands out free quota,
        // and the data that got it there is already wrong.
        $owner->update(['active_listing_count' => max(0, $owner->active_listing_count - 1)]);
    }
}
