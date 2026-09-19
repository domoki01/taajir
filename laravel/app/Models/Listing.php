<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ListingStatus;
use App\Enums\PriceUnit;
use App\Services\Geo;
use App\Support\Nav;
use App\Support\Price;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A property ad.
 *
 * Written only through App\Services\ListingService — never from a controller,
 * never from a view. That is what makes the quota, the slug and the derived
 * fields impossible to bypass, and it is the rule firestore.rules used to
 * enforce by denying every client write to the collection.
 *
 * @property string $id
 * @property string $slug
 * @property string $owner_uid
 * @property int $price
 * @property string $status
 */
class Listing extends Model
{
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'price_on_request' => 'boolean',
            'is_negotiable' => 'boolean',
            'show_phone' => 'boolean',
            'allow_whatsapp' => 'boolean',
            'owner_is_verified' => 'boolean',
            'is_featured' => 'boolean',
            'approved_for_launch' => 'boolean',
            'pinned_until' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'id';
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_uid', 'uid');
    }

    public function images(): HasMany
    {
        return $this->hasMany(ListingImage::class)->orderBy('position');
    }

    public function amenities(): HasMany
    {
        return $this->hasMany(ListingAmenity::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class)->where('status', 'visible')->oldest();
    }

    // ── Reading ──────────────────────────────────────────────────────────────

    /**
     * The only scope the public is ever served through.
     *
     * Every public query starts here. An unpublished ad is invisible whatever
     * else is asked for, which is the one rule the whole read path depends on.
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', ListingStatus::Published->value);
    }

    public function scopeNewest(Builder $query): Builder
    {
        // Pinned ads first while their window lasts, then by recency. "الأحدث"
        // is the default ordering for classifieds everywhere.
        return $query
            ->orderByRaw('CASE WHEN pinned_until IS NOT NULL AND pinned_until > ? THEN 0 ELSE 1 END', [now()])
            ->orderByDesc('published_at');
    }

    public function status(): ListingStatus
    {
        return ListingStatus::from($this->status);
    }

    public function priceUnit(): PriceUnit
    {
        return PriceUnit::tryFrom((string) $this->price_unit) ?? PriceUnit::Total;
    }

    /** "800 مليون في الشهر", or "السعر بالاتفاق" when the owner asked. */
    public function formattedPrice(): string
    {
        if ($this->price_on_request || $this->price <= 0) {
            return __('price.negotiable');
        }

        return Price::formatWithUnit($this->price, $this->priceUnit());
    }

    public function placeLabel(): string
    {
        return Geo::placeLabel($this->wilaya_slug, $this->commune_slug);
    }

    /** `/annonce/{id}/{slug}` — the id resolves it, the slug is for humans. */
    public function path(): string
    {
        return '/annonce/'.$this->id.'/'.$this->slug;
    }

    /**
     * Schema.org, so a Google result carries the price and the place rather
     * than just a title.
     *
     * RealEstateListing rather than Product: the price here is an asking price
     * for one specific property, not a catalogue item with stock.
     */
    public function jsonLd(): string
    {
        $data = [
            '@context' => 'https://schema.org',
            '@type' => 'RealEstateListing',
            'name' => $this->title,
            'description' => Str::limit(strip_tags($this->description), 300),
            'url' => url(Nav::href($this->path())),
            'datePosted' => optional($this->published_at)->toIso8601String(),
            'address' => [
                '@type' => 'PostalAddress',
                'addressLocality' => $this->commune_slug,
                'addressRegion' => $this->wilaya_slug,
                'addressCountry' => 'DZ',
            ],
        ];

        // A price of zero is "ask me", not free, and publishing 0 DZD as an
        // offer is worse than publishing no offer at all.
        if (! $this->price_on_request && $this->price > 0) {
            $data['offers'] = [
                '@type' => 'Offer',
                'price' => $this->price,
                'priceCurrency' => 'DZD',
                'availability' => 'https://schema.org/InStock',
            ];
        }

        if ($this->cover_url !== null) {
            $data['image'] = $this->cover_url;
        }

        return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?: '{}';
    }

    public function isPinned(): bool
    {
        return $this->pinned_until !== null && $this->pinned_until->isFuture();
    }
}
