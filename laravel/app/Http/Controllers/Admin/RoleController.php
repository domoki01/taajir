<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\Permission;
use App\Enums\Role as BuiltIn;
use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Services\Permissions;
use App\Services\RoleService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Who is allowed to do what.
 *
 * The matrix is shown with the super-admin's row locked and every box ticked,
 * because that is the truth: it holds every permission by code and the table is
 * not consulted for it. Rendering it as editable would be a lie the first save
 * would expose.
 */
final class RoleController extends Controller
{
    public function __construct(private readonly RoleService $roles) {}

    private function authorizeAction(Request $request): void
    {
        abort_unless($request->user()?->hasPermission(Permission::RolesManage) === true, 403);
    }

    public function index(Request $request): View
    {
        $this->authorizeAction($request);

        $roles = Role::query()->orderByDesc('builtin')->orderBy('id')->get();

        return view('admin.roles', [
            'roles' => $roles,
            'permissions' => Permission::cases(),
            'superAdmin' => BuiltIn::Admin->value,
            // Resolved through the same service the rest of the site asks, so
            // the boxes on this screen cannot disagree with what the gates do.
            'held' => $roles->mapWithKeys(fn (Role $role) => [
                $role->id => array_map(fn (Permission $p) => $p->value, Permissions::of($role->id)),
            ]),
            // The screen refuses to delete a role somebody is still on, so it
            // has to say how many that is before the button is pressed.
            'counts' => User::query()
                ->selectRaw('role_id, count(*) as total')
                ->groupBy('role_id')
                ->pluck('total', 'role_id'),
        ]);
    }

    public function save(Request $request): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate([
            // The form posts the role ids it drew as well as the boxes that are
            // ticked. Without that list, a role whose every box was just
            // unticked is simply absent from the payload — indistinguishable
            // from a role the form never showed, and the save would leave its
            // old permissions in place. Emptying a row has to mean emptying it.
            'roles' => ['required', 'array'],
            'roles.*' => ['string'],
            'permissions' => ['array'],
            'permissions.*' => ['array'],
            'permissions.*.*' => ['string'],
        ]);

        $matrix = array_fill_keys($validated['roles'], []);
        foreach ($validated['permissions'] ?? [] as $roleId => $permissions) {
            // Only rows the form said it was editing. A ticked box for a role
            // that is not in the list is a hand-posted payload, not a save.
            if (array_key_exists($roleId, $matrix)) {
                $matrix[$roleId] = $permissions;
            }
        }

        $this->roles->save($request->user(), $matrix);

        return back()->with('status', __('admin.roles.saved'));
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate([
            'id' => ['required', 'string', 'max:24'],
            'label' => ['required', 'string', 'min:2', 'max:40'],
        ]);

        $this->roles->create($request->user(), $validated['id'], $validated['label']);

        return back()->with('status', __('admin.roles.created'));
    }

    public function destroy(Request $request, Role $role): RedirectResponse
    {
        $this->authorizeAction($request);

        $this->roles->delete($request->user(), $role);

        return back()->with('status', __('admin.roles.deleted'));
    }
}
