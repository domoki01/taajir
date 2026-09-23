<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\Locale;
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

    /*
     * Same reason as Wilaya: without a cast, wilaya_code is an int on SQLite
     * and a string on MySQL, and every typed signature it is passed to is a
     * 500 waiting for the production driver. lat and lng stay strings — the
     * column is a decimal and the docblock says string, which is what Laravel
     * returns for one; making them floats here would be a different change
     * with rounding in it.
     */
    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'wilaya_code' => 'integer',
        ];
    }

    /** The name in the language being rendered; see Wilaya::name(). */
    public function name(): string
    {
        return Locale::current() === Locale::Ar ? $this->name_ar : $this->name_fr;
    }

    public function wilaya(): BelongsTo
    {
        return $this->belongsTo(Wilaya::class, 'wilaya_code', 'code');
    }
}
