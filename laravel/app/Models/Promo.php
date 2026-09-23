<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $image_url
 * @property string $storage_path
 * @property int $width
 * @property int $height
 * @property string $link_url
 * @property string $title
 * @property bool $is_active
 * @property int $order
 */
class Promo extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /** What the carousel renders, in the order an admin put them in. */
    public function scopeVisible($query)
    {
        return $query->where('is_active', true)->orderBy('order')->orderBy('id');
    }

    /**
     * Does this banner leave the site?
     *
     * Decides `rel` and `target`. A site-relative link stays in the tab; an
     * external one opens beside it and carries noopener, because the
     * destination is an advertiser's page and `window.opener` is theirs to use.
     */
    public function isExternal(): bool
    {
        return ! str_starts_with($this->link_url, '/');
    }
}
