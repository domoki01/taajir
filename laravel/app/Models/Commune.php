<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $wilaya_code
 * @property string $slug
 * @property string $name_ar
 * @property string $name_fr
 * @property string|null $postal_code
 * @property string|null $lat
 * @property string|null $lng
 */
class Commune extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    public function wilaya(): BelongsTo
    {
        return $this->belongsTo(Wilaya::class, 'wilaya_code', 'code');
    }
}
