<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\Locale;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Lang;

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

    /**
     * The name in the language being rendered.
     *
     * French mostly carries English too: Algerian place names in English *are*
     * the French forms, and inventing transliterations would be worse than
     * using the ones on every road sign, ID card and map of the country. The
     * handful with a real English exonym — Algiers, and so far only Algiers —
     * are listed in lang/en/geography.php.
     */
    public function name(): string
    {
        $locale = Locale::current();

        if ($locale === Locale::Ar) {
            return $this->name_ar;
        }

        // Pinned to English and with the fallback chain switched off, on both
        // calls. Lang::has() otherwise walks the fallback locale and answers
        // true for a French page, which is how "à Algiers" reached a French
        // heading — an exonym is a fact about one language, not a missing
        // translation to be filled in from another.
        if ($locale === Locale::En) {
            $exonym = 'geography.wilayas.'.$this->slug;

            if (Lang::has($exonym, Locale::En->value, false)) {
                return __($exonym, [], Locale::En->value);
            }
        }

        return $this->name_fr;
    }

    public function communes(): HasMany
    {
        return $this->hasMany(Commune::class, 'wilaya_code', 'code');
    }

    /*
     * The integer columns are cast, and that is not decoration.
     *
     * Without a cast the attribute is whatever the driver hands back. SQLite
     * returns a native int; MySQL returns a string, because PDO does. The
     * docblock above this class has always said `@property int $code`, which
     * is what made it invisible: the reader believes it, static analysis
     * believes it, and the tests believe it because they run on SQLite.
     *
     * It surfaced in production as a 500 on the publish form's commune list —
     * Geo::communes(int $wilayaCode) refusing the string MySQL had just
     * returned, under strict_types, on a page that worked perfectly here.
     */
    protected function casts(): array
    {
        return [
            'code' => 'integer',
            'code58' => 'integer',
            'commune_count' => 'integer',
            'aliases' => 'array',
            'is_new_2026' => 'boolean',
        ];
    }
}
