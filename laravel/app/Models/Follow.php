<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One person following another.
 *
 * @property int $id
 * @property string $follower_uid
 * @property string $followed_uid
 */
class Follow extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['id' => 'integer', 'created_at' => 'datetime'];
    }
}
