<?php

declare(strict_types=1);

namespace App\Services;

use App\Support\Links;

/**
 * ── CONTENT POLICY ───────────────────────────────────────────────────────────
 * What a post has to clear before it goes live, and why each rule is here.
 *
 * This runs on every listing and every demand at submission. Clean content
 * publishes itself; a certain violation is refused with a reason the author can
 * act on; anything in between is handed to a human. That third outcome is the
 * point — a filter with only two answers either lets scams through or blocks
 * honest sellers, and on a property site both are expensive.
 *
 * Every rule is a pure function of the text, so the whole thing is tested
 * against real Algerian phrasing rather than trusted by eye.
 */
final class Policy
{
    public const CLEAN = 'clean';

    public const REJECT = 'reject';

    public const REVIEW = 'review';

    /**
     * Insults and obscenity, Arabic/derja and French.
     *
     * Matched as whole words against the normalised text. Substring matching is
     * what makes filters infamous — it is the reason "Scunthorpe" is a byword —
     * and Arabic makes it worse, because short roots sit inside ordinary words.
     *
     * @var list<string>
     */
    private const PROFANITY = [
        'زبي', 'كس امك', 'كسامك', 'نيك', 'ننيك', 'نيكمك', 'قحبة', 'قحبه',
        'قحاب', 'زامل', 'شرموطة', 'شرموطه', 'حمار', 'كلب ابن', 'ولد القحبة',
        'ولد القحبه',
        // Deliberately NOT here: "علق" (the site's own reply button says «علّق»,
        // and تعليق/معلق are everywhere) and "طحان" (a common surname and a
        // trade). Both are mild derja insults and neither is worth the false
        // positives.
        'putain', 'salope', 'connard', 'enculé', 'encule', 'merde', 'nique',
        'pute', 'fuck', 'bitch', 'asshole',
    ];

    /**
     * Advance-fee and payment-redirection scams.
     *
     * These are the ones that actually run on Algerian property listings: a
     * deposit wired abroad for a flat the "owner" is conveniently out of the
     * country to show. Money leaves the country and there is no recovering it,
     * so this tier refuses rather than queues.
     *
     * Note what is deliberately absent: قرض/سلفة/تمويل. A buyer writing "نشري
     * بقرض بنكي" is describing how they will pay, which is ordinary and true.
     *
     * @var list<string>
     */
    private const SCAM = [
        'western union', 'westernunion', 'ويسترن يونيون', 'moneygram',
        'موني قرام', 'موني غرام', 'bitcoin', 'بيتكوين', 'بتكوين', 'usdt',
        'crypto', 'كريبتو', 'عملة رقمية', 'عمله رقميه', 'binance', 'بينانس',
        'skrill', 'paypal', 'payeer',
    ];

    /**
     * Off-topic recruitment and immigration spam.
     *
     * Reviewed rather than refused: "قرب الجامعة" and "قرب المدرسة" are selling
     * points, and a landlord may legitimately mention that a flat suits
     * students or workers. Only a human can tell that apart from a visa broker.
     *
     * @var list<string>
     */
    private const OFF_TOPIC = [
        'تاشيره', 'تاشيرة', 'فيزا شنغن', 'هجره', 'الهجرة', 'عقد عمل',
        'وظيفه شاغره', 'وظيفة شاغرة', 'توظيف', 'recrutement', 'visa schengen',
    ];

    /**
     * Arabic proclitics, which attach with no space: و ف ب ك ل and the article ال.
     *
     * Without this the matcher is useless in Arabic — "القحبه" and "بالبيتكوين"
     * both walk straight past a plain whole-word test, and they are the forms
     * people actually write. Only these six letters are allowed to lead, so an
     * unrelated word that merely ends in a banned string still does not match.
     */
    private const PROCLITIC = '[وفبكل]{0,2}(?:ال)?';

