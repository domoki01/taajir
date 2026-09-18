<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\PriceUnit;
use App\Enums\PropertyType;
use App\Enums\TransactionType;
use App\Models\Setting;

/**
 * Every category the site knows about right now: the built-ins, renamed where
 * the admin renamed them, plus whatever they added.
 *
 * This — not the enums — is what validation, forms, routes and the sitemap must
 * agree on. A custom category that the filter offers but the router rejects is
 * a 404 on a link the site itself printed.
 *
 * Ported from src/server/filterSettings.ts, reading the `filter` row of the
 * settings table where that read a `settings/filter` document.
 */
final class Taxonomy
{
    /** Latin, lowercase, no leading or trailing dash. Ends up in a URL path. */
    public const SLUG_PATTERN = '/^[a-z][a-z0-9-]{1,30}[a-z0-9]$/';

    /** @var array<string, string> slug => label, in code order then custom order */
    public readonly array $propertyTypes;

    /** @var array<string, string> deals, worded for someone posting */
    public readonly array $transactionTypes;

    /** @var array<string, string> the same deals, worded for someone searching */
    public readonly array $transactionFilterLabels;

    /**
     * slug => price unit, for built-in and custom deals alike. The one place
     * the rest of the code asks "how is this deal priced?", so nothing else has
     * to carry a list of deal names.
     *
     * @var array<string, PriceUnit>
     */
    public readonly array $transactionUnits;

    /** @var list<string> property slugs the admin added */
    public readonly array $customPropertySlugs;

    /** @var list<string> deal slugs the admin added */
    public readonly array $customTransactionSlugs;

    /**
     * The settings this was built from, kept so the order and the hidden set
     * are read from the same snapshot as the labels.
     *
     * @var array<string, mixed>
     */
    public readonly array $settings;

    /** Deduped per request, the way React's `cache` deduped the Firestore read. */
    private static ?self $current = null;

    /** @param array<string, mixed> $settings */
    public function __construct(array $settings = [])
    {
        $propertyTypes = self::withLabels(PropertyType::labels(), $settings['propertyLabels'] ?? null);
        $customPropertySlugs = [];

        foreach ($settings['customPropertyTypes'] ?? [] as $custom) {
            $slug = is_array($custom) ? ($custom['slug'] ?? null) : null;
            // Built-ins win a collision: a custom row that shadowed
            // `appartement` would silently rename a category that thousands of
            // listings already point at.
            if (! is_string($slug) || isset(PropertyType::labels()[$slug]) || ! preg_match(self::SLUG_PATTERN, $slug)) {
                continue;
            }
            $propertyTypes[$slug] = trim((string) ($custom['label'] ?? '')) ?: $slug;
            $customPropertySlugs[] = $slug;
        }

        // ── DEALS ────────────────────────────────────────────────────────────
        // Same shape as the property types above, plus the one thing a deal
        // carries that a property type does not: the unit its price is
        // expressed in. Built-in deals take theirs from the code; a custom deal
        // declares its own, and that declaration is what lets the rest of the
        // site handle a deal it has never heard of.
        $builtInDeals = [];
        $builtInFilterLabels = [];
        $units = [];
        foreach (TransactionType::cases() as $case) {
            $builtInDeals[$case->value] = $case->label();
            $builtInFilterLabels[$case->value] = $case->filterLabel();
            $units[$case->value] = $case->defaultPriceUnit();
        }

        $transactionTypes = self::withLabels($builtInDeals, $settings['transactionLabels'] ?? null);
        $transactionFilterLabels = self::withLabels($builtInFilterLabels, $settings['transactionLabels'] ?? null);
        $customTransactionSlugs = [];

        foreach ($settings['customTransactionTypes'] ?? [] as $custom) {
            $slug = is_array($custom) ? ($custom['slug'] ?? null) : null;
            if (! is_string($slug) || isset($builtInDeals[$slug]) || ! preg_match(self::SLUG_PATTERN, $slug)) {
                continue;
            }
            $label = trim((string) ($custom['label'] ?? '')) ?: $slug;
            $transactionTypes[$slug] = $label;
            $transactionFilterLabels[$slug] = trim((string) ($custom['filterLabel'] ?? '')) ?: $label;
            // A unit the code does not know is a price with no scale; fall back
            // rather than let it through, since the unit decides which scale the
            // price is read on.
            $units[$slug] = PriceUnit::tryFrom((string) ($custom['priceUnit'] ?? '')) ?? PriceUnit::Total;
            $customTransactionSlugs[] = $slug;
        }

        $this->propertyTypes = $propertyTypes;
        $this->transactionTypes = $transactionTypes;
        $this->transactionFilterLabels = $transactionFilterLabels;
        $this->transactionUnits = $units;
        $this->customPropertySlugs = $customPropertySlugs;
        $this->customTransactionSlugs = $customTransactionSlugs;
        $this->settings = $settings;
    }

