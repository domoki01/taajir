<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\Permission;
use App\Enums\PriceUnit;
use App\Enums\PropertyType;
use App\Enums\TransactionType;
use App\Models\AuditEntry;
use App\Models\Listing;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * ── CATEGORIES AND FILTER ────────────────────────────────────────────────────
 * Which options the filter offers, in what order, and under what names — plus
 * the categories an admin added that the code has never heard of.
 *
 * Site configuration rather than content, so it sits behind `taxonomy.edit`.
 * Every slug is checked against the resolved taxonomy before it is written: the
 * screen only ever sends known values, and this is what makes that true.
 *
 * Ported from src/server/actions/filterSettings.ts.
 */
final class TaxonomyEditor
{
    private const LABEL_MIN = 2;

    private const LABEL_MAX = 40;

    /**
     * Top-level paths a deal slug must not take.
     *
     * Browse lives at /{deal}, so a deal called "publier" would sit in front of
     * the publish form. Laravel resolves the fixed route first, which leaves
     * the deal as a page nobody can reach — and the reverse becomes true the
     * moment a route is renamed. Refusing the collision is cheaper than
     * debugging it later.
     */
    public const RESERVED = [
        'annonce', 'demandes', 'recherche', 'publier', 'connexion', 'inscription',
        'admin', 'api', 'tableau-de-bord', 'merci', 'bienvenue', 'lancement',
        'aide', 'cgu', 'confidentialite', 'securite', 'a-propos', 'articles',
        'sitemap.xml', 'r', 's', 'fr', 'en', 'ar',
    ];

    /**
     * Save order, visibility and renames for both lists.
     *
     * @param  list<array{slug: string, label: string, hidden: bool}>  $deals
     * @param  list<array{slug: string, label: string, hidden: bool}>  $properties
     *
     * @throws ValidationException
     */
    public function save(User $actor, array $deals, array $properties): void
    {
        $this->ensure($actor);

        $taxonomy = Taxonomy::current();
        $settings = $taxonomy->settings;

        $t = $this->split($deals, $taxonomy->transactionFilterLabels, $this->builtInDealLabels());
        $p = $this->split($properties, $taxonomy->propertyTypes, PropertyType::labels());

        // An empty dropdown is a broken page, not a configuration. Refuse
        // rather than let someone lock the filter into a state they cannot see
        // to undo.
        if (count($t['hidden']) >= count($taxonomy->transactionFilterLabels)) {
            $this->refuse('deals', __('admin.taxonomy.keep_one_deal'));
        }
        if (count($p['hidden']) >= count($taxonomy->propertyTypes)) {
            $this->refuse('properties', __('admin.taxonomy.keep_one_property'));
        }

        /*
         * Custom rows are rewritten from the posted labels so a rename lands on
         * the definition rather than piling a label override on top of it — and
         * a custom slug's label *is* its definition, so it must not also appear
         * in the override map or it would be stored twice and disagree with
         * itself the next time one of the two is edited.
         */
        $renamedProperties = $this->renames($properties);
        $customProperties = [];
        foreach ($settings['customPropertyTypes'] ?? [] as $custom) {
            $slug = $custom['slug'] ?? null;
            if (is_string($slug) && isset($taxonomy->propertyTypes[$slug])) {
                $customProperties[] = [
                    'slug' => $slug,
                    'label' => $renamedProperties[$slug] ?? $custom['label'],
                ];
            }
        }

        // The rows this screen edits carry the *search* wording, so a rename
        // lands on filterLabel and the posting wording is left as it was.
        $renamedDeals = $this->renames($deals);
        $customDeals = [];
        foreach ($settings['customTransactionTypes'] ?? [] as $custom) {
            $slug = $custom['slug'] ?? null;
            if (is_string($slug) && isset($taxonomy->transactionTypes[$slug])) {
                $customDeals[] = [
                    ...$custom,
                    'filterLabel' => $renamedDeals[$slug] ?? ($custom['filterLabel'] ?? $custom['label']),
                ];
            }
        }

        foreach ($taxonomy->customPropertySlugs as $slug) {
            unset($p['labels'][$slug]);
        }
        foreach ($taxonomy->customTransactionSlugs as $slug) {
            unset($t['labels'][$slug]);
        }

        $this->write($actor, [
            'transactionTypeOrder' => $t['order'],
            'hiddenTransactionTypes' => $t['hidden'],
            'transactionLabels' => $t['labels'],
            'propertyTypeOrder' => $p['order'],
            'hiddenPropertyTypes' => $p['hidden'],
            'propertyLabels' => $p['labels'],
            'customPropertyTypes' => $customProperties,
            'customTransactionTypes' => $customDeals,
        ]);

        AuditEntry::record($actor, 'filter.save', 'settings', 'filter', [
            'hidden' => count($t['hidden']) + count($p['hidden']),
        ]);
    }

