<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\Permission;
use App\Services\Geo;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A demand — "نشري شقة F3 في باب الزوار".
 *
 * The mirror image of a listing: the whole site is supply, and this is the one
 * place demand is visible.
 *
 * @property string $id
 * @property string $status
 */
class PropertyRequest extends Model
{
    protected $table = 'requests';

    protected $keyType = 'string';

    public $incrementing = false;

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['created_at' => 'datetime', 'moderated_at' => 'datetime'];
    }

    /** The account that posted it, when it still exists. */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_uid', 'uid');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(RequestReply::class, 'request_id')->oldest('created_at');
    }

    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('status', 'visible');
    }

    /**
     * Every non-visible state stays readable to its author, so nobody is left
     * wondering where their post went.
     */
    public function visibleTo(?User $user): bool
    {
        if ($this->status === 'visible') {
            return true;
        }

        return $user !== null
            && ($user->uid === $this->owner_uid || $user->hasPermission(Permission::RequestsModerate));
    }

    public function placeLabel(): string
    {
        return $this->commune_slug !== null
            ? Geo::placeLabel($this->wilaya_slug, $this->commune_slug)
            : (Geo::wilaya($this->wilaya_slug)?->name() ?? $this->wilaya_slug);
    }

    public function path(): string
    {
        return '/demandes/'.$this->id;
    }
}
