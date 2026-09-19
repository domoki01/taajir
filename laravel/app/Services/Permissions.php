<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\Permission;
use App\Enums\Role;
use Illuminate\Support\Facades\DB;

final class Permissions
{
    /** @var array<string, list<Permission>>|null */
    private static ?array $byRole = null;

    /**
     * What a role may do.
     *
     * The super-admin holds every permission, always — including ones added to
     * the catalogue in a later release. This is the emergency door. An editable
     * permission system means an admin can take away their own access to the
     * screen that grants access; if that were possible for every role, one bad
     * save would leave the site with nobody able to administer it and no way
     * back except a database edit. So one role is beyond editing, and it is the
     * one you are signed in as.
     *
     * @return list<Permission>
     */
    public static function of(string $roleId): array
    {
        if ($roleId === Role::Admin->value) {
            return Permission::cases();
        }

        return self::table()[$roleId] ?? [];
    }

    /**
     * role id => permissions, read once per request.
     *
     * A failed read falls back to the built-in defaults rather than to nothing:
     * an empty table would lock every moderator out of the site at the moment
     * the database is least healthy.
     *
     * @return array<string, list<Permission>>
     */
    private static function table(): array
    {
        if (self::$byRole !== null) {
            return self::$byRole;
        }

        try {
            $rows = DB::table('role_permissions')->get();
        } catch (\Throwable $e) {
            report($e);

            return self::$byRole = self::defaults();
        }

        if ($rows->isEmpty()) {
            return self::$byRole = self::defaults();
        }

        $out = [];
        foreach ($rows as $row) {
            // A permission that has left the catalogue guards nothing; dropping
            // it here keeps a stale row from becoming a ghost grant if the
            // string is ever reused.
            $permission = Permission::tryFrom($row->permission);
            if ($permission !== null) {
                $out[$row->role_id][] = $permission;
            }
        }

        return self::$byRole = $out;
    }

    /** @return array<string, list<Permission>> */
    private static function defaults(): array
    {
        $out = [];
        foreach (Role::cases() as $role) {
            $out[$role->value] = $role->defaultPermissions();
        }

        return $out;
    }

    /** Test seam, and the hook a roles-screen save will call. */
    public static function forget(): void
    {
        self::$byRole = null;
    }
}
