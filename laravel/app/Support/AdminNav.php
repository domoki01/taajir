<?php

declare(strict_types=1);

namespace App\Support;

use App\Enums\Permission;

/**
 * ── THE ADMIN'S MAP ──────────────────────────────────────────────────────────
 * Thirteen destinations is a lot, and the first version of this screen drew
 * them as thirteen identical pills in one wrapping row. On a phone that is a
 * wall: it filled the first screen, pushed the actual page below the fold, and
 * gave no clue which of the thirteen you were looking at.
 *
 * Grouping is what makes a long list readable. Four groups, each answering a
 * different question — what is on the site, who is on it, how it grows, and how
 * it is configured — so the eye lands in a neighbourhood before it reads a
 * label.
 *
 * Ported from src/app/admin/nav.ts. `icon` names an <x-icon.*> component rather
 * than importing one, for the same reason it did there: this list is built
 * where permissions are known, and the thing that draws it is somewhere else.
 */
final class AdminNav
{
    public const CONTENT = 'content';

    public const PEOPLE = 'people';

    public const GROWTH = 'growth';

    public const PLATFORM = 'platform';

    /** The order groups are drawn in, so the screen never depends on array order. */
    public const GROUPS = [self::CONTENT, self::PEOPLE, self::GROWTH, self::PLATFORM];

    /**
     * Every screen in the section, with what it takes to open it.
     *
     * `need` is an OR, not an AND: the accounts screen is useful to someone who
     * may only approve registrations, and hiding it from them would leave the
     * one thing they are here to do with no way in.
     *
     * An empty `need` means everyone who got past the door — which is everyone
     * holding any permission at all.
     *
     * Three screens the permission catalogue names are missing here on purpose:
     * the launch gate, the broadcast and the affiliate programme arrive in
     * phase 8 (§13), and listing a row now would put a 404 behind it — the same
     * objection as a row that 403s, for the same reason. They go in with the
     * routes, not before.
     *
     * @return list<array{href: string, key: string, icon: string, group: string, need: list<Permission>}>
     */
    public static function items(): array
    {
        return [
            // Two permissions, each opening half the screen: ads and demands are
            // different queues judged on different rules.
            ['href' => '/admin/moderation', 'key' => 'queue', 'icon' => 'clock', 'group' => self::CONTENT, 'need' => [Permission::ListingsModerate, Permission::RequestsModerate]],
            ['href' => '/admin/commentaires', 'key' => 'comments', 'icon' => 'message-square', 'group' => self::CONTENT, 'need' => [Permission::CommentsModerate]],
            ['href' => '/admin/articles', 'key' => 'articles', 'icon' => 'newspaper', 'group' => self::CONTENT, 'need' => [Permission::ArticlesManage]],
            ['href' => '/admin/filtre', 'key' => 'taxonomy', 'icon' => 'sliders-horizontal', 'group' => self::CONTENT, 'need' => [Permission::TaxonomyEdit]],

            ['href' => '/admin/utilisateurs', 'key' => 'users', 'icon' => 'users', 'group' => self::PEOPLE, 'need' => [Permission::UsersManage, Permission::UsersApprove]],
            ['href' => '/admin/roles', 'key' => 'roles', 'icon' => 'shield-check', 'group' => self::PEOPLE, 'need' => [Permission::RolesManage]],

            ['href' => '/admin/publicites', 'key' => 'promos', 'icon' => 'image', 'group' => self::GROWTH, 'need' => [Permission::PromosManage]],

            ['href' => '/admin/identite', 'key' => 'branding', 'icon' => 'palette', 'group' => self::PLATFORM, 'need' => [Permission::BrandingEdit]],
            ['href' => '/admin/journal', 'key' => 'audit', 'icon' => 'scroll-text', 'group' => self::PLATFORM, 'need' => [Permission::AuditView]],
        ];
    }

    /**
     * The subset this account may actually open.
     *
     * The menu is built from the permissions the reader holds rather than from
     * the full list with the rest greyed out: a row that 403s when tapped is a
     * worse answer than no row.
     *
     * @param  list<Permission>  $held
     * @return list<array{href: string, key: string, icon: string, group: string, need: list<Permission>}>
     */
    public static function visibleTo(array $held): array
    {
        return array_values(array_filter(
            self::items(),
            // Not array_intersect(): it compares its arguments as strings, and
            // a backed enum has no string cast — which is a fatal error rather
            // than a wrong answer, but only on the first request that renders
            // the menu.
            fn (array $item) => $item['need'] === []
                || array_any($item['need'], fn (Permission $need) => in_array($need, $held, true)),
        ));
    }
}
