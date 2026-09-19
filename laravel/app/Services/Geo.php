<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\Locale;
use App\Models\Commune;
use App\Models\Wilaya;
use App\Support\Text;
use Illuminate\Support\Collection;

/**
 * ── GEOGRAPHY ────────────────────────────────────────────────────────────────
 * Lookups over the seeded dataset. Everything keys off the SLUG, not the
 * numeric code: Algeria renumbered its wilayas in 2026 and may do so again, but
 * "bab-ezzouar" stays "bab-ezzouar" — which keeps URLs and any SEO equity
 * attached to them stable across administrative reshuffles.
 *
 * Ported from src/lib/geo.ts, which read a committed JSON file. Here the same
 * data is in MySQL, so the whole 69-row wilaya table is read once per request
 * and held: a browse page asks for a wilaya in the breadcrumb, the heading, the
 * canonical URL and twenty-four footer links, and that is one query, not
 * twenty-seven.
 */
final class Geo
{
    /** @var Collection<int, Wilaya>|null */
    private static ?Collection $wilayas = null;

    /** @return Collection<int, Wilaya> */
    public static function wilayas(): Collection
    {
        return self::$wilayas ??= Wilaya::query()->orderBy('code')->get();
    }

    public static function wilaya(string $slug): ?Wilaya
    {
        return self::wilayas()->firstWhere('slug', $slug);
    }

    public static function wilayaByCode(int $code): ?Wilaya
    {
        return self::wilayas()->firstWhere('code', $code);
    }

    /** @return Collection<int, Commune> */
    public static function communes(int $wilayaCode): Collection
    {
        return Commune::query()
            ->where('wilaya_code', $wilayaCode)
            ->orderBy('slug')
            ->get();
    }

    public static function commune(int $wilayaCode, string $slug): ?Commune
    {
        return Commune::query()
            ->where('wilaya_code', $wilayaCode)
            ->where('slug', $slug)
            ->first();
    }

    /**
     * "باب الزوار، الجزائر" — or "Bab Ezzouar, Alger" — the commune name in the
     * language being rendered, falling back to a de-slugged form. Printing the
     * raw Latin slug inside Arabic prose looks broken and reads worse, so the
     * lookup is worth the query.
     *
     * The separator is the language's own: Arabic uses the Arabic comma, which
     * is a different character and sits on the other side of the word.
     */
    public static function placeLabel(string $wilayaSlug, string $communeSlug): string
    {
        $wilaya = self::wilaya($wilayaSlug);
        $commune = $wilaya ? self::commune($wilaya->code, $communeSlug) : null;
        $communeName = $commune?->name() ?? str_replace('-', ' ', $communeSlug);

        $comma = Locale::current() === Locale::Ar ? '، ' : ', ';

        return $wilaya ? $communeName.$comma.$wilaya->name() : $communeName;
    }

    /**
     * Wilayas people actually search for, ordered by population weight rather
     * than by code, so the home page shortcuts are useful instead of
     * alphabetical.
     *
     * @var list<string>
     */
    public const FEATURED_SLUGS = [
        'alger',
        'oran',
        'constantine',
        'setif',
        'annaba',
        'blida',
        'tizi-ouzou',
        'batna',
    ];

    /** @return list<Wilaya> */
    public static function featured(): array
    {
        return array_values(array_filter(array_map(
            fn (string $slug) => self::wilaya($slug),
            self::FEATURED_SLUGS,
        )));
    }

    /**
     * Match a free-text query against wilaya names in either language, plus the
     * alias list — which carries the pre-2026 parent name, so someone typing
     * "M'sila" still finds Bou Saâda after it was split off.
     *
     * @return list<Wilaya>
     */
    public static function search(string $query, int $limit = 8): array
    {
        $q = Text::normalize($query);
        if ($q === '') {
            return [];
        }

        return self::wilayas()
            ->filter(fn (Wilaya $w) => str_contains(Text::normalize($w->name_fr), $q)
                || str_contains(Text::normalize($w->name_ar), $q)
                || collect($w->aliases)->contains(fn (string $alias) => str_contains($alias, $q)))
            ->take($limit)
            ->values()
            ->all();
    }

    /** Test seam: the per-request memo is stale once a test reseeds the table. */
    public static function forget(): void
    {
        self::$wilayas = null;
    }
}
