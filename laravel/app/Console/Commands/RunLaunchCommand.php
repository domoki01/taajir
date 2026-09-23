<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Launch;
use App\Services\RunLaunch;
use Illuminate\Console\Command;

/**
 * Open the site from the scheduler.
 *
 * The same work the admin's switch does and the HTTP cron route asks for,
 * reachable from `schedule:run` — which is what §12 puts in the one cron line a
 * shared host gets. Each caller brings its own authority: a permission for the
 * screen, a shared secret for the route, and the shell for this one.
 *
 * `--if-due` is the scheduled shape: it opens the site only when an admin has
 * both held it and set a countdown that has since elapsed. Without the flag it
 * opens the site outright, which is the hand-operated escape hatch for when the
 * admin screen itself cannot be reached.
 */
final class RunLaunchCommand extends Command
{
    protected $signature = 'taajir:launch {--if-due : only when a countdown has elapsed}';

    protected $description = 'Publish the held listings and open the site';

    public function handle(RunLaunch $run): int
    {
        $launch = Launch::current();

        if ($this->option('if-due')) {
            if (! $launch->isHeld()) {
                $this->line('Already open.');

                return self::SUCCESS;
            }

            if (! $launch->timerElapsed()) {
                $this->line('The countdown has not elapsed.');

                return self::SUCCESS;
            }
        }

        $out = $run('cron');

        $this->info(sprintf(
            'Opened. %d published, %d requeued, %d demands, %d notifications queued.',
            $out['published'], $out['requeued'], $out['requests'], $out['queued'],
        ));

        return self::SUCCESS;
    }
}
