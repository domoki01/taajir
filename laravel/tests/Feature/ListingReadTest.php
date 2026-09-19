<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Services\Geo;
use App\Services\ListingQuery;
use App\Support\Text;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class ListingReadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();
    }

    public function test_only_published_listings_are_ever_served(): void
    {
        // The one rule the whole read path depends on.
        Listing::factory()->create(['title' => 'منشور']);
        Listing::factory()->pending()->create(['title' => 'في الانتظار']);
        Listing::factory()->create(['status' => ListingStatus::Rejected->value, 'title' => 'مرفوض']);

        $this->assertSame(1, ListingQuery::make()->count());
        $this->get('/')->assertOk()->assertSee('منشور')->assertDontSee('في الانتظار');
    }

    public function test_an_unpublished_listing_is_a_404_not_a_403(): void
    {
        // A 403 would confirm that an ad with this id exists and is held.
        $listing = Listing::factory()->pending()->create();

        $this->get($listing->path())->assertNotFound();
    }

    public function test_a_listing_page_renders_its_price_place_and_structured_data(): void
    {
        $listing = Listing::factory()->create([
            'transaction_type' => 'vente',
            'price' => 8_000_000,
            'price_unit' => 'total',
            'wilaya_slug' => 'alger',
            'commune_slug' => 'bab-ezzouar',
        ]);

        $this->get($listing->path())
            ->assertOk()
            ->assertSee('800 مليون')
            ->assertSee('باب الزوار، الجزائر')
            ->assertSee('RealEstateListing', false)
            ->assertSee('"priceCurrency":"DZD"', false);
    }

    public function test_the_wrong_slug_redirects_to_the_right_one(): void
    {
        // An ad that was reclassified keeps one canonical URL, and old links
        // still land.
        $listing = Listing::factory()->create();

        $this->get('/annonce/'.$listing->id.'/un-slug-perime')
            ->assertRedirect($listing->path());
    }

    public function test_a_view_is_counted_without_looking_like_an_edit(): void
    {
        $listing = Listing::factory()->create();
        $before = $listing->updated_at;

        $this->get($listing->path())->assertOk();

        $listing->refresh();
        $this->assertSame(1, $listing->view_count);
        // Touching updated_at would make every page view look like an edit to
        // the owner and to the moderation queue.
        $this->assertEquals($before, $listing->updated_at);
    }

    public function test_english_shows_the_dinar_amount_rather_than_millions(): void
    {
        $listing = Listing::factory()->create(['price' => 8_000_000, 'price_unit' => 'total']);

        $this->get('/en'.$listing->path())->assertOk()->assertSee('8,000,000 DZD');
    }

    public function test_browse_narrows_to_its_segments(): void
    {
        Listing::factory()->create(['transaction_type' => 'vente', 'property_type' => 'villa', 'wilaya_slug' => 'oran', 'title' => 'فيلا وهران']);
        Listing::factory()->create(['transaction_type' => 'location', 'property_type' => 'appartement', 'wilaya_slug' => 'alger', 'title' => 'شقة الجزائر']);

        $this->get('/vente/villa/oran')->assertOk()->assertSee('فيلا وهران')->assertDontSee('شقة الجزائر');
    }

    public function test_a_price_range_is_a_range_not_a_bucket(): void
    {
        // The whole reason the bucket fields are not ported.
        Listing::factory()->create(['price' => 3_000_000]);
        Listing::factory()->create(['price' => 9_000_000]);

        $this->assertSame(1, ListingQuery::make(['priceMin' => 5_000_000])->count());
        $this->assertSame(1, ListingQuery::make(['priceMax' => 5_000_000])->count());
        $this->assertSame(2, ListingQuery::make(['priceMin' => 1, 'priceMax' => 10_000_000])->count());
    }

    public function test_search_folds_the_query_the_same_way_it_folded_the_text(): void
    {
        // A query folded one way against text folded another matches nothing,
        // which is the whole of the search working or not.
        Listing::factory()->create([
            'title' => 'شقة في الجزائر',
            'search_text' => Text::normalize('شقة في الجزائر'),
        ]);

        $this->assertSame(1, ListingQuery::make(['q' => 'الجزاير'])->count());
        $this->assertSame(0, ListingQuery::make(['q' => 'وهران'])->count());
    }

    public function test_amenities_are_all_of_not_any_of(): void
    {
        $both = Listing::factory()->create();
        $both->amenities()->createMany([['amenity' => 'garage'], ['amenity' => 'jardin']]);
        $one = Listing::factory()->create();
        $one->amenities()->create(['amenity' => 'garage']);

        $this->assertSame(2, ListingQuery::make(['amenities' => ['garage']])->count());
        $this->assertSame(1, ListingQuery::make(['amenities' => ['garage', 'jardin']])->count());
    }

    public function test_the_search_page_asks_not_to_be_indexed(): void
    {
        // It can express an unbounded number of filter permutations; the clean
        // combinations are the browse routes.
        $this->get('/recherche')->assertOk()->assertSee('name="robots" content="noindex', false);
    }

    public function test_the_sitemap_carries_published_ads_and_not_the_search_page(): void
    {
        $listing = Listing::factory()->create();
        Listing::factory()->pending()->create();

        $response = $this->get('/sitemap.xml')->assertOk();

        $response->assertSee($listing->path(), false);
        $response->assertDontSee('/recherche', false);
        // Three languages per URL, so none of them reads as a duplicate.
        $response->assertSee('hreflang="fr-DZ"', false);
    }

    public function test_pinned_listings_come_first_while_their_window_lasts(): void
    {
        Listing::factory()->create(['title' => 'عادي', 'published_at' => now()]);
        Listing::factory()->create(['title' => 'مثبّت', 'published_at' => now()->subDay(), 'pinned_until' => now()->addDay()]);
        Listing::factory()->create(['title' => 'منتهي التثبيت', 'published_at' => now()->subDays(2), 'pinned_until' => now()->subHour()]);

        $order = ListingQuery::make()->take(3)->pluck('title')->all();

        $this->assertSame('مثبّت', $order[0]);
    }
}
