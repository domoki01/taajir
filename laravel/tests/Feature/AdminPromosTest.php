<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Promo;
use App\Models\User;
use App\Services\Geo;
use App\Services\PromoService;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The home-page carousel: the link validation that has to hold, and the
 * ordering that has to have no ties in it.
 */
final class AdminPromosTest extends TestCase
{
    use RefreshDatabase;

    private User $seller;

    private User $member;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();
        Storage::fake('public');

        // The moderator role holds promos.manage by default.
        $this->seller = User::factory()->create(['role_id' => 'moderator']);
        $this->member = User::factory()->create(['role_id' => 'user']);
    }

    private function image(): UploadedFile
    {
        return UploadedFile::fake()->image('banner.jpg', 1600, 500);
    }

    public function test_the_screen_needs_promos_manage(): void
    {
        $this->actingAs($this->member)->get('/admin/publicites')->assertForbidden();
        $this->actingAs($this->seller)->get('/admin/publicites')->assertOk();
    }

    public function test_a_banner_is_stored_as_webp_and_appended_to_the_end(): void
    {
        Promo::factory()->create(['order' => 0]);

        $this->actingAs($this->seller)->post('/admin/publicites', [
            'image' => $this->image(),
            'title' => 'وكالة الوئام — شقق جديدة',
            'link_url' => '/vente/appartement/alger',
        ])->assertSessionHasNoErrors();

        $promo = Promo::query()->latest('id')->firstOrFail();
        $this->assertSame(1, $promo->order);
        $this->assertStringEndsWith('.webp', $promo->storage_path);
        Storage::disk('public')->assertExists($promo->storage_path);
    }

    public function test_an_href_built_from_stored_text_is_still_an_untrusted_url(): void
    {
        // `javascript:` and `data:` are executable in an href, and the admin
        // panel being staff-only is not a reason to leave that open.
        foreach (['javascript:alert(1)', 'data:text/html,<script>', '//evil.dz/x', 'ftp://example.dz'] as $link) {
            $this->actingAs($this->seller)->post('/admin/publicites', [
                'image' => $this->image(),
                'title' => 'بانر',
                'link_url' => $link,
            ])->assertSessionHasErrors('link_url');
        }

        $this->assertSame(0, Promo::query()->count());
    }

    public function test_a_site_relative_path_and_an_https_url_are_both_accepted(): void
    {
        foreach (['/vente/villa/oran', 'https://example.dz/promo'] as $link) {
            $this->actingAs($this->seller)->post('/admin/publicites', [
                'image' => $this->image(),
                'title' => 'بانر',
                'link_url' => $link,
            ])->assertSessionHasNoErrors();
        }

        $this->assertSame(2, Promo::query()->count());
    }

    public function test_the_title_is_required_because_it_is_the_alt_text(): void
    {
        $this->actingAs($this->seller)->post('/admin/publicites', [
            'image' => $this->image(),
            'title' => 'ب',
            'link_url' => '/vente',
        ])->assertSessionHasErrors('title');
    }

    public function test_the_carousel_is_capped(): void
    {
        Promo::factory()->count(PromoService::MAX)->create();

        $this->actingAs($this->seller)->post('/admin/publicites', [
            'image' => $this->image(),
            'title' => 'بانر',
            'link_url' => '/vente',
        ])->assertSessionHasErrors('image');
    }

    public function test_moving_a_banner_leaves_no_two_sharing_a_slot(): void
    {
        // Three banners that all claim slot 0 — the state the swap has to
        // survive, because two sharing an order render in an arbitrary
        // sequence and that is the complaint the first-slot advertiser makes.
        $a = Promo::factory()->create(['order' => 0, 'title' => 'A']);
        $b = Promo::factory()->create(['order' => 0, 'title' => 'B']);
        $c = Promo::factory()->create(['order' => 0, 'title' => 'C']);

        $this->actingAs($this->seller)->post("/admin/publicites/{$c->id}/ordre", ['direction' => 'up'])
            ->assertSessionHasNoErrors();

        $order = Promo::query()->orderBy('order')->orderBy('id')->pluck('title')->all();
        $this->assertSame(['A', 'C', 'B'], $order);
        $this->assertSame([0, 1, 2], Promo::query()->orderBy('order')->pluck('order')->all());

        // At the edges it is a no-op, not an error.
        $this->actingAs($this->seller)->post("/admin/publicites/{$a->id}/ordre", ['direction' => 'up'])
            ->assertSessionHasNoErrors();
        $this->assertSame(['A', 'C', 'B'], Promo::query()->orderBy('order')->pluck('title')->all());
    }

    public function test_hiding_a_banner_keeps_it_off_the_home_page(): void
    {
        $shown = Promo::factory()->create(['title' => 'ظاهر']);
        $hidden = Promo::factory()->create(['title' => 'مخفي', 'is_active' => false]);

        $this->get('/')->assertSee('ظاهر', false)->assertDontSee('مخفي', false);

        $this->actingAs($this->seller)->post("/admin/publicites/{$hidden->id}/visibilite", ['active' => 1]);
        $this->get('/')->assertSee('مخفي', false);
    }

    public function test_deleting_a_banner_takes_its_file_with_it(): void
    {
        $this->actingAs($this->seller)->post('/admin/publicites', [
            'image' => $this->image(),
            'title' => 'بانر',
            'link_url' => '/vente',
        ]);

        $promo = Promo::query()->firstOrFail();
        Storage::disk('public')->assertExists($promo->storage_path);

        $this->actingAs($this->seller)->delete("/admin/publicites/{$promo->id}")->assertSessionHasNoErrors();

        $this->assertSame(0, Promo::query()->count());
        Storage::disk('public')->assertMissing($promo->storage_path);
    }

    public function test_an_external_banner_opens_beside_the_site_and_carries_noopener(): void
    {
        Promo::factory()->create(['link_url' => 'https://example.dz/promo', 'title' => 'خارجي']);
        Promo::factory()->create(['link_url' => '/vente/villa/oran', 'title' => 'داخلي']);

        $html = $this->get('/')->assertOk()->getContent();

        $this->assertStringContainsString('rel="noopener nofollow sponsored"', $html);
        $this->assertSame(1, substr_count($html, 'target="_blank"'));
    }
}
