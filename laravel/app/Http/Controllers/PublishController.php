<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\ListingStatus;
use App\Http\Requests\StoreListingRequest;
use App\Models\Listing;
use App\Services\Geo;
use App\Services\ListingImageService;
use App\Services\ListingService;
use App\Services\Taxonomy;
use App\Support\ListingId;
use App\Support\Nav;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * `/publier` — the wizard.
 *
 * §7.3 of the roadmap puts this on Livewire. It is Alpine and one POST instead,
 * and that is a deliberate departure: the steps are a presentation of one form,
 * nothing between them needs the server, and a Livewire round trip per step on
 * a 3G connection in Algeria buys latency for nothing. The one thing Livewire
 * would genuinely add — an image preview that uploads as you pick — is not
 * worth a dependency and its own asset pipeline on shared hosting.
 */
final class PublishController extends Controller
{
    public function __construct(
        private readonly ListingService $listings,
        private readonly ListingImageService $images,
    ) {}

    public function create(Request $request): View
    {
        return view('publish.create', [
            'taxonomy' => Taxonomy::current(),
            'wilayas' => Geo::wilayas(),
            'user' => $request->user(),
        ]);
    }

    public function store(StoreListingRequest $request): RedirectResponse
    {
        $input = $request->validated();

        // The id is minted before the images so they can be filed under it.
        // ListingService mints its own when none is handed to it; passing this
        // one keeps the storage path and the row in agreement.
        $listingId = ListingId::mint();

        $stored = $this->images->store(
            $request->file('photos', []),
            $request->user()->uid,
            $listingId,
        );

        $listing = $this->listings->create($request->user(), $input + ['id' => $listingId], $stored);

        return redirect()
            ->to(Nav::href('/merci').'?a='.$listing->id)
            ->with('published', $listing->id);
    }

    /**
     * The post-publish screen, which branches on where the ad landed.
     *
     * Three outcomes and three different things to say: live, queued, or held
     * for the launch. Telling someone their ad is published when a moderator
     * still has to see it is how a site earns a reputation for lying.
     */
    public function thanks(Request $request): View
    {
        $listing = Listing::query()
            ->where('owner_uid', $request->user()->uid)
            ->find($request->query('a'));

        abort_if($listing === null, 404);

        return view('publish.thanks', [
            'listing' => $listing,
            'status' => ListingStatus::from($listing->status),
        ]);
    }
}
