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
*/

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
Schedule::command('taajir:launch --if-due')->hourly()->withoutOverlapping();

/*
 * Ads reach the end of their life at 60 days (config('taajir.listing_lifetime_days')).
 *
 * Nightly, in the small hours: it touches every published ad older than the
 * cutoff and moves its owner's quota counter, which is not work to do while
 * people are browsing.
 */
Schedule::command('taajir:expire-listings')->dailyAt('03:20')->withoutOverlapping();

/*
 * The queue, drained by the same cron rather than a daemon a shared host has
 * nowhere to keep. `--stop-when-empty` is what makes that safe: the worker
 * finishes what is there and exits, instead of holding a PHP process open for
 * the next hour.
 */
Schedule::command('queue:work --stop-when-empty --tries=3')->everyFiveMinutes()->withoutOverlapping();