    /**
     * Add a property category.
     *
     * The slug is permanent from this moment on: it goes into
     * /vente/{slug}/alger and into every listing filed under it. Renaming is
     * the label; there is no rename for a slug, only a delete of an unused one.
     *
     * @throws ValidationException
     */
    public function addPropertyType(User $actor, string $slug, string $label): void
    {
        $this->ensure($actor);

        $slug = $this->cleanSlug($slug, 'slug');
        $label = $this->cleanLabel($label, 'label');

        if (isset(PropertyType::labels()[$slug])) {
            $this->refuse('slug', __('admin.taxonomy.slug_is_builtin'));
        }
        if (isset(Taxonomy::current()->propertyTypes[$slug])) {
            $this->refuse('slug', __('admin.taxonomy.already_exists'));
        }

        $settings = Taxonomy::current()->settings;
        $settings['customPropertyTypes'] = [
            ...($settings['customPropertyTypes'] ?? []),
            ['slug' => $slug, 'label' => $label],
        ];

        $this->write($actor, $settings);
        AuditEntry::record($actor, 'filter.type_add', 'settings', 'filter', ['note' => $slug]);
    }

    /**
     * Add a deal — a third thing to do with a property, beside selling and
     * renting.
     *
     * The one field that is not a label is the price unit, and it is the whole
     * reason this can exist at all: a deal is the only category the code
     * reasons about numerically. Declared here, it is read from the taxonomy
     * everywhere else, so no other file has to learn the new deal's name.
     *
     * @throws ValidationException
     */
    public function addTransactionType(User $actor, string $slug, string $label, string $filterLabel, string $priceUnit): void
    {
        $this->ensure($actor);

        $slug = $this->cleanSlug($slug, 'slug');
        $label = $this->cleanLabel($label, 'label');

        if (TransactionType::tryFrom($slug) !== null) {
            $this->refuse('slug', __('admin.taxonomy.slug_is_builtin'));
        }
        if (in_array($slug, self::RESERVED, true)) {
            $this->refuse('slug', __('admin.taxonomy.slug_is_a_page'));
        }
        if (isset(Taxonomy::current()->transactionTypes[$slug])) {
            $this->refuse('slug', __('admin.taxonomy.already_exists'));
        }
        if (PriceUnit::tryFrom($priceUnit) === null) {
            $this->refuse('price_unit', __('admin.taxonomy.bad_unit'));
        }

        $filterLabel = trim($filterLabel);
        if ($filterLabel !== '') {
            $filterLabel = $this->cleanLabel($filterLabel, 'filter_label');
        }

        $settings = Taxonomy::current()->settings;
        $settings['customTransactionTypes'] = [
            ...($settings['customTransactionTypes'] ?? []),
            [
                'slug' => $slug,
                'label' => $label,
                'filterLabel' => $filterLabel ?: $label,
                'priceUnit' => $priceUnit,
            ],
        ];

        $this->write($actor, $settings);
        AuditEntry::record($actor, 'filter.deal_add', 'settings', 'filter', ['note' => $slug.':'.$priceUnit]);
    }

    /**
     * Remove a category an admin added — but only while nothing is filed under
     * it.
     *
     * A listing whose type no longer resolves has no label, drops out of the
     * filter and keeps a URL that now 404s. Counting first is one query; the
     * alternative is finding out from a seller whose paid ad stopped working.
     *
     * @throws ValidationException
     */
    public function deleteCustom(User $actor, string $kind, string $slug): void
    {
        $this->ensure($actor);

        $taxonomy = Taxonomy::current();
        $isDeal = $kind === 'deal';

        $builtIn = $isDeal
            ? TransactionType::tryFrom($slug) !== null
            : isset(PropertyType::labels()[$slug]);

        if ($builtIn) {
            // Built-ins are hidden, never deleted: the slug is in published
            // URLs and in filed listings.
            $this->refuse('slug', __('admin.taxonomy.builtin_hide_only'));
        }

        $custom = $isDeal ? $taxonomy->customTransactionSlugs : $taxonomy->customPropertySlugs;
        if (! in_array($slug, $custom, true)) {
            return;
        }

        $used = Listing::query()
            ->where($isDeal ? 'transaction_type' : 'property_type', $slug)
            ->count();

        if ($used > 0) {
            $this->refuse('slug', __('admin.taxonomy.still_used', ['count' => $used]));
        }

        $key = $isDeal ? 'customTransactionTypes' : 'customPropertyTypes';
        $settings = $taxonomy->settings;
        $settings[$key] = array_values(array_filter(
            $settings[$key] ?? [],
            fn (array $row) => ($row['slug'] ?? null) !== $slug,
        ));

        $this->write($actor, $settings);
        AuditEntry::record($actor, $isDeal ? 'filter.deal_delete' : 'filter.type_delete', 'settings', 'filter', ['note' => $slug]);
    }

