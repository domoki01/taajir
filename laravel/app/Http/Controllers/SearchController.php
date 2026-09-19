<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\Geo;
use App\Services\ListingQuery;
use App\Services\Taxonomy;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * `/recherche` — free-form filtering.
 *
 * Deliberately noindex. The clean, canonical combinations a crawler should see
 * are the browse routes; this one can express an unbounded number of filter
 * permutations, and letting them all be indexed is how a site ends up
 * competing with itself for every query.
 */
final class SearchController extends Controller
{
    public function __invoke(Request $request): View
    {
        $filters = $request->only([
            'transaction', 'type', 'wilaya', 'commune',
            'rooms', 'priceMin', 'priceMax', 'areaMin', 'areaMax',
            'amenities', 'paperwork', 'q', 'sort',
        ]);

        return view('search', [
            'filters' => $filters,
            'results' => ListingQuery::make($filters)->paginate(24),
            'taxonomy' => Taxonomy::current(),
            'wilayas' => Geo::wilayas(),
        ]);
    }
}
