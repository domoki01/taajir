<?php

declare(strict_types=1);

namespace App\Support;

/**
 * The 12-character id in `/annonce/{id}/{slug}`.
 *
 * Random rather than sequential: a sequential id tells every visitor how many
 * ads the site has and lets anyone walk the whole catalogue, including the ads
 * that were taken down. random_int rather than rand for the same reason the
 * referral code uses it.
 */
final class ListingId
{
    private const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

    public const LENGTH = 12;

    public static function mint(): string
    {
        $id = '';
        for ($i = 0; $i < self::LENGTH; $i++) {
            $id .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
        }

        return $id;
    }
}
