<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\SavedSearch;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Standing searches, and the alerts they drive.
 *
 * Ten per account: generous for a person, and low enough that approving one ad
 * fans out to a bounded number of notifications rather than an unbounded one.
 */
final class SavedSearchService
{
    public function create(User $owner, array $input): SavedSearch
    {
        $max = config('taajir.max_saved_searches');

        if (SavedSearch::where('owner_uid', $owner->uid)->count() >= $max) {
            throw ValidationException::withMessages([
                'wilaya' => __('community.too_many_searches', ['max' => $max]),
            ]);
        }

        return SavedSearch::create([
            'owner_uid' => $owner->uid,
            'transaction_type' => $input['transaction'] ?? null,
            'property_type' => $input['type'] ?? null,
            'wilaya_slug' => $input['wilaya'],
            'commune_slug' => $input['commune'] ?? null,
            // Built here, not in the view, so the list on screen and the text
            // of the push notification cannot drift apart.
            'label' => $this->label($input),
            'notify' => (bool) ($input['notify'] ?? true),
            'created_at' => now(),
        ]);
    }

    public function delete(User $owner, SavedSearch $search): void
    {
        abort_unless($search->owner_uid === $owner->uid, 403);

        $search->delete();
    }

    /**
     * "شقة للكراء في باب الزوار" — the search in the language it was made in.
     *
     * Assembled from the live taxonomy rather than the enums, so a category an
     * admin renamed reads the way they renamed it.
     */
    private function label(array $input): string
    {
        $taxonomy = Taxonomy::current();

        $what = isset($input['type'])
            ? Taxonomy::labelOf($taxonomy->propertyTypes, (string) $input['type'])
            : __('browse.all_properties');

        $deal = isset($input['transaction'])
            ? __('taxonomy.deal_headings.'.$input['transaction'])
            : '';

        $where = isset($input['commune']) && $input['commune'] !== ''
            ? Geo::placeLabel((string) $input['wilaya'], (string) $input['commune'])
            : (Geo::wilaya((string) $input['wilaya'])?->name() ?? $input['wilaya']);

        return mb_substr(trim(implode(' ', array_filter([
            $what,
            $deal,
            __('browse.in_place', ['place' => $where]),
        ]))), 0, 160);
    }
}
