<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\ListingStatus;
use App\Models\Listing;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Take down ads that have been up for their whole lifetime.
 *
 * Sixty days, from config. A classifieds board whose oldest ads never leave
 * turns into a museum: the flat was let in March, the seller has stopped
 * answering the phone, and every buyer who calls about it learns the site
 * cannot be trusted.
 *
 * Expiring frees the owner's quota, which is the other half of why it matters
 * — a seller who hit their limit six months ago should not have to hunt for
 * dead ads to delete before posting a live one.
 */
final class ExpireListings extends Command
{
    protected $signature = 'taajir:expire-listings {--dry-run : count them and write nothing}';

    protected $description = 'Expire published listings past their lifetime';

    public function handle(): int
    {
        $days = (int) config('taajir.listing_lifetime_days', 60);
        $cutoff = now()->subDays($days);

        $stale = Listing::query()
            ->where('status', ListingStatus::Published->value)
            // Never the pinned ones. Somebody paid for that placement, and its
            // clock is the pin's, not the ad's.
            ->where(fn ($q) => $q->whereNull('pinned_until')->orWhere('pinned_until', '<', now()))
            ->where('published_at', '<', $cutoff);

        if ($this->option('dry-run')) {
            $this->info("{$stale->count()} listing(s) older than {$days} days.");

            return self::SUCCESS;
        }

        $expired = 0;

        // Chunked by id and in a transaction per batch: the owner counters move
        // with the rows, and a run interrupted halfway must not leave a quota
        // saying an ad is live when it is not.
        $stale->select(['id', 'owner_uid'])->chunkById(200, function ($listings) use (&$expired): void {
            DB::transaction(function () use ($listings, &$expired): void {
                $ids = $listings->pluck('id');

                $expired += Listing::query()->whereIn('id', $ids)->update([
                    'status' => ListingStatus::Expired->value,
                    'updated_at' => now(),
                ]);

                foreach ($listings->countBy('owner_uid') as $uid => $count) {
                    /*
                     * Two statements rather than one GREATEST(): that function
                     * is MySQL's, and the suite runs on sqlite, which has MAX()
                     * instead. The clamp matters on its own — a counter that
                     * has already drifted must not go negative and start
                     * granting free quota — so it is written portably rather
                     * than guarded by a driver check.
                     */
                    DB::table('users')->where('uid', $uid)->decrement('active_listing_count', $count);
                    DB::table('users')->where('uid', $uid)
                        ->where('active_listing_count', '<', 0)
                        ->update(['active_listing_count' => 0]);
                }
            });
        });

        $this->info("{$expired} listing(s) expired.");

        return self::SUCCESS;
    }
}
