<?php

declare(strict_types=1);

namespace App\Support;

/**
 * ── LISTING SLUGS ────────────────────────────────────────────────────────────
 * The slug is the readable half of /annonce/{id}/{slug}. The id is what
 * resolves the page, so the slug exists purely for humans and for search.
 *
 * It is built from the listing's structured fields rather than transliterated
 * from its Arabic title, and that is the whole point. Transliteration produced
 * "bya-chqa-fy-bjaya" — a string nobody types, nobody reads, and that matches no
 * query. The fields instead yield "vente-appartement-f3-akbou", which is the
 * French-derived vocabulary Algerians actually search with and which mirrors the
 * browse routes (/vente/appartement/bejaia) that carry this site's SEO.
 *
 * A title change no longer changes the URL either, which removes a whole class
 * of link churn: only moving the property or reclassifying it does.
 */
final class ListingSlug
{
    public static function build(
        string $transactionType,
        string $propertyType,
        ?string $roomsCode,
        ?string $communeSlug,
        string $wilayaSlug,
    ): string {
        // The commune is preferred over the wilaya: it is the more specific —
        // and more searched — location.
        $place = trim((string) $communeSlug) !== '' ? $communeSlug : $wilayaSlug;

        // Rooms are included when known because "F3" is a real search term
        // here, not decoration.
        $rooms = $roomsCode !== null && $roomsCode !== ''
            ? str_replace('+', '-plus', mb_strtolower($roomsCode))
            : null;

        $slug = implode('-', array_filter([$transactionType, $propertyType, $rooms, $place]));

        $slug = preg_replace('/[^a-z0-9-]/', '', mb_strtolower($slug)) ?? '';
        $slug = preg_replace('/-+/', '-', $slug) ?? '';

        return mb_substr(trim($slug, '-'), 0, 80);
    }
}
