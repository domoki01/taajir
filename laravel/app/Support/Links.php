<?php

declare(strict_types=1);

namespace App\Support;

/**
 * ── LINK DETECTION ───────────────────────────────────────────────────────────
 * Listings, requests and their replies allow no links at all.
 *
 * This is not prudishness about the open web. A demand thread — "نشري شقة في
 * باب الزوار" — is the highest-value spam target on a classifieds site: it is a
 * list of people who have just announced they are ready to spend money, and it
 * is public. Left open, the replies fill with links to Telegram channels and
 * competitor sites within a week, and the feature dies.
 *
 * The check refuses rather than strips. Silently editing what someone wrote is
 * worse than telling them why it was rejected, and a stripped link leaves a
 * sentence that no longer says anything.
 */
final class Links
{
    /**
     * TLDs worth catching, rather than "any two letters after a dot".
     *
     * The permissive form flags ordinary Latin prose — "nice apartment.Very
     * big" contains `apartment.very`, which matches a generic pattern and would
     * reject a legitimate reply. Spam converges on a small set of endings, so
     * an explicit list is both stricter where it matters and quiet where it
     * does not.
     *
     * @var list<string>
     */
    private const TLDS = [
        // generic
        'com', 'net', 'org', 'info', 'biz', 'io', 'co', 'me', 'ly', 'gl', 'to',
        'cc', 'tv', 'xyz', 'top', 'site', 'online', 'store', 'shop', 'club',
        'link', 'page', 'app', 'dev', 'live', 'space', 'website', 'fun', 'icu',
        'pro', 'vip', 'cloud', 'digital', 'agency', 'immo',
        // country codes that show up in Algerian traffic
        'dz', 'fr', 'tn', 'ma', 'eg', 'sa', 'ae', 'qa', 'kw', 'tr', 'uk', 'de',
        'es', 'it', 'be', 'nl', 'ch', 'ca', 'us', 'ru', 'cn', 'in', 'pk',
    ];

    /** True when the text contains something that functions as a link. */
    public static function present(string $input): bool
    {
        $folded = self::fold($input);

        if (preg_match('~(?:[a-z][a-z0-9+.-]*://|\bwww\.)~i', $folded) === 1) {
            return true;
        }

        // A label, a dot, one of the known endings, and then either a boundary
        // or the start of a path — so "example.com/promo" and "example.com"
        // both match.
        $tlds = implode('|', self::TLDS);

        return preg_match(
            '~\b[a-z0-9][a-z0-9-]{0,62}\.(?:'.$tlds.')(?:[/?#:]|\b)~i',
            $folded,
        ) === 1;
    }

    /**
     * Fold the ways a link gets written when someone knows links are blocked:
     * `example[.]com`, `example (dot) com`, `example نقطة com`, `example . com`.
     *
     * Collapsing spaces around a dot is safe here because the match still needs
     * a known TLD on the right-hand side — "شقة . كبيرة" folds to "شقة.كبيرة"
     * and matches nothing.
     */
    private static function fold(string $input): string
    {
        $out = mb_strtolower($input);

        return preg_replace(
            [
                '~[\[\(\{]\s*\.\s*[\]\)\}]~u',
                '~\s*(?:\(|\[)?\s*(?:dot|point|نقطة)\s*(?:\)|\])?\s*~iu',
                '~\s*\.\s*~u',
                // Full-width and Arabic-decimal separators used the same way.
                '~[．｡。٫]~u',
            ],
            ['.', '.', '.', '.'],
            $out,
        ) ?? $out;
    }

    /** The one message shown wherever a link is refused, so it reads as one rule. */
    public static function refusalMessage(): string
    {
        return __('policy.no_links');
    }
}
