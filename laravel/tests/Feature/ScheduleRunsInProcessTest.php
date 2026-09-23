<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Console\Scheduling\CallbackEvent;
use Illuminate\Console\Scheduling\Schedule;
use Tests\TestCase;

/**
 * The scheduler must not spawn a second PHP process.
 *
 * Schedule::command() reads as though it calls the command. It does not: it
 * builds a shell line and runs it through Symfony's Process, always, not only
 * under runInBackground(). The production host disables proc_open — shared
 * hosts usually do — so every scheduled job died at the spawn and the cron
 * reported nothing wrong. Hourly launches, nightly expiry and the queue all
 * silently stopped, and the only trace was a line in laravel.log.
 *
 * This is pinned as a shape rather than a behaviour because the failure is
 * invisible in any environment where proc_open exists, which includes every
 * machine this suite is likely to run on.
 */
final class ScheduleRunsInProcessTest extends TestCase
{
    public function test_no_scheduled_job_spawns_a_process(): void
    {
        $events = app(Schedule::class)->events();

        $this->assertNotEmpty($events, 'the schedule is empty; this test would pass vacuously');

        foreach ($events as $event) {
            $this->assertInstanceOf(
                CallbackEvent::class,
                $event,
                "[{$event->getSummaryForDisplay()}] is a Schedule::command(), which spawns "
                .'`php artisan` through proc_open. Use Schedule::call() with Artisan::call().',
            );
        }
    }

    public function test_every_job_is_named_so_overlap_locks_still_work(): void
    {
        // withoutOverlapping() on a closure throws without a name — and it
        // throws at schedule:run time, on the server, not here. A name is also
        // what the lock is keyed on, so two differently-named jobs do not
        // block each other by accident.
        foreach (app(Schedule::class)->events() as $event) {
            $this->assertNotEmpty(
                $event->description,
                'a scheduled closure has no ->name(); withoutOverlapping() cannot key its lock',
            );
        }
    }
}
