<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use App\Services\Branding;
use App\Services\Geo;
use App\Services\Permissions;
use App\Services\Taxonomy;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The name, the tagline, the logo and six brand colours — and the validation
 * that has to hold, because everything here renders somewhere unescapable.
 */
final class AdminBrandingTest extends TestCase
{
    use RefreshDatabase;

    private User $designer;

    private User $member;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();
        Taxonomy::forget();
        Branding::forget();

        DB::table('roles')->insert([['id' => 'designer', 'label' => 'Designer', 'builtin' => false]]);
        DB::table('role_permissions')->insert([['role_id' => 'designer', 'permission' => 'branding.edit']]);
        Permissions::forget();

        $this->designer = User::factory()->create(['role_id' => 'designer']);
        $this->member = User::factory()->create(['role_id' => 'user']);
    }

    protected function tearDown(): void
    {
        Branding::forget();
        Taxonomy::forget();
        parent::tearDown();
    }

    /** @param array<string, mixed> $overrides */
    private function save(array $overrides = [])
    {
        return $this->actingAs($this->designer)->post('/admin/identite', [
            'site_name' => 'تأجير',
            'tagline' => 'عقارات الجزائر',
            ...$overrides,
        ]);
    }

    public function test_the_screen_needs_branding_edit(): void
    {
        $this->actingAs($this->member)->get('/admin/identite')->assertForbidden();
        $this->actingAs($this->designer)->get('/admin/identite')->assertOk();
    }

    public function test_a_save_repaints_the_site_on_the_next_request(): void
    {
        $this->save([
            'site_name' => 'عقاري',
            'tagline' => 'كراء وبيع',
            'colors' => ['primary' => '#123456', 'accent' => '#ABCDEF'],
        ])->assertSessionHasNoErrors();

        Branding::forget();

        $this->get('/')
            ->assertSee('عقاري', false)
            ->assertSee('--color-primary:#123456', false)
            // Stored folded, so two admins typing the same colour in different
            // cases do not produce two different stored values.
            ->assertSee('--color-accent:#abcdef', false);
    }

    public function test_nothing_is_emitted_when_no_colour_was_changed(): void
    {
        $this->save(['colors' => ['primary' => '', 'accent' => '']])->assertSessionHasNoErrors();
        Branding::forget();

        $this->assertSame([], Setting::read('branding')['colors']);
        $this->get('/')->assertDontSee('--color-primary:', false);
    }

    public function test_a_colour_that_is_not_a_hex_is_refused(): void
    {
        // It is interpolated into a <style> body, so "an admin typed it" is not
        // the property a stylesheet should depend on.
        $this->save(['colors' => ['primary' => 'red']])->assertSessionHasErrors('colors.primary');
        $this->save(['colors' => ['primary' => '#123']])->assertSessionHasErrors('colors.primary');
        $this->save(['colors' => ['primary' => '#000;}</style><script>']])->assertSessionHasErrors('colors.primary');

        $this->assertNull(Setting::query()->find('branding'));
    }

    public function test_a_logo_url_is_https_and_carries_nothing_that_breaks_an_attribute(): void
    {
        $this->save(['logo_url' => 'http://example.dz/logo.png'])->assertSessionHasErrors('logo_url');
        $this->save(['logo_url' => 'https://example.dz/a" onerror="alert(1)'])->assertSessionHasErrors('logo_url');

        $this->save(['logo_url' => 'https://example.dz/logo.png'])->assertSessionHasNoErrors();
        Branding::forget();
        $this->assertSame('https://example.dz/logo.png', Branding::current()->logoUrl);
    }

    public function test_an_unknown_colour_key_is_dropped(): void
    {
        $this->save(['colors' => ['primary' => '#123456', 'background' => '#000000']])
            ->assertSessionHasNoErrors();

        $this->assertSame(['primary' => '#123456'], Setting::read('branding')['colors']);
    }

    public function test_a_stored_colour_is_validated_on_the_way_out_as_well(): void
    {
        // Only a server action can write this row — but the value ends up in a
        // <style> body, and "whoever wrote it checked" is not a property a
        // stylesheet should rest on.
        Setting::query()->create(['key' => 'branding', 'value' => [
            'siteName' => 'تأجير',
            'colors' => ['primary' => '#000;}body{display:none'],
        ]]);
        Branding::forget();

        $this->assertSame('', Branding::current()->style());
    }

    public function test_reset_puts_the_build_back(): void
    {
        $this->save(['site_name' => 'عقاري'])->assertSessionHasNoErrors();

        $this->actingAs($this->designer)->delete('/admin/identite/defaut')->assertSessionHasNoErrors();
        Branding::forget();

        $this->assertNull(Setting::query()->find('branding'));
        $this->assertSame(__('brand.name'), Branding::current()->siteName);
    }

    public function test_a_failed_read_leaves_the_site_named_rather_than_blank(): void
    {
        $this->assertSame(__('brand.name'), Branding::fromSettings([])->siteName);
        $this->assertSame(__('brand.tagline'), Branding::fromSettings(['siteName' => '  '])->tagline);
    }
}
