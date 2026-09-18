<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $code
 * @property int $code58
 * @property string $name_ar
 * @property string $name_fr
 * @property string $slug
 * @property list<string> $aliases
 * @property bool $is_new_2026
 * @property int $commune_count
 */
class Wilaya extends Model
{
    protected $primaryKey = 'code';

    protected $keyType = 'int';

    public $incrementing = false;

    public $timestamps = false;

    protected $guarded = [];

    /**
     * URLs key off the slug, never the code, so a future renumbering is a
     * redirect rather than a migration.
     */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function communes(): HasMany
    {
        return $this->hasMany(Commune::class, 'wilaya_code', 'code');
    }

    protected function casts(): array
    {
        return [
            'aliases' => 'array',
            'is_new_2026' => 'boolean',
        ];
    }
}
