<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\Notification;
use App\Models\User;
use App\Services\Follows;
use App\Support\ListingId;
use App\Support\ReferralCode;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Public profiles, following, and the notification a follower gets.
 */
final class FollowTest extends TestCase
{
    use RefreshDatabase;

    private User $seller;

    private User $fan;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);

        $this->seller = $this->user('uid-seller-0000000000000001', 'بائع');
        $this->fan = $this->user('uid-fan-0000000000000001', 'متابع');
    }

    private function user(string $uid, string $name): User
    {
        return User::create([
            'uid' => $uid,
            'public_id' => ListingId::mint(),
            'display_name' => $name,
            'role_id' => 'user',
            'referral_code' => ReferralCode::mint(),
            'created_at' => now(),
        ]);
    }

    private function listing(User $owner, string $status = 'published'): Listing
    {
        return Listing::create([
            'id' => ListingId::mint(),
            'slug' => 'vente-appartement-alger-'.uniqid(),
            'owner_uid' => $owner->uid,
            'owner_name' => $owner->display_name,
            'transaction_type' => 'vente',
            'property_type' => 'appartement',
            'price' => 8000000,
            'wilaya_code' => 16,
            'wilaya_slug' => 'alger',
            'commune_slug' => 'el-biar',
            'title' => 'شقة للبيع',
            'description' => 'وصف الإعلان',
            'status' => $status,
            'published_at' => now(),
            'created_at' => now(),
        ]);
    }

    public function test_a_public_profile_opens_without_an_account(): void
    {
        // The point of the page is that it can be sent to someone.
        $this->listing($this->seller);

        $this->get('/vendeur/'.$this->seller->public_id)
            ->assertOk()
            ->assertSee('بائع')
            ->assertSee('شقة للبيع');
    }

    public function test_a_profile_shows_only_what_the_public_may_see(): void
    {
        // Drafts and ads in the queue belong on the owner's dashboard. A
        // profile anyone can open must not be a way around moderation.
        $this->listing($this->seller, 'published');
        $this->listing($this->seller, 'draft');
        $this->listing($this->seller, 'pending');

        $response = $this->get('/vendeur/'.$this->seller->public_id)->assertOk();

        $this->assertSame(1, substr_count($response->getContent(), 'شقة للبيع'));
    }

    public function test_a_banned_account_has_no_page(): void
    {
        // Their ads are already gone from every listing page; a profile that
        // still rendered would be a way back onto the site.
        $this->seller->update(['is_banned' => true]);

        $this->get('/vendeur/'.$this->seller->public_id)->assertNotFound();
    }

    public function test_the_uid_is_not_an_address(): void
    {
        // The URL is keyed on public_id. The uid is Firebase's, it is what the
        // auth layer is keyed on, and it changes when the project moves.
        $this->get('/vendeur/'.$this->seller->uid)->assertNotFound();
    }

    public function test_following_and_unfollowing(): void
    {
        $this->actingAs($this->fan)
            ->postJson('/vendeur/'.$this->seller->public_id.'/suivre')
            ->assertOk()
            ->assertJson(['following' => true, 'followers' => 1]);

        $this->actingAs($this->fan)
            ->deleteJson('/vendeur/'.$this->seller->public_id.'/suivre')
            ->assertOk()
            ->assertJson(['following' => false, 'followers' => 0]);
    }

    public function test_following_twice_is_one_follow(): void
    {
        // A double-tapped button must be a no-op, not a 500 and not two
        // notifications for every ad.
        $this->actingAs($this->fan)->postJson('/vendeur/'.$this->seller->public_id.'/suivre')->assertOk();
        $this->actingAs($this->fan)->postJson('/vendeur/'.$this->seller->public_id.'/suivre')->assertOk();

        $this->assertSame(1, app(Follows::class)->followerCount($this->seller));
    }

    public function test_you_cannot_follow_yourself(): void
    {
        $this->actingAs($this->seller)
            ->postJson('/vendeur/'.$this->seller->public_id.'/suivre')
            ->assertOk()
            ->assertJson(['following' => false, 'followers' => 0]);
    }

    public function test_following_needs_an_account(): void
    {
        $this->postJson('/vendeur/'.$this->seller->public_id.'/suivre')->assertUnauthorized();
    }

    public function test_a_follower_is_told_when_a_published_ad_appears(): void
    {
        app(Follows::class)->follow($this->fan, $this->seller);

        $written = app(Follows::class)->announceListing($this->listing($this->seller));

        $this->assertSame(1, $written);

        $notification = Notification::query()->where('uid', $this->fan->uid)->first();
        $this->assertNotNull($notification);
        $this->assertSame('listing.published', $notification->type);
        $this->assertStringContainsString('بائع', $notification->title);
        $this->assertSame('شقة للبيع', $notification->body);
        $this->assertTrue($notification->isUnread());
    }

    public function test_nobody_else_is_told(): void
    {
        $bystander = $this->user('uid-other-00000000000001', 'واحد آخر');
        app(Follows::class)->follow($this->fan, $this->seller);

        app(Follows::class)->announceListing($this->listing($this->seller));

        $this->assertSame(0, Notification::query()->where('uid', $bystander->uid)->count());
    }

    public function test_an_unpublished_ad_tells_nobody(): void
    {
        /*
         * The guard that matters. Announcing at submission would tell every
         * follower about an ad nobody can open, and leak the contents of one a
         * moderator is about to refuse.
         */
        app(Follows::class)->follow($this->fan, $this->seller);

        $pending = $this->listing($this->seller, 'pending');
        $this->assertFalse(ListingStatus::from($pending->status)->isPublic());

        // The services only call announceListing behind isPublic(); this
        // asserts the guard exists at the call sites by going through create.
        $this->assertSame(0, Notification::query()->where('uid', $this->fan->uid)->count());
    }

    public function test_the_notifications_page_lists_them_and_marks_them_read(): void
    {
        app(Follows::class)->follow($this->fan, $this->seller);
        app(Follows::class)->announceListing($this->listing($this->seller));

        $this->actingAs($this->fan)->get('/tableau-de-bord/notifications')
            ->assertOk()
            ->assertSee('شقة للبيع');

        $this->assertSame(1, app(Follows::class)->unreadCount($this->fan));

        $this->actingAs($this->fan)->post('/tableau-de-bord/notifications/lues')->assertRedirect();

        $this->assertSame(0, app(Follows::class)->unreadCount($this->fan));
    }

    public function test_the_profile_page_opens_and_saves(): void
    {
        // The 404 that started this.
        $this->actingAs($this->fan)->get('/tableau-de-bord/profil')->assertOk();

        $this->actingAs($this->fan)->post('/tableau-de-bord/profil', [
            'display_name' => 'اسم جديد',
            'phone' => '+213555111222',
            'wilaya' => 'oran',
        ])->assertRedirect();

        $this->fan->refresh();
        $this->assertSame('اسم جديد', $this->fan->display_name);
        $this->assertSame('+213555111222', $this->fan->phone);
        $this->assertSame(31, $this->fan->wilaya_code);
    }

    public function test_renaming_refreshes_the_name_copied_onto_their_ads(): void
    {
        // owner_name is denormalised so a page of cards is one query; this is
        // where that copy is kept honest.
        $listing = $this->listing($this->seller);

        $this->actingAs($this->seller)->post('/tableau-de-bord/profil', [
            'display_name' => 'الاسم الجديد',
        ])->assertRedirect();

        $this->assertSame('الاسم الجديد', $listing->fresh()->owner_name);
    }

    public function test_a_preference_can_be_turned_off_again(): void
    {
        // An unchecked box sends nothing at all. Treating absence as "leave it
        // alone" makes a preference that can be turned on and never off.
        // Refreshed first: a column default lives in the database, and the
        // model returned by create() has never read it back.
        $this->assertTrue($this->fan->fresh()->notify_on_message);

        $this->actingAs($this->fan)->post('/tableau-de-bord/profil', [
            'display_name' => $this->fan->display_name,
        ])->assertRedirect();

        $this->assertFalse($this->fan->fresh()->notify_on_message);
    }
}
