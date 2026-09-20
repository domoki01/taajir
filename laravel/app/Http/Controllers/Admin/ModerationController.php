<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\ListingStatus;
use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Listing;
use App\Models\PropertyRequest;
use App\Services\ModerationService;
use App\Services\Policy;
use App\Services\RequestService;
use App\Support\Nav;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\View\View;

/**
 * The moderation queue.
 *
 * Every action here is authorised again at the point of doing it, not once at
 * the door. Reaching a page is never treated as proof of anything — that was
 * true of the Server Actions this replaces and it is true of these.
 */
final class ModerationController extends Controller
{
    // The guard lives on the route group, not here: Laravel 11 removed
    // $this->middleware() from controllers, and a constructor call to it is a
    // fatal error rather than an unprotected route — but the permission is
    // still checked again on each action below, because reaching a page is
    // never treated as proof of anything.
    public function __construct(
        private readonly ModerationService $moderation,
        private readonly RequestService $requests,
    ) {}

    private function authorizeAction(Request $request): void
    {
        abort_unless($request->user()?->hasPermission(Permission::ListingsModerate) === true, 403);
    }

    public function index(Request $request): View
    {
        /*
         * Two permissions reach this screen and each opens half of it. Ads and
         * demands are different queues judged on different rules, and a role
         * that holds only requests.moderate has to be able to work its own —
         * otherwise that permission gates nothing anybody can get to.
         */
        $canModerateListings = $request->user()->hasPermission(Permission::ListingsModerate);
        $canModerateRequests = $request->user()->hasPermission(Permission::RequestsModerate);

        abort_unless($canModerateListings || $canModerateRequests, 403);

        $queue = $canModerateListings
            ? Listing::query()
                ->whereIn('status', [ListingStatus::Pending->value, ListingStatus::PendingLaunch->value])
                ->with('images')
                ->oldest('created_at')
                ->paginate(20)
            : new LengthAwarePaginator([], 0, 20);

        $requests = $canModerateRequests
            ? PropertyRequest::query()
                ->whereIn('status', ['pending', 'pendingLaunch'])
                ->oldest('created_at')
                ->limit(50)
                ->get()
            : collect();

        return view('admin.moderation', [
            'queue' => $queue,
            'canModerateListings' => $canModerateListings,
            'requests' => $requests,
            'canModerateRequests' => $canModerateRequests,
            // The check has already read each one and said what bothered it.
            // Re-reading a paragraph hunting for the problem is the slow way to
            // do this a hundred times.
            'flagLabel' => fn (?string $rule) => Policy::flagLabel($rule),
        ]);
    }

    public function approve(Request $request, Listing $listing): RedirectResponse
    {
        $this->authorizeAction($request);

        $this->moderation->approve($request->user(), $listing);

        return back()->with('status', __('admin.approved'));
    }

    public function reject(Request $request, Listing $listing): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate([
            // A rejection with no reason is one the owner cannot act on, so
            // they post the same thing again.
            'reason' => ['required', 'string', 'min:4', 'max:255'],
        ]);

        $this->moderation->reject($request->user(), $listing, $validated['reason']);

        return back()->with('status', __('admin.rejected'));
    }

    public function feature(Request $request, Listing $listing): RedirectResponse
    {
        $this->authorizeAction($request);

        $this->moderation->feature($request->user(), $listing, ! $listing->is_featured);

        return back();
    }

    public function archive(Request $request, Listing $listing): RedirectResponse
    {
        $this->authorizeAction($request);

        $this->moderation->archive($request->user(), $listing);

        return redirect()->to(Nav::href('/admin/moderation'))->with('status', __('admin.archived'));
    }

    /**
     * A demand's decision. Its own permission, checked here and again in the
     * service: listings.moderate does not carry requests.moderate.
     */
    public function decideRequest(Request $request, PropertyRequest $propertyRequest): RedirectResponse
    {
        abort_unless($request->user()?->hasPermission(Permission::RequestsModerate) === true, 403);

        $validated = $request->validate([
            'status' => ['required', 'in:visible,hidden,rejected'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $this->requests->moderate(
            $request->user(),
            $propertyRequest,
            $validated['status'],
            (string) ($validated['reason'] ?? ''),
        );

        return back()->with('status', __('admin.requests.decided'));
    }
}
