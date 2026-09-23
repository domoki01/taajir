<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\ListingStatus;
use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\AuditEntry;
use App\Models\Listing;
use App\Models\PropertyRequest;
use App\Models\Setting;
use App\Services\Launch;
use App\Services\Outbox;
use App\Services\RunLaunch;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\View\View;

/**
 * Holding the site closed, and opening it again.
 *
 * Site configuration of the most consequential kind there is, so it sits behind
 * its own permission: a moderator reviews ads, they do not decide whether the
 * public can see the site at all.
 */
final class LaunchController extends Controller
{
    private function authorizeAction(Request $request): void
    {
        abort_unless($request->user()?->hasPermission(Permission::LaunchControl) === true, 403);
    }

    public function index(Request $request): View
    {
        $this->authorizeAction($request);

        $held = Listing::query()->where('status', ListingStatus::PendingLaunch->value);

        return view('admin.launch', [
            'launch' => Launch::current(),
            'heldTotal' => (clone $held)->count(),
            'heldApproved' => (clone $held)->where('approved_for_launch', true)->count(),
            'heldRequests' => PropertyRequest::query()->where('status', 'pendingLaunch')->count(),
            'readiness' => Outbox::readiness(),
            'pending' => Outbox::pending(),
        ]);
    }

    /** Hold the site, or take the hold off without publishing anything. */
    public function state(Request $request): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate([
            'state' => ['required', 'in:'.Launch::PRELAUNCH.','.Launch::ACTIVE],
        ]);

        $this->save($request, ['state' => $validated['state']]);
        AuditEntry::record($request->user(), 'launch.state', 'settings', 'launch', ['note' => $validated['state']]);

        return back()->with('status', __('launch.state_saved'));
    }

    /**
     * Set, move or clear the countdown.
     *
     * Clearing it shows "the wait is over" and nothing more. Publishing is a
     * separate, deliberate act — a timer that ran out while nobody was watching
     * should never be the thing that makes a thousand unreviewed ads public.
     */
    public function timer(Request $request): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate([
            'launch_at' => ['nullable', 'date'],
        ]);

        $at = $validated['launch_at'] ?? null;

        $this->save($request, [
            'launchAt' => $at === null ? null : Carbon::parse($at)->getTimestampMs(),
        ]);

        AuditEntry::record($request->user(), 'launch.timer', 'settings', 'launch', [
            'note' => $at === null ? 'cleared' : (string) $at,
        ]);

        return back()->with('status', $at === null ? __('launch.timer_cleared') : __('launch.timer_set'));
    }

    /** The switch. */
    public function execute(Request $request, RunLaunch $run): RedirectResponse
    {
        $this->authorizeAction($request);

        // Typed, not clicked. This is the one action on the site with no undo:
        // it makes every approved ad public and sends the announcement, and
        // neither can be recalled.
        $request->validate([
            'confirm' => ['required', 'in:'.Launch::ACTIVE],
        ], ['confirm.in' => __('launch.confirm_hint')]);

        $out = $run($request->user()->uid);

        return back()->with('status', __('launch.done', $out));
    }

    /**
     * Write one field of the launch settings without disturbing the others.
     *
     * Read-modify-write rather than a merge, because the row is one JSON
     * document and the three fields are read together everywhere else.
     *
     * @param  array<string, mixed>  $changes
     */
    private function save(Request $request, array $changes): void
    {
        $current = Setting::read('launch');

        Setting::query()->updateOrCreate(['key' => 'launch'], [
            'value' => [
                'state' => $changes['state'] ?? Launch::current()->state,
                'launchAt' => array_key_exists('launchAt', $changes)
                    ? $changes['launchAt']
                    : Launch::current()->launchAt?->getTimestampMs(),
                'launchedAt' => $current['launchedAt'] ?? Launch::current()->launchedAt?->getTimestampMs(),
            ],
            'updated_at' => now(),
            'updated_by' => $request->user()->uid,
        ]);

        Launch::forget();
    }
}
