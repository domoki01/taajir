<?php

declare(strict_types=1);

namespace App\Support;

use Normalizer;

final class Text
{
    /**
     * Fold a string for comparison: strip Arabic diacritics and the hamza
     * carriers, unify the yaa/taa-marbuta variants people type inconsistently,
     * and drop French accents.
     *
     * This is what makes "الجزاير" match "الجزائر", and it is typed that way
     * constantly. The same fold will build `listings.search_text` for MySQL's
     * FULLTEXT index, so a query folded one way against text folded another
     * matches nothing — which makes this function the whole of search.
     *
     * It is NOT a character-for-character port of `normalize` in the Next app's
     * src/lib/geo.ts, because that version does not do what its own comment
     * says. It decomposes with NFD and then looks for the *composed* أ إ آ ؤ ئ,
     * which by then no longer exist: NFD has already split them into a base
     * letter plus a combining hamza at U+0654/U+0655, and the strip that
     * follows covers only U+0300–U+036F. The hamza survives, so today
     * "الجزائر" and "الجزاير" fold to different strings and the wilaya search
     * box finds nothing for the spelling it exists to catch.
     *
     * Stripping every non-spacing mark after the decomposition is what the
     * replacements were reaching for, and it subsumes both the Latin accents
     * and the Arabic harakat in one pass. The three letters with no canonical
     * decomposition — ى, ة and the alef wasla ٱ — still need naming.
     */
    public static function normalize(string $input): string
    {
        $out = mb_strtolower(trim($input));

        $decomposed = Normalizer::normalize($out, Normalizer::FORM_D);
        if (is_string($decomposed)) {
            $out = $decomposed;
        }

        return preg_replace(
            [
                '/\p{Mn}+/u',        // combining marks: Latin accents, harakat, hamza, madda
                '/\x{0640}/u',       // tatweel — a letter-modifier, not a mark
                '/\x{0671}/u',       // alef wasla, which does not decompose
                '/\x{0649}/u',       // alef maqsura
                '/\x{0629}/u',       // taa marbuta
                '/[\'\x{2019}\x{0060}]/u',
            ],
            ['', '', 'ا', 'ي', 'ه', ''],
            $out,
        ) ?? $out;
    }
}
