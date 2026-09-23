<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Services\Geo;
use App\Support\Text;
use Database\Seeders\GeographySeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The one-shot import.
 *
 * It runs once, against live data, during a freeze — so every rule it carries
 * is asserted here rather than discovered on the night.
 */
final class ImportFirestoreTest extends TestCase
{
    use RefreshDatabase;

    private string $path;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(GeographySeeder::class);
        Geo::forget();
        Storage::fake('public');

        $this->path = storage_path('framework/testing/export-'.uniqid());
        File::makeDirectory($this->path, 0755, true);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->path);
        parent::tearDown();
    }

    /** @param array<string, list<array<string, mixed>>> $collections */
    private function export(array $collections): void
    {
        foreach ($collections as $name => $rows) {
            File::put("{$this->path}/{$name}.json", json_encode($rows));
        }

        // Every file the command reads has to exist, or each absence is its own
        // reported problem and the assertions drown in them.
        foreach (['settings', 'users', 'listings', 'comments', 'requests', 'replies',
            'savedSearches', 'articles', 'articleComments', 'promos', 'adminAudit', 'pointsLedger'] as $name) {
            if (! File::exists("{$this->path}/{$name}.json")) {
                File::put("{$this->path}/{$name}.json", '[]');
            }
        }
    }

    private function import(array ...$options): int
    {
        return $this->artisan('taajir:import', ['path' => $this->path, ...($options[0] ?? [])])->run();
    }

    /** @return array<string, mixed> */
    private function user(array $overrides = []): array
    {
        return [
            'id' => 'uid000000000000000000000001',
            'email' => 'karim@example.dz',
            'displayName' => 'كريم',
            'role' => 'user',
            'listingQuota' => 5,
            'createdAt' => 1700000000000,
            ...$overrides,
        ];
    }

    /** @return array<string, mixed> */
    private function listing(array $overrides = []): array
    {
        return [
            'id' => 'abc123def456',
            'slug' => 'appartement-f3-bab-ezzouar',
            'ownerUid' => 'uid000000000000000000000001',
            'ownerName' => 'كريم',
            'transactionType' => 'vente',
            'propertyType' => 'appartement',
            'price' => 8_000_000,
            'priceUnit' => 'total',
            'wilayaCode' => 16,
            'wilayaSlug' => 'alger',
            'communeSlug' => 'bab-ezzouar',
            'title' => 'شقة F3 في باب الزوار',
            'description' => 'شقة في الطابق الثالث.',
            'status' => 'published',
            'createdAt' => 1700000000000,
            'publishedAt' => 1700000100000,
            ...$overrides,
        ];
    }

    public function test_the_points_balance_is_recomputed_from_the_ledger(): void
    {
        // §10 point 6. A cache is only ever as good as its last write, and the
        // one number here that somebody would notice being wrong is the one
        // that buys them free ads.
        $this->export([
            'users' => [$this->user(['pointsBalance' => 9999])],
            'pointsLedger' => [
                ['id' => 'l1', 'uid' => 'uid000000000000000000000001', 'delta' => 50, 'reason' => 'referral', 'at' => 1700000000000],
                ['id' => 'l2', 'uid' => 'uid000000000000000000000001', 'delta' => -20, 'reason' => 'spend', 'at' => 1700000100000],
            ],
        ]);

        $this->assertSame(0, $this->import());

        $this->assertSame(2, DB::table('points_ledger')->count());
        $this->assertSame(30, (int) DB::table('users')->value('points_balance'));
    }

    public function test_an_account_with_no_ledger_rows_has_no_balance(): void
    {
        // A stale number copied across would be free ads nobody earned.
        $this->export(['users' => [$this->user(['pointsBalance' => 500])]]);

        $this->import();

        $this->assertSame(0, (int) DB::table('users')->value('points_balance'));
    }

    public function test_a_ledger_row_for_a_missing_account_is_skipped(): void
    {
        $this->export([
            'users' => [$this->user()],
            'pointsLedger' => [['id' => 'l1', 'uid' => 'uid-gone', 'delta' => 10, 'reason' => 'referral', 'at' => 1700000000000]],
        ]);

        $this->assertSame(1, $this->import());
        $this->assertSame(0, DB::table('points_ledger')->count());
    }

    public function test_it_refuses_to_strand_the_phone_only_accounts_quietly(): void
    {
        // Their only door is the phone. Importing them while that door is shut
        // gives them no way in at all, and the day it matters is the one day
        // nobody is looking at a config flag.
        config(['taajir.phone_signin_enabled' => false]);

        $this->export(['users' => [
            $this->user(['email' => null, 'phone' => '+213550112233']),
            $this->user(['id' => 'uid000000000000000000000002', 'email' => 'b@example.dz']),
        ]]);

        // Non-zero, so a scripted migration stops rather than carrying on.
        $this->assertSame(1, $this->import());
        // Imported all the same: the account is not the thing that was wrong.
        $this->assertSame(2, DB::table('users')->count());
    }

    public function test_it_says_nothing_when_the_phone_door_is_open(): void
    {
        config(['taajir.phone_signin_enabled' => true]);

        $this->export(['users' => [$this->user(['email' => null, 'phone' => '+213550112233'])]]);

        $this->assertSame(0, $this->import());
    }

    public function test_it_imports_a_user_and_a_listing(): void
    {
        $this->export([
            'users' => [$this->user()],
            'listings' => [$this->listing()],
        ]);

        $this->assertSame(0, $this->import());

        $this->assertDatabaseHas('users', ['uid' => 'uid000000000000000000000001', 'display_name' => 'كريم']);
        $this->assertDatabaseHas('listings', [
            'id' => 'abc123def456',
            'status' => 'published',
            'wilaya_slug' => 'alger',
        ]);
    }

    public function test_the_price_crosses_untouched(): void
    {
        // Firestore already stored whole dinars. A conversion here would be the
        // 10 000× error applied to every ad on the site at once.
        $this->export(['users' => [$this->user()], 'listings' => [$this->listing(['price' => 8_000_000])]]);
        $this->import();

        $this->assertSame(8_000_000, (int) DB::table('listings')->value('price'));
    }

    public function test_search_text_is_recomputed_not_copied(): void
    {
        $this->export([
            'users' => [$this->user()],
            // The Firestore workaround fields come across in the document and
            // must land nowhere: MySQL has FULLTEXT, which is the reason they
            // existed.
            'listings' => [$this->listing([
                'searchTokens' => ['nonsense', 'tokens'],
                'priceBucket' => 'p6',
                'areaBucket' => 'a3',
            ])],
        ]);
        $this->import();

        $searchText = (string) DB::table('listings')->value('search_text');

        $this->assertSame(
            Text::normalize('شقة F3 في باب الزوار bab-ezzouar alger'),
            $searchText,
        );
        $this->assertStringNotContainsString('nonsense', $searchText);
        $this->assertFalse(DB::getSchemaBuilder()->hasColumn('listings', 'price_bucket'));
    }

    public function test_images_and_amenities_become_rows(): void
    {
        $this->export([
            'users' => [$this->user()],
            'listings' => [$this->listing([
                'coverUrl' => 'https://example.dz/a.webp',
                'images' => [
                    ['url' => 'https://example.dz/a.webp', 'w' => 1600, 'h' => 900],
                    ['url' => 'https://example.dz/b.webp', 'w' => 800, 'h' => 600],
                ],
                'amenities' => ['ascenseur', 'garage', 'ascenseur'],
            ])],
        ]);
        $this->import();

        $images = DB::table('listing_images')->orderBy('position')->get();
        $this->assertCount(2, $images);
        $this->assertSame(0, $images[0]->position);
        $this->assertSame(1600, $images[0]->width);

        // The duplicate is the primary key's problem, and it must not be an
        // aborted import.
        $this->assertSame(2, DB::table('listing_amenities')->count());
    }

    public function test_a_listing_whose_owner_is_missing_is_skipped_and_reported(): void
    {
        // Not inserted with the owner nulled: owner_uid is a foreign key, and a
        // listing with no owner is not a listing.
        $this->export(['users' => [], 'listings' => [$this->listing()]]);

        $this->assertSame(1, $this->import());
        $this->assertSame(0, DB::table('listings')->count());
    }

    public function test_a_role_that_no_longer_exists_demotes_rather_than_fails(): void
    {
        $this->export(['users' => [$this->user(['role' => 'ancien-moderateur'])]]);

        $this->assertSame(1, $this->import());
        // Demoted, imported, and named in the report — never a foreign-key
        // failure halfway through the run.
        $this->assertSame('user', DB::table('users')->value('role_id'));
    }

    public function test_a_missing_approved_field_reads_as_approved(): void
    {
        // The field arrived with the approval feature. Every account written
        // before it predates the gate, and reading the absence as "blocked"
        // would mute the whole existing platform on the first request.
        $this->export(['users' => [$this->user()]]);
        $this->import();

        $this->assertTrue((bool) DB::table('users')->value('approved'));
    }

    public function test_a_referral_pointing_nowhere_is_cleared(): void
    {
        $this->export(['users' => [
            $this->user(['referredBy' => 'uid-that-never-existed']),
            $this->user(['id' => 'uid000000000000000000000002', 'email' => 'b@example.dz']),
        ]]);

        $this->import();

        $this->assertNull(DB::table('users')->where('uid', 'uid000000000000000000000001')->value('referred_by'));
    }

    public function test_a_referral_between_two_imported_accounts_survives(): void
    {
        $this->export(['users' => [
            $this->user(['referredBy' => 'uid000000000000000000000002']),
            $this->user(['id' => 'uid000000000000000000000002', 'email' => 'b@example.dz']),
        ]]);

        $this->import();

        $this->assertSame(
            'uid000000000000000000000002',
            DB::table('users')->where('uid', 'uid000000000000000000000001')->value('referred_by'),
        );
    }

    public function test_a_downloaded_image_is_copied_onto_the_public_disk(): void
    {
        $path = 'listings/uid1/abc123def456/photo-1600.webp';
        File::makeDirectory("{$this->path}/storage/".dirname($path), 0755, true);
        File::put("{$this->path}/storage/{$path}", 'webp-bytes');

        $this->export([
            'users' => [$this->user()],
            'listings' => [$this->listing([
                'coverUrl' => 'https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/'
                    .rawurlencode($path).'?alt=media&token=abc',
            ])],
        ]);
        $this->import();

        Storage::disk('public')->assertExists($path);
        $this->assertStringContainsString($path, (string) DB::table('listings')->value('cover_url'));
    }

    public function test_an_image_that_was_not_downloaded_keeps_its_firebase_url(): void
    {
        // This is what lets the rows go across before the images finish, and
        // why §10 says keep the bucket alive after the cut-over: the ad still
        // renders, and a second run moves it once the file is there.
        $url = 'https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/listings%2Fmissing.webp?alt=media';

        $this->export(['users' => [$this->user()], 'listings' => [$this->listing(['coverUrl' => $url])]]);
        $this->import();

        $this->assertSame($url, DB::table('listings')->value('cover_url'));
    }

    public function test_running_it_twice_changes_nothing(): void
    {
        // The freeze is short because this is true: rows now, images later, and
        // a run that dies halfway is just run again.
        $this->export([
            'users' => [$this->user()],
            'listings' => [$this->listing(['images' => [['url' => 'https://example.dz/a.webp', 'w' => 1, 'h' => 1]]])],
            'comments' => [[
                'id' => 'c1', 'listingId' => 'abc123def456',
                'authorUid' => 'uid000000000000000000000001', 'authorName' => 'كريم',
                'text' => 'سعر مناسب', 'createdAt' => 1700000200000,
            ]],
        ]);

        $this->import();
        $this->import();

        $this->assertSame(1, DB::table('users')->count());
        $this->assertSame(1, DB::table('listings')->count());
        $this->assertSame(1, DB::table('listing_images')->count());
        $this->assertSame(1, DB::table('comments')->count());
    }

    public function test_a_dry_run_writes_nothing(): void
    {
        $this->export(['users' => [$this->user()], 'listings' => [$this->listing()]]);

        $this->import(['--dry-run' => true]);

        $this->assertSame(0, DB::table('users')->count());
        $this->assertSame(0, DB::table('listings')->count());
    }

    public function test_a_truncated_file_is_caught_against_the_manifest(): void
    {
        // A copy to the server that lost its tail is still valid JSON, so the
        // only thing that catches it is the count the export wrote down.
        $this->export(['users' => [$this->user()]]);
        File::put("{$this->path}/manifest.json", json_encode(['counts' => ['users' => 412]]));

        $this->assertSame(1, $this->import());
    }

    public function test_the_thread_and_the_demand_feed_come_across(): void
    {
        $this->export([
            'users' => [$this->user()],
            'listings' => [$this->listing()],
            'comments' => [[
                'id' => 'c1', 'listingId' => 'abc123def456',
                'authorUid' => 'uid000000000000000000000001', 'authorName' => 'كريم',
                'text' => 'واش السعر آخر؟', 'status' => 'hidden', 'hiddenReason' => 'خارج الموضوع',
                'createdAt' => 1700000200000,
            ]],
            'requests' => [[
                'id' => 'req000000001', 'ownerUid' => 'uid000000000000000000000001',
                'ownerName' => 'كريم', 'intent' => 'location', 'title' => 'نكري شقة',
                'description' => 'نحوس على شقة.', 'wilayaSlug' => 'alger',
                'status' => 'visible', 'replyCount' => 1, 'createdAt' => 1700000300000,
            ]],
            'replies' => [[
                'id' => 'r1', 'requestId' => 'req000000001',
                'authorUid' => 'uid000000000000000000000001', 'authorName' => 'كريم',
                'text' => 'عندي وحدة.', 'listing' => ['id' => 'abc123def456'],
                'createdAt' => 1700000400000,
            ]],
            'savedSearches' => [[
                'id' => 's1', 'ownerUid' => 'uid000000000000000000000001',
                'wilayaSlug' => 'alger', 'transactionType' => 'location',
                'label' => 'كراء في الجزائر', 'notify' => true, 'createdAt' => 1700000500000,
            ]],
        ]);

        $this->assertSame(0, $this->import());

        $this->assertSame('hidden', DB::table('comments')->value('status'));
        $this->assertSame('location', DB::table('requests')->value('intent'));
        // The attached ad is a real foreign key here where it was denormalised
        // there.
        $this->assertSame('abc123def456', DB::table('request_replies')->value('listing_id'));
        $this->assertSame('كراء في الجزائر', DB::table('saved_searches')->value('label'));
    }

    public function test_a_reply_whose_attached_ad_is_gone_keeps_its_text(): void
    {
        $this->export([
            'users' => [$this->user()],
            'requests' => [[
                'id' => 'req000000001', 'ownerUid' => 'uid000000000000000000000001',
                'ownerName' => 'كريم', 'intent' => 'vente', 'title' => 'نشري',
                'description' => 'x', 'wilayaSlug' => 'alger', 'createdAt' => 1700000300000,
            ]],
            'replies' => [[
                'id' => 'r1', 'requestId' => 'req000000001',
                'authorUid' => 'uid000000000000000000000001', 'authorName' => 'كريم',
                'text' => 'عندي وحدة.', 'listing' => ['id' => 'deleted00001'],
                'createdAt' => 1700000400000,
            ]],
        ]);

        $this->assertSame(0, $this->import());

        $reply = DB::table('request_replies')->first();
        $this->assertNull($reply->listing_id);
        $this->assertSame('عندي وحدة.', $reply->text);
    }

    public function test_articles_carry_their_thread_across(): void
    {
        $this->export([
            'users' => [$this->user()],
            'articles' => [[
                'id' => 'art1', 'slug' => 'marche-immobilier-algerie',
                'title' => 'سوق العقار في الجزائر', 'excerpt' => 'ملخّص.',
                'body' => [['type' => 'p', 'text' => 'فقرة.'], ['type' => 'h2', 'text' => 'عنوان']],
                'authorUid' => 'uid000000000000000000000001', 'authorName' => 'التحرير',
                'status' => 'published', 'tags' => ['كراء'], 'readMinutes' => 3,
                'publishedAt' => 1700000600000, 'createdAt' => 1700000600000, 'commentCount' => 1,
            ]],
            'articleComments' => [[
                'id' => 'ac1', 'articleId' => 'art1',
                'authorUid' => 'uid000000000000000000000001', 'authorName' => 'كريم',
                'text' => 'مقال مفيد.', 'createdAt' => 1700000700000,
            ]],
        ]);

        $this->assertSame(0, $this->import());

        $article = DB::table('articles')->first();
        $this->assertSame('marche-immobilier-algerie', $article->slug);
        $this->assertCount(2, json_decode($article->body, true));
        // Firestore keyed the thread by document id; here it is the article's
        // own primary key, so the id is resolved rather than copied.
        $this->assertSame($article->id, DB::table('article_comments')->value('article_id'));
    }

    public function test_settings_and_the_audit_trail_come_across(): void
    {
        $this->export([
            'settings' => [
                ['id' => 'access', 'requireApproval' => true, 'updatedAt' => 1700000000000],
                ['id' => 'filter', 'hiddenPropertyTypes' => ['terrain']],
            ],
            'adminAudit' => [[
                'id' => 'a1', 'actorUid' => 'uid000000000000000000000001',
                'action' => 'approve', 'targetType' => 'listing', 'targetId' => 'abc123def456',
                'note' => 'مطابق', 'at' => 1700000800000,
            ]],
        ]);

        $this->assertSame(0, $this->import());

        $this->assertTrue(json_decode(DB::table('settings')->where('key', 'access')->value('value'), true)['requireApproval']);
        $this->assertSame(['terrain'], json_decode(DB::table('settings')->where('key', 'filter')->value('value'), true)['hiddenPropertyTypes']);
        $this->assertSame('مطابق', json_decode(DB::table('admin_audit')->value('detail'), true)['note']);
    }

    public function test_only_runs_the_named_step(): void
    {
        $this->export(['users' => [$this->user()], 'listings' => [$this->listing()]]);

        $this->import(['--only' => 'users']);

        $this->assertSame(1, DB::table('users')->count());
        $this->assertSame(0, DB::table('listings')->count());
    }

    public function test_it_refuses_to_run_before_the_roles_are_seeded(): void
    {
        DB::table('role_permissions')->delete();
        DB::table('users')->delete();
        DB::table('roles')->delete();
        $this->export(['users' => [$this->user()]]);

        $this->assertSame(1, $this->import());
    }
}
