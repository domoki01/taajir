<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\OutboxEntry;
use App\Models\PropertyRequest;
use App\Models\Setting;
use App\Models\User;
use App\Services\Geo;
use App\Services\Launch;
use App\Services\Outbox;
use App\Services\Permissions;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The launch gate: the door, the clock, and the switch.
 */
final class LaunchTest extends TestCase
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
        Launch::forget();

        $this->admin = User::factory()->create(['role_id' => 'admin']);
        $this->moderator = User::factory()->create(['role_id' => 'moderator']);
        $this->visitor = User::factory()->create(['role_id' => 'user']);
    }

    protected function tearDown(): void
    {
        Launch::forget();
        parent::tearDown();
    }

    private function hold(?int $launchAtMs = null): void
    {
        Setting::query()->updateOrCreate(['key' => 'launch'], ['value' => [
            'state' => Launch::PRELAUNCH,
            'launchAt' => $launchAtMs,
        ]]);
        Launch::forget();
    }

    // ── the default ──────────────────────────────────────────────────────────

    public function test_the_site_is_open_unless_somebody_decided_otherwise(): void
    {
        // Load-bearing in one direction. The site is live: defaulting to held
        // would mean the deploy that ships this feature closes the site on
        // every visitor.
        $this->assertFalse(Launch::current()->isHeld());
        $this->get('/vente')->assertOk();
    }

    public function test_a_failed_settings_read_leaves_the_site_open(): void
    {
        // Locking the public out takes a decision, never an absence and never
        // a failure.
        $this->assertFalse(Launch::fromSettings([])->isHeld());
        $this->assertFalse(Launch::open()->isHeld());
    }

    public function test_the_boolean_phase_five_invented_is_still_read(): void
    {
        // `state` is the authority because it is what the Firestore export
        // carries, but a row written against the old shape must not silently
        // open the site.
        $this->assertTrue(Launch::fromSettings(['held' => true])->isHeld());
        $this->assertTrue(Launch::fromSettings(['state' => 'prelaunch'])->isHeld());
        $this->assertFalse(Launch::fromSettings(['state' => 'active'])->isHeld());
    }

    // ── the door ─────────────────────────────────────────────────────────────

    public function test_a_held_site_sends_the_public_to_the_waiting_page(): void
    {
        $this->hold();

        // The home page included: it renders featured and latest listings, and
        // the ads stay `published` while the site is held, so nothing else
        // would be hiding them from the one URL everybody types.
        foreach (['/', '/vente', '/vente/appartement/alger', '/recherche', '/demandes'] as $path) {
            $this->get($path)->assertRedirectContains('/lancement');
        }

        $listing = Listing::factory()->create(['status' => ListingStatus::Published->value]);
        $this->get($listing->path())->assertRedirectContains('/lancement');
    }

    public function test_staff_walk_through_a_held_site(): void
    {
        // Somebody has to be able to look at the site they are about to launch,
        // and reviewing the queue means opening the pages it holds.
        $this->hold();

        $this->actingAs($this->moderator)->get('/vente')->assertOk();
        $this->actingAs($this->visitor)->get('/vente')->assertRedirectContains('/lancement');
    }

    public function test_the_waiting_page_redirects_once_the_doors_are_open(): void
    {
        // Someone who bookmarked it, or left the tab open overnight.
        $this->get('/lancement')->assertRedirect();

        $this->hold();
        $this->get('/lancement')->assertOk()->assertSee(__('launch.signed_out'), false);
    }

    public function test_publishing_and_signing_in_stay_open_while_the_site_is_held(): void
    {
        // The hold gathers ads. A hold that also blocked posting one would be
        // working against its own purpose.
        $this->hold();

        $this->get('/connexion')->assertOk();
        $this->actingAs($this->visitor)->get('/publier')->assertOk();
    }

    public function test_the_articles_stay_open_while_the_site_is_held(): void
    {
        // They carry no listings, and they are the one surface worth having
        // indexed before the doors open.
        $this->hold();

        $this->get('/articles')->assertOk();
    }

    // ── the clock ────────────────────────────────────────────────────────────

    public function test_the_state_endpoint_says_only_what_the_closed_page_says(): void
    {
        $this->hold(now()->addDays(3)->getTimestampMs());

        $this->getJson('/api/launch-state')
            ->assertOk()
            ->assertJsonStructure(['state', 'launchAt'])
            ->assertJsonPath('state', 'prelaunch')
            ->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_an_elapsed_timer_publishes_nothing_by_itself(): void
    {
        $this->hold(now()->subHour()->getTimestampMs());
        Listing::factory()->create(['status' => ListingStatus::PendingLaunch->value, 'approved_for_launch' => true]);

        // A clock that ran out while nobody was watching must not be the thing
        // that makes ads public.
        $this->assertTrue(Launch::current()->timerElapsed());
        $this->assertTrue(Launch::current()->isHeld());
        $this->get('/vente')->assertRedirectContains('/lancement');
        $this->assertSame(0, Listing::query()->where('status', ListingStatus::Published->value)->count());
    }

    // ── the switch ───────────────────────────────────────────────────────────

    public function test_the_screen_and_the_switch_need_launch_control(): void
    {
        $this->actingAs($this->moderator)->get('/admin/lancement')->assertForbidden();
        $this->actingAs($this->moderator)->post('/admin/lancement', ['confirm' => 'active'])->assertForbidden();
        $this->actingAs($this->admin)->get('/admin/lancement')->assertOk();
    }

    public function test_the_switch_is_typed_not_clicked(): void
    {
        $this->hold();

        $this->actingAs($this->admin)->post('/admin/lancement', ['confirm' => 'oui'])
            ->assertSessionHasErrors('confirm');

        $this->assertTrue(Launch::current()->isHeld());
    }

    public function test_the_switch_publishes_the_approved_and_requeues_the_rest(): void
    {
        $this->hold();

        $approved = Listing::factory()->create([
            'status' => ListingStatus::PendingLaunch->value,
            'approved_for_launch' => true,
            'published_at' => null,
        ]);
        // Held at creation, so it has never been published.
        $unapproved = Listing::factory()->create([
            'status' => ListingStatus::PendingLaunch->value,
            'approved_for_launch' => false,
            'published_at' => null,
        ]);

        $this->actingAs($this->admin)->post('/admin/lancement', ['confirm' => 'active'])
            ->assertSessionHasNoErrors();

        $this->assertSame(ListingStatus::Published->value, $approved->fresh()->status);
        $this->assertNotNull($approved->fresh()->published_at);

        // Never published unreviewed, and never lost. This is what makes an
        // unattended launch safe enough to put on a cron at all.
        $this->assertSame(ListingStatus::Pending->value, $unapproved->fresh()->status);
        $this->assertNull($unapproved->fresh()->published_at);
    }

    public function test_requeueing_does_not_erase_a_dateline_that_exists(): void
    {
        // The Next version nulled published_at on every requeued ad. Phase 5
        // settled the opposite rule for the same field on rejection, and it
        // holds here: `status` decides what is visible, `published_at` is a
        // historical fact about when an ad was first public. Erasing it would
        // shuffle a month-old ad back to the top of "الأحدث" the day somebody
        // re-approves it.
        $this->hold();
        $first = now()->subMonth();

        $listing = Listing::factory()->create([
            'status' => ListingStatus::PendingLaunch->value,
            'approved_for_launch' => false,
            'published_at' => $first,
        ]);

        $this->actingAs($this->admin)->post('/admin/lancement', ['confirm' => 'active']);

        $this->assertSame(ListingStatus::Pending->value, $listing->fresh()->status);
        $this->assertTrue($first->startOfSecond()->equalTo($listing->fresh()->published_at));

        $this->assertFalse(Launch::current()->isHeld());
        $this->assertNotNull(Launch::current()->launchedAt);
        $this->assertDatabaseHas('admin_audit', ['action' => 'launch.execute']);
    }

    public function test_a_released_ad_keeps_its_original_dateline(): void
    {
        // Published, held, released again — it must not jump to the top of
        // "الأحدث" as though it were new.
        $this->hold();
        $first = now()->subMonth();

        $listing = Listing::factory()->create([
            'status' => ListingStatus::PendingLaunch->value,
            'approved_for_launch' => true,
            'published_at' => $first,
        ]);

        $this->actingAs($this->admin)->post('/admin/lancement', ['confirm' => 'active']);

        $this->assertTrue($first->startOfSecond()->equalTo($listing->fresh()->published_at));
    }

    public function test_held_demands_are_released_without_an_approval_gate(): void
    {
        // A demand is text, and the link ban already covers what is worth
        // banning.
        $this->hold();

        $demand = PropertyRequest::create([
            'id' => 'req000000001', 'owner_uid' => $this->visitor->uid,
            'owner_name' => 'كريم', 'intent' => 'vente', 'title' => 'نشري شقة',
            'description' => 'x', 'wilaya_slug' => 'alger',
            'status' => 'pendingLaunch', 'created_at' => now(),
        ]);

        $this->actingAs($this->admin)->post('/admin/lancement', ['confirm' => 'active']);

        $this->assertSame('visible', $demand->fresh()->status);
    }

    public function test_opening_without_publishing_leaves_the_held_ads_alone(): void
    {
        $this->hold();
        $listing = Listing::factory()->create([
            'status' => ListingStatus::PendingLaunch->value,
            'approved_for_launch' => true,
        ]);

        $this->actingAs($this->admin)->post('/admin/lancement/etat', ['state' => 'active'])
            ->assertSessionHasNoErrors();

        $this->assertFalse(Launch::current()->isHeld());
        $this->assertSame(ListingStatus::PendingLaunch->value, $listing->fresh()->status);
    }

    public function test_the_timer_survives_a_state_change_and_the_reverse(): void
    {
        // The three fields live in one JSON row; writing one must not blank the
        // other two.
        $this->hold();

        $at = now()->addDays(5);
        $this->actingAs($this->admin)->post('/admin/lancement/compte-a-rebours', [
            'launch_at' => $at->format('Y-m-d\TH:i'),
        ])->assertSessionHasNoErrors();

        $this->assertNotNull(Launch::current()->launchAt);
        $this->assertTrue(Launch::current()->isHeld());

        $this->actingAs($this->admin)->post('/admin/lancement/etat', ['state' => 'prelaunch']);
        $this->assertNotNull(Launch::current()->launchAt);

        $this->actingAs($this->admin)->post('/admin/lancement/compte-a-rebours', ['launch_at' => null]);
        $this->assertNull(Launch::current()->launchAt);
        $this->assertTrue(Launch::current()->isHeld());
    }

    // ── the cron ─────────────────────────────────────────────────────────────

    public function test_the_cron_route_is_off_until_a_secret_is_configured(): void
    {
        // An automated launch that half-works is worse than one that plainly
        // does not.
        config(['taajir.cron_secret' => null]);
        $this->getJson('/api/cron/launch')->assertStatus(503);
    }

    public function test_the_cron_route_refuses_a_wrong_or_missing_token(): void
    {
        config(['taajir.cron_secret' => 'a-long-shared-secret']);
        $this->hold(now()->subHour()->getTimestampMs());

        $this->getJson('/api/cron/launch')->assertStatus(401);
        $this->getJson('/api/cron/launch', ['Authorization' => 'Bearer wrong'])->assertStatus(401);
        $this->assertTrue(Launch::current()->isHeld());
    }

    public function test_the_cron_waits_for_the_timer(): void
    {
        config(['taajir.cron_secret' => 'a-long-shared-secret']);
        $this->hold(now()->addDay()->getTimestampMs());

        $this->getJson('/api/cron/launch', ['Authorization' => 'Bearer a-long-shared-secret'])
            ->assertOk()
            ->assertJsonPath('skipped', 'timer has not elapsed');

        $this->assertTrue(Launch::current()->isHeld());
    }

    public function test_the_cron_launches_once_and_then_says_so(): void
    {
        config(['taajir.cron_secret' => 'a-long-shared-secret']);
        $this->hold(now()->subHour()->getTimestampMs());
        Listing::factory()->create([
            'status' => ListingStatus::PendingLaunch->value,
            'approved_for_launch' => true,
        ]);

        $this->getJson('/api/cron/launch', ['Authorization' => 'Bearer a-long-shared-secret'])
            ->assertOk()
            ->assertJsonPath('launched', true)
            ->assertJsonPath('published', 1);

        Launch::forget();

        $this->getJson('/api/cron/launch', ['Authorization' => 'Bearer a-long-shared-secret'])
            ->assertOk()
            ->assertJsonPath('skipped', 'already active');
    }

    public function test_the_cron_is_recorded_even_though_it_has_no_account(): void
    {
        // "The site opened and nobody is recorded as having opened it" is the
        // one line this log must never have.
        config(['taajir.cron_secret' => 'a-long-shared-secret']);
        $this->hold(now()->subHour()->getTimestampMs());

        $this->getJson('/api/cron/launch', ['Authorization' => 'Bearer a-long-shared-secret']);

        $this->assertDatabaseHas('admin_audit', ['action' => 'launch.execute', 'actor_uid' => 'cron']);
    }

    // ── the announcement ─────────────────────────────────────────────────────

    public function test_the_launch_queues_one_row_per_reachable_address(): void
    {
        $this->hold();

        $verified = User::factory()->create(['email' => 'a@example.dz', 'email_verified' => true, 'phone' => '0550112233']);
        $unverified = User::factory()->create(['email' => 'b@example.dz', 'email_verified' => false, 'phone' => null]);
        $banned = User::factory()->create(['email' => 'c@example.dz', 'email_verified' => true, 'is_banned' => true]);

        $this->actingAs($this->admin)->post('/admin/lancement', ['confirm' => 'active']);

        $rows = OutboxEntry::query()->get()->groupBy('uid');

        // Verified addresses only: users.email is a column full of claims, and
        // a launch blast to it is unsolicited mail from our own domain on the
        // day its reputation matters most.
        $this->assertEqualsCanonicalizing(['email', 'sms', 'push'], $rows[$verified->uid]->pluck('channel')->all());
        $this->assertSame(['push'], $rows[$unverified->uid]->pluck('channel')->all());
        $this->assertArrayNotHasKey($banned->uid, $rows->all());

        $this->assertSame('queued', OutboxEntry::query()->value('status'));
    }

    public function test_nothing_is_actually_sent(): void
    {
        // Not an omission: a push needs a Firebase service-account credential
        // on the host, which is the one secret this port keeps off it.
        $this->assertSame(
            ['email' => false, 'sms' => false, 'push' => false],
            Outbox::readiness(),
        );
    }

    public function test_the_broadcast_screen_needs_its_own_permission(): void
    {
        $this->actingAs($this->moderator)->get('/admin/notifications')->assertForbidden();
        $this->actingAs($this->admin)->get('/admin/notifications')->assertOk();
    }

    public function test_a_broadcast_refuses_to_carry_anyone_off_the_site(): void
    {
        foreach (['https://evil.dz', '//evil.dz', 'javascript:alert(1)'] as $url) {
            $this->actingAs($this->admin)->post('/admin/notifications', [
                'title' => 'إعلانات جديدة', 'body' => 'شوف الجديد في باب الزوار', 'url' => $url,
            ])->assertSessionHasErrors('url');
        }

        $this->assertSame(0, OutboxEntry::query()->count());
    }

    public function test_a_broadcast_queues_a_row_per_address(): void
    {
        User::factory()->create(['email' => 'a@example.dz', 'email_verified' => true]);

        $this->actingAs($this->admin)->post('/admin/notifications', [
            'title' => 'إعلانات جديدة',
            'body' => 'شوف الجديد في باب الزوار',
            'url' => '/vente/appartement/alger',
        ])->assertSessionHasNoErrors();

        $this->assertGreaterThan(0, OutboxEntry::query()->where('title', 'إعلانات جديدة')->count());
        $this->assertDatabaseHas('admin_audit', ['action' => 'broadcast.queue']);
    }

    public function test_a_permission_holder_alone_can_work_each_screen(): void
    {
        DB::table('roles')->insert([['id' => 'launcher', 'label' => 'Launcher', 'builtin' => false]]);
        DB::table('role_permissions')->insert([['role_id' => 'launcher', 'permission' => 'launch.control']]);
        Permissions::forget();

        $launcher = User::factory()->create(['role_id' => 'launcher']);

        $this->actingAs($launcher)->get('/admin/lancement')->assertOk();
        $this->actingAs($launcher)->get('/admin/notifications')->assertForbidden();
    }
}
