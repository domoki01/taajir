<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\User;

/**
 * ── REFERRAL LINK, SHARED FACTS ──────────────────────────────────────────────
 * Ported from src/lib/referral.ts.
 */
final class ReferralCode
{
    /** Where the invited visitor's code is parked until they create an account. */
    public const COOKIE = 'taajir_ref';

    /**
     * Ninety days.
     *
     * Someone sent a link on WhatsApp does not sign up in the same minute; they
     * look, close the tab, and come back when they actually need a flat. A
     * cookie that expired in a day would credit almost nobody, and the only
     * cost of a long one is attributing a signup to an invitation that really
     * did cause it, late.
     */
    public const COOKIE_DAYS = 90;

    /**
     * The code alphabet: no vowels and no lookalikes.
     *
     * A code gets read aloud, typed from a WhatsApp message and written on
     * paper, so `0/O` and `1/I` are out — and so are vowels, which is what
     * keeps a random six-character string from spelling something unfortunate
     * in Arabic or French.
     */
    public const ALPHABET = '23456789BCDFGHJKLMNPQRSTVWXYZ';

    public const LENGTH = 6;

    public static function isValid(string $code): bool
    {
        return preg_match('/^['.self::ALPHABET.']{'.self::LENGTH.'}$/', $code) === 1;
    }

    /**
     * A code nobody else holds.
     *
     * random_int rather than rand: this is the identifier behind a payout, and
     * a predictable sequence lets someone guess a code that has not been handed
     * out yet. The collision retry is bounded — 29^6 is 594 million, so
     * exhausting ten attempts means something else is wrong.
     */
    public static function mint(): string
    {
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $code = '';
            for ($i = 0; $i < self::LENGTH; $i++) {
                $code .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
            }

            if (! User::query()->where('referral_code', $code)->exists()) {
                return $code;
            }
        }

        throw new \RuntimeException('could not mint an unused referral code');
    }
}
