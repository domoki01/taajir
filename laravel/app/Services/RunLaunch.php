<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\ListingStatus;
use App\Models\AuditEntry;
use App\Models\Listing;
use App\Models\PropertyRequest;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * ── THE LAUNCH ITSELF ────────────────────────────────────────────────────────
 * Opening the site.
 *
 * Its own class, called by two authorities that have nothing else in common:
 * the admin's switch, which checks a permission, and the cron, which checks a
 * shared secret. Neither guard belongs in here — this is the work, and each
 * caller brings its own reason to be allowed to ask for it.
 *
 * Ported from src/server/launchRun.ts.
 */
final class RunLaunch
{
    /**
     * Order matters and is not arbitrary: content is published first, then the
     * state flips, then people are told.
     *
     * Announcing before the ads are public sends a thousand people to a page
     * that still says "coming soon"; flipping the state before publishing shows
     * an empty catalogue to whoever arrives first.
     *
     * @return array{published: int, requeued: int, requests: int, queued: int}
     */
    public function __invoke(string $actorUid): array
    {
        $now = now();

        /*
         * 1. Approved ads go live; everything else that was held falls into the
         *    ordinary review queue. Never published unreviewed, and never lost
         *    — which is what makes an unattended launch safe enough to put on a
         *    cron at all.
         */
        $published = Listing::query()
            ->where('status', ListingStatus::PendingLaunch->value)
            ->where('approved_for_launch', true)
            ->update([
                'status' => ListingStatus::Published->value,
                // Kept when it already exists: an ad that was published, held
                // and released again keeps its original dateline rather than
                // jumping to the top of "الأحدث".
                'published_at' => DB::raw('COALESCE(published_at, '.$this->quote($now).')'),
                'updated_at' => $now,
            ]);

        $requeued = Listing::query()
            ->where('status', ListingStatus::PendingLaunch->value)
            ->update([
                'status' => ListingStatus::Pending->value,
                'updated_at' => $now,
            ]);

        // 2. Held demands. No approval gate on those — a demand is text, and
        //    the link ban already covers what is worth banning.
        $requests = PropertyRequest::query()
            ->where('status', 'pendingLaunch')
            ->update(['status' => 'visible']);

        // 3. Open the doors.
        Setting::query()->updateOrCreate(['key' => 'launch'], [
            'value' => [
                'state' => Launch::ACTIVE,
                'launchAt' => null,
                'launchedAt' => $now->getTimestampMs(),
            ],
            'updated_at' => $now,
            'updated_by' => mb_substr($actorUid, 0, 28),
        ]);

        Launch::forget();

        /*
         * 4. Tell everyone. It swallows its own failures: the site is already
         *    open and the ads are already public by the time this runs, so a
         *    notification that did not go out is a row to retry, never a reason
         *    to leave the site half-open.
         */
        $queued = app(Outbox::class)->announceLaunch();

        AuditEntry::record(
            $this->actor($actorUid),
            'launch.execute',
            'settings',
            'launch',
            ['published' => $published, 'requeued' => $requeued, 'requests' => $requests, 'queued' => $queued],
        );

        return compact('published', 'requeued', 'requests', 'queued');
    }

    /**
     * The audit row's author.
     *
     * The cron has no account, so it gets a stand-in rather than no entry at
     * all: "the site opened and nobody is recorded as having opened it" is the
     * one line this log must never have.
     */
    private function actor(string $uid): User
    {
        $user = User::query()->find($uid);

        if ($user !== null) {
            return $user;
        }

        $stand_in = new User;
        $stand_in->uid = mb_substr($uid, 0, 28);
        $stand_in->display_name = $uid;

        return $stand_in;
    }

    /** Quoted for the one place a raw expression is unavoidable. */
    private function quote(Carbon $moment): string
    {
        return DB::getPdo()->quote($moment->toDateTimeString());
    }
}
