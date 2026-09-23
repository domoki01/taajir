<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * The three languages the site speaks.
 *
 * Arabic is the default and carries no URL prefix, which is not a stylistic
 * choice: every path the site serves today is Arabic and unprefixed, and those
 * paths are the contract with Google and with every WhatsApp message ever sent.
 * Moving them under /ar would break all of it. French and English are additions,
 * so they are the ones that take a prefix.
 *
 * French before English deliberately. Algeria's second working language is
 * French — it is what the property market, the paperwork and the wilaya names
 * are already written in (`wilayas.name_fr` predates this). English is for the
 * diaspora and for search engines outside the country.
 */
enum Locale: string
{
    case Ar = 'ar';
    case Fr = 'fr';
    case En = 'en';

    public static function default(): self
    {
        return self::Ar;
    }

    public function isDefault(): bool
    {
        return $this === self::default();
    }

    /**
     * Arabic reads right to left; the other two do not.
     *
     * This is the value of <html dir>, which is what every logical Tailwind
     * utility on the site keys off — ps-*, me-*, start-*, and the `rtl:` and
     * `ltr:` variants. Getting it from here is why the layout needed no other
     * change to work in French: the utilities were logical from the first
     * commit, exactly so this day would be cheap.
     */
    public function direction(): string
    {
        return $this === self::Ar ? 'rtl' : 'ltr';
    }

    /** What the language calls itself, for the switcher. */
    public function nativeName(): string
    {
        return match ($this) {
            self::Ar => 'العربية',
            self::Fr => 'Français',
            self::En => 'English',
        };
    }

    /**
     * The `lang` attribute and the hreflang value.
     *
     * Region-qualified for Arabic and French because this is an Algerian site:
     * ar-DZ is not ar-EG, and fr-DZ is the French of Algerian administration.
     * English is unqualified — there is no Algerian English, and en-DZ would
     * tell a crawler this page is for a variety that does not exist.
     */
    public function htmlLang(): string
    {
        return match ($this) {
            self::Ar => 'ar-DZ',
            self::Fr => 'fr-DZ',
            self::En => 'en',
        };
    }

    /** The OpenGraph locale, which wants underscores and a region on each. */
    public function openGraphLocale(): string
    {
        return match ($this) {
            self::Ar => 'ar_DZ',
            self::Fr => 'fr_DZ',
            self::En => 'en_US',
        };
    }

    /**
     * Does this language quote property in ملايين?
     *
     * Algerians do, in Arabic and in French alike: one مليون is 10 000 DZD, so
     * a flat advertised at "800 مليون" costs 8 000 000 DZD, and "800 millions"
     * is exactly how it is said on the phone and in every agency window.
     *
     * English is the exception, and not for style. "800 million" is not a
     * translation of "800 مليون" — it is a different number. The Algerian unit
     * is a million *centimes*, which an English reader has no reason to know,
     * and part of that audience is outside the country. 8,000,000 DZD says the
     * same thing to everyone.
     *
     * This lives here rather than in lang/{locale}/price.php because __()
     * returns the key back for anything that is not a string: a boolean in a
     * translation file reads as truthy in every locale.
     */
    public function quotesInMillions(): bool
    {
        return $this !== self::En;
    }

    /** The URL prefix, empty for the default. */
    public function prefix(): string
    {
        return $this->isDefault() ? '' : '/'.$this->value;
    }

    public static function current(): self
    {
        return self::tryFrom(app()->getLocale()) ?? self::default();
    }

    /**
     * The locales that take a prefix, as a route pattern: `fr|en`.
     *
     * One source for the pattern so a fourth language is one enum case and
     * nothing else.
     */
    public static function prefixedPattern(): string
    {
        return implode('|', array_map(
            fn (self $l) => $l->value,
            array_filter(self::cases(), fn (self $l) => ! $l->isDefault()),
        ));
    }

    /**
     * The same page in this locale.
     *
     * Takes a path with no locale prefix ("/vente/appartement/alger") and
     * returns the one this locale serves it at.
     */
    public function path(string $path): string
    {
        $path = '/'.ltrim($path, '/');

        if ($path === '/') {
            return $this->prefix() ?: '/';
        }

        return $this->prefix().$path;
    }
}
