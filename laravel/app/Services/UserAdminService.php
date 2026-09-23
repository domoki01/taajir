<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\Permission;
use App\Enums\Role;
use App\Models\AuditEntry;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * ── ACCOUNT ADMINISTRATION ───────────────────────────────────────────────────
 * Roles, bans, quotas and the registration queue.
 *
 * Ported from src/server/actions/users.ts. Most of this file is guards, and
 * they are the reason it is a service rather than four controller methods: each
 * one is a rule about what an admin may do to another admin, and a rule that
 * lives in a controller is a rule that gets forgotten by the second caller.
 *
 * What the port drops is the custom-claim dance. Firebase carried the role in
 * the ID token, so every change had to write the claim, mirror it to the
 * document and revoke refresh tokens to make it land — three writes that could
 * half-succeed. Here `users.role_id` is the only copy, permissions are resolved
 * per request, and a change takes effect on the very next one.
 */
final class UserAdminService
{
    /**
     * Move an account to another role.
     *
     * @throws ValidationException
     */
    public function setRole(User $actor, User $target, string $roleId): void
    {
        $this->ensure($actor, Permission::UsersManage);

        if (! \App\Models\Role::query()->whereKey($roleId)->exists()) {
            $this->refuse('role', __('admin.users.unknown_role'));
        }

        // Taking away your own rights cannot be undone from this screen: the
        // screen is the thing you just lost.
        if ($target->uid === $actor->uid) {
            $this->refuse('role', __('admin.users.not_yourself_role'));
        }

        /*
         * The super-admin role carries every permission there is, including the
         * one that edits permissions. Granting it, or taking it away, is
         * therefore a roles decision rather than an accounts one — otherwise
         * `users.manage` quietly contains `roles.manage` by way of "promote a
         * friend, ask them to promote you back".
         */
        $admin = Role::Admin->value;
        if (($roleId === $admin || $target->role_id === $admin) && ! $actor->hasPermission(Permission::RolesManage)) {
            $this->refuse('role', __('admin.users.super_admin_needs_roles'));
        }

        // The site must keep at least one super-admin. Demoting the last one
        // leaves nobody able to edit roles, and the only way back is a database
        // client and somebody's laptop.
        if ($target->role_id === $admin && $roleId !== $admin) {
            $remaining = User::query()->where('role_id', $admin)->count();
            if ($remaining <= 1) {
                $this->refuse('role', __('admin.users.last_super_admin'));
            }
        }

        $target->forceFill(['role_id' => $roleId])->save();
        AuditEntry::record($actor, 'user.role', 'user', $target->uid, ['role' => $roleId]);
    }

    /**
     * Suspend an account, or give it back.
     *
     * @throws ValidationException
     */
    public function setBanned(User $actor, User $target, bool $banned, string $reason = ''): void
    {
        $this->ensure($actor, Permission::UsersManage);

        if ($target->uid === $actor->uid) {
            $this->refuse('ban', __('admin.users.not_yourself_ban'));
        }

        $reason = trim($reason);

        // The reason is what the log carries, and what anyone reviewing the
        // decision later — including the person it was made about — has to go
        // on. A ban with no reason is one nobody can argue with or undo.
        if ($banned && mb_strlen($reason) < 5) {
            $this->refuse('ban', __('admin.users.ban_needs_reason'));
        }

        $target->forceFill([
            'is_banned' => $banned,
            'ban_reason' => $banned ? $reason : null,
        ])->save();

        /*
         * The Next version also clawed back the points this account earned
         * whoever invited it, and pulled it out of any live prize campaign.
         * Both need the points ledger, which arrives with the affiliate
         * programme in phase 8 — this is the one place that will call it, and
         * `points_balance` stays a cache of a ledger that does not exist yet
         * rather than a number this method could plausibly decrement.
         *
         * Unbanning will not re-award when it does land: a reversed decision is
         * rare, and paying twice for one account is worse than paying once too
         * few.
         */

        AuditEntry::record(
            $actor,
            $banned ? 'user.ban' : 'user.unban',
            'user',
            $target->uid,
            $reason === '' ? [] : ['reason' => $reason],
        );
    }

    /**
     * Raising a quota is how a paid plan is granted until there is a payment
     * flow, so it is deliberately an audited admin action rather than a field
     * anyone can write.
     *
     * @throws ValidationException
     */
    public function setQuota(User $actor, User $target, int $listingQuota, int $featuredQuota): void
    {
        $this->ensure($actor, Permission::UsersManage);

        $target->forceFill([
            'listing_quota' => $listingQuota,
            'featured_quota' => $featuredQuota,
        ])->save();

        AuditEntry::record($actor, 'user.quota', 'user', $target->uid, [
            'note' => $listingQuota.'/'.$featuredQuota,
        ]);
    }

    /** Let one waiting account publish, or put it back in the queue. */
    public function setApproved(User $actor, User $target, bool $approved): void
    {
        $this->ensure($actor, Permission::UsersApprove);

        $target->forceFill(['approved' => $approved])->save();

        AuditEntry::record($actor, $approved ? 'user.approve' : 'user.unapprove', 'user', $target->uid);
    }

    /**
     * Switch registration approval on or off.
     *
     * Switching it *on* approves every account that already exists, in the same
     * transaction. Without that, one click would stop every current member of
     * the platform from posting — people who were approved by the fact that the
     * site was open when they joined. The feature filters who arrives next; it
     * does not revoke what is already there.
     *
     * The back-fill and the setting are written together, because a half-applied
     * back-fill is exactly the state the rule exists to prevent.
     */
    public function setRequireApproval(User $actor, bool $on): int
    {
        $this->ensure($actor, Permission::UsersApprove);

        return DB::transaction(function () use ($actor, $on): int {
            $touched = 0;

            if ($on) {
                $touched = User::query()->where('approved', false)->update(['approved' => true]);
            }

            Setting::query()->updateOrCreate(
                ['key' => 'access'],
                ['value' => ['requireApproval' => $on], 'updated_at' => now(), 'updated_by' => $actor->uid],
            );

            AuditEntry::record($actor, 'access.approval', 'settings', 'access', [
                'on' => $on,
                'approved' => $touched,
            ]);

            return $touched;
        });
    }

    private function ensure(User $actor, Permission $permission): void
    {
        abort_unless($actor->hasPermission($permission), 403);
    }

    /**
     * Refusals come back as validation errors so the form that posted them
     * shows the reason next to the control, rather than as a 403 that tells the
     * admin only that something went wrong.
     *
     * @throws ValidationException
     */
    private function refuse(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
