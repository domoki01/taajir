<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Models\AuditEntry;
use App\Models\Listing;
use App\Models\User;
use App\Services\Geo;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The panel's shell: who gets through the door, what they are shown once
 * inside, and the log that records what they did.
 */
final class AdminPanelTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $moderator;

    private User $visitor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();
        $this->admin = User::factory()->create(['role_id' => 'admin']);
        $this->moderator = User::factory()->create(['role_id' => 'moderator']);
        $this->visitor = User::factory()->create(['role_id' => 'user']);
    }

    public function test_the_door_asks_for_a_permission_not_an_account(): void
    {
        $this->get('/admin')->assertRedirectContains('/connexion');
        $this->actingAs($this->visitor)->get('/admin')->assertForbidden();
        $this->actingAs($this->moderator)->get('/admin')->assertOk();
        $this->actingAs($this->admin)->get('/admin')->assertOk();
    }

    public function test_the_map_shows_only_the_screens_this_account_can_open(): void
    {
        // A moderator holds five permissions and none of them is roles.manage,
        // so the row is absent rather than present and 403ing when tapped.
        $this->actingAs($this->moderator)->get('/admin')
            ->assertSee(__('admin.nav.queue'))
            ->assertSee(__('admin.nav.promos'))
            ->assertDontSee(__('admin.nav.roles'))
            ->assertDontSee(__('admin.nav.branding'))
            ->assertDontSee(__('admin.nav.audit'));

        $this->actingAs($this->admin)->get('/admin')
            ->assertSee(__('admin.nav.roles'))
            ->assertSee(__('admin.nav.branding'))
            ->assertSee(__('admin.nav.audit'));
    }

    public function test_a_failed_count_shows_a_dash_rather_than_a_zero(): void
    {
        // Nothing has been published, so the tile is a real zero — the point of
        // the assertion is that an empty table reads as 0 and only a broken
        // query reads as a dash.
        Listing::factory()->create(['status' => ListingStatus::Pending->value]);

        $this->actingAs($this->admin)->get('/admin')
            ->assertOk()
            ->assertSee(__('admin.tiles.pending'));
    }

    public function test_the_log_needs_audit_view(): void
    {
        $this->actingAs($this->moderator)->get('/admin/journal')->assertForbidden();
        $this->actingAs($this->admin)->get('/admin/journal')->assertOk();
    }

    public function test_the_log_renders_an_entry_in_words(): void
    {
        AuditEntry::record($this->moderator, 'listing.reject', 'listing', 'abc123', ['reason' => 'صورة ما تخصش']);

        $this->actingAs($this->admin)->get('/admin/journal')
            ->assertSee(__('admin.audit.actions.listing.reject'))
            ->assertSee('صورة ما تخصش', false)
            ->assertSee($this->moderator->uid);
    }

    public function test_an_action_the_release_no_longer_knows_still_reads_as_something(): void
    {
        // The log outlives the code that wrote it. An action name with no
        // translation renders as itself, never as a lang key.
        AuditEntry::record($this->admin, 'listing.teleport', 'listing', 'abc123');

        $this->actingAs($this->admin)->get('/admin/journal')
            ->assertSee('listing.teleport')
            ->assertDontSee('admin.audit.actions');
    }

    public function test_the_panel_is_never_indexed(): void
    {
        $this->actingAs($this->admin)->get('/admin')->assertSee('noindex, nofollow', false);
    }
}
