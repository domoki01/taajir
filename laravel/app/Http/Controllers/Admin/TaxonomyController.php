<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\Permission;
use App\Enums\PriceUnit;
use App\Http\Controllers\Controller;
use App\Services\Taxonomy;
use App\Services\TaxonomyEditor;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * The categories and the filter.
 *
 * Hiding is a presentation decision and stops at the dropdown: a hidden slug
 * keeps resolving, an ad already filed under it keeps its page, and it still
 * appears under "every type". A settings toggle that could make paid listings
 * disappear would be a far worse problem than one extra line in a menu.
 */
final class TaxonomyController extends Controller
{
    public function __construct(private readonly TaxonomyEditor $editor) {}

    private function authorizeAction(Request $request): void
    {
        abort_unless($request->user()?->hasPermission(Permission::TaxonomyEdit) === true, 403);
    }

    public function index(Request $request): View
    {
        $this->authorizeAction($request);

        $taxonomy = Taxonomy::current();

        return view('admin.taxonomy', [
            // resolve(), not visibleOptions(): this screen is where hiding is
            // decided, so it has to show the hidden rows too.
            'deals' => Taxonomy::resolve(
                $taxonomy->transactionFilterLabels,
                $taxonomy->settings['transactionTypeOrder'] ?? [],
                $taxonomy->settings['hiddenTransactionTypes'] ?? [],
                $taxonomy->customTransactionSlugs,
            ),
            'properties' => Taxonomy::resolve(
                $taxonomy->propertyTypes,
                $taxonomy->settings['propertyTypeOrder'] ?? [],
                $taxonomy->settings['hiddenPropertyTypes'] ?? [],
                $taxonomy->customPropertySlugs,
            ),
            'units' => PriceUnit::cases(),
        ]);
    }

    public function save(Request $request): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate([
            'deals' => ['array'],
            'deals.*.slug' => ['required', 'string'],
            'deals.*.label' => ['required', 'string', 'max:40'],
            'properties' => ['array'],
            'properties.*.slug' => ['required', 'string'],
            'properties.*.label' => ['required', 'string', 'max:40'],
        ]);

        $this->editor->save(
            $request->user(),
            $this->rows($validated['deals'] ?? [], $request->input('hidden.deals', [])),
            $this->rows($validated['properties'] ?? [], $request->input('hidden.properties', [])),
        );

        return back()->with('status', __('admin.taxonomy.saved'));
    }

    /**
     * The posted rows, in the order the form drew them, with the hidden set
     * folded back in.
     *
     * Visibility is posted as a separate list of slugs rather than a checkbox
     * inside each row, because an *unticked* checkbox sends nothing at all —
     * the row would come back with no `hidden` key and no way to tell "shown"
     * from "the browser dropped it".
     *
     * @param  list<array{slug: string, label: string}>  $rows
     * @param  mixed  $hidden
     * @return list<array{slug: string, label: string, hidden: bool}>
     */
    private function rows(array $rows, $hidden): array
    {
        $hidden = is_array($hidden) ? $hidden : [];

        return array_map(fn (array $row) => [
            'slug' => $row['slug'],
            'label' => $row['label'],
            'hidden' => in_array($row['slug'], $hidden, true),
        ], array_values($rows));
    }

    public function addProperty(Request $request): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate([
            'slug' => ['required', 'string', 'max:32'],
            'label' => ['required', 'string', 'max:40'],
        ]);

        $this->editor->addPropertyType($request->user(), $validated['slug'], $validated['label']);

        return back()->with('status', __('admin.taxonomy.type_added'));
    }

    public function addDeal(Request $request): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate([
            'slug' => ['required', 'string', 'max:32'],
            'label' => ['required', 'string', 'max:40'],
            'filter_label' => ['nullable', 'string', 'max:40'],
            'price_unit' => ['required', 'string'],
        ]);

        $this->editor->addTransactionType(
            $request->user(),
            $validated['slug'],
            $validated['label'],
            (string) ($validated['filter_label'] ?? ''),
            $validated['price_unit'],
        );

        return back()->with('status', __('admin.taxonomy.deal_added'));
    }

    public function destroy(Request $request, string $kind, string $slug): RedirectResponse
    {
        $this->authorizeAction($request);

        abort_unless(in_array($kind, ['deal', 'type'], true), 404);

        $this->editor->deleteCustom($request->user(), $kind, $slug);

        return back()->with('status', __('admin.taxonomy.deleted'));
    }

    public function reset(Request $request): RedirectResponse
    {
        $this->authorizeAction($request);

        $this->editor->reset($request->user());

        return back()->with('status', __('admin.taxonomy.reset_done'));
    }
}
