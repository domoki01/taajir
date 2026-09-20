<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Comment;
use App\Models\Listing;
use App\Models\SavedSearch;
use App\Models\User;
use App\Services\CommentService;
use App\Services\Geo;
use App\Services\RequestService;
use App\Services\SavedSearchService;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

final class CommunityTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();
        RateLimiter::clear('comment:');
        $this->user = User::factory()->create();
    }

    // ── comments ─────────────────────────────────────────────────────────────

    public function test_a_comment_takes_its_author_from_the_session_not_the_request(): void
    {
        // Otherwise anyone could post as "وكالة موثّقة" and borrow its credibility.
        $listing = Listing::factory()->create();

        $this->actingAs($this->user)
            ->post('/annonce/'.$listing->id.'/commentaires', [
                'text' => 'واش هو الطابق؟',
                'author_name' => 'وكالة موثّقة',
            ])->assertRedirect();

        $this->assertSame($this->user->display_name, Comment::firstOrFail()->author_name);
    }

    public function test_the_ads_own_author_is_badged(): void
    {
        $listing = Listing::factory()->create(['owner_uid' => $this->user->uid]);

        app(CommentService::class)->create($this->user, $listing, 'الطابق الثالث');

        $this->assertTrue(Comment::firstOrFail()->is_owner);
    }

    public function test_comments_are_rate_limited(): void
    {
        $listing = Listing::factory()->create();
        $service = app(CommentService::class);

        for ($i = 0; $i < 8; $i++) {
            $service->create($this->user, $listing, "تعليق رقم {$i}");
        }

        $this->expectException(ValidationException::class);
        $service->create($this->user, $listing, 'واحد زائد');
    }

    public function test_a_comment_with_a_link_is_refused_not_stripped(): void
    {
        // Silently editing what someone wrote is worse than telling them why.
        $listing = Listing::factory()->create();

        $this->expectException(ValidationException::class);
        app(CommentService::class)->create($this->user, $listing, 'شوف example.com');
    }

    public function test_only_the_author_or_a_moderator_may_remove_a_comment(): void
    {
        $listing = Listing::factory()->create();
        $comment = app(CommentService::class)->create($this->user, $listing, 'سؤال');
        $stranger = User::factory()->create();

        $this->actingAs($stranger)->delete('/commentaires/'.$comment->id)->assertForbidden();
        $this->assertSame(1, Comment::count());

        $this->actingAs($this->user)->delete('/commentaires/'.$comment->id)->assertRedirect();
        $this->assertSame(0, Comment::count());
    }

    public function test_hiding_keeps_the_row_and_its_author_can_still_read_it(): void
    {
        // Deleting would lose the evidence of what was said.
        $listing = Listing::factory()->create();
        $comment = app(CommentService::class)->create($this->user, $listing, 'كلام');
        $moderator = User::factory()->create(['role_id' => 'moderator']);

        app(CommentService::class)->hide($moderator, $comment, 'خارج الموضوع');

        $comment->refresh();
        $this->assertSame('hidden', $comment->status);
        $this->assertTrue($comment->visibleTo($this->user));
        $this->assertTrue($comment->visibleTo($moderator));
        $this->assertFalse($comment->visibleTo(User::factory()->create()));
    }

    public function test_a_comment_cannot_be_left_on_an_unpublished_ad(): void
    {
        // Commenting on a held ad would leak that it exists.
        $listing = Listing::factory()->pending()->create();

        $this->actingAs($this->user)
            ->post('/annonce/'.$listing->id.'/commentaires', ['text' => 'سؤال'])
            ->assertNotFound();
    }

    // ── requests ─────────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    private function requestInput(array $overrides = []): array
    {
        return array_merge([
            'intent' => 'vente',
            'title' => 'نشري شقة F3 في باب الزوار',
            'description' => 'نحوس على شقة في الطابق الثاني أو الثالث، بعقد موثق، والميزانية محدودة.',
            'wilaya' => 'alger',
            'commune' => 'bab-ezzouar',
        ], $overrides);
    }

    public function test_a_demand_is_capped_so_one_person_cannot_own_the_feed(): void
    {
        $service = app(RequestService::class);

        for ($i = 0; $i < config('taajir.max_open_requests'); $i++) {
            RateLimiter::clear('request:'.$this->user->uid);
            $service->create($this->user, $this->requestInput());
        }

        RateLimiter::clear('request:'.$this->user->uid);
        $this->expectException(ValidationException::class);
        $service->create($this->user, $this->requestInput());
    }

    public function test_a_demand_goes_through_the_same_policy_check(): void
    {
        $this->expectException(ValidationException::class);

        app(RequestService::class)->create($this->user, $this->requestInput([
            'description' => 'الدفع عبر بيتكوين برك، وراني برّا البلاد.',
        ]));
    }

    public function test_a_reply_may_only_attach_the_authors_own_published_ad(): void
    {
        // Attaching someone else's would let anyone advertise an ad they do not
        // control on a thread full of ready buyers.
        $request = app(RequestService::class)->create($this->user, $this->requestInput());
        $stranger = User::factory()->create();
        $theirs = Listing::factory()->create();

        $this->expectException(ValidationException::class);
        app(RequestService::class)->reply($stranger, $request, 'عندي هذي', $theirs->id);
    }

    public function test_a_reply_with_its_own_ad_is_accepted_and_counted(): void
    {
        $request = app(RequestService::class)->create($this->user, $this->requestInput());
        $responder = User::factory()->create();
        $mine = Listing::factory()->create(['owner_uid' => $responder->uid]);

        app(RequestService::class)->reply($responder, $request, 'شوف هذي', $mine->id);

        $this->assertSame(1, $request->fresh()->reply_count);
    }

    public function test_a_queued_demand_stays_readable_to_its_author_only(): void
    {
        // Nobody should be left wondering where their post went.
        $request = app(RequestService::class)->create($this->user, $this->requestInput([
            'description' => 'نحوس على شقة، ونوفر تاشيرة شنغن وعقد عمل لمن يهمه الأمر هنا.',
        ]));

        $this->assertSame('pending', $request->status);
        $this->actingAs($this->user)->get($request->path())->assertOk();
        $this->actingAs(User::factory()->create())->get($request->path())->assertNotFound();
        $this->get('/demandes')->assertOk()->assertDontSee($request->title);
    }

    // ── saved searches ───────────────────────────────────────────────────────

    public function test_saved_searches_are_capped_and_labelled_server_side(): void
    {
        $service = app(SavedSearchService::class);
        $max = config('taajir.max_saved_searches');

        for ($i = 0; $i < $max; $i++) {
            $service->create($this->user, ['wilaya' => 'alger', 'type' => 'appartement']);
        }

        // The label is built here so the list and the push cannot drift apart.
        $this->assertStringContainsString('شقة', SavedSearch::first()->label);

        $this->expectException(ValidationException::class);
        $service->create($this->user, ['wilaya' => 'oran']);
    }

    public function test_a_search_without_a_place_is_refused(): void
    {
        // It would match every ad on the platform and turn the alert into spam.
        $this->actingAs($this->user)
            ->post('/tableau-de-bord/alertes', ['type' => 'appartement'])
            ->assertSessionHasErrors('wilaya');
    }

    public function test_nobody_can_delete_someone_elses_alert(): void
    {
        $search = app(SavedSearchService::class)->create($this->user, ['wilaya' => 'alger']);

        $this->actingAs(User::factory()->create())
            ->delete('/tableau-de-bord/alertes/'.$search->id)
            ->assertForbidden();

        $this->assertSame(1, SavedSearch::count());
    }

    public function test_the_dashboard_shows_a_rejected_ad_with_its_reason(): void
    {
        // An owner who cannot see why posts the same thing again.
        Listing::factory()->create([
            'owner_uid' => $this->user->uid,
            'status' => 'rejected',
            'rejection_reason' => 'الصور ماشي تاع العقار',
        ]);

        $this->actingAs($this->user)->get('/tableau-de-bord/annonces')
            ->assertOk()
            ->assertSee('الصور ماشي تاع العقار');
    }
}
