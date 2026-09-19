<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\Locale;
use App\Enums\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * The four built-in roles and their default permissions.
 *
 * Idempotent, and deliberately not destructive: it upserts the role rows and
 * inserts only the permissions that are missing. Re-running it after an admin
 * has edited the roles screen must not undo their work — the one exception
 * being that `admin` holds everything by code, so nothing it might lose here
 * matters.
 */
class RoleSeeder extends Seeder
{
    public function run(): void
    {
        foreach (Role::cases() as $role) {
            // Pinned to the default locale. `roles.label` is one column and one
            // string — what an admin will edit on the roles screen — so it must
            // not come out in whatever language happened to be active when the
            // seeder ran.
            $label = __('permissions.roles.'.$role->value, [], Locale::default()->value);

            DB::table('roles')->upsert(
                [['id' => $role->value, 'label' => $label, 'builtin' => true]],
                ['id'],
                ['builtin'],
            );

            $rows = array_map(
                fn ($permission) => ['role_id' => $role->value, 'permission' => $permission->value],
                $role->defaultPermissions(),
            );

            if ($rows !== []) {
                DB::table('role_permissions')->insertOrIgnore($rows);
            }
        }
    }
}
