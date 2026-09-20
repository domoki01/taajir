<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\Setting;
use App\Models\User;
use App\Services\Geo;
use App\Services\Launch;
use App\Services\ListingService;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

final class ListingWriteTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();
        $this->owner = User::factory()->create(['listing_quota' => 2]);
    }

    /** @return array<string, mixed> */
    private function input(array $overrides = []): array
    {
        return array_merge([
            'title' => 'شقة F3 في باب الزوار قرب الترامواي',
            'description' => 'شقة في الطابق الثالث، مساحة 90 متر مربع، عقد موثق، قريبة من كل المرافق.',
            'transaction_type' => 'vente',
            'property_type' => 'appartement',
            'wilaya' => 'alger',
            'commune' => 'bab-ezzouar',
            'price' => 8_000_000,
            'price_unit' => 'total',
            'rooms_code' => 'F3',
        ], $overrides);
    }

    protected function tearDown(): void
    {
        Launch::forget();
        parent::tearDown();
    }

    private function service(): ListingService
    {
        return app(ListingService::class);
    }

    public function test_a_clean_ad_publishes_itself(): void
    {
        $listing = $this->service()->create($this->owner, $this->input());

        $this->assertSame(ListingStatus::Published->value, $listing->status);
        $this->assertNotNull($listing->published_at);
        $this->assertNull($listing->policy_rule);
    }

    public function test_derived_fields_are_computed_not_accepted(): void
    {
        $listing = $this->service()->create($this->owner, $this->input());

        // The slug is built from the structured fields, never from the Arabic
        // title — "bya-chqa-fy-bjaya" is a string nobody types or reads.
        $this->assertSame('vente-appartement-f3-bab-ezzouar', $listing->slug);
        $this->assertSame($this->owner->display_name, $listing->owner_name);
        $this->assertSame(16, $listing->wilaya_code);
        // The same fold the search query uses, or nothing matches.
        $this->assertStringContainsString('bab-ezzouar', $listing->search_text);
    }

    public function test_the_quota_is_enforced_and_counts_pending_ads(): void
    {
        $this->service()->create($this->owner, $this->input());
        $this->service()->create($this->owner, $this->input());

        $this->assertSame(2, $this->owner->fresh()->active_listing_count);

        // A quota that only counted live ads would let someone queue fifty.
        $this->expectException(ValidationException::class);
        $this->service()->create($this->owner, $this->input());
    }

    public function test_a_banned_account_cannot_publish(): void
    {
        $this->owner->update(['is_banned' => true]);

        $this->expectException(ValidationException::class);
        $this->service()->create($this->owner, $this->input());
    }

    public function test_an_unapproved_account_is_held_only_when_the_switch_is_on(): void
    {
        $this->owner->update(['approved' => false]);

        // Off by default: requiring approval is a decision, so it takes one.
        $this->assertNotNull($this->service()->create($this->owner, $this->input()));

        Setting::create(['key' => 'access', 'value' => ['requireApproval' => true]]);

        $this->expectException(ValidationException::class);
        $this->service()->create($this->owner, $this->input());
    }

    public function test_a_refused_ad_never_reaches_the_database(): void
    {
        // Nothing is stored, so nothing has to be cleaned up — and the quota is
        // untouched, because a refusal is not a listing.
        try {
            $this->service()->create($this->owner, $this->input([
                'description' => 'تواصل معايا على example.com للتفاصيل الكاملة.',
            ]));
            $this->fail('a link should have been refused');
        } catch (ValidationException) {
            //
        }

        $this->assertSame(0, Listing::count());
        $this->assertSame(0, $this->owner->fresh()->active_listing_count);
    }

    public function test_a_flagged_ad_is_queued_with_the_rule_that_flagged_it(): void
    {
        // So a moderator opens it already knowing what bothered the check.
        $listing = $this->service()->create($this->owner, $this->input([
            'description' => 'نوفرو تاشيرة شنغن وعقد عمل لكل من يهمه الأمر في هذا العقار.',
        ]));

        $this->assertSame(ListingStatus::Pending->value, $listing->status);
        $this->assertSame('offtopic', $listing->policy_rule);
        $this->assertNull($listing->published_at);
        // Queued still counts against the quota.
        $this->assertSame(1, $this->owner->fresh()->active_listing_count);
    }

    public function test_the_launch_hold_wins_over_a_clean_verdict(): void
    {
        // `state`, which is what the Firestore export carries and what the
        // admin screen writes. Launch memoises per request, so a test that
        // writes the row has to say so.
        Setting::create(['key' => 'launch', 'value' => ['state' => Launch::PRELAUNCH]]);
        Launch::forget();

        $listing = $this->service()->create($this->owner, $this->input());

        $this->assertSame(ListingStatus::PendingLaunch->value, $listing->status);
        // Approved-during-the-hold is a separate flag: reusing `published`
        // would put the ad on the site the moment a moderator clicked.
        $this->assertFalse($listing->approved_for_launch);
    }

    public function test_the_price_is_stored_as_whole_dinars(): void
    {
        $listing = $this->service()->create($this->owner, $this->input(['price' => 8_000_000]));

        $this->assertSame(8_000_000, $listing->price);
        $this->assertSame('800 مليون', $listing->formattedPrice());
    }

    // ── through the HTTP form ────────────────────────────────────────────────

    public function test_the_form_needs_an_account(): void
    {
        $this->get('/publier')->assertRedirectContains('/connexion');
        $this->post('/publier', $this->input())->assertRedirectContains('/connexion');
    }

    public function test_posting_the_form_creates_the_ad_and_lands_on_thanks(): void
    {
        $response = $this->actingAs($this->owner)->post('/publier', $this->input());

        $listing = Listing::firstOrFail();
        $response->assertRedirect('/merci?a='.$listing->id);

        $this->actingAs($this->owner)->get('/merci?a='.$listing->id)
            ->assertOk()
            ->assertSee(__('listing.thanks_published'));
    }

    public function test_the_thanks_page_does_not_show_someone_elses_ad(): void
    {
        $other = Listing::factory()->create();

        $this->actingAs($this->owner)->get('/merci?a='.$other->id)->assertNotFound();
    }

    public function test_a_commune_is_validated_against_its_wilaya(): void
    {
        // Several wilayas share a commune slug, so this cannot be a plain
        // exists rule.
        $this->actingAs($this->owner)
            ->post('/publier', $this->input(['wilaya' => 'oran', 'commune' => 'bab-ezzouar']))
            ->assertSessionHasErrors('commune');
    }

    public function test_a_category_that_is_not_in_the_taxonomy_is_refused(): void
    {
        $this->actingAs($this->owner)
            ->post('/publier', $this->input(['property_type' => 'chateau']))
            ->assertSessionHasErrors('property_type');
    }

    public function test_a_missing_price_is_refused_unless_it_is_on_request(): void
    {
        // Zero is "ask me", and storing it would put "0 دج" on the card.
        $this->actingAs($this->owner)
            ->post('/publier', $this->input(['price' => 0]))
            ->assertSessionHasErrors('price');

        $this->actingAs($this->owner)
            ->post('/publier', $this->input(['price' => 0, 'price_on_request' => '1']))
            ->assertSessionHasNoErrors();
    }

    public function test_the_commune_endpoint_answers_for_a_real_wilaya_only(): void
    {
        $this->getJson('/api/communes/alger')->assertOk()->assertJsonStructure([['slug', 'name']]);
        $this->getJson('/api/communes/pas-une-wilaya')->assertNotFound();
    }
}
