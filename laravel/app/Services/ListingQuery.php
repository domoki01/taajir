<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Listing;
use App\Support\Text;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Every public listing query.
 *
 * This is where the port pays for itself. The Firestore version needed three
 * denormalised fields and an in-memory second pass to answer what is below,
 * because it could not do a range, a second range, or a text match. Here a
 * price range is `whereBetween`, amenities are a join, and the filters compose
 * with any sort. The bucket code is gone and is not coming back.
 */
final class ListingQuery
{
    private Builder $query;

    /** @param array<string, mixed> $filters */
    public function __construct(private readonly array $filters = [])
    {
        $this->query = Listing::query()->published();
        $this->apply();
    }

    /** @param array<string, mixed> $filters */
    public static function make(array $filters = []): self
    {
        return new self($filters);
    }

    public function paginate(int $perPage = 24): LengthAwarePaginator
    {
        return $this->sorted()->paginate($perPage)->withQueryString();
    }

    /** @return Collection<int, Listing> */
    public function take(int $limit)
    {
        return $this->sorted()->limit($limit)->get();
    }

    public function count(): int
    {
        return $this->query->toBase()->getCountForPagination();
    }

    public function builder(): Builder
    {
        return $this->query;
    }

    private function sorted(): Builder
    {
        $query = $this->query->with(['images']);

        return match ($this->filters['sort'] ?? null) {
            'price_asc' => $query->orderBy('price'),
            'price_desc' => $query->orderByDesc('price'),
            // Relevance is only meaningful with a query behind it; without one
            // it degrades to recency, which is the honest default.
            default => $query->newest(),
        };
    }

    private function apply(): void
    {
        $f = $this->filters;

        $this->whereSlug('transaction_type', $f['transaction'] ?? null);
        $this->whereSlug('property_type', $f['type'] ?? null);
        $this->whereSlug('wilaya_slug', $f['wilaya'] ?? null);
        $this->whereSlug('commune_slug', $f['commune'] ?? null);
        $this->whereSlug('rooms_code', $f['rooms'] ?? null);
        $this->whereSlug('paperwork', $f['paperwork'] ?? null);

        // The ranges Firestore refused, as ranges.
        $this->whereRange('price', $f['priceMin'] ?? null, $f['priceMax'] ?? null);
        $this->whereRange('area_built', $f['areaMin'] ?? null, $f['areaMax'] ?? null);

        // Amenities: every one asked for must be present, so one EXISTS per
        // amenity rather than a single IN, which would mean "any of".
        foreach ((array) ($f['amenities'] ?? []) as $amenity) {
            if (is_string($amenity) && $amenity !== '') {
                $this->query->whereExists(
                    fn ($sub) => $sub->select(DB::raw(1))
                        ->from('listing_amenities')
                        ->whereColumn('listing_amenities.listing_id', 'listings.id')
                        ->where('listing_amenities.amenity', $amenity)
                );
            }
        }

        $this->whereText($f['q'] ?? null);
    }

    private function whereSlug(string $column, mixed $value): void
    {
        if (is_string($value) && $value !== '') {
            $this->query->where($column, $value);
        }
    }

    private function whereRange(string $column, mixed $min, mixed $max): void
    {
        if (is_numeric($min)) {
            $this->query->where($column, '>=', (int) $min);
        }
        if (is_numeric($max)) {
            $this->query->where($column, '<=', (int) $max);
        }
    }

    /**
     * Free-text search over the normalised title and place.
     *
     * The query is folded with the same function that wrote `search_text` — the
     * fold is the whole of the matching, and a query folded one way against
     * text folded another matches nothing.
     *
     * MySQL gets FULLTEXT in boolean mode. sqlite, which the test suite runs
     * on, has no such index, so it falls back to LIKE over the same column:
     * slower and less clever about relevance, but the same rows for the same
     * input, which is what a test needs to be worth writing.
     */
    private function whereText(mixed $raw): void
    {
        if (! is_string($raw) || trim($raw) === '') {
            return;
        }

        $normalised = Text::normalize($raw);
        if ($normalised === '') {
            return;
        }

        // InnoDB's default minimum token length is 3, which is the same floor
        // the Firestore tokeniser used. Shorter words are dropped rather than
        // silently matching nothing.
        $terms = array_values(array_filter(
            preg_split('/\s+/', $normalised) ?: [],
            fn (string $t) => mb_strlen($t) >= 3,
        ));

        if ($terms === []) {
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            // Every term required, each allowed to match a longer word.
            $against = implode(' ', array_map(fn (string $t) => '+'.$t.'*', $terms));
            $this->query->whereRaw('MATCH(search_text) AGAINST (? IN BOOLEAN MODE)', [$against]);

            return;
        }

        foreach ($terms as $term) {
            $this->query->where('search_text', 'like', '%'.$term.'%');
        }
    }
}
