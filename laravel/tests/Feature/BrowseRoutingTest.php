<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Setting;
use App\Services\Geo;
use Database\Seeders\GeographySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The SEO catch-all. Every path here is one the Next app serves today, and the
 * 404s are the point: without them the route generates an unbounded number of
 * empty pages for a crawler to walk.
 */
final class BrowseRoutingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(GeographySeeder::class);
        Geo::forget();
    }

    #[DataProvider('pathsThatResolve')]
    public function test_a_real_combination_resolves(string $path): void
    {
        $this->get($path)->assertOk();
    }

    /** @return list<array{string}> */
    public static function pathsThatResolve(): array
    {
        return [
            ['/vente'],
            ['/location'],
            ['/vacances'],
            ['/echange'],
            ['/vente/appartement'],
            ['/vente/appartement/alger'],
            ['/vente/appartement/alger/bab-ezzouar'],
            ['/location/villa/oran'],
            // A category an admin could hide still routes: hiding is a
            // presentation decision, and an ad already published as a hangar
            // keeps its page.
            ['/vente/hangar/setif'],
        ];
    }

    #[DataProvider('pathsThatAreJunk')]
    public function test_anything_unresolvable_is_a_404(string $path): void
    {
        $this->get($path)->assertNotFound();
    }

    /** @return list<array{string}> */
    public static function pathsThatAreJunk(): array
    {
        return [
            'unknown deal' => ['/pas-un-deal'],
            'unknown property type' => ['/vente/pas-un-type/alger'],
            'unknown wilaya' => ['/vente/appartement/pas-une-wilaya'],
            // Stricter than the React version, which passed the commune through
            // unchecked: every string after a real wilaya answered 200.
            'unknown commune' => ['/vente/appartement/alger/pas-une-commune'],
            // A commune that exists, but not in this wilaya.
            'commune of another wilaya' => ['/vente/appartement/oran/bab-ezzouar'],
            // Also stricter: the React version destructured three segments and
            // ignored the rest, so every value of x answered 200.
            'a fifth segment' => ['/vente/appartement/alger/bab-ezzouar/x'],
            // Positional: a wilaya slug in the property-type seat is not a
            // property type.
            'wilaya in the type seat' => ['/vente/alger'],
        ];
    }

    public function test_the_content_pages_are_not_swallowed_by_the_catch_all(): void
    {
        // /cgu would resolve as a transaction type if the catch-all were
        // registered ahead of them.
        foreach (['/a-propos', '/aide', '/cgu', '/confidentialite', '/securite'] as $path) {
            $this->get($path)->assertOk()->assertSee('<html lang="ar" dir="rtl"', false);
        }
    }

    public function test_the_heading_reads_as_a_sentence(): void
    {
        $this->get('/vente/appartement/alger')
            ->assertOk()
            ->assertSee('شقة للبيع في الجزائر')
            ->assertSee('<title>شقة للبيع في الجزائر | تأجير</title>', false);
    }

    public function test_a_deal_with_no_place_says_so(): void
    {
        $this->get('/location')->assertOk()->assertSee('عقارات للكراء في الجزائر');
    }

    public function test_a_commune_narrows_the_page_it_does_not_rename_it(): void
    {
        $this->get('/vente/appartement/alger/bab-ezzouar')
            ->assertOk()
            ->assertSee('شقة للبيع في الجزائر')
            ->assertSee('باب الزوار، الجزائر');
    }

    public function test_a_category_an_admin_added_routes_like_a_built_in(): void
    {
        Setting::create(['key' => 'filter', 'value' => [
            'customPropertyTypes' => [['slug' => 'chalet', 'label' => 'شاليه']],
        ]]);

        $this->get('/vacances/chalet/tipaza')->assertOk()->assertSee('شاليه');
    }

    public function test_a_category_an_admin_renamed_routes_under_its_slug(): void
    {
        Setting::create(['key' => 'filter', 'value' => [
            'propertyLabels' => ['appartement' => 'شقة سكنية'],
        ]]);

        $this->get('/vente/appartement/alger')->assertOk()->assertSee('شقة سكنية للبيع في الجزائر');
    }
}
