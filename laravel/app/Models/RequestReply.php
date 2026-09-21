<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\Permission;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RequestReply extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['is_owner' => 'boolean', 'created_at' => 'datetime'];
    }

    /** The account that wrote it, when it still exists; see Comment::author(). */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_uid', 'uid');
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(PropertyRequest::class, 'request_id');
    }

    /** The ad this reply offers, if it carries one. */
    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }

    public function visibleTo(?User $user): bool
    {
        if ($this->status === 'visible') {
            return true;
        }

        return $user !== null
            && ($user->uid === $this->author_uid || $user->hasPermission(Permission::RequestsModerate));
    }
}
