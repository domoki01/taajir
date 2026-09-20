<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Models\AuditEntry;
use App\Models\Listing;
use App\Models\Setting;
use App\Models\User;
use App\Services\Geo;
use App\Services\ModerationService;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class ModerationTest extends TestCase
{
    use RefreshDatabase;

    private User $moderator;

    private User $visitor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();
        $this->moderator = User::factory()->create(['role_id' => 'moderator']);
        $this->visitor = User::factory()->create(['role_id' => 'user']);
    }

    private function service(): ModerationService
    {
        return app(ModerationService::class);
    }

    public function test_the_queue_needs_the_permission_not_just_an_account(): void
    {
        $this->get('/admin/moderation')->assertRedirectContains('/connexion');
        $this->actingAs($this->visitor)->get('/admin/moderation')->assertForbidden();
        $this->actingAs($this->moderator)->get('/admin/moderation')->assertOk();
    }

    public function test_each_action_is_authorised_again_not_just_the_page(): void
    {
        // Reaching a page is never treated as proof of anything.
        $listing = Listing::factory()->pending()->create();

        $this->actingAs($this->visitor)
            ->post('/admin/moderation/'.$listing->id.'/approuver')
            ->assertForbidden();

        $this->assertSame(ListingStatus::Pending->value, $listing->fresh()->status);
    }

    public function test_the_queue_shows_what_the_check_flagged(): void
    {
        Listing::factory()->pending()->create(['policy_rule' => 'offtopic', 'title' => 'إعلان مشبوه']);

        $this->actingAs($this->moderator)->get('/admin/moderation')
            ->assertOk()
            ->assertSee('إعلان مشبوه')
            ->assertSee(__('policy.flags.offtopic'));
    }

    public function test_approving_publishes_and_writes_an_audit_row(): void
    {
        $owner = User::factory()->create(['active_listing_count' => 1]);
        $listing = Listing::factory()->pending()->create(['owner_uid' => $owner->uid, 'policy_rule' => 'spam']);

        $this->service()->approve($this->moderator, $listing);

        $listing->refresh();
        $this->assertSame(ListingStatus::Published->value, $listing->status);
        $this->assertNotNull($listing->published_at);
        $this->assertNull($listing->policy_rule);
        // Pending and published both occupy a quota slot, so nothing moves.
        $this->assertSame(1, $owner->fresh()->active_listing_count);

        $this->assertSame(1, AuditEntry::where('action', 'listing.approve')->count());
    }

    public function test_rejecting_frees_the_quota_slot_and_keeps_the_reason(): void
    {
        $owner = User::factory()->create(['active_listing_count' => 1]);
        $listing = Listing::factory()->pending()->create(['owner_uid' => $owner->uid]);

        $this->service()->reject($this->moderator, $listing, 'الصور ماشي تاع العقار');

        $listing->refresh();
        $this->assertSame(ListingStatus::Rejected->value, $listing->status);
        // A rejection with no reason is one the owner cannot act on.
        $this->assertSame('الصور ماشي تاع العقار', $listing->rejection_reason);
        // A rejection that forgot to decrement would leave them permanently
        // unable to post.
        $this->assertSame(0, $owner->fresh()->active_listing_count);
    }

    public function test_a_rejection_must_carry_a_reason(): void
    {
        $listing = Listing::factory()->pending()->create();

        $this->actingAs($this->moderator)
            ->post('/admin/moderation/'.$listing->id.'/refuser', ['reason' => ''])
            ->assertSessionHasErrors('reason');
    }

    public function test_approving_during_the_launch_hold_does_not_publish(): void
    {
        // Reusing `published` for "approved" would put the ad on the site the
        // moment the moderator clicked.
        Setting::create(['key' => 'launch', 'value' => ['held' => true]]);
        $listing = Listing::factory()->create([
            'status' => ListingStatus::PendingLaunch->value,
            'published_at' => null,
        ]);

        $this->service()->approve($this->moderator, $listing);

        $listing->refresh();
        $this->assertSame(ListingStatus::PendingLaunch->value, $listing->status);
        $this->assertTrue($listing->approved_for_launch);
        $this->assertNull($listing->published_at);
    }

    public function test_re_approving_does_not_shuffle_an_old_ad_back_to_the_top(): void
    {
        $published = now()->subMonth();
        $listing = Listing::factory()->create(['published_at' => $published]);

        $this->service()->reject($this->moderator, $listing, 'خطأ');
        $this->service()->approve($this->moderator, $listing->fresh());

        // published_at is set once. "الأحدث" is the default ordering, and a
        // moderator's second look is not a republication.
        $this->assertEquals($published->startOfSecond(), $listing->fresh()->published_at->startOfSecond());
    }

    public function test_the_counter_never_goes_below_zero(): void
    {
        // The data that got it there is already wrong; handing out free quota
        // on top of that makes it worse.
        $owner = User::factory()->create(['active_listing_count' => 0]);
        $listing = Listing::factory()->create(['owner_uid' => $owner->uid]);

        $this->service()->archive($this->moderator, $listing);

        $this->assertSame(0, $owner->fresh()->active_listing_count);
    }

    public function test_the_audit_trail_survives_the_account_that_made_the_decision(): void
    {
        $listing = Listing::factory()->pending()->create();
        $this->service()->approve($this->moderator, $listing);

        $name = $this->moderator->display_name;
        $this->moderator->delete();

        $entry = AuditEntry::firstOrFail();
        // Denormalised on purpose: the log is read long after, and a join to a
        // deleted account is not one worth depending on.
        $this->assertSame($name, $entry->actor_name);
    }
}
