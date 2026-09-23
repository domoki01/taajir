<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use App\Services\UserAdminService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * The accounts screen.
 *
 * Two permissions reach it. `users.manage` edits roles, bans and quotas;
 * `users.approve` works the registration queue. A role holding only the second
 * gets the queue and nothing else — which is exactly what a front-desk role
 * should be able to do, and the reason the screen is one page rather than two.
 *
 * Every action behind it asks for its own permission again inside the service.
 */
final class UserController extends Controller
{
    public function __construct(private readonly UserAdminService $users) {}

    public function index(Request $request): View
    {
        $viewer = $request->user();
        $canManage = $viewer->hasPermission(Permission::UsersManage);
        $canApprove = $viewer->hasPermission(Permission::UsersApprove);

        abort_unless($canManage || $canApprove, 403);

        $search = trim((string) $request->query('q', ''));

        $requireApproval = (Setting::read('access')['requireApproval'] ?? false) === true;

        return view('admin.users', [
            'viewer' => $viewer,
            'canManage' => $canManage,
            'canApprove' => $canApprove,
            'requireApproval' => $requireApproval,
            'search' => $search,
            'roles' => Role::query()->orderBy('id')->get(),
            'users' => $this->search($search),
            // Oldest first, for the same reason the moderation queue is: a
            // newest-first queue starves its tail, and here the tail is
            // somebody who signed up and has been unable to post since.
            'pending' => $requireApproval
                ? User::query()->where('approved', false)->oldest('created_at')->limit(50)->get()
                : collect(),
        ]);
    }

    /**
     * Newest first, or the matches for a search.
     *
     * The Firestore version fetched a page and filtered it in memory, because
     * Firestore has neither substring nor case-insensitive matching. MySQL has
     * both, so this is a query — and that is the whole of the improvement.
     *
     * It deliberately does not fold Arabic. Matching "محمّد" typed with the
     * shadda against "محمد" stored without it needs a second, folded copy of
     * every name in its own column, plus a backfill. That is the same trade the
     * Firestore version looked at and refused, and the reason has not changed:
     * a few hundred accounts, and the email and the uid both match exactly.
     * Revisit when the account count makes one page of results the wrong shape.
     *
     * @return LengthAwarePaginator<int, User>
     */
    private function search(string $search): LengthAwarePaginator
    {
        return User::query()
            ->when($search !== '', fn ($query) => $query->where(fn ($q) => $q
                ->whereLike('display_name', '%'.$search.'%')
                ->orWhereLike('email', '%'.$search.'%')
                // The uid is matched whole or not at all: it is copied from a
                // log line, never typed from memory.
                ->orWhere('uid', $search)))
            ->latest('created_at')
            ->paginate(30)
            ->withQueryString();
    }

    public function role(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate(['role' => ['required', 'string', 'exists:roles,id']]);

        $this->users->setRole($request->user(), $user, $validated['role']);

        return back()->with('status', __('admin.users.role_changed'));
    }

    public function ban(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'banned' => ['required', 'boolean'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $this->users->setBanned(
            $request->user(),
            $user,
            (bool) $validated['banned'],
            (string) ($validated['reason'] ?? ''),
        );

        return back()->with('status', __($validated['banned'] ? 'admin.users.banned' : 'admin.users.unbanned'));
    }

    public function quota(Request $request, User $user): RedirectResponse
    {
        // A thousand is not a real ceiling, it is a typo guard: the field is a
        // number input, and a fat-fingered extra zero should not silently grant
        // somebody ten thousand ads.
        $validated = $request->validate([
            'listing_quota' => ['required', 'integer', 'min:0', 'max:1000'],
            'featured_quota' => ['required', 'integer', 'min:0', 'max:1000'],
        ]);

        $this->users->setQuota(
            $request->user(),
            $user,
            (int) $validated['listing_quota'],
            (int) $validated['featured_quota'],
        );

        return back()->with('status', __('admin.users.quota_changed'));
    }

    public function approve(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate(['approved' => ['required', 'boolean']]);

        $this->users->setApproved($request->user(), $user, (bool) $validated['approved']);

        return back()->with('status', __($validated['approved'] ? 'admin.users.approved' : 'admin.users.unapproved'));
    }

    public function requireApproval(Request $request): RedirectResponse
    {
        $validated = $request->validate(['on' => ['required', 'boolean']]);
        $on = (bool) $validated['on'];

        $touched = $this->users->setRequireApproval($request->user(), $on);

        return back()->with('status', $on
            ? __('admin.users.approval_on', ['count' => $touched])
            : __('admin.users.approval_off'));
    }
}
