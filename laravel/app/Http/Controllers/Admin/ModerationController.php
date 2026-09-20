<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\ListingStatus;
use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Listing;
use App\Services\ModerationService;
use App\Services\Policy;
use App\Support\Nav;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
    public function __construct(private readonly ModerationService $moderation) {}

    private function authorizeAction(Request $request): void
    {
        abort_unless($request->user()?->hasPermission(Permission::ListingsModerate) === true, 403);
    }

    public function index(Request $request): View
    {
        $this->authorizeAction($request);

        $queue = Listing::query()
            ->whereIn('status', [ListingStatus::Pending->value, ListingStatus::PendingLaunch->value])
            ->with('images')
            ->oldest('created_at')
            ->paginate(20);

        return view('admin.moderation', [
            'queue' => $queue,
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
}
