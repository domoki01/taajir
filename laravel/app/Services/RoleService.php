<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\Permission;
use App\Enums\Role as BuiltIn;
use App\Models\AuditEntry;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * ── ROLES AND PERMISSIONS ────────────────────────────────────────────────────
 * The screen that decides what every other screen may do.
 *
 * Editable permissions mean an admin can take away their own access to the
 * screen that grants access, so most of this file is the four guards that stop
 * that from happening:
 *
 *   1. `admin` is untouchable. It holds every permission by code, never from
 *      the table, and an edit to its row is ignored rather than validated —
 *      accepting one would only make the screen lie.
 *   2. Nobody may drop `roles.manage` from the role they are signed in as. It
 *      is the one edit with no undo, because the screen that would fix it is
 *      the screen you just locked.
 *   3. The built-in roles survive every save, whatever the form posted, or
 *      accounts end up pointing at a role that no longer exists.
 *   4. A role with people on it is not deleted until they are moved.
 *
 * Ported from src/server/actions/roles.ts.
 */
final class RoleService
{
    /**
     * Save the permission matrix.
     *
     * @param  array<string, list<string>>  $matrix  role id => permission strings
     *
     * @throws ValidationException
     */
    public function save(User $actor, array $matrix): void
    {
        $this->ensure($actor);

        $admin = BuiltIn::Admin->value;
        $valid = Permission::values();

        $next = [];
        foreach ($matrix as $roleId => $permissions) {
            if ($roleId === $admin) {
                continue; // Guard 1.
            }
            if (! Role::query()->whereKey($roleId)->exists()) {
                continue; // A row for a role deleted since the page rendered.
            }

            // Unknown strings are dropped rather than rejected: the catalogue
            // can shrink between a page render and its save, and a permission
            // that no longer exists guards nothing.
            $next[$roleId] = array_values(array_intersect(array_unique($permissions), $valid));
        }

        // Guard 2. `admin` is exempt because it cannot lose anything.
        if ($actor->role_id !== $admin
            && ! in_array(Permission::RolesManage->value, $next[$actor->role_id] ?? [], true)) {
            throw ValidationException::withMessages([
                'permissions' => __('admin.roles.not_your_own_key'),
            ]);
        }

        DB::transaction(function () use ($actor, $next): void {
            foreach ($next as $roleId => $permissions) {
                DB::table('role_permissions')->where('role_id', $roleId)->delete();

                if ($permissions !== []) {
                    DB::table('role_permissions')->insert(array_map(
                        fn (string $permission) => ['role_id' => $roleId, 'permission' => $permission],
                        $permissions,
                    ));
                }
            }

            AuditEntry::record($actor, 'role.save', 'role', 'all');
        });

        Permissions::forget();
    }

    /**
     * Add a role.
     *
     * It starts with nothing. Anything else would hand out access as a side
     * effect of typing a name.
     *
     * @throws ValidationException
     */
    public function create(User $actor, string $id, string $label): Role
    {
        $this->ensure($actor);

        $id = mb_strtolower(trim($id));

        if (! preg_match(BuiltIn::ID_PATTERN, $id)) {
            throw ValidationException::withMessages(['id' => __('admin.roles.bad_id')]);
        }
        if (Role::query()->whereKey($id)->exists()) {
            throw ValidationException::withMessages(['id' => __('admin.roles.exists')]);
        }

        $role = Role::create(['id' => $id, 'label' => trim($label), 'builtin' => false]);
        AuditEntry::record($actor, 'role.create', 'role', $id);

        return $role;
    }

    /**
     * Remove a custom role.
     *
     * Guards 3 and 4. Deleting a role out from under the accounts on it would
     * leave them pointing at a row that is not there — a foreign key error on
     * the delete if you are lucky, and a silent demotion if you are not.
     *
     * @throws ValidationException
     */
    public function delete(User $actor, Role $role): void
    {
        $this->ensure($actor);

        if ($role->builtin || $role->id === BuiltIn::Admin->value) {
            throw ValidationException::withMessages(['id' => __('admin.roles.builtin_kept')]);
        }
        if ($role->id === $actor->role_id) {
            throw ValidationException::withMessages(['id' => __('admin.roles.not_your_own')]);
        }

        $count = User::query()->where('role_id', $role->id)->count();
        if ($count > 0) {
            throw ValidationException::withMessages([
                'id' => __('admin.roles.still_in_use', ['count' => $count]),
            ]);
        }

        DB::transaction(function () use ($actor, $role): void {
            DB::table('role_permissions')->where('role_id', $role->id)->delete();
            $role->delete();
            AuditEntry::record($actor, 'role.delete', 'role', $role->id);
        });

        Permissions::forget();
    }

    private function ensure(User $actor): void
    {
        abort_unless($actor->hasPermission(Permission::RolesManage), 403);
    }
}
