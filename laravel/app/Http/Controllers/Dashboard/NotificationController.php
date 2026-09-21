<?php

declare(strict_types=1);

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Services\Follows;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * What the people you follow have posted.
 *
 * Rows from `notifications`, which is not the outbox: the outbox records
 * messages meant to leave the site and nothing dispatches those yet, so a page
 * built on it would always be empty.
 */
final class NotificationController extends Controller
{
    public function __construct(private readonly Follows $follows) {}

    public function index(Request $request): View
    {
        $user = $request->user();

        $notifications = Notification::query()
            ->where('uid', $user->uid)
            ->latest('created_at')
            ->paginate(30);

        return view('dashboard.notifications', [
            'notifications' => $notifications,
            'unread' => $this->follows->unreadCount($user),
        ]);
    }

    public function readAll(Request $request): RedirectResponse
    {
        // Marked on a deliberate press rather than on opening the page: a
        // badge that clears itself the moment you glance at the list loses the
        // one you meant to come back to.
        $this->follows->markAllRead($request->user());

        return back();
    }
}
