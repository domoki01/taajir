<?php

declare(strict_types=1);

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| The schedule
|--------------------------------------------------------------------------
|
| A shared host gets one cron line, and this is what it drives:
|
|   * * * * * cd /home/USER/taajir-app && php artisan schedule:run >/dev/null 2>&1
|
| Everything below hangs off that single entry, which is the point — a host
| where each job needs its own cron form is a host where one of them is
| eventually forgotten.
|
| Every job runs inside this process, through Artisan::call, rather than
| through Schedule::command.
|
| Schedule::command does not call the command. It builds a shell line and
| spawns `php artisan …` through Symfony's Process — not only under
| runInBackground(), which is the easy thing to assume, but always. Shared
| hosts routinely disable proc_open, and this one does: once the cron line was
| finally correct, every tick logged "The Process class relies on proc_open,
| which is not available on your PHP installation" and nothing ran. The
| scheduler was firing exactly on time and achieving nothing, which is the
| failure that looks most like success.
|
| Schedule::call runs the closure here, with no second PHP to start.
| withoutOverlapping keeps working — it is a cache lock, not a process check —
| but it needs a name of its own, because a closure has no command line to be
| named after.
|
*/

/** Run an Artisan command in this process rather than spawning one. */
$inProcess = fn (string $command): Closure => fn () => Artisan::call($command);

/*
 * The unattended launch.
 *
 * `--if-due` is the whole safety of it: it fires only when an admin has both
 * held the site and set a countdown that has since elapsed, and even then it
 * publishes only the ads a moderator approved — every other held ad lands in
 * the review queue. A clock running out is never what makes unreviewed content
 * public.
 *
 * Hourly rather than by the minute: the countdown is announced to the day, and
 * a site that opens within the hour of a date nobody was watching is opening on
 * time.
 */
Schedule::call($inProcess('taajir:launch --if-due'))
    ->name('taajir:launch')
    ->hourly()
    ->withoutOverlapping();

/*
 * Ads reach the end of their life at 60 days (config('taajir.listing_lifetime_days')).
 *
 * Nightly, in the small hours: it touches every published ad older than the
 * cutoff and moves its owner's quota counter, which is not work to do while
 * people are browsing.
 */
Schedule::call($inProcess('taajir:expire-listings'))
    ->name('taajir:expire-listings')
    ->dailyAt('03:20')
    ->withoutOverlapping();

/*
 * The queue, drained by the same cron rather than a daemon a shared host has
 * nowhere to keep. `--stop-when-empty` is what makes that safe: the worker
 * finishes what is there and exits, instead of holding a PHP process open for
 * the next hour. --max-time bounds it as well, which matters more now that the
 * worker runs inside the scheduler: without it, a queue that keeps refilling
 * would hold this tick open until the next cron arrived on top of it.
 */
Schedule::call($inProcess('queue:work --stop-when-empty --tries=3 --max-time=50'))
    ->name('queue:work')
    ->everyFiveMinutes()
    ->withoutOverlapping();
