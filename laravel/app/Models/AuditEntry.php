<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $actor_uid
 * @property string $action
 */
class AuditEntry extends Model
{
    protected $table = 'admin_audit';

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['detail' => 'array', 'created_at' => 'datetime'];
    }

    /** @param array<string, mixed> $detail */
    public static function record(User $actor, string $action, string $targetType, string $targetId, array $detail = []): self
    {
        return static::create([
            'actor_uid' => $actor->uid,
            // Denormalised, for the same reason the listing carries its owner's
            // name: the log is read long after, and a join to an account that
            // may since have been deleted is not one worth depending on.
            'actor_name' => $actor->display_name,
            'action' => $action,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'detail' => $detail === [] ? null : $detail,
            'created_at' => now(),
        ]);
    }
}