    /**
     * The taxonomy as the admin last left it.
     *
     * A settings read that fails must fall back to the code defaults rather
     * than leave the site with no filter at all — the search filter is the
     * first thing on the home page, and a site with no filter at all is worse
     * than one showing the built-in categories. A missing row is the normal
     * state until an admin touches the screen once.
     *
     * Memoised for the request: a browse page asks for the taxonomy in the
     * heading, the breadcrumb, the side menu and the filter, and that is one
     * query rather than four.
     */
    public static function current(): self
    {
        if (self::$current !== null) {
            return self::$current;
        }

        try {
            $settings = Setting::read('filter');
        } catch (\Throwable $e) {
            report($e);
            $settings = [];
        }

        return self::$current = new self($settings);
    }

    /** Test seam: the memo is stale once a test writes the settings row. */
    public static function forget(): void
    {
        self::$current = null;
    }

    /** The label for one slug, never blank — an unknown slug prints as itself. */
    public static function labelOf(array $map, string $slug): string
    {
        return $map[$slug] ?? $slug;
    }

    /**
     * Apply an order and a hidden set to a resolved list of options.
     *
     * Ordered slugs come first in the admin's order; everything the settings
     * row does not mention keeps its code order behind them. Slugs that no
     * longer exist are dropped rather than rendered as blanks.
     *
     * @param  array<string, string>  $labels
     * @param  list<string>  $order
     * @param  list<string>  $hidden
     * @param  list<string>  $custom
     * @return list<array{slug: string, label: string, hidden: bool, custom: bool}>
     */
    public static function resolve(array $labels, array $order = [], array $hidden = [], array $custom = []): array
    {
        $all = array_keys($labels);
        $ranked = array_values(array_filter($order, fn (string $slug) => in_array($slug, $all, true)));
        $rest = array_values(array_filter($all, fn (string $slug) => ! in_array($slug, $ranked, true)));

        return array_map(fn (string $slug) => [
            'slug' => $slug,
            'label' => $labels[$slug],
            'hidden' => in_array($slug, $hidden, true),
            'custom' => in_array($slug, $custom, true),
        ], [...$ranked, ...$rest]);
    }

    /**
     * Only the options the filter should offer, in order — what the public
     * dropdowns render.
     *
     * Hiding is a presentation decision and stops here. The slug stays valid
     * everywhere else: /vente/hangar/alger keeps resolving, an ad already
     * published as a hangar keeps its page and keeps appearing under "كل أنواع
     * العقار". A settings toggle that could make paid listings disappear would
     * be a far worse problem than one extra line in a dropdown.
     *
     * @return array{transactionTypes: list<array{slug: string, label: string, hidden: bool, custom: bool}>, propertyTypes: list<array{slug: string, label: string, hidden: bool, custom: bool}>}
     */
    public function visibleOptions(?array $settings = null): array
    {
        $settings ??= $this->settings;

        $deals = self::resolve(
            $this->transactionFilterLabels,
            $settings['transactionTypeOrder'] ?? [],
            $settings['hiddenTransactionTypes'] ?? [],
            $this->customTransactionSlugs,
        );

        $properties = self::resolve(
            $this->propertyTypes,
            $settings['propertyTypeOrder'] ?? [],
            $settings['hiddenPropertyTypes'] ?? [],
            $this->customPropertySlugs,
        );

        return [
            'transactionTypes' => array_values(array_filter($deals, fn (array $o) => ! $o['hidden'])),
            'propertyTypes' => array_values(array_filter($properties, fn (array $o) => ! $o['hidden'])),
        ];
    }

    /**
     * Only rename what exists. An override for a slug that has since left the
     * code would otherwise resurrect it as a category with nothing behind it.
     *
     * @param  array<string, string>  $base
     * @param  array<string, mixed>|null  $overrides
     * @return array<string, string>
     */
    private static function withLabels(array $base, ?array $overrides): array
    {
        if (! $overrides) {
            return $base;
        }

        foreach ($overrides as $slug => $label) {
            if (isset($base[$slug]) && is_string($label) && trim($label) !== '') {
                $base[$slug] = trim($label);
            }
        }

        return $base;
    }
}
