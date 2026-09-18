<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Commune;
use App\Models\Wilaya;
use App\Services\Geo;
use Database\Seeders\GeographySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class GeographyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(GeographySeeder::class);
        Geo::forget();
    }

    public function test_the_dataset_is_the_one_the_2026_law_describes(): void
    {
        // loi n° 26-06 (JO n°25, 5 April 2026): 69 wilayas, 1541 communes.
        $this->assertSame(69, Wilaya::count());
        $this->assertSame(1541, Commune::count());
    }

    public function test_every_wilaya_holds_the_number_of_communes_it_claims(): void
    {
        $actual = Commune::query()
            ->selectRaw('wilaya_code, count(*) as total')
            ->groupBy('wilaya_code')
            ->pluck('total', 'wilaya_code');

        foreach (Wilaya::all() as $wilaya) {
            $this->assertSame(
                $wilaya->commune_count,
                (int) ($actual[$wilaya->code] ?? 0),
                "wilaya {$wilaya->slug} declares {$wilaya->commune_count} communes",
            );
        }
    }

    public function test_a_split_wilaya_remembers_its_parent(): void
    {
        // Bou Saâda was split off M'sila (28) and is 68 under the new law. The
        // old number is what most people and every competitor site still use.
        $bouSaada = Geo::wilaya('bou-saada');

        $this->assertNotNull($bouSaada);
        $this->assertSame(68, $bouSaada->code);
        $this->assertSame(28, $bouSaada->code58);
        $this->assertTrue($bouSaada->is_new_2026);
        $this->assertContains('msila', $bouSaada->aliases);
    }

    public function test_searching_by_the_old_parent_name_still_finds_the_new_wilaya(): void
    {
        $slugs = array_map(fn (Wilaya $w) => $w->slug, Geo::search("M'sila"));

        $this->assertContains('bou-saada', $slugs);
    }

    public function test_search_folds_the_spelling_people_actually_type(): void
    {
        // "الجزاير" for "الجزائر" is the single most common misspelling on the
        // site, and the fold is what makes it resolve.
        $slugs = array_map(fn (Wilaya $w) => $w->slug, Geo::search('الجزاير'));

        $this->assertContains('alger', $slugs);
    }

    public function test_a_place_reads_as_arabic_prose(): void
    {
        $this->assertSame('باب الزوار، الجزائر', Geo::placeLabel('alger', 'bab-ezzouar'));
    }

    public function test_an_unknown_commune_falls_back_to_a_deslugged_name(): void
    {
        // Better than printing a raw Latin slug inside Arabic prose.
        $this->assertSame('pas une commune، الجزائر', Geo::placeLabel('alger', 'pas-une-commune'));
    }

    public function test_a_commune_slug_only_means_something_inside_its_wilaya(): void
    {
        $alger = Geo::wilaya('alger');
        $oran = Geo::wilaya('oran');

        $this->assertNotNull(Geo::commune($alger->code, 'bab-ezzouar'));
        $this->assertNull(Geo::commune($oran->code, 'bab-ezzouar'));
    }

    public function test_the_featured_wilayas_resolve(): void
    {
        // The home page shortcuts. A slug here that no longer exists would be a
        // missing tile rather than an error, so it is worth pinning.
        $this->assertCount(count(Geo::FEATURED_SLUGS), Geo::featured());
    }

    public function test_seeding_twice_changes_nothing(): void
    {
        $this->seed(GeographySeeder::class);

        $this->assertSame(69, Wilaya::count());
        $this->assertSame(1541, Commune::count());
    }
}