    /**
     * Judge one post.
     *
     * Title and description are judged together: splitting them lets a
     * violation hide in whichever field is checked less carefully.
     *
     * @return array{decision: string, rule: string, reason: string}
     */
    public static function check(string $title, string $description): array
    {
        $raw = $title."\n".$description;
        $normalised = self::fold($raw);

        // ── refuse ───────────────────────────────────────────────────────────
        // Checked against the raw text: the link detector does its own folding,
        // and normalising first would eat the dots it keys on.
        if (Links::present($raw)) {
            return self::verdict(self::REJECT, 'links');
        }

        if (self::hasTerm($normalised, self::PROFANITY) !== null) {
            return self::verdict(self::REJECT, 'profanity');
        }

        if (self::hasTerm($normalised, self::SCAM) !== null) {
            return self::verdict(self::REJECT, 'scam');
        }

        // ── hand to a human ──────────────────────────────────────────────────
        if (self::hasTerm($normalised, self::OFF_TOPIC) !== null) {
            return self::verdict(self::REVIEW, 'offtopic');
        }

        if (self::looksSpammy($raw)) {
            return self::verdict(self::REVIEW, 'spam');
        }

        return ['decision' => self::CLEAN, 'rule' => '', 'reason' => ''];
    }

    /**
     * Fold the spellings that mean the same word.
     *
     * Arabic gets written with and without diacritics, with أ/إ/آ/ا
     * interchanged, with ة/ه and ى/ي swapped, and with tatweel stretching
     * letters apart. Someone evading a filter reaches for exactly those, so the
     * comparison happens after they are collapsed.
     *
     * Deliberately NOT App\Support\Text::normalize: that one folds ؤ and ئ to و
     * and ي for search, and this one folds them to ء. They are different jobs —
     * one is about finding a wilaya, the other about not being evaded — and
     * sharing a function would quietly change both.
     */
    public static function fold(string $input): string
    {
        $out = preg_replace(
            [
                '/[\x{064B}-\x{0670}]/u',  // harakat
                '/\x{0640}/u',             // tatweel
                '/[أإآٱ]/u',
                '/ى/u',
                '/ة/u',
                '/[ؤئ]/u',
                '/\s+/u',
            ],
            ['', '', 'ا', 'ي', 'ه', 'ء', ' '],
            $input,
        ) ?? $input;

        return trim(mb_strtolower($out));
    }

    /**
     * Word match against already-normalised text, tolerant of attached prefixes.
     *
     * @param  list<string>  $terms
     */
    private static function hasTerm(string $normalised, array $terms): ?string
    {
        foreach ($terms as $term) {
            $folded = self::fold($term);

            // Arabic has no case and few word boundaries a regex engine
            // understands, so the guard is an explicit non-letter (or string
            // edge) on each side.
            $pattern = '/(^|[^\p{L}\p{N}])'.self::PROCLITIC.preg_quote($folded, '/').'($|[^\p{L}\p{N}])/u';

            if (preg_match($pattern, $normalised) === 1) {
                return $term;
            }
        }

        return null;
    }

    /**
     * One character or word hammered over and over — "شقة شقة شقة شقة" — which
     * is keyword stuffing rather than a description.
     */
    private static function looksSpammy(string $text): bool
    {
        if (preg_match('/(.)\1{7,}/u', $text) === 1) {
            return true;
        }

        $words = array_values(array_filter(
            preg_split('/\s+/u', $text) ?: [],
            fn (string $w) => mb_strlen($w) > 2,
        ));

        if (count($words) < 8) {
            return false;
        }

        $unique = array_unique(array_map(self::fold(...), $words));

        // Fewer than a third of the words are distinct.
        return count($unique) * 3 < count($words);
    }

    /** @return array{decision: string, rule: string, reason: string} */
    private static function verdict(string $decision, string $rule): array
    {
        return [
            'decision' => $decision,
            'rule' => $rule,
            // Arabic, addressed to the author, and specific enough to act on.
            'reason' => __('policy.reasons.'.$rule),
        ];
    }

    /**
     * The same rules, in the moderator's words rather than the author's.
     *
     * Shown on every queued post: the check has already read it and said what
     * bothered it, and re-reading a paragraph hunting for the problem is the
     * slow way to do this a hundred times.
     */
    public static function flagLabel(?string $rule): ?string
    {
        return $rule === null || $rule === '' ? null : __('policy.flags.'.$rule);
    }
}
