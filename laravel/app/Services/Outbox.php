<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\OutboxEntry;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * ── WHO GETS TOLD, AND HOW ───────────────────────────────────────────────────
 * Every intended message, written down before anything is sent.
 *
 * None of the three channels has a provider wired: no SMTP, no Twilio, and —
 * by decision — no FCM, since sending one would mean a Firebase service-account
 * credential on the shared host, which is the one secret this port keeps off
 * it. So nothing is dispatched. What this class does is decide *who* should
 * hear about something and on which address, and record that.
 *
 * That is deliberately the hard half. Wiring a provider later is one adapter
 * and a pass over `launch_outbox`; reconstructing who should have been told,
 * months after the launch, is not possible at all.
 *
 * Ported from src/server/launchNotify.ts, minus the inline push dispatch.
 */
final class Outbox
{
    /** Written in one go rather than a row at a time. */
    private const CHUNK = 500;

    /**
     * Tell everyone the site is live.
     *
     * @return int rows queued
     */
    public function announceLaunch(): int
    {
        $branding = Branding::current();

        return $this->queueForEveryone(
            title: __('launch.announce_title', ['site' => $branding->siteName]),
            body: __('launch.announce_body'),
            url: '/',
        );
    }

    /**
     * One message to every account that can receive one.
     *
     * Swallows its own failures when called from the launch: the site is
     * already open by then, and a fan-out that fell over is a table to retry,
     * not a reason to roll the launch back.
     */
    public function queueForEveryone(string $title, string $body, string $url): int
    {
        $now = now();
        $queued = 0;

        User::query()
            ->where('is_banned', false)
            ->select(['uid', 'email', 'email_verified', 'phone'])
            ->chunkById(self::CHUNK, function ($users) use ($title, $body, $url, $now, &$queued): void {
                $rows = [];

                foreach ($users as $user) {
                    foreach ($this->targetsFor($user) as [$channel, $target]) {
                        $rows[] = [
                            'uid' => $user->uid,
                            'channel' => $channel,
                            'target' => $target,
                            'title' => mb_substr($title, 0, 120),
                            'body' => mb_substr($body, 0, 300),
                            'url' => mb_substr($url, 0, 500),
                            'status' => 'queued',
                            'error' => null,
                            'created_at' => $now,
                            'sent_at' => null,
                        ];
                    }
                }

                if ($rows !== []) {
                    DB::table('launch_outbox')->insert($rows);
                    $queued += count($rows);
                }
            }, 'uid');

        return $queued;
    }

    /** One message to one account — what a saved-search alert is. */
    public function queueFor(User $user, string $title, string $body, string $url): int
    {
        if ($user->is_banned) {
            return 0;
        }

        $rows = [];
        foreach ($this->targetsFor($user) as [$channel, $target]) {
            $rows[] = [
                'uid' => $user->uid,
                'channel' => $channel,
                'target' => $target,
                'title' => mb_substr($title, 0, 120),
                'body' => mb_substr($body, 0, 300),
                'url' => mb_substr($url, 0, 500),
                'status' => 'queued',
                'error' => null,
                'created_at' => now(),
                'sent_at' => null,
            ];
        }

        if ($rows !== []) {
            DB::table('launch_outbox')->insert($rows);
        }

        return count($rows);
    }

    /**
     * The addresses one account may be reached on.
     *
     * **Verified email addresses only.** Firebase's password provider accepted
     * any address anybody typed, so `users.email` is a column full of claims
     * rather than facts — and a launch blast to it would be unsolicited mail to
     * strangers, sent from our own domain, on the single day its reputation
     * matters most.
     *
     * Push is queued for everyone. There are no device tokens yet, so every one
     * of those rows is a row waiting for a channel — which is the honest state
     * and exactly what this table is for.
     *
     * @return list<array{0: string, 1: string}>
     */
    private function targetsFor(User $user): array
    {
        $targets = [];

        if ($user->email !== null && $user->email_verified) {
            $targets[] = ['email', $user->email];
        }

        if ($user->phone !== null && $user->phone !== '') {
            $targets[] = ['sms', $user->phone];
        }

        $targets[] = ['push', 'device'];

        return $targets;
    }

    /**
     * Whether a channel could deliver right now.
     *
     * All three answer false today, and the screen says so rather than showing
     * a send button that quietly does nothing. Each becomes true by setting one
     * variable and writing one adapter.
     *
     * @return array<string, bool>
     */
    public static function readiness(): array
    {
        return [
            'email' => (bool) config('taajir.email_provider_key'),
            'sms' => (bool) config('taajir.sms_provider_key'),
            'push' => (bool) config('taajir.fcm_ready'),
        ];
    }

    /** @return array<string, int> channel => rows still waiting */
    public static function pending(): array
    {
        return OutboxEntry::query()
            ->where('status', 'queued')
            ->selectRaw('channel, count(*) as total')
            ->groupBy('channel')
            ->pluck('total', 'channel')
            ->all();
    }
}
