<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * The roles that ship with the code.
 *
 * An admin may add more and may move permissions between them, which is why
 * `users.role_id` is a plain string and the real list lives in the `roles`
 * table. These four cannot be deleted.
 */
enum Role: string
{
    /** The role every deployment starts with, and the only one that is untouchable. */
    case Admin = 'admin';
    case Moderator = 'moderator';
    case Agency = 'agency';
    case User = 'user';

    public function label(): string
    {
        return __('permissions.roles.'.$this->value);
    }

    /**
     * Defaults, used until an admin saves the roles screen once — and as the
     * floor the resolver falls back to if the table cannot be read.
     *
     * `admin` is deliberately absent from this map: it holds everything,
     * always, and that is hard-coded rather than stored. See Permissions::of().
     *
     * @return list<Permission>
     */
    public function defaultPermissions(): array
    {
        return match ($this) {
            self::Admin => Permission::cases(),
            self::Moderator => [
                Permission::ListingsModerate,
                Permission::CommentsModerate,
                Permission::RequestsModerate,
                Permission::PromosManage,
                Permission::ArticlesManage,
            ],
            self::Agency, self::User => [],
        };
    }

    /** A role id an admin typed. Latin and stable, because it lands in URLs and the audit log. */
    public const ID_PATTERN = '/^[a-z][a-z0-9-]{1,23}$/';
}
