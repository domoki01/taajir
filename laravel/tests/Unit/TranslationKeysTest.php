<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Enums\Locale;
use Tests\TestCase;

/**
 * The three languages have to carry the same keys.
 *
 * Laravel falls back to the default locale for a key a translation file is
 * missing, so a forgotten French string does not break the page — it renders
 * Arabic, right-to-left, in the middle of a left-to-right paragraph, and
 * nothing tells anyone. That is the failure this file is here to catch.
 */
final class TranslationKeysTest extends TestCase
{
    public function test_every_language_defines_exactly_the_same_keys(): void
    {
        $reference = Locale::default()->value;
        $expected = $this->keysFor($reference);

        $this->assertNotEmpty($expected, 'the reference language has no translations at all');

        foreach (Locale::cases() as $locale) {
            if ($locale->value === $reference) {
                continue;
            }

            $actual = $this->keysFor($locale->value);

            $this->assertSame(
                [],
                array_values(array_diff($expected, $actual)),
                "missing from lang/{$locale->value}",
            );

            $this->assertSame(
                [],
                array_values(array_diff($actual, $expected)),
                "present in lang/{$locale->value} but not in lang/{$reference}",
            );
        }
    }

    public function test_no_translation_is_left_blank(): void
    {
        foreach (Locale::cases() as $locale) {
            foreach ($this->keysFor($locale->value) as $key) {
                $this->assertNotSame(
                    '',
                    trim((string) __($key, [], $locale->value)),
                    "{$key} is blank in lang/{$locale->value}",
                );
            }
        }
    }

    /**
     * Files a language may have that the others need not: English is the only
     * one with place-name exonyms, because it is the only one that has any.
     *
     * @var list<string>
     */
    private const LANGUAGE_SPECIFIC = ['geography'];

    /** @return list<string> */
    private function keysFor(string $locale): array
    {
        $keys = [];

        foreach (glob(lang_path($locale.'/*.php')) ?: [] as $file) {
            $group = basename($file, '.php');

            if (in_array($group, self::LANGUAGE_SPECIFIC, true)) {
                continue;
            }

            foreach ($this->flatten(require $file) as $key) {
                $keys[] = $group.'.'.$key;
            }
        }

        sort($keys);

        return $keys;
    }

    /**
     * @param  array<string, mixed>  $lines
     * @return list<string>
     */
    private function flatten(array $lines, string $prefix = ''): array
    {
        $out = [];

        foreach ($lines as $key => $value) {
            $full = $prefix === '' ? (string) $key : $prefix.'.'.$key;

            if (is_array($value)) {
                $out = [...$out, ...$this->flatten($value, $full)];

                continue;
            }

            $out[] = $full;
        }

        return $out;
    }
}
