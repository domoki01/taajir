<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * ── THE LAUNCH GATE ──────────────────────────────────────────────────────────
 * Whether the site is open to the public, or holding behind a countdown while
 * it gathers listings and buyers.
 *
 * Ported from src/server/launch.ts and src/types/launch.ts.
 *
 * **The default is `active`, and that is load-bearing in one direction only.**
 * The site is live today. Defaulting to `prelaunch` would mean the deploy that
 * ships this feature closes the site on every visitor, and a transient database
 * error would close it again later. Locking the public out is a decision, so it
 * takes a decision — a row an admin wrote — and never an absence or a failure.
 */
final class Launch
{
    public const PRELAUNCH = 'prelaunch';

    public const ACTIVE = 'active';

    private static ?self $current = null;

    private function __construct(
        public readonly string $state,
        /** Countdown target. null means "held with no date announced". */
        public readonly ?Carbon $launchAt,
        /** Set once, by the switch. */
        public readonly ?Carbon $launchedAt,
    ) {}

    public static function current(): self
    {
        if (self::$current !== null) {
            return self::$current;
        }

        try {
            return self::$current = self::fromSettings(Setting::read('launch'));
        } catch (\Throwable $e) {
            report($e);

            // Open. See the note on the class: a failed read must never be
            // what closes the site.
            return self::$current = self::open();
        }
    }

    /** @param array<string, mixed> $stored */
    public static function fromSettings(array $stored): self
    {
        /*
         * `state` is the authority, because that is the field the Firestore
         * export carries and `taajir:import` copies the settings row across
         * verbatim. `held` is the boolean phase 5 invented before this screen
         * existed; it is read so a deployment written against it keeps working,
         * and it is never written.
         */
        $state = ($stored['state'] ?? null) === self::PRELAUNCH
            || ($stored['held'] ?? false) === true
                ? self::PRELAUNCH
                : self::ACTIVE;

        return new self(
            state: $state,
            launchAt: self::moment($stored['launchAt'] ?? null),
            launchedAt: self::moment($stored['launchedAt'] ?? null),
        );
    }

    public static function open(): self
    {
        return new self(self::ACTIVE, null, null);
    }

    /** Is the public locked out right now? */
    public function isHeld(): bool
    {
        return $this->state === self::PRELAUNCH;
    }

    /**
     * Has the announced date passed?
     *
     * Separate from "open", and deliberately so. An elapsed timer shows "the
     * wait is over" and nothing more: publishing is its own act, because a
     * clock that ran out while nobody was watching should never be the thing
     * that makes a thousand unreviewed ads public.
     */
    public function timerElapsed(): bool
    {
        return $this->launchAt !== null && $this->launchAt->isPast();
    }

    /**
     * May this visitor see the catalogue while it is held?
     *
     * Staff walk through: somebody has to be able to look at the site they are
     * about to launch, and reviewing the queue means opening the pages it
     * holds.
     */
    public function admits(?User $user): bool
    {
        return ! $this->isHeld() || $user?->isStaff() === true;
    }

    /**
     * What the countdown page polls. Public on purpose — it says whether the
     * site is open and when it plans to be, which is exactly what the closed
     * page already tells every visitor.
     *
     * @return array{state: string, launchAt: ?string}
     */
    public function toPayload(): array
    {
        return [
            'state' => $this->state,
            'launchAt' => $this->launchAt?->toIso8601String(),
        ];
    }

    /**
     * Timestamps arrive as epoch milliseconds from the Firestore export and as
     * datetime strings from the admin form. Both are read here so neither
     * caller has to know which the row happens to hold.
     */
    private static function moment(mixed $value): ?Carbon
    {
        if (is_numeric($value) && (int) $value > 0) {
            return Carbon::createFromTimestampMs((int) $value);
        }

        if (is_string($value) && $value !== '') {
            try {
                return Carbon::parse($value);
            } catch (\Throwable) {
                return null;
            }
        }

        return null;
    }

    /** Test seam, and the hook the launch screen calls after every write. */
    public static function forget(): void
    {
        self::$current = null;
    }
}
