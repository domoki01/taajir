<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\Permission;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A question or remark under a listing.
 *
 * @property string $author_uid
 * @property string $text
 * @property string $status
 */
class Comment extends Model
{
    public const UPDATED_AT = 'edited_at';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['is_owner' => 'boolean', 'created_at' => 'datetime', 'edited_at' => 'datetime'];
    }

    /**
     * The account that wrote it, when it still exists.
     *
     * author_name is kept denormalised beside this — a comment has to keep
     * reading correctly after the account is deleted, and the list is read far
     * more often than it is written. The relation is only what turns the name
     * into a link.
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_uid', 'uid');
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }

    /**
     * Hidden stays readable to its author and to a moderator, and to nobody
     * else. Deleting instead would lose the evidence of what was said, which is
     * exactly what somebody needs when the argument about it starts.
     */
    public function visibleTo(?User $user): bool
    {
        if ($this->status === 'visible') {
            return true;
        }

        return $user !== null
            && ($user->uid === $this->author_uid || $user->hasPermission(Permission::CommentsModerate));
    }
}
