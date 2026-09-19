<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * ── PERMISSIONS ──────────────────────────────────────────────────────────────
 * What a role may do. The catalogue is code, not data, because every entry
 * names a real code path — a permission an admin could invent would guard
 * nothing. What *is* data is which role holds which of them.
 *
 * Ported verbatim from src/lib/permissions.ts. The fourteen values are the
 * contract: §6.2 of the roadmap says port them exactly, and the role rows in
 * the database refer to them by these strings.
 */
enum Permission: string
{
    case ListingsModerate = 'listings.moderate';
    case CommentsModerate = 'comments.moderate';
    case RequestsModerate = 'requests.moderate';
    case PromosManage = 'promos.manage';
    case UsersManage = 'users.manage';
    case UsersApprove = 'users.approve';
    case RolesManage = 'roles.manage';
    case TaxonomyEdit = 'taxonomy.edit';
    case BrandingEdit = 'branding.edit';
    case LaunchControl = 'launch.control';
    // Its own permission, not part of users.manage: sending a notification to
    // every phone that installed the site is a different kind of power from
    // editing one account, and it should be grantable on its own.
    case PushBroadcast = 'push.broadcast';
    // Point values, redemption channels and the prize campaigns. Kept apart
    // from users.manage because it is the one screen where a setting turns into
    // money: whoever holds it decides what a referral is worth and who gets paid.
    case AffiliateManage = 'affiliate.manage';
    // Writing on the site's own masthead. Separate from listings.moderate — a
    // moderator judges other people's ads, an editor publishes in the site's
    // name — but granted to both built-in staff roles, because the point of the
    // articles is that somebody actually writes them.
    case ArticlesManage = 'articles.manage';
    case AuditView = 'audit.view';

    public function label(): string
    {
        return __('permissions.'.$this->value);
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(fn (self $p) => $p->value, self::cases());
    }
}
