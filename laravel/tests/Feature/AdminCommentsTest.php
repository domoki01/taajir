<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Article;
use App\Models\ArticleComment;
use App\Models\Comment;
use App\Models\Listing;
use App\Models\PropertyRequest;
use App\Models\User;
use App\Services\Geo;
use App\Services\Permissions;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Comment moderation across both threads, and the demand queue beside the ad
 * queue — the two permissions that had nothing behind them until now.
 */
final class AdminCommentsTest extends TestCase
{
    use RefreshDatabase;

    private User $moderator;

    private User $demandsOnly;

    private User $member;

    private Listing $listing;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();

        // A role holding requests.moderate and nothing else: the only account
        // for whom "half the screen" is the whole screen.
        DB::table('roles')->insert([['id' => 'demands', 'label' => 'Demands', 'builtin' => false]]);
        DB::table('role_permissions')->insert([['role_id' => 'demands', 'permission' => 'requests.moderate']]);
        Permissions::forget();

        $this->moderator = User::factory()->create(['role_id' => 'moderator']);
        $this->demandsOnly = User::factory()->create(['role_id' => 'demands']);
        $this->member = User::factory()->create(['role_id' => 'user']);
        $this->listing = Listing::factory()->create();
    }

    private function comment(array $overrides = []): Comment
    {
        return Comment::create([
            'listing_id' => $this->listing->id,
            'author_uid' => $this->member->uid,
            'author_name' => $this->member->display_name,
            'text' => 'تعليق على الإعلان',
            'status' => 'visible',
            'created_at' => now(),
            ...$overrides,
        ]);
    }

    private function demand(array $overrides = []): PropertyRequest
    {
        return PropertyRequest::create([
            'id' => 'req000000001',
            'owner_uid' => $this->member->uid,
            'owner_name' => $this->member->display_name,
            'intent' => 'vente',
            'title' => 'نشري شقة F3 في باب الزوار',
            'description' => 'نحوس على شقة في باب الزوار، ميزانية 900 مليون.',
            'wilaya_slug' => 'alger',
            'status' => 'pending',
            'created_at' => now(),
            ...$overrides,
        ]);
    }

    public function test_the_screen_needs_comments_moderate(): void
    {
        $this->actingAs($this->member)->get('/admin/commentaires')->assertForbidden();
        $this->actingAs($this->moderator)->get('/admin/commentaires')->assertOk();
    }

    public function test_hiding_keeps_the_row_and_showing_clears_the_reason(): void
    {
        $comment = $this->comment();

        $this->actingAs($this->moderator)
            ->post("/admin/commentaires/annonces/{$comment->id}/masquer", ['reason' => 'خارج الموضوع'])
            ->assertSessionHasNoErrors();

        $hidden = $comment->fresh();
        $this->assertSame('hidden', $hidden->status);
        $this->assertSame('خارج الموضوع', $hidden->hidden_reason);

        // A decision that stays reviewable is the point; so is being able to
        // reverse it.
        $this->actingAs($this->moderator)->post("/admin/commentaires/annonces/{$comment->id}/afficher");
        $shown = $comment->fresh();
        $this->assertSame('visible', $shown->status);
        $this->assertNull($shown->hidden_reason);
    }

    public function test_deleting_is_final_and_logged(): void
    {
        $comment = $this->comment();

        $this->actingAs($this->moderator)->delete("/admin/commentaires/annonces/{$comment->id}")
            ->assertSessionHasNoErrors();

        $this->assertNull($comment->fresh());
        $this->assertDatabaseHas('admin_audit', ['action' => 'comment.delete', 'target_type' => 'comment']);
    }

    public function test_article_comments_are_moderated_from_the_same_screen(): void
    {
        $article = Article::factory()->create(['slug' => 'ouvert', 'comment_count' => 1]);
        $comment = $article->comments()->create([
            'author_uid' => $this->member->uid,
            'author_name' => $this->member->display_name,
            'text' => 'تعليق على المقال',
            'created_at' => now(),
        ]);

        $this->actingAs($this->moderator)->get('/admin/commentaires')
            ->assertSee('تعليق على المقال', false);

        $this->actingAs($this->moderator)
            ->post("/admin/commentaires/articles/{$comment->id}/masquer", ['reason' => 'سبّة'])
            ->assertSessionHasNoErrors();

        $this->assertSame('hidden', $comment->fresh()->status);

        $this->actingAs($this->moderator)->delete("/admin/commentaires/articles/{$comment->id}");
        $this->assertSame(0, ArticleComment::query()->count());
        $this->assertSame(0, $article->fresh()->comment_count);
    }

    public function test_a_member_cannot_reach_the_moderation_actions(): void
    {
        $comment = $this->comment();

        $this->actingAs($this->member)
            ->post("/admin/commentaires/annonces/{$comment->id}/masquer", ['reason' => 'x'])
            ->assertForbidden();

        $this->assertSame('visible', $comment->fresh()->status);
    }

    public function test_requests_moderate_opens_the_queue_on_its_own(): void
    {
        $this->demand();

        // Otherwise the permission gates nothing anybody can get to: the ad
        // queue is behind listings.moderate, which this role does not hold.
        $this->actingAs($this->demandsOnly)->get('/admin/moderation')
            ->assertOk()
            ->assertSee('نشري شقة F3 في باب الزوار', false)
            // Half the screen, not all of it.
            ->assertDontSee(__('admin.queue_empty'));
    }

    public function test_listings_moderate_does_not_carry_requests_moderate(): void
    {
        DB::table('role_permissions')->where('role_id', 'moderator')
            ->where('permission', 'requests.moderate')->delete();
        Permissions::forget();

        $demand = $this->demand();

        $this->actingAs($this->moderator)->get('/admin/moderation')
            ->assertOk()
            ->assertDontSee('نشري شقة F3 في باب الزوار', false);

        $this->actingAs($this->moderator)
            ->post("/admin/moderation/demandes/{$demand->id}", ['status' => 'visible'])
            ->assertForbidden();
    }

    public function test_a_demand_is_approved_or_refused_with_a_reason(): void
    {
        $demand = $this->demand();

        $this->actingAs($this->demandsOnly)
            ->post("/admin/moderation/demandes/{$demand->id}", ['status' => 'rejected'])
            ->assertSessionHasErrors('reason');

        $this->assertSame('pending', $demand->fresh()->status);

        $this->actingAs($this->demandsOnly)
            ->post("/admin/moderation/demandes/{$demand->id}", ['status' => 'rejected', 'reason' => 'رقم هاتف في النص'])
            ->assertSessionHasNoErrors();

        $refused = $demand->fresh();
        $this->assertSame('rejected', $refused->status);
        $this->assertSame('رقم هاتف في النص', $refused->rejection_reason);
        $this->assertSame($this->demandsOnly->uid, $refused->moderated_by);

        $this->assertDatabaseHas('admin_audit', ['action' => 'request.rejected']);
    }

    public function test_an_approved_demand_appears_in_the_feed(): void
    {
        $demand = $this->demand();

        $this->get('/demandes')->assertDontSee('نشري شقة F3 في باب الزوار', false);

        $this->actingAs($this->demandsOnly)
            ->post("/admin/moderation/demandes/{$demand->id}", ['status' => 'visible'])
            ->assertSessionHasNoErrors();

        $this->get('/demandes')->assertSee('نشري شقة F3 في باب الزوار', false);
    }
}
