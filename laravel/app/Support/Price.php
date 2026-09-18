<?php

declare(strict_types=1);

namespace App\Support;

use App\Enums\PriceUnit;

/**
 * ── PRICE ────────────────────────────────────────────────────────────────────
 * Algerians quote property in "ملايين" — millions of centimes. One مليون is
 * 10 000 DZD, so a flat advertised at "800 مليون" costs 8 000 000 DZD. Rents
 * are usually quoted in ألف (thousands of dinars): "3 ملايين" a month is
 * 30 000 DZD.
 *
 * Prices are stored as a whole number of DINARS everywhere — the `listings`
 * table, every filter, every sort key. Mixing the units up is a 10 000x error,
 * so every conversion lives in this class and nowhere else. This is the PHP
 * mirror of src/lib/price.ts, minus the Firestore bucket half: SQL answers
 * `WHERE price BETWEEN ? AND ?` directly, so the buckets have nothing left to
 * work around.
 */
final class Price
{
    /** What the user typed is in one of these two units. */
    public const INPUT_DZD = 'dzd';

    public const INPUT_MILLION = 'million';

    /** Convert what the user typed into the canonical dinar amount. */
    public static function toDinars(float|int $amount, string $unit): int
    {
        return (int) round(
            $unit === self::INPUT_MILLION
                ? $amount * config('taajir.dinars_per_million')
                : $amount
        );
    }

    /** Convert a stored dinar amount back into the unit the user is editing in. */
    public static function fromDinars(int $dinars, string $unit): float
    {
        return $unit === self::INPUT_MILLION
            ? $dinars / config('taajir.dinars_per_million')
            : (float) $dinars;
    }

    /**
     * Format a price the way an Algerian seller would say it out loud.
     *
     *   8_000_000 -> "800 مليون"      (sale prices are spoken in ملايين)
     *      35_000 -> "3.5 مليون"      (rents too, once past a million centimes)
     *       8_000 -> "8,000 دج"       (below that, plain dinars read better)
     *
     * Digits stay Latin — that is what the market uses on every listing site and
     * what the Cairo font renders most legibly at small sizes.
     */
    public static function format(int|float|null $dinars): string
    {
        if ($dinars === null || ! is_finite((float) $dinars) || $dinars <= 0) {
            return 'السعر بالاتفاق';
        }

        $millions = $dinars / config('taajir.dinars_per_million');
        if ($millions < 1) {
            return self::digits(round($dinars)).' دج';
        }

        // One decimal only when it carries information: 3.5 مليون, not 800.0 مليون.
        $rounded = $millions < 10
            ? round($millions * 10) / 10
            : round($millions);

        return self::digits($rounded).' مليون';
    }

    /** Full form for the listing detail page, where precision is expected. */
    public static function formatExact(int|float|null $dinars): string
    {
        if ($dinars === null || ! is_finite((float) $dinars) || $dinars <= 0) {
            return 'السعر بالاتفاق';
        }

        return self::digits(round($dinars)).' دج';
    }

    /** Price with its unit suffix, e.g. "4.5 مليون في الشهر". */
    public static function formatWithUnit(int|float|null $dinars, PriceUnit $unit): string
    {
        $price = self::format($dinars);

        return $unit === PriceUnit::Total ? $price : $price.' '.$unit->label();
    }

    /**
     * Group digits the way Intl.NumberFormat("en-US") does, which is what the
     * Next app renders: a comma every three digits, and a decimal only when the
     * value actually has one ("3.5", never "800.0").
     */
    private static function digits(float $value): string
    {
        $decimals = fmod($value, 1.0) === 0.0 ? 0 : 1;

        return number_format($value, $decimals, '.', ',');
    }
}
