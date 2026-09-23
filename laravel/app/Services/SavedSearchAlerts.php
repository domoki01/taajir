<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Listing;
use App\Models\SavedSearch;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Tell people whose saved search a new ad matches.
 *
 * Called at the one moment an ad becomes visible. Notifying at submission
 * would leak unmoderated content, and an ad later refused would already have
 * been announced to everyone watching that wilaya.
 *
 * Nothing here may fail a publish. A moderator pressing «تأكيد» cares that the
 * ad went live; an alert that did not get written is worth a log line, not a
 * rolled-back approval.
 *
 * Ported from src/server/push.ts, with the outbox in place of the FCM call.
 */
final class SavedSearchAlerts
{
    public function __construct(private readonly Outbox $outbox) {}

    /** @return int people told */
    public function notify(Listing $listing): int
    {
        try {
            return $this->fanOut($listing);
        } catch (\Throwable $e) {
            report($e);

            return 0;
        }
    }

    private function fanOut(Listing $listing): int
    {
        /*
         * Anchored on the wilaya because every saved search has one, so this is
         * a bounded index lookup rather than a scan. The rest of the shape is
         * checked in PHP over what comes back — three nullable columns, where
         * null means "anything", which is not a filter a query expresses
         * cheaply.
         */
        $searches = SavedSearch::query()
            ->where('wilaya_slug', $listing->wilaya_slug)
            ->where('notify', true)
            // Never tell somebody about their own ad.
            ->where('owner_uid', '!=', $listing->owner_uid)
            ->limit(500)
            ->get()
            ->filter(fn (SavedSearch $search) => $this->matches($search, $listing));

        if ($searches->isEmpty()) {
            return 0;
        }

        // The model's own formatter, so the alert quotes a price exactly the
        // way the card and the listing page do — including the unit, which a
        // rental alert without it would be wrong by a factor of months.
        $price = $listing->formattedPrice();

        $told = 0;

        /*
         * One person can hold several alerts that all match the same ad. They
         * get one message, keyed on the first — and every matching search still
         * has its counter moved, because the count is what tells somebody their
         * alert is alive.
         */
        foreach ($searches->groupBy('owner_uid') as $ownerUid => $matching) {
            $owner = User::query()->find($ownerUid);

            if ($owner === null || ! $owner->notify_on_saved_search) {
                // A silenced account still accumulates the count: turning
                // alerts back on should not look like the search was asleep.
                $this->touch($matching);

                continue;
            }

            $told += $this->outbox->queueFor(
                $owner,
                __('community.alert_title', ['label' => $matching->first()->label]),
                $listing->title.' — '.$price,
                $listing->path(),
            ) > 0 ? 1 : 0;

            $this->touch($matching);
        }

        return $told;
    }

    /** @param Collection<int, SavedSearch> $searches */
    private function touch(Collection $searches): void
    {
        SavedSearch::query()
            ->whereIn('id', $searches->pluck('id'))
            ->update(['last_notified_at' => now(), 'match_count' => DB::raw('match_count + 1')]);
    }

    /** A null column on the search means "anything", which is how it was saved. */
    private function matches(SavedSearch $search, Listing $listing): bool
    {
        foreach ([
            [$search->commune_slug, $listing->commune_slug],
            [$search->transaction_type, $listing->transaction_type],
            [$search->property_type, $listing->property_type],
        ] as [$wanted, $actual]) {
            if ($wanted !== null && $wanted !== $actual) {
                return false;
            }
        }

        return true;
    }
}
