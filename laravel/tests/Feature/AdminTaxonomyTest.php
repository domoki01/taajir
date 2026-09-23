<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\Setting;
use App\Models\User;
use App\Services\Geo;
use App\Services\Permissions;
use App\Services\Taxonomy;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The categories and the filter: order, visibility, wording, and the
 * categories an admin adds that the code has never heard of.
 */
final class AdminTaxonomyTest extends TestCase
{
    use RefreshDatabase;

    private User $editor;

    private User $member;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();
        Taxonomy::forget();

        DB::table('roles')->insert([['id' => 'editor', 'label' => 'Editor', 'builtin' => false]]);
        DB::table('role_permissions')->insert([['role_id' => 'editor', 'permission' => 'taxonomy.edit']]);
        Permissions::forget();

        $this->editor = User::factory()->create(['role_id' => 'editor']);
        $this->member = User::factory()->create(['role_id' => 'user']);
    }

    protected function tearDown(): void
    {
        Taxonomy::forget();
        parent::tearDown();
    }

    public function test_the_screen_needs_taxonomy_edit(): void
    {
        $this->actingAs($this->member)->get('/admin/filtre')->assertForbidden();
        $this->actingAs($this->editor)->get('/admin/filtre')->assertOk();
    }

    public function test_the_screen_shows_hidden_rows_because_it_is_where_hiding_is_decided(): void
    {
        Setting::query()->create(['key' => 'filter', 'value' => ['hiddenPropertyTypes' => ['terrain']]]);
        Taxonomy::forget();

        $this->actingAs($this->editor)->get('/admin/filtre')
            ->assertOk()
            ->assertSee('terrain');
    }

    public function test_order_visibility_and_a_rename_survive_a_save(): void
    {
        $this->actingAs($this->editor)->post('/admin/filtre', [
            'properties' => [
                ['slug' => 'villa', 'label' => 'فيلا'],
                ['slug' => 'appartement', 'label' => 'شقة راقية'],
                ['slug' => 'terrain', 'label' => 'أرض'],
            ],
            'deals' => [['slug' => 'vente', 'label' => 'للبيع']],
            'hidden' => ['properties' => ['terrain']],
        ])->assertSessionHasNoErrors();

        Taxonomy::forget();
        $stored = Setting::read('filter');

        $this->assertSame(['villa', 'appartement', 'terrain'], $stored['propertyTypeOrder']);
        $this->assertSame(['terrain'], $stored['hiddenPropertyTypes']);
        $this->assertSame('شقة راقية', $stored['propertyLabels']['appartement']);

        // Only what differs from the code default is stored: otherwise a copy
        // fix shipped in the enums would be overridden for good by a settings
        // row written before it.
        $this->assertArrayNotHasKey('villa', $stored['propertyLabels']);
    }

    public function test_hiding_stops_at_the_dropdown(): void
    {
        $this->actingAs($this->editor)->post('/admin/filtre', [
            'properties' => [['slug' => 'terrain', 'label' => 'أرض']],
            'deals' => [['slug' => 'vente', 'label' => 'للبيع']],
            'hidden' => ['properties' => ['terrain']],
        ])->assertSessionHasNoErrors();

        Taxonomy::forget();
        $taxonomy = Taxonomy::current();

        // Gone from the menu, still a category everywhere else — an ad already
        // filed under it keeps its page and its URL.
        $visible = array_column($taxonomy->visibleOptions()['propertyTypes'], 'slug');
        $this->assertNotContains('terrain', $visible);
        $this->assertArrayHasKey('terrain', $taxonomy->propertyTypes);
    }

    public function test_an_empty_dropdown_is_refused(): void
    {
        $all = array_keys(Taxonomy::current()->propertyTypes);

        $this->actingAs($this->editor)->post('/admin/filtre', [
            'properties' => array_map(fn ($slug) => ['slug' => $slug, 'label' => 'x'.$slug], $all),
            'deals' => [['slug' => 'vente', 'label' => 'للبيع']],
            'hidden' => ['properties' => $all],
        ])->assertSessionHasErrors('properties');
    }

    public function test_a_custom_category_is_added_and_is_a_real_category(): void
    {
        $this->actingAs($this->editor)
            ->post('/admin/filtre/categorie', ['slug' => 'Ferme', 'label' => 'مزرعة'])
            ->assertSessionHasNoErrors();

        Taxonomy::forget();
        $taxonomy = Taxonomy::current();
        $this->assertSame('مزرعة', $taxonomy->propertyTypes['ferme']);
        $this->assertContains('ferme', $taxonomy->customPropertySlugs);
    }

    public function test_a_custom_slug_cannot_shadow_a_built_in_or_a_page(): void
    {
        $this->actingAs($this->editor)
            ->post('/admin/filtre/categorie', ['slug' => 'appartement', 'label' => 'شقة'])
            ->assertSessionHasErrors('slug');

        // Browse lives at /{deal}, so a deal called "publier" would sit in
        // front of the publish form for good.
        $this->actingAs($this->editor)
            ->post('/admin/filtre/operation', [
                'slug' => 'publier', 'label' => 'تنازل', 'price_unit' => 'mois',
            ])
            ->assertSessionHasErrors('slug');

        $this->actingAs($this->editor)
            ->post('/admin/filtre/operation', ['slug' => 'ونس', 'label' => 'تنازل', 'price_unit' => 'mois'])
            ->assertSessionHasErrors('slug');
    }

    public function test_a_custom_deal_declares_the_unit_its_price_is_read_on(): void
    {
        $this->actingAs($this->editor)->post('/admin/filtre/operation', [
            'slug' => 'cession',
            'label' => 'تنازل',
            'filter_label' => 'للتنازل',
            'price_unit' => 'mois',
        ])->assertSessionHasNoErrors();

        Taxonomy::forget();
        $taxonomy = Taxonomy::current();

        $this->assertSame('تنازل', $taxonomy->transactionTypes['cession']);
        $this->assertSame('للتنازل', $taxonomy->transactionFilterLabels['cession']);
        $this->assertSame('mois', $taxonomy->transactionUnits['cession']->value);
    }

    public function test_a_category_with_listings_in_it_is_hidden_not_deleted(): void
    {
        $this->actingAs($this->editor)->post('/admin/filtre/categorie', ['slug' => 'ferme', 'label' => 'مزرعة']);
        Taxonomy::forget();

        Listing::factory()->create(['property_type' => 'ferme', 'status' => ListingStatus::Published->value]);

        $this->actingAs($this->editor)->delete('/admin/filtre/type/ferme')->assertSessionHasErrors('slug');
        Taxonomy::forget();
        $this->assertArrayHasKey('ferme', Taxonomy::current()->propertyTypes);

        Listing::query()->where('property_type', 'ferme')->delete();
        $this->actingAs($this->editor)->delete('/admin/filtre/type/ferme')->assertSessionHasNoErrors();
        Taxonomy::forget();
        $this->assertArrayNotHasKey('ferme', Taxonomy::current()->propertyTypes);
    }

    public function test_a_built_in_is_never_deleted(): void
    {
        $this->actingAs($this->editor)->delete('/admin/filtre/type/appartement')->assertSessionHasErrors('slug');
        Taxonomy::forget();
        $this->assertArrayHasKey('appartement', Taxonomy::current()->propertyTypes);
    }

    public function test_reset_is_undo_my_presentation_changes_not_delete_my_categories(): void
    {
        $this->actingAs($this->editor)->post('/admin/filtre/categorie', ['slug' => 'ferme', 'label' => 'مزرعة']);
        Taxonomy::forget();

        $this->actingAs($this->editor)->delete('/admin/filtre/defaut')->assertSessionHasErrors('reset');

        $this->actingAs($this->editor)->delete('/admin/filtre/type/ferme');
        Taxonomy::forget();

        $this->actingAs($this->editor)->delete('/admin/filtre/defaut')->assertSessionHasNoErrors();
        $this->assertNull(Setting::query()->find('filter'));
    }
}
