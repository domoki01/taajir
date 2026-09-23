<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Promo;
use App\Services\Geo;
use App\Services\ListingQuery;
use App\Services\Taxonomy;
use Illuminate\View\View;

final class HomeController extends Controller
{
    public function __invoke(): View
    {
        return view('home', [
            // The carousel of paid placements. Straight off the builder: being
            // featured is not a filter anyone can ask for in a URL.
            'featured' => ListingQuery::make()->builder()
                ->where('is_featured', true)
                ->with('images')
                ->newest()
                ->limit(8)
                ->get(),
            'latest' => ListingQuery::make()->take(12),
            'wilayas' => Geo::featured(),
            // The paid slots, in the order an admin put them in. A table of
            // their own, so no listing query can ever leak one into results.
            'promos' => Promo::query()->visible()->get(),
            'taxonomy' => Taxonomy::current(),
        ]);
    }
}