    /**
     * Back to the code defaults: every option visible, in its original order.
     *
     * @throws ValidationException
     */
    public function reset(User $actor): void
    {
        $this->ensure($actor);

        $taxonomy = Taxonomy::current();
        if ($taxonomy->customPropertySlugs !== [] || $taxonomy->customTransactionSlugs !== []) {
            // Reset is "undo my presentation changes", not "delete my
            // categories". The second has its own button, per category, with a
            // usage check behind it.
            $this->refuse('reset', __('admin.taxonomy.delete_custom_first'));
        }

        // Deleted rather than blanked: absent is exactly what "never
        // configured" means, and the reader already falls back to the enums.
        Setting::query()->whereKey('filter')->delete();
        Taxonomy::forget();

        AuditEntry::record($actor, 'filter.reset', 'settings', 'filter');
    }

    /**
     * Split posted rows into order, hidden set and renamed labels, keeping only
     * slugs that resolve.
     *
     * @param  list<array{slug: string, label: string, hidden: bool}>  $rows
     * @param  array<string, string>  $known
     * @param  array<string, string>  $base
     * @return array{order: list<string>, hidden: list<string>, labels: array<string, string>}
     */
    private function split(array $rows, array $known, array $base): array
    {
        $order = [];
        $hidden = [];
        $labels = [];

        foreach ($rows as $row) {
            $slug = $row['slug'];
            if (! isset($known[$slug]) || in_array($slug, $order, true)) {
                continue;
            }

            $order[] = $slug;
            if ($row['hidden']) {
                $hidden[] = $slug;
            }

            $label = $this->cleanLabel($row['label'], 'labels');
            /*
             * Only stored when it differs from the code default. Storing every
             * label would freeze the wording: a copy fix shipped in the enums
             * would be overridden for good by a settings row written before it.
             */
            if (($base[$slug] ?? null) !== $label) {
                $labels[$slug] = $label;
            }
        }

        return ['order' => $order, 'hidden' => $hidden, 'labels' => $labels];
    }

    /**
     * @param  list<array{slug: string, label: string, hidden: bool}>  $rows
     * @return array<string, string>
     */
    private function renames(array $rows): array
    {
        $out = [];
        foreach ($rows as $row) {
            $label = trim($row['label']);
            if ($label !== '') {
                $out[$row['slug']] = $label;
            }
        }

        return $out;
    }

    /** @return array<string, string> the built-in deals under their *search* wording */
    private function builtInDealLabels(): array
    {
        $out = [];
        foreach (TransactionType::cases() as $case) {
            $out[$case->value] = $case->filterLabel();
        }

        return $out;
    }

    /** @param array<string, mixed> $value */
    private function write(User $actor, array $value): void
    {
        Setting::query()->updateOrCreate(['key' => 'filter'], [
            'value' => $value,
            'updated_at' => now(),
            'updated_by' => $actor->uid,
        ]);

        Taxonomy::forget();
    }

    private function cleanSlug(string $slug, string $field): string
    {
        $slug = mb_strtolower(trim($slug));

        if (! preg_match(Taxonomy::SLUG_PATTERN, $slug)) {
            $this->refuse($field, __('admin.taxonomy.bad_slug'));
        }

        return $slug;
    }

    private function cleanLabel(string $label, string $field): string
    {
        $label = trim($label);
        $length = mb_strlen($label);

        if ($length < self::LABEL_MIN || $length > self::LABEL_MAX) {
            $this->refuse($field, __('admin.taxonomy.bad_label', [
                'min' => self::LABEL_MIN,
                'max' => self::LABEL_MAX,
            ]));
        }

        return $label;
    }

    private function ensure(User $actor): void
    {
        abort_unless($actor->hasPermission(Permission::TaxonomyEdit), 403);
    }

    /** @throws ValidationException */
    private function refuse(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
