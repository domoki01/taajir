<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Something that happened, for one person to read on the site.
 *
 * Not the outbox: a row here needs no provider and is visible the moment it is
 * written. launch_outbox is for messages meant to leave the site, and nothing
 * dispatches those yet.
 *
 * @property int $id
 * @property string $uid
 * @property string $type
 * @property string $title
 * @property string|null $body
 * @property string $url
 */
class Notification extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'read_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function isUnread(): bool
    {
        return $this->read_at === null;
    }
}
