<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\AuditEntry;
use App\Models\OutboxEntry;
use App\Services\Outbox;
use App\Support\Links;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * The one action on the site that speaks to everybody at once.
 *
 * Behind its own permission rather than folded into users.manage: sending a
 * notification to every account is a different kind of power from editing one,
 * and it should be grantable — and withholdable — on its own.
 *
 * Today it queues rather than sends. Every row is a message waiting for a
 * channel, and the screen says that in as many words rather than offering a
 * send button that quietly does nothing.
 */
final class BroadcastController extends Controller
{
    public function __construct(private readonly Outbox $outbox) {}

    private function authorizeAction(Request $request): void
    {
        abort_unless($request->user()?->hasPermission(Permission::PushBroadcast) === true, 403);
    }

    public function index(Request $request): View
    {
        $this->authorizeAction($request);

        return view('admin.broadcast', [
            'readiness' => Outbox::readiness(),
            'pending' => Outbox::pending(),
            'recent' => OutboxEntry::query()
                ->selectRaw('title, body, url, min(created_at) as created_at, count(*) as recipients')
                ->groupBy('title', 'body', 'url')
                ->orderByDesc('created_at')
                ->limit(10)
                ->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate([
            'title' => ['required', 'string', 'min:4', 'max:60'],
            // Android and iOS both cut a notification around two lines;
            // anything past that is written for nobody.
            'body' => ['required', 'string', 'min:4', 'max:160'],
            // An internal path only, and the same rule the sign-in redirect
            // uses. A notification is the most trusted surface the site has —
            // it arrives wearing the site's name and icon on a lock screen —
            // and it must not be able to carry anyone off it.
            'url' => ['nullable', 'string', 'max:500', 'regex:#^/(?!/)#'],
        ], ['url.regex' => __('broadcast.internal_only')]);

        if (Links::present($validated['title'].' '.$validated['body'])) {
            return back()->withErrors(['body' => __('broadcast.no_links')])->withInput();
        }

        $queued = $this->outbox->queueForEveryone(
            $validated['title'],
            $validated['body'],
            $validated['url'] ?? '/',
        );

        AuditEntry::record($request->user(), 'broadcast.queue', 'settings', 'outbox', [
            'note' => $validated['title'],
            'queued' => $queued,
        ]);

        return back()->with('status', __('broadcast.queued', ['count' => $queued]));
    }
}
