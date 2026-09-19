<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Support\Nav;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * `/annonce/{id}/{slug}` — one ad.
 *
 * The id resolves the page; the slug is for humans and for search. A request
 * carrying the wrong slug is redirected to the right one rather than served,
 * so an ad that was reclassified keeps exactly one canonical URL and the old
 * links still land.
 */
final class ListingController extends Controller
{
    public function show(string $id, string $slug): View|RedirectResponse
    {
        $listing = Listing::query()
            ->with(['images', 'amenities', 'owner'])
            ->find($id);

        // Unpublished is indistinguishable from absent, deliberately: a 403
        // would confirm that an ad with this id exists and is being held.
        abort_if($listing === null || $listing->status !== ListingStatus::Published->value, Response::HTTP_NOT_FOUND);

        if ($slug !== $listing->slug) {
            return redirect()->to(Nav::href($listing->path()), Response::HTTP_MOVED_PERMANENTLY);
        }

        $this->countView($listing);

        return view('listing.show', [
            'listing' => $listing,
            'similar' => Listing::query()
                ->published()
                ->where('id', '!=', $listing->id)
                ->where('transaction_type', $listing->transaction_type)
                ->where('wilaya_slug', $listing->wilaya_slug)
                ->with('images')
                ->newest()
                ->limit(4)
                ->get(),
        ]);
    }

    /**
     * One more view.
     *
     * A bare UPDATE rather than a model save: this must not touch
     * `updated_at`, which would make every page view look like an edit to the
     * owner and to the moderation queue. It is also not something to fail a
     * page over, so it is deliberately unguarded by a transaction.
     */
    private function countView(Listing $listing): void
    {
        DB::table('listings')->where('id', $listing->id)->increment('view_count');
    }
}
