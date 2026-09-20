<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Setting;

/**
 * ── SITE IDENTITY ────────────────────────────────────────────────────────────
 * The name, the tagline, the logo and six brand colours. Read on every request,
 * so a save repaints the site with no deploy.
 *
 * Six colours is a deliberately short list. Every token in app.css could in
 * principle be editable, but most of them — the surface greys, the two
 * secondary text greys — are what hold the site's contrast at AA, and handing
 * those over is handing over the ability to make the whole site unreadable in
 * one save. These six are the ones that carry the brand.
 *
 * Ported from src/server/branding.ts and src/types/branding.ts.
 */
final class Branding
{
    /** Colour key => the CSS custom property it overrides. Must match app.css. */
    public const VARIABLES = [
        'primary' => '--color-primary',
        'primaryStrong' => '--color-primary-strong',
        'primarySoft' => '--color-primary-soft',
        'accent' => '--color-accent',
        'accentStrong' => '--color-accent-strong',
        'accentSoft' => '--color-accent-soft',
    ];

    public const HEX = '/^#[0-9a-f]{6}$/i';

    private static ?self $current = null;

    /** @param array<string, string> $colors */
    private function __construct(
        public readonly string $siteName,
        public readonly string $tagline,
        public readonly ?string $logoUrl,
        public readonly array $colors,
    ) {}

    /**
     * The saved identity, or the build's own.
     *
     * A failed or absent read leaves the site named rather than blank: the lang
     * files stay the floor, and this layers on top.
     */
    public static function current(): self
    {
        return self::$current ??= self::fromSettings(Setting::read('branding'));
    }

    /** @param array<string, mixed> $stored */
    public static function fromSettings(array $stored): self
    {
        $colors = [];
        foreach ($stored['colors'] ?? [] as $key => $value) {
            /*
             * Validated on read as well as on write. Only a Server Action can
             * write this row — but the value is interpolated into a <style>
             * tag, and "whoever wrote it checked" is not the property you want
             * a stylesheet to depend on.
             */
            if (isset(self::VARIABLES[$key]) && is_string($value) && preg_match(self::HEX, $value)) {
                $colors[$key] = mb_strtolower($value);
            }
        }

        $logo = $stored['logoUrl'] ?? null;

        return new self(
            siteName: trim((string) ($stored['siteName'] ?? '')) ?: __('brand.name'),
            tagline: trim((string) ($stored['tagline'] ?? '')) ?: __('brand.tagline'),
            logoUrl: is_string($logo) && $logo !== '' ? $logo : null,
            colors: $colors,
        );
    }

    /**
     * The <style> body that repaints the site, or "" when nothing was changed.
     *
     * Overrides `:root` rather than editing app.css: the build's palette stays
     * the default and this layers on top at request time. Emitting nothing when
     * there are no overrides keeps the common case free.
     *
     * Safe to interpolate: every value has been matched against `#rrggbb`, so
     * no quote, brace or angle bracket can reach the document.
     */
    public function style(): string
    {
        $rules = [];
        foreach ($this->colors as $key => $value) {
            $rules[] = self::VARIABLES[$key].':'.$value;
        }

        return $rules === [] ? '' : ':root{'.implode(';', $rules).'}';
    }

    /** Test seam, and the hook the branding screen calls after a save. */
    public static function forget(): void
    {
        self::$current = null;
    }
}
