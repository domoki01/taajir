<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $uid
 * @property string $channel
 * @property string $target
 * @property string $status
 */
class OutboxEntry extends Model
{
    protected $table = 'launch_outbox';

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['created_at' => 'datetime', 'sent_at' => 'datetime'];
    }
}
