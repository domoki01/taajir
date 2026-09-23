<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One row per settings document: access, affiliate, branding, filter, launch.
 *
 * @property string $key
 * @property array<string, mixed> $value
 */
class Setting extends Model
{
    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    public const UPDATED_AT = 'updated_at';

    public const CREATED_AT = null;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['value' => 'array'];
    }

    /**
     * The stored object, or an empty one when nothing has written it yet —
     * which is the normal state until an admin touches the screen once.
     *
     * @return array<string, mixed>
     */
    public static function read(string $key): array
    {
        return static::query()->find($key)?->value ?? [];
    }
}
