<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\Permission;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $article_id
 * @property string $author_uid
 * @property string $author_name
 * @property string $text
 * @property string $status
 */
class ArticleComment extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class);
    }

    /**
     * Who may see this comment.
     *
     * Hidden keeps the row, so the question is asked on every read: its author
     * still sees it, because a comment that vanishes without a word reads as a
     * bug and gets posted again; staff see it because the decision has to stay
     * reviewable; everyone else does not.
     */
    public function visibleTo(?User $user): bool
    {
        if ($this->status === 'visible') {
            return true;
        }

        return $user !== null
            && ($user->uid === $this->author_uid
                || $user->hasPermission(Permission::CommentsModerate));
    }
}
