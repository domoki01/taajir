<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Listing;
use App\Models\PropertyRequest;
use App\Services\Geo;
use App\Services\RequestService;
use App\Support\Nav;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * `/demandes` — the demand feed.
 *
 * The mirror image of the listings: the whole site is supply, and this is the
 * one place demand is visible.
 */
final class RequestController extends Controller
{
    public function __construct(private readonly RequestService $requests) {}

    public function index(): View
    {
        return view('requests.index', [
            'requests' => PropertyRequest::query()->visible()->latest('created_at')->paginate(20),
        ]);
    }

    public function create(): View
    {
        return view('requests.create', ['wilayas' => Geo::wilayas()]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'intent' => ['required', 'in:vente,location'],
            'title' => ['required', 'string', 'min:10', 'max:90'],
            'description' => ['required', 'string', 'min:20', 'max:2000'],
            'wilaya' => ['required', 'string', 'exists:wilayas,slug'],
            'commune' => ['nullable', 'string', 'max:64'],
        ]);

        $created = $this->requests->create($request->user(), $validated);

        return redirect()->to(Nav::href($created->path()));
    }

    public function show(Request $request, string $id): View
    {
        $propertyRequest = PropertyRequest::query()->with('replies.listing')->findOrFail($id);

        // Every non-visible state stays readable to its author, so nobody is
        // left wondering where their post went.
        abort_unless($propertyRequest->visibleTo($request->user()), 404);

        return view('requests.show', [
            'request' => $propertyRequest,
            // Only the author's own published ads can be offered, and this is
            // the list the form is built from — the service checks it again.
            'attachable' => $request->user() === null ? collect() : Listing::query()
                ->published()
                ->where('owner_uid', $request->user()->uid)
                ->get(['id', 'title']),
        ]);
    }

    public function reply(Request $request, string $id): RedirectResponse
    {
        $propertyRequest = PropertyRequest::query()->findOrFail($id);
        abort_unless($propertyRequest->status === 'visible', 404);

        $validated = $request->validate([
            'text' => ['required', 'string', 'min:2', 'max:1000'],
            'listing_id' => ['nullable', 'string', 'size:12'],
        ]);

        $this->requests->reply(
            $request->user(),
            $propertyRequest,
            $validated['text'],
            $validated['listing_id'] ?? null,
        );

        return back();
    }
}
