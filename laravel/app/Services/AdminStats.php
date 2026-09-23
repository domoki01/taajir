<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\User;

/**
 * The four numbers at the top of the admin home screen.
 *
 * Every count is guarded on its own. A dashboard that 500s because one query
 * failed is worse than one showing a dash in a single tile — and the dash is
 * honest in a way a zero is not: a failed count and an empty table are not the
 * same fact, and an admin who reads "0 waiting" and closes the tab because of a
 * broken query has been actively misled.
 *
 * Ported from src/server/stats.ts. The Firestore version needed count()
 * aggregations to avoid paying a read per document; MySQL counts an index, so
 * the interesting part of the port is what it no longer has to do.
 */
final class AdminStats
{
    /** @return array{pending: ?int, published: ?int, users: ?int, banned: ?int} */
    public static function all(): array
    {
        return [
            // Both queue states, because both are ads whose owner is waiting on
            // a person: one is held by the check, the other by the launch date.
            'pending' => self::count(fn () => Listing::query()
                ->whereIn('status', [ListingStatus::Pending->value, ListingStatus::PendingLaunch->value])
                ->count()),
            'published' => self::count(fn () => Listing::query()
                ->where('status', ListingStatus::Published->value)
                ->count()),
            'users' => self::count(fn () => User::query()->count()),
            'banned' => self::count(fn () => User::query()->where('is_banned', true)->count()),
        ];
    }

    /** @param callable(): int $query */
    private static function count(callable $query): ?int
    {
        try {
            return $query();
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }
}
