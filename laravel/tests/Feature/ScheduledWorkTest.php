<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\OutboxEntry;
use App\Models\SavedSearch;
use App\Models\Setting;
use App\Models\User;
use App\Services\Geo;
use App\Services\Launch;
use App\Services\ModerationService;
use App\Services\SavedSearchAlerts;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The work the one cron line drives, and the alerts that hang off a publish.
 */
final class ScheduledWorkTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $watcher;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();
        Launch::forget();

        $this->owner = User::factory()->create(['listing_quota' => 20]);
        $this->watcher = User::factory()->create(['email' => 'w@example.dz', 'email_verified' => true]);
    }

    protected function tearDown(): void
    {
        Launch::forget();
        parent::tearDown();
    }

    private function alert(array $overrides = []): SavedSearch
    {
        return SavedSearch::create([
            'owner_uid' => $this->watcher->uid,
            'wilaya_slug' => 'alger',
            'label' => 'شقق في الجزائر',
            'notify' => true,
            'created_at' => now(),
            ...$overrides,
        ]);
    }

    // ── saved-search alerts ──────────────────────────────────────────────────

    public function test_a_published_ad_reaches_a_matching_alert(): void
    {
        $this->alert();

        Listing::factory()->create([
            'owner_uid' => $this->owner->uid,
            'status' => ListingStatus::Published->value,
            'wilaya_slug' => 'alger',
        ]);

        // Created directly, so nothing fired. The service is what the publish
        // path calls, and it is what is under test.
        $this->assertSame(0, OutboxEntry::query()->count());

        $listing = Listing::query()->firstOrFail();
        app(SavedSearchAlerts::class)->notify($listing);

        $this->assertGreaterThan(0, OutboxEntry::query()->where('uid', $this->watcher->uid)->count());
        $this->assertSame(1, (int) SavedSearch::query()->value('match_count'));
        $this->assertNotNull(SavedSearch::query()->value('last_notified_at'));
    }

    public function test_a_null_field_on_the_alert_means_anything(): void
    {
        // Which is how it was saved: the form's "any type" is a null column.
        $this->alert(['property_type' => null, 'transaction_type' => 'vente']);

        $listing = Listing::factory()->create([
            'owner_uid' => $this->owner->uid,
            'wilaya_slug' => 'alger',
            'transaction_type' => 'vente',
            'property_type' => 'villa',
        ]);

        $this->assertSame(1, app(SavedSearchAlerts::class)->notify($listing));
    }

    public function test_a_field_that_disagrees_does_not_match(): void
    {
        $this->alert(['commune_slug' => 'bab-ezzouar']);

        $listing = Listing::factory()->create([
            'owner_uid' => $this->owner->uid,
            'wilaya_slug' => 'alger',
            'commune_slug' => 'hydra',
        ]);

        $this->assertSame(0, app(SavedSearchAlerts::class)->notify($listing));
        $this->assertSame(0, OutboxEntry::query()->count());
    }

    public function test_nobody_is_told_about_their_own_ad(): void
    {
        $this->alert(['owner_uid' => $this->owner->uid]);

        $listing = Listing::factory()->create([
            'owner_uid' => $this->owner->uid,
            'wilaya_slug' => 'alger',
        ]);

        $this->assertSame(0, app(SavedSearchAlerts::class)->notify($listing));
    }

    public function test_several_matching_alerts_are_one_message_and_several_counts(): void
    {
        // One person can hold four alerts that all match. They get one message
        // — and every search still has its counter moved, because the count is
        // what tells somebody their alert is alive.
        $this->alert(['label' => 'أ']);
        $this->alert(['label' => 'ب', 'property_type' => 'appartement']);

        $listing = Listing::factory()->create([
            'owner_uid' => $this->owner->uid,
            'wilaya_slug' => 'alger',
            'property_type' => 'appartement',
        ]);

        $this->assertSame(1, app(SavedSearchAlerts::class)->notify($listing));

        $rows = OutboxEntry::query()->where('uid', $this->watcher->uid)->get();
        $this->assertSame(1, $rows->pluck('title')->unique()->count());
        $this->assertSame([1, 1], SavedSearch::query()->pluck('match_count')->all());
    }

    public function test_a_silenced_account_still_accumulates_the_count(): void
    {
        // Turning alerts back on should not make the search look as though it
        // had been asleep the whole time.
        $this->watcher->forceFill(['notify_on_saved_search' => false])->save();
        $this->alert();

        $listing = Listing::factory()->create(['owner_uid' => $this->owner->uid, 'wilaya_slug' => 'alger']);

        $this->assertSame(0, app(SavedSearchAlerts::class)->notify($listing));
        $this->assertSame(0, OutboxEntry::query()->count());
        $this->assertSame(1, (int) SavedSearch::query()->value('match_count'));
    }

    public function test_approval_is_what_fires_the_alert_not_submission(): void
    {
        $this->alert();
        $moderator = User::factory()->create(['role_id' => 'moderator']);

        $listing = Listing::factory()->create([
            'owner_uid' => $this->owner->uid,
            'status' => ListingStatus::Pending->value,
            'wilaya_slug' => 'alger',
        ]);

        $this->assertSame(0, OutboxEntry::query()->count());

        app(ModerationService::class)->approve($moderator, $listing);

        $this->assertGreaterThan(0, OutboxEntry::query()->count());
    }

    public function test_approving_during_the_hold_announces_nothing(): void
    {
        // It clears the ad for the launch batch without publishing it —
        // alerting there would announce an ad nobody can open.
        Setting::query()->create(['key' => 'launch', 'value' => ['state' => Launch::PRELAUNCH]]);
        Launch::forget();

        $this->alert();
        $moderator = User::factory()->create(['role_id' => 'moderator']);

        $listing = Listing::factory()->create([
            'owner_uid' => $this->owner->uid,
            'status' => ListingStatus::PendingLaunch->value,
            'wilaya_slug' => 'alger',
        ]);

        app(ModerationService::class)->approve($moderator, $listing);

        $this->assertTrue($listing->fresh()->approved_for_launch);
        $this->assertSame(0, OutboxEntry::query()->count());
    }

    public function test_a_failed_fan_out_never_fails_the_publish(): void
    {
        $this->alert();
        $moderator = User::factory()->create(['role_id' => 'moderator']);

        // A real failure rather than a double: the outbox table is gone, so the
        // insert throws exactly as a broken channel would. The fan-out has to
        // survive it, because a moderator pressing "تأكيد" cares that the ad
        // went live — and a publish rolled back by a failed notification helps
        // nobody at all.
        Schema::drop('launch_outbox');

        $listing = Listing::factory()->create([
            'owner_uid' => $this->owner->uid,
            'status' => ListingStatus::Pending->value,
            'wilaya_slug' => 'alger',
        ]);

        app(ModerationService::class)->approve($moderator, $listing);

        $this->assertSame(ListingStatus::Published->value, $listing->fresh()->status);
    }

    // ── expiry ───────────────────────────────────────────────────────────────

    public function test_an_ad_past_its_lifetime_expires_and_frees_the_quota(): void
    {
        $days = (int) config('taajir.listing_lifetime_days');

        $old = Listing::factory()->create([
            'owner_uid' => $this->owner->uid,
            'status' => ListingStatus::Published->value,
            'published_at' => now()->subDays($days + 1),
        ]);
        $fresh = Listing::factory()->create([
            'owner_uid' => $this->owner->uid,
            'status' => ListingStatus::Published->value,
            'published_at' => now()->subDay(),
        ]);

        $this->owner->forceFill(['active_listing_count' => 2])->save();

        $this->artisan('taajir:expire-listings')->assertSuccessful();

        $this->assertSame(ListingStatus::Expired->value, $old->fresh()->status);
        $this->assertSame(ListingStatus::Published->value, $fresh->fresh()->status);
        // The other half of why expiry matters: a seller who hit their limit
        // months ago should not have to hunt for dead ads before posting.
        $this->assertSame(1, $this->owner->fresh()->active_listing_count);
    }

    public function test_a_pinned_ad_outlives_the_cutoff(): void
    {
        // Somebody paid for that placement, and its clock is the pin's.
        $days = (int) config('taajir.listing_lifetime_days');

        $pinned = Listing::factory()->create([
            'owner_uid' => $this->owner->uid,
            'status' => ListingStatus::Published->value,
            'published_at' => now()->subDays($days + 10),
            'pinned_until' => now()->addWeek(),
        ]);

        $this->artisan('taajir:expire-listings')->assertSuccessful();

        $this->assertSame(ListingStatus::Published->value, $pinned->fresh()->status);
    }

    public function test_the_quota_counter_is_clamped_at_zero(): void
    {
        $days = (int) config('taajir.listing_lifetime_days');

        Listing::factory()->count(2)->create([
            'owner_uid' => $this->owner->uid,
            'status' => ListingStatus::Published->value,
            'published_at' => now()->subDays($days + 1),
        ]);

        // Already drifted. It must not go negative and start granting free
        // quota.
        $this->owner->forceFill(['active_listing_count' => 1])->save();

        $this->artisan('taajir:expire-listings')->assertSuccessful();

        $this->assertSame(0, $this->owner->fresh()->active_listing_count);
    }

    public function test_a_dry_run_expires_nothing(): void
    {
        $days = (int) config('taajir.listing_lifetime_days');
        $old = Listing::factory()->create([
            'owner_uid' => $this->owner->uid,
            'status' => ListingStatus::Published->value,
            'published_at' => now()->subDays($days + 1),
        ]);

        $this->artisan('taajir:expire-listings --dry-run')->assertSuccessful();

        $this->assertSame(ListingStatus::Published->value, $old->fresh()->status);
    }

    // ── the scheduled launch ─────────────────────────────────────────────────

    public function test_if_due_waits_for_both_the_hold_and_the_clock(): void
    {
        $this->artisan('taajir:launch --if-due')->expectsOutputToContain('Already open.');

        Setting::query()->updateOrCreate(['key' => 'launch'], ['value' => [
            'state' => Launch::PRELAUNCH,
            'launchAt' => now()->addDay()->getTimestampMs(),
        ]]);
        Launch::forget();

        $this->artisan('taajir:launch --if-due')->expectsOutputToContain('has not elapsed');
        $this->assertTrue(Launch::current()->isHeld());
    }

    public function test_if_due_opens_the_site_once_the_clock_has_run_out(): void
    {
        Setting::query()->updateOrCreate(['key' => 'launch'], ['value' => [
            'state' => Launch::PRELAUNCH,
            'launchAt' => now()->subHour()->getTimestampMs(),
        ]]);
        Launch::forget();

        Listing::factory()->create([
            'owner_uid' => $this->owner->uid,
            'status' => ListingStatus::PendingLaunch->value,
            'approved_for_launch' => true,
        ]);

        $this->artisan('taajir:launch --if-due')->assertSuccessful();

        Launch::forget();
        $this->assertFalse(Launch::current()->isHeld());
        $this->assertSame(1, Listing::query()->where('status', ListingStatus::Published->value)->count());
    }
}
