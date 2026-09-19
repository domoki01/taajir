<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\Permission;
use App\Services\Permissions;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * An account, keyed by its Firebase uid.
 *
 * There is no password and no remember_token: the only way to become this user
 * is to present a Firebase ID token that verifies, after which Laravel's own
 * session carries the request. §5 of the roadmap.
 *
 * @property string $uid
 * @property string|null $email
 * @property string $display_name
 * @property string|null $photo_url
 * @property string|null $phone
 * @property bool $email_verified
 * @property string $role_id
 * @property bool $approved
 * @property bool $is_banned
 * @property int $active_listing_count
 * @property int $listing_quota
 * @property string|null $referred_by
 * @property string|null $referral_code
 */
class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $primaryKey = 'uid';

    protected $keyType = 'string';

    public $incrementing = false;

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected $hidden = ['referral_code', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified' => 'boolean',
            'approved' => 'boolean',
            'is_banned' => 'boolean',
            'notify_on_message' => 'boolean',
            'notify_on_saved_search' => 'boolean',
            'created_at' => 'datetime',
            'last_seen_at' => 'datetime',
        ];
    }

    /**
     * There is no password, and the remember-me cookie wants one anyway.
     *
     * Laravel folds the password hash into that cookie so changing a password
     * invalidates it. With no password there is nothing to fold, and returning
     * null makes hash_hmac() take null on PHP 8.4 — a deprecation today and a
     * TypeError on the version after. The empty string is stable, which is all
     * the cookie needs: the secret in it is `remember_token`, which Laravel
     * rotates on its own.
     */
    public function getAuthPassword(): string
    {
        return '';
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(self::class, 'referred_by', 'uid');
    }

    /**
     * What this account may do, resolved from its role at read time.
     *
     * Read time, not sign-in time: roles live in MySQL now rather than in a
     * token claim, so taking a permission away takes effect on the very next
     * request instead of whenever the holder's token happens to refresh.
     *
     * @return list<Permission>
     */
    public function permissions(): array
    {
        return Permissions::of($this->role_id);
    }

    public function can($abilities, $arguments = []): bool
    {
        if ($abilities instanceof Permission) {
            return $this->hasPermission($abilities);
        }

        if (is_string($abilities) && ($permission = Permission::tryFrom($abilities)) !== null) {
            return $this->hasPermission($permission);
        }

        return parent::can($abilities, $arguments);
    }

    public function hasPermission(Permission $permission): bool
    {
        return in_array($permission, $this->permissions(), true);
    }

    /**
     * Holds anything at all — "can see behind the curtain".
     *
     * The door to /admin. What they may do once inside is decided per screen,
     * and again by every action behind every button: reaching a page is never
     * treated as proof of anything.
     */
    public function isStaff(): bool
    {
        return $this->permissions() !== [];
    }

    /**
     * May this account publish — an ad, a demand, a comment, a reply?
     *
     * Deliberately not a session check. Approval gates *writing*, never reading
     * or signing in: an account waiting on review can browse the whole site,
     * save a search and set its alerts up, so the wait costs them nothing they
     * would notice except the one button. Gating the session instead would turn
     * a moderation queue into a locked door.
     */
    public function mayPublish(): bool
    {
        return $this->approved && ! $this->is_banned;
    }
}
