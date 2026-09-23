<?php

declare(strict_types=1);

namespace App\Support;

use Normalizer;

/**
 * ── ARTICLE TEXT ─────────────────────────────────────────────────────────────
 * Turning what an editor types into the block list the page renders, and back.
 *
 * Deliberately not Markdown. A parser would accept inline HTML, and the whole
 * reason the body is blocks is that nothing an admin types ever becomes markup:
 * a block becomes a <p> with text inside it, and Blade escapes the text.
 *
 * Ported from src/lib/article.ts.
 */
final class ArticleBody
{
    /**
     * Three prefixes and a blank line, which is as much syntax as an editor
     * writing Arabic into a textarea should have to remember:
     *
     *   ## a heading
     *   - a bullet
     *   > a pulled quote
     *   anything else is a paragraph
     *
     * @return list<array{type: string, text: string}>
     */
    public static function parse(string $raw): array
    {
        $blocks = [];

        foreach (preg_split('/\r?\n/', $raw) as $line) {
            $text = trim($line);
            if ($text === '') {
                continue;
            }

            $blocks[] = match (true) {
                str_starts_with($text, '## ') => ['type' => 'h2', 'text' => trim(substr($text, 3))],
                str_starts_with($text, '- ') => ['type' => 'li', 'text' => trim(substr($text, 2))],
                str_starts_with($text, '> ') => ['type' => 'quote', 'text' => trim(substr($text, 2))],
                default => ['type' => 'p', 'text' => $text],
            };
        }

        return $blocks;
    }

    /**
     * The inverse, so the editor can reopen what it saved.
     *
     * @param  list<array{type: string, text: string}>  $blocks
     */
    public static function toRaw(array $blocks): string
    {
        return implode("\n\n", array_map(fn (array $b) => match ($b['type']) {
            'h2' => '## '.$b['text'],
            'li' => '- '.$b['text'],
            'quote' => '> '.$b['text'],
            default => $b['text'],
        }, $blocks));
    }

    /**
     * Inline emphasis, resolved at render time into runs of text.
     *
     * `**like this**` — the one piece of inline syntax there is. It is split
     * here rather than converted to markup anywhere, so what reaches the view
     * is still a list of strings: a <strong> with text inside it, never a
     * string containing a tag.
     *
     * An odd number of markers is treated as literal text, because half a bold
     * run is a typo and a typo should look like one rather than eat the rest of
     * the paragraph. (The Next app's /cgu still shows the literal asterisks
     * this rule produces — that is the rule working, and the copy that needs
     * fixing.)
     *
     * @return list<array{text: string, bold: bool}>
     */
    public static function runs(string $text): array
    {
        $parts = explode('**', $text);

        if (count($parts) % 2 === 0) {
            return [['text' => $text, 'bold' => false]];
        }

        $out = [];
        foreach ($parts as $i => $part) {
            if ($part !== '') {
                $out[] = ['text' => $part, 'bold' => $i % 2 === 1];
            }
        }

        return $out;
    }

    /**
     * Reading time, at 180 words a minute.
     *
     * Slower than the 220–250 usually quoted for English prose: Arabic packs
     * more meaning per word, and this text is read on a phone. Rounding up
     * means a two-minute read is never announced as one.
     *
     * @param  list<array{type: string, text: string}>  $blocks
     */
    public static function readingMinutes(array $blocks): int
    {
        $words = 0;
        foreach ($blocks as $block) {
            $words += count(preg_split('/\s+/', trim($block['text']), -1, PREG_SPLIT_NO_EMPTY));
        }

        return max(1, (int) ceil($words / 180));
    }

    /** Latin, lowercase, hyphenated — the shape every URL on this site takes. */
    public const SLUG_PATTERN = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

    public static function slug(string $raw): string
    {
        // Decompose, drop the combining marks, keep what is left of the Latin
        // alphabet: "marché" becomes "marche" rather than "march-".
        $slug = mb_strtolower(trim($raw));
        $slug = preg_replace('/\p{Mn}+/u', '', Normalizer::normalize($slug, Normalizer::FORM_D) ?: $slug);

        /*
         * Everything else goes, Arabic included — which means an Arabic slug
         * folds to the empty string and is refused by the pattern check rather
         * than quietly accepted.
         *
         * Deliberately not Str::slug(), which transliterates: it would turn
         * "سوق العقار" into "sok-alaakar" and put that in a URL. Latin and
         * French-derived is the rule (CLAUDE.md); a machine transliteration is
         * Latin and nothing else, and telling the editor to type a slug is a
         * better answer than inventing an unreadable one for them.
         */
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);

        return mb_substr(trim($slug, '-'), 0, 70);
    }

    /**
     * Segments the article routes must never hand to a slug.
     *
     * /articles/nouveau is the editor. A published article claiming that slug
     * would shadow it, and the way back would be a database edit.
     */
    public const RESERVED = ['nouveau', 'new', 'admin', 'modifier'];

    /**
     * A cover URL the page may actually render.
     *
     * A same-origin path or an https URL, and nothing else. The value ends up
     * in three places with different rules: an <img src>, where javascript: is
     * inert but data: is a way to smuggle content past review; the og:image
     * tag, which *other people's servers* fetch on every shared link, so a
     * hostile host there is a beacon aimed at our own readers; and the JSON-LD,
     * which search engines fetch. articles.manage is a staff permission, not a
     * promise — the field is validated, not trusted.
     */
    public static function safeCoverUrl(?string $raw): ?string
    {
        $value = trim((string) $raw);

        if ($value === '') {
            return null;
        }

        // Same-origin path. `//evil.dz` is protocol-relative, not a path.
        if (str_starts_with($value, '/') && ! str_starts_with($value, '//')) {
            return $value;
        }

        return parse_url($value, PHP_URL_SCHEME) === 'https' && parse_url($value, PHP_URL_HOST) !== null
            ? $value
            : null;
    }
}
