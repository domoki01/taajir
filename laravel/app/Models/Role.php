<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $label
 * @property bool $builtin
 */
class Role extends Model
{
    protected $primaryKey = 'id';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['builtin' => 'boolean'];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'role_id');
    }
}
