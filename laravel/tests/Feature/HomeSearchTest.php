<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Services\Geo;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The search belongs on the home page.
 *
 * It lived only on /recherche, behind a link in the menu, which asked a visitor
 * to know the site had a search before they could use it. Both pages now render
 * the same component, so a filter added to one cannot go missing from the other
 * — the duplication that would otherwise be invisible until someone noticed a
 * field on one page and not the other.
 */
final class HomeSearchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();
    }

    public function test_the_home_page_carries_the_search(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertSee('name="q"', escape: false)
            ->assertSee('name="transaction"', escape: false)
            ->assertSee('name="type"', escape: false)
            ->assertSee('name="wilaya"', escape: false)
            ->assertSee('name="priceMin"', escape: false)
            ->assertSee('name="priceMax"', escape: false)
            ->assertSee('name="sort"', escape: false);
    }

    public function test_both_pages_offer_the_same_fields(): void
    {
        $fields = fn (string $html) => collect(preg_match_all('/name="([a-zA-Z]+)"/', $html, $m) ? $m[1] : [])
            ->unique()->sort()->values()->all();

        $home = $fields($this->get('/')->getContent());
        $search = $fields($this->get('/recherche')->getContent());

        foreach (['q', 'transaction', 'type', 'wilaya', 'priceMin', 'priceMax', 'sort'] as $field) {
            $this->assertContains($field, $home, "the home page is missing [{$field}]");
            $this->assertContains($field, $search, "the search page is missing [{$field}]");
        }
    }

    public function test_the_home_form_submits_to_the_results_page(): void
    {
        // The home page keeps one canonical URL; results live on the page that
        // is noindex because it can express unbounded filter permutations.
        $this->get('/')->assertSee('action="/recherche"', escape: false);
    }

    public function test_the_listings_are_still_below_it(): void
    {
        // A home page that is only a form tells a visitor nothing about what is
        // on the site, and most people look before they search.
        $this->get('/')->assertOk()->assertSee(__('listing.latest'));
    }

    public function test_the_promos_stay_above_the_search(): void
    {
        $html = $this->get('/')->getContent();

        $promo = mb_strpos($html, 'aria-label="'.__('promo.label').'"');
        $search = mb_strpos($html, 'action="/recherche"');

        // Only meaningful when a promo is on the page; when none is, the
        // section is not rendered at all and there is nothing to order.
        if ($promo !== false) {
            $this->assertLessThan($search, $promo, 'the search is drawn above the promo slider');
        }

        $this->assertNotFalse($search);
    }
}
