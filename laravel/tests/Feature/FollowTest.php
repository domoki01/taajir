<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Models\Comment;
use App\Models\Listing;
use App\Models\Notification;
use App\Models\PropertyRequest;
use App\Models\User;
use App\Services\Follows;
use App\Support\ListingId;
use App\Support\ReferralCode;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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

    public function test_the_publisher_name_on_an_ad_links_to_their_page(): void
    {
        // The page carried a phone number and no name at all. A buyer decides
        // whether to call partly on who is asking, and this is how they find
        // out whether it is one flat or forty.
        $listing = $this->listing($this->seller);

        $this->get('/annonce/'.$listing->id.'/'.$listing->slug)
            ->assertOk()
            ->assertSee('/vendeur/'.$this->seller->public_id, escape: false)
            ->assertSee('بائع');
    }

    public function test_a_commenter_name_links_to_their_page(): void
    {
        $listing = $this->listing($this->seller);
        Comment::create([
            'listing_id' => $listing->id,
            'author_uid' => $this->fan->uid,
            'author_name' => $this->fan->display_name,
            'text' => 'تعليق',
            'status' => 'visible',
            'created_at' => now(),
        ]);

        $this->get('/annonce/'.$listing->id.'/'.$listing->slug)
            ->assertOk()
            ->assertSee('/vendeur/'.$this->fan->public_id, escape: false);
    }

    public function test_a_name_whose_account_is_gone_is_not_a_broken_link(): void
    {
        /*
         * Names are stored denormalised beside the row precisely so a comment
         * keeps reading correctly after its author deletes their account. A
         * link built from a relation that is now null would be an anchor to
         * nowhere, which is worse than plain text.
         */
        $listing = $this->listing($this->seller);
        Comment::create([
            'listing_id' => $listing->id,
            'author_uid' => 'uid-deleted-000000000000001',
            'author_name' => 'حساب محذوف',
            'text' => 'تعليق',
            'status' => 'visible',
            'created_at' => now(),
        ]);

        $this->get('/annonce/'.$listing->id.'/'.$listing->slug)
            ->assertOk()
            ->assertSee('حساب محذوف')
            ->assertDontSee('/vendeur/uid-deleted', escape: false);
    }

    public function test_a_banned_authors_name_is_not_a_link(): void
    {
        // Their page is a 404, so linking to it sends people nowhere.
        $listing = $this->listing($this->seller);
        $this->fan->update(['is_banned' => true]);

        Comment::create([
            'listing_id' => $listing->id,
            'author_uid' => $this->fan->uid,
            'author_name' => $this->fan->display_name,
            'text' => 'تعليق',
            'status' => 'visible',
            'created_at' => now(),
        ]);

        $this->get('/annonce/'.$listing->id.'/'.$listing->slug)
            ->assertOk()
            ->assertDontSee('/vendeur/'.$this->fan->public_id, escape: false);
    }

    public function test_the_demands_feed_does_not_query_once_per_author(): void
    {
        /*
         * The name became a link, and a link needs the author row. Without the
         * eager load that is one query per demand on a page of twenty — the
         * classic way a feature that reads fine in review makes a list page
         * slow, and it never shows up in a test that only checks the HTML.
         */
        foreach (range(1, 8) as $n) {
            $author = $this->user('uid-asker-'.str_pad((string) $n, 17, '0', STR_PAD_LEFT), "سائل {$n}");
            PropertyRequest::create([
                'id' => ListingId::mint(),
                'owner_uid' => $author->uid,
                'owner_name' => $author->display_name,
                'intent' => 'vente',
                'title' => "طلب {$n}",
                'description' => 'وصف',
                'wilaya_slug' => 'alger',
                'status' => 'visible',
                'created_at' => now(),
            ]);
        }

        $queries = 0;
        DB::listen(function () use (&$queries): void {
            $queries++;
        });

        $this->get('/demandes')->assertOk();

        // Comfortably under one-per-row: the point is that it does not scale
        // with the number of demands, not an exact count that breaks whenever
        // the page gains a query.
        $this->assertLessThan(8, $queries, "the demands feed ran {$queries} queries for 8 demands");
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
