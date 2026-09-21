<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Support\Text;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

/**
 * ── THE ONE-SHOT IMPORT ──────────────────────────────────────────────────────
 * Reads the folder `tools/export-firestore.mjs` wrote and fills MySQL. §10 of
 * the roadmap.
 *
 * Three rules shape the whole file.
 *
 * **Order is decided by the foreign keys, not by preference.** users before
 * listings, listings before comments and replies, articles before their
 * thread. A row whose parent is missing is skipped and counted, never inserted
 * with the reference nulled: a comment on an ad that did not come across is
 * not a comment, and silently keeping it would leave the moderation screen
 * showing threads that point nowhere.
 *
 * **Derived fields are recomputed, never copied.** `search_text` is rebuilt by
 * the same fold the live code uses, and the three Firestore workarounds —
 * priceBucket, areaBucket, searchTokens — are dropped on the floor. They exist
 * because Firestore could not do `WHERE price BETWEEN`; MySQL can, and copying
 * them across would be importing the workaround along with the data.
 *
 * **It is re-runnable.** Every write is an upsert keyed on what the row is, so
 * a run that dies halfway can be run again, and a media-only second pass after
 * the images finish downloading is just another run. That is what makes the
 * freeze window short: rows first, images whenever they are ready.
 */
final class ImportFirestore extends Command
{
    protected $signature = 'taajir:import
        {path : the folder the export script wrote}
        {--dry-run : read and report, write nothing}
        {--only= : a comma-separated subset, e.g. users,listings}
        {--media-root= : where the downloaded images are, if not <path>/storage}';

    protected $description = 'Import a Firestore export into MySQL (§10)';

    /** @var array<string, array{read: int, written: int, skipped: int}> */
    private array $tally = [];

    /** @var list<string> */
    private array $problems = [];

    /**
     * Role ids that exist, so a user carrying a role that was deleted lands on
     * `user` instead of failing a foreign key mid-import.
     *
     * @var list<string>
     */
    private array $roles = [];

    /**
     * Each collection's decoded rows, read once.
     *
     * An instance property, deliberately not a static: a static would survive
     * between two runs in one process and hand the second run the first one's
     * files — which is invisible for a CLI that exits, and exactly what the
     * test suite does.
     *
     * @var array<string, list<array<string, mixed>>>
     */
    private array $cache = [];

    /**
     * The keys each step accepted, so a later step can check a parent without
     * asking the database.
     *
     * This is what makes --dry-run mean anything. A dry run writes nothing, so
     * a parent check against the database finds no users and calls every single
     * listing an orphan — which is the first command anybody runs on the night,
     * reporting the whole export as broken.
     *
     * @var array<string, array<string, true>>
     */
    private array $accepted = [];

    /** Which step is running, for the tally. */
    private string $step = 'other';

    private string $path;

    private string $mediaRoot;

    private bool $dry;

    public function handle(): int
    {
        $this->path = rtrim((string) $this->argument('path'), '/');
        $this->mediaRoot = rtrim((string) ($this->option('media-root') ?: $this->path.'/storage'), '/');
        $this->dry = (bool) $this->option('dry-run');

        if (! File::isDirectory($this->path)) {
            $this->error("No such folder: {$this->path}");

            return self::FAILURE;
        }

        if ($this->dry) {
            $this->warn('Dry run: nothing will be written.');
        }

        $this->roles = DB::table('roles')->pluck('id')->all();
        if ($this->roles === []) {
            $this->error('The roles table is empty. Run `php artisan db:seed` first — users reference it.');

            return self::FAILURE;
        }

        // The order is the foreign keys' order. Do not rearrange.
        $steps = [
            'settings' => fn () => $this->importSettings(),
            'users' => fn () => $this->importUsers(),
            'pointsLedger' => fn () => $this->importPointsLedger(),
            'listings' => fn () => $this->importListings(),
            'comments' => fn () => $this->importComments(),
            'requests' => fn () => $this->importRequests(),
            'replies' => fn () => $this->importReplies(),
            'savedSearches' => fn () => $this->importSavedSearches(),
            'articles' => fn () => $this->importArticles(),
            'articleComments' => fn () => $this->importArticleComments(),
            'promos' => fn () => $this->importPromos(),
            'adminAudit' => fn () => $this->importAudit(),
        ];

        $only = array_filter(array_map('trim', explode(',', (string) $this->option('only'))));

        foreach ($steps as $name => $step) {
            if ($only !== [] && ! in_array($name, $only, true)) {
                continue;
            }

            $this->step = $name;
            $this->line("→ {$name}");
            $step();
        }

        return $this->report();
    }

    // ── the collections ──────────────────────────────────────────────────────

    private function importSettings(): void
    {
        foreach ($this->rows('settings') as $row) {
            $key = (string) $row['id'];
            unset($row['id']);

            // `filter` carries the admin's category edits and `branding` the
            // palette. Both are read as whole objects by the app, so they go
            // across as whole objects.
            $this->write('settings', ['key' => $key], [
                'value' => json_encode($row, JSON_UNESCAPED_UNICODE),
                'updated_at' => $this->time($row['updatedAt'] ?? null) ?? now(),
                'updated_by' => $this->text($row['updatedBy'] ?? null, 28),
            ]);
        }
    }

    private function importUsers(): void
    {
        foreach ($this->rows('users') as $row) {
            $uid = $this->text($row['id'] ?? null, 28);
            if ($uid === null) {
                $this->skip('users', 'a document with no id');

                continue;
            }

            $role = (string) ($row['role'] ?? 'user');
            if (! in_array($role, $this->roles, true)) {
                // Never a failed foreign key halfway through: the account comes
                // across demoted, and the problem is named at the end so
                // somebody can put it back.
                $this->problems[] = "user {$uid}: role '{$role}' does not exist — imported as 'user'";
                $role = 'user';
            }

            $this->write('users', ['uid' => $uid], [
                'email' => $this->text($row['email'] ?? null, 255),
                'display_name' => $this->text($row['displayName'] ?? null, 80) ?? 'مستخدم',
                'photo_url' => $this->text($row['photoURL'] ?? null, 500),
                'phone' => $this->text($row['phone'] ?? null, 20),
                'email_verified' => (bool) ($row['emailVerified'] ?? false),
                'role_id' => $role,
                // Absent means approved. The field arrived with the approval
                // feature, and every account written before it predates the
                // gate — reading the absence as "blocked" would mute the whole
                // existing platform on the first request.
                'approved' => (bool) ($row['approved'] ?? true),
                'agency_id' => $this->text($row['agencyId'] ?? null, 20),
                'wilaya_code' => $this->int($row['wilayaCode'] ?? null),
                'active_listing_count' => (int) ($row['activeListingCount'] ?? 0),
                'listing_quota' => (int) ($row['listingQuota'] ?? config('taajir.default_quota', 3)),
                'featured_quota' => (int) ($row['featuredQuota'] ?? 0),
                'is_banned' => (bool) ($row['isBanned'] ?? false),
                'ban_reason' => $this->text($row['banReason'] ?? null, 255),
                'strike_count' => (int) ($row['strikeCount'] ?? 0),
                'notify_on_message' => (bool) ($row['notifyOnMessage'] ?? true),
                'notify_on_saved_search' => (bool) ($row['notifyOnSavedSearch'] ?? true),
                'locale' => $this->text($row['locale'] ?? null, 5) ?? 'ar',
                'points_balance' => (int) ($row['pointsBalance'] ?? 0),
                'referred_by' => $this->text($row['referredBy'] ?? null, 28),
                'referral_code' => $this->text($row['referralCode'] ?? null, 6),
                'created_at' => $this->time($row['createdAt'] ?? null) ?? now(),
                'last_seen_at' => $this->time($row['lastSeenAt'] ?? null),
            ]);

            $this->accept('users', $uid);
        }

        /*
         * Accounts whose only door is the phone.
         *
         * They have no email and no password — thirty-five of them on the live
         * site — so with phone sign-in switched off, importing them strands
         * every one. Counted rather than assumed, and reported rather than
         * fixed: turning the door back on is a product decision, and this is
         * the moment it stops being hypothetical.
         */
        $phoneOnly = 0;
        foreach ($this->rows('users') as $row) {
            if (($row['email'] ?? null) === null && ($row['phone'] ?? null) !== null) {
                $phoneOnly++;
            }
        }

        if ($phoneOnly > 0 && ! config('taajir.phone_signin_enabled')) {
            $this->problems[] = "{$phoneOnly} account(s) have a phone and no email, and phone sign-in is off"
                .' — they will have no way in. Set TAAJIR_PHONE_SIGNIN=on.';
        }

        /*
         * referred_by points at users, and the person who invited you may well
         * have signed up after you in document-id order. Rather than sort the
         * file, the column is filled above and the danglers are cleared here —
         * an invitation from an account that no longer exists is not an
         * invitation.
         */
        if (! $this->dry) {
            $dangling = DB::table('users')
                ->whereNotNull('referred_by')
                ->whereNotIn('referred_by', fn ($q) => $q->select('uid')->from('users'))
                ->update(['referred_by' => null]);

            if ($dangling > 0) {
                $this->problems[] = "{$dangling} referral(s) pointed at an account that is not in the export — cleared";
            }
        }
    }

    /**
     * The referral points, and the balances recomputed from them.
     *
     * §10 point 6: the ledger first, then `users.points_balance` from it —
     * never the cached balance in the export. A cache is only ever as good as
     * its last write, and the one number in this system that somebody would
     * notice being wrong is the one that buys them free ads.
     *
     * The rest of the affiliate programme is not ported (§11), so nothing here
     * spends or awards. This is the record arriving ahead of the feature that
     * will read it.
     */
    private function importPointsLedger(): void
    {
        $holders = $this->keysOf('users', 'uid', 'users');

        foreach ($this->rows('pointsLedger') as $row) {
            $uid = $this->text($row['uid'] ?? null, 28);

            if ($uid === null || ! isset($holders[$uid])) {
                $this->skip('pointsLedger', "a ledger row for {$uid}, who is not in the export");

                continue;
            }

            $this->write('points_ledger', [
                'uid' => $uid,
                'reason' => $this->text($row['reason'] ?? null, 32) ?? '',
                'ref_uid' => $this->text($row['refUid'] ?? null, 28),
                'created_at' => $this->time($row['at'] ?? null) ?? now(),
            ], [
                'delta' => (int) ($row['delta'] ?? 0),
                'campaign_id' => $this->text($row['campaignId'] ?? null, 32),
                'note' => $this->text($row['note'] ?? null, 255),
            ]);
        }

        if ($this->dry) {
            return;
        }

        /*
         * Recomputed for everyone, including the accounts with no rows: an
         * account whose ledger is empty has a balance of zero, and a stale
         * number copied from the export would be free ads nobody earned.
         */
        $totals = DB::table('points_ledger')
            ->selectRaw('uid, sum(delta) as total')
            ->groupBy('uid')
            ->pluck('total', 'uid');

        DB::table('users')->update(['points_balance' => 0]);

        foreach ($totals as $uid => $total) {
            DB::table('users')->where('uid', $uid)->update(['points_balance' => max(0, (int) $total)]);
        }
    }

    private function importListings(): void
    {
        $owners = $this->keysOf('users', 'uid', 'users');

        foreach ($this->rows('listings') as $row) {
            $id = $this->text($row['id'] ?? null, 12);
            $owner = $this->text($row['ownerUid'] ?? null, 28);

            if ($id === null || $owner === null || ! isset($owners[$owner])) {
                $this->skip('listings', "listing {$id}: owner {$owner} is not in the export");

                continue;
            }

            $title = $this->text($row['title'] ?? null, 90) ?? '';
            $wilayaSlug = $this->text($row['wilayaSlug'] ?? null, 48) ?? '';
            $communeSlug = $this->text($row['communeSlug'] ?? null, 64) ?? '';

            $this->write('listings', ['id' => $id], [
                'slug' => $this->text($row['slug'] ?? null, 160) ?? $id,
                'owner_uid' => $owner,
                'owner_type' => ($row['ownerType'] ?? 'individual') === 'agency' ? 'agency' : 'individual',
                'agency_id' => $this->text($row['agencyId'] ?? null, 20),
                'owner_name' => $this->text($row['ownerName'] ?? null, 80) ?? 'مستخدم',
                'owner_is_verified' => (bool) ($row['ownerIsVerified'] ?? false),
                'transaction_type' => $this->text($row['transactionType'] ?? null, 32) ?? 'vente',
                'sale_form' => $this->text($row['saleForm'] ?? null, 24),
                'property_type' => $this->text($row['propertyType'] ?? null, 32) ?? 'appartement',
                'housing_program' => $this->text($row['housingProgram'] ?? null, 16),
                // Already whole dinars in Firestore. The ×10 000 lives in one
                // helper and this is not it — a conversion here would be the
                // 10 000× error, applied to every ad at once.
                'price' => max(0, (int) ($row['price'] ?? 0)),
                'price_unit' => $this->text($row['priceUnit'] ?? null, 8) ?? 'total',
                'price_on_request' => (bool) ($row['priceOnRequest'] ?? false),
                'is_negotiable' => (bool) ($row['isNegotiable'] ?? false),
                'area_built' => $this->int($row['areaBuilt'] ?? null),
                'area_land' => $this->int($row['areaLand'] ?? null),
                'rooms_code' => $this->text($row['roomsCode'] ?? null, 4),
                'bathrooms' => $this->int($row['bathrooms'] ?? null),
                'floor' => $this->int($row['floor'] ?? null),
                // `condition` is a reserved word in MySQL, so the column carries
                // the suffix the Firestore field did not.
                'condition_code' => $this->text($row['condition'] ?? null, 16),
                'paperwork' => $this->text($row['paperwork'] ?? null, 32),
                'wilaya_code' => (int) ($row['wilayaCode'] ?? 0),
                'wilaya_slug' => $wilayaSlug,
                'commune_slug' => $communeSlug,
                'quartier' => $this->text($row['quartier'] ?? null, 80),
                'lat' => $this->float($row['geo']['lat'] ?? null),
                'lng' => $this->float($row['geo']['lng'] ?? null),
                'title' => $title,
                'description' => (string) ($row['description'] ?? ''),
                'cover_url' => $this->media($row['coverUrl'] ?? null),
                // Recomputed, not copied: searchTokens was Firestore's answer to
                // having no LIKE and no FULLTEXT, and it is exactly the kind of
                // workaround the port exists to delete.
                'search_text' => Text::normalize(implode(' ', array_filter([$title, $communeSlug, $wilayaSlug]))),
                'contact_phone' => $this->text($row['contactPhone'] ?? null, 20),
                'show_phone' => (bool) ($row['showPhone'] ?? true),
                'allow_whatsapp' => (bool) ($row['allowWhatsapp'] ?? true),
                'status' => $this->text($row['status'] ?? null, 16) ?? 'draft',
                'rejection_reason' => $this->text($row['rejectionReason'] ?? null, 255),
                'policy_rule' => $this->text($row['policyRule'] ?? null, 64),
                'approved_for_launch' => (bool) ($row['approvedForLaunch'] ?? false),
                'is_featured' => (bool) ($row['isFeatured'] ?? false),
                'pinned_until' => $this->time($row['pinnedUntil'] ?? null),
                'view_count' => (int) ($row['viewCount'] ?? 0),
                'created_at' => $this->time($row['createdAt'] ?? null) ?? now(),
                'updated_at' => $this->time($row['updatedAt'] ?? null) ?? $this->time($row['createdAt'] ?? null) ?? now(),
                'published_at' => $this->time($row['publishedAt'] ?? null),
            ]);

            $this->accept('listings', $id);

            if ($this->dry) {
                continue;
            }

            // The array on the document becomes rows. Rewritten wholesale so a
            // second run does not double the gallery.
            DB::table('listing_images')->where('listing_id', $id)->delete();
            $position = 0;
            foreach ($row['images'] ?? [] as $image) {
                $url = $this->media($image['url'] ?? null);
                if ($url === null) {
                    continue;
                }

                DB::table('listing_images')->insert([
                    'listing_id' => $id,
                    'url' => $url,
                    'storage_path' => $this->storagePath($image['url'] ?? null),
                    'width' => $this->int($image['w'] ?? null),
                    'height' => $this->int($image['h'] ?? null),
                    'position' => $position++,
                ]);
            }

            DB::table('listing_amenities')->where('listing_id', $id)->delete();
            foreach (array_unique($row['amenities'] ?? []) as $amenity) {
                if (is_string($amenity) && $amenity !== '') {
                    DB::table('listing_amenities')->insert([
                        'listing_id' => $id,
                        'amenity' => mb_substr($amenity, 0, 24),
                    ]);
                }
            }
        }
    }

    private function importComments(): void
    {
        $listings = $this->keysOf('listings', 'id', 'listings');

        foreach ($this->rows('comments') as $row) {
            $listingId = $this->text($row['listingId'] ?? null, 12);

            if ($listingId === null || ! isset($listings[$listingId])) {
                $this->skip('comments', "a comment on {$listingId}, which is not in the export");

                continue;
            }

            // Keyed on the Firestore id so a re-run updates rather than doubles.
            $this->write('comments', [
                'listing_id' => $listingId,
                'author_uid' => $this->text($row['authorUid'] ?? null, 28) ?? '',
                'created_at' => $this->time($row['createdAt'] ?? null) ?? now(),
            ], [
                'author_name' => $this->text($row['authorName'] ?? null, 80) ?? 'مستخدم',
                'author_photo_url' => $this->text($row['authorPhotoUrl'] ?? null, 500),
                'is_owner' => (bool) ($row['isOwner'] ?? false),
                'text' => mb_substr((string) ($row['text'] ?? ''), 0, 1000),
                'status' => ($row['status'] ?? 'visible') === 'hidden' ? 'hidden' : 'visible',
                'hidden_reason' => $this->text($row['hiddenReason'] ?? null, 255),
                'edited_at' => $this->time($row['editedAt'] ?? null),
            ]);
        }
    }

    private function importRequests(): void
    {
        $owners = $this->keysOf('users', 'uid', 'users');

        foreach ($this->rows('requests') as $row) {
            $id = $this->text($row['id'] ?? null, 12);
            $owner = $this->text($row['ownerUid'] ?? null, 28);

            if ($id === null || $owner === null || ! isset($owners[$owner])) {
                $this->skip('requests', "request {$id}: owner {$owner} is not in the export");

                continue;
            }

            $this->write('requests', ['id' => $id], [
                'owner_uid' => $owner,
                'owner_name' => $this->text($row['ownerName'] ?? null, 80) ?? 'مستخدم',
                'owner_photo_url' => $this->text($row['ownerPhotoUrl'] ?? null, 500),
                'intent' => ($row['intent'] ?? 'vente') === 'location' ? 'location' : 'vente',
                'title' => $this->text($row['title'] ?? null, 90) ?? '',
                'description' => (string) ($row['description'] ?? ''),
                'wilaya_slug' => $this->text($row['wilayaSlug'] ?? null, 48) ?? '',
                'commune_slug' => $this->text($row['communeSlug'] ?? null, 64),
                'status' => $this->text($row['status'] ?? null, 16) ?? 'visible',
                'hidden_reason' => $this->text($row['hiddenReason'] ?? null, 255),
                'rejection_reason' => $this->text($row['rejectionReason'] ?? null, 255),
                'policy_rule' => $this->text($row['policyRule'] ?? null, 64),
                'moderated_by' => $this->text($row['moderatedBy'] ?? null, 28),
                'moderated_at' => $this->time($row['moderatedAt'] ?? null),
                'reply_count' => (int) ($row['replyCount'] ?? 0),
                'created_at' => $this->time($row['createdAt'] ?? null) ?? now(),
            ]);

            $this->accept('requests', $id);
        }
    }

    private function importReplies(): void
    {
        $requests = $this->keysOf('requests', 'id', 'requests');
        $listings = $this->keysOf('listings', 'id', 'listings');

        foreach ($this->rows('replies') as $row) {
            $requestId = $this->text($row['requestId'] ?? null, 12);

            if ($requestId === null || ! isset($requests[$requestId])) {
                $this->skip('replies', "a reply to {$requestId}, which is not in the export");

                continue;
            }

            // The attached ad is denormalised on the Firestore document and a
            // nullable foreign key here. An ad that has since been deleted
            // leaves the reply standing with its text — it still says what was
            // offered, which is the reason it was denormalised in the first
            // place.
            $listingId = $this->text($row['listing']['id'] ?? null, 12);
            if ($listingId !== null && ! isset($listings[$listingId])) {
                $listingId = null;
            }

            $this->write('request_replies', [
                'request_id' => $requestId,
                'author_uid' => $this->text($row['authorUid'] ?? null, 28) ?? '',
                'created_at' => $this->time($row['createdAt'] ?? null) ?? now(),
            ], [
                'author_name' => $this->text($row['authorName'] ?? null, 80) ?? 'مستخدم',
                'author_photo_url' => $this->text($row['authorPhotoUrl'] ?? null, 500),
                'is_owner' => (bool) ($row['isOwner'] ?? false),
                'text' => mb_substr((string) ($row['text'] ?? ''), 0, 1000),
                'listing_id' => $listingId,
                'status' => ($row['status'] ?? 'visible') === 'hidden' ? 'hidden' : 'visible',
                'hidden_reason' => $this->text($row['hiddenReason'] ?? null, 255),
            ]);
        }
    }

    private function importSavedSearches(): void
    {
        $owners = $this->keysOf('users', 'uid', 'users');

        foreach ($this->rows('savedSearches') as $row) {
            $owner = $this->text($row['ownerUid'] ?? null, 28);

            if ($owner === null || ! isset($owners[$owner])) {
                $this->skip('savedSearches', "a saved search for {$owner}, who is not in the export");

                continue;
            }

            $this->write('saved_searches', [
                'owner_uid' => $owner,
                'wilaya_slug' => $this->text($row['wilayaSlug'] ?? null, 48) ?? '',
                'commune_slug' => $this->text($row['communeSlug'] ?? null, 64),
                'transaction_type' => $this->text($row['transactionType'] ?? null, 32),
                'property_type' => $this->text($row['propertyType'] ?? null, 32),
            ], [
                'label' => $this->text($row['label'] ?? null, 160) ?? '',
                'notify' => (bool) ($row['notify'] ?? true),
                'created_at' => $this->time($row['createdAt'] ?? null) ?? now(),
                'last_notified_at' => $this->time($row['lastNotifiedAt'] ?? null),
                'match_count' => (int) ($row['matchCount'] ?? 0),
            ]);
        }
    }

    private function importArticles(): void
    {
        foreach ($this->rows('articles') as $row) {
            $slug = $this->text($row['slug'] ?? null, 70);
            if ($slug === null) {
                $this->skip('articles', 'an article with no slug');

                continue;
            }

            $body = array_values(array_filter(
                $row['body'] ?? [],
                fn ($block) => is_array($block) && isset($block['text']),
            ));

            $this->write('articles', ['slug' => $slug], [
                'title' => $this->text($row['title'] ?? null, 120) ?? '',
                'excerpt' => $this->text($row['excerpt'] ?? null, 300) ?? '',
                'body' => json_encode($body, JSON_UNESCAPED_UNICODE),
                'cover_url' => $this->media($row['coverUrl'] ?? null),
                'cover_alt' => $this->text($row['coverAlt'] ?? null, 140),
                'author_uid' => $this->text($row['authorUid'] ?? null, 28) ?? '',
                'author_name' => $this->text($row['authorName'] ?? null, 80) ?? '',
                'status' => ($row['status'] ?? 'draft') === 'published' ? 'published' : 'draft',
                'tags' => json_encode(array_slice($row['tags'] ?? [], 0, 6), JSON_UNESCAPED_UNICODE),
                'read_minutes' => max(1, (int) ($row['readMinutes'] ?? 1)),
                'published_at' => $this->time($row['publishedAt'] ?? null),
                'comment_count' => (int) ($row['commentCount'] ?? 0),
                'created_at' => $this->time($row['createdAt'] ?? null) ?? now(),
                'updated_at' => $this->time($row['updatedAt'] ?? null) ?? now(),
            ]);
        }
    }

    private function importArticleComments(): void
    {
        /*
         * Firestore keyed the thread by document id; here it is the article's
         * own auto-increment primary key, so the id is resolved rather than
         * copied. In a dry run there is no row to resolve against, so the
         * export's own id stands in — the only thing being checked then is
         * whether the parent article is in the export at all.
         */
        $byFirestoreId = [];
        foreach ($this->rows('articles') as $article) {
            $slug = $this->text($article['slug'] ?? null, 70);
            if ($slug === null) {
                continue;
            }

            $byFirestoreId[(string) $article['id']] = $this->dry
                ? $article['id']
                : DB::table('articles')->where('slug', $slug)->value('id');
        }

        foreach ($this->rows('articleComments') as $row) {
            $articleId = $byFirestoreId[(string) ($row['articleId'] ?? '')] ?? null;

            if ($articleId === null) {
                $this->skip('articleComments', 'a comment on an article that is not in the export');

                continue;
            }

            $this->write('article_comments', [
                'article_id' => $articleId,
                'author_uid' => $this->text($row['authorUid'] ?? null, 28) ?? '',
                'created_at' => $this->time($row['createdAt'] ?? null) ?? now(),
            ], [
                'author_name' => $this->text($row['authorName'] ?? null, 80) ?? 'مستخدم',
                'author_photo_url' => $this->text($row['authorPhotoUrl'] ?? null, 500),
                'text' => mb_substr((string) ($row['text'] ?? ''), 0, 1000),
                'status' => ($row['status'] ?? 'visible') === 'hidden' ? 'hidden' : 'visible',
                'hidden_reason' => $this->text($row['hiddenReason'] ?? null, 255),
            ]);
        }
    }

    private function importPromos(): void
    {
        foreach ($this->rows('promos') as $row) {
            $url = $this->media($row['imageUrl'] ?? null);
            if ($url === null) {
                $this->skip('promos', 'a banner with no image');

                continue;
            }

            $this->write('promos', ['image_url' => $url], [
                'storage_path' => $this->storagePath($row['imageUrl'] ?? null) ?? '',
                'width' => (int) ($row['width'] ?? 1200),
                'height' => (int) ($row['height'] ?? 400),
                'link_url' => $this->text($row['linkUrl'] ?? null, 500) ?? '/',
                'title' => $this->text($row['title'] ?? null, 140) ?? '',
                'is_active' => (bool) ($row['isActive'] ?? true),
                'order' => (int) ($row['order'] ?? 0),
                'created_at' => $this->time($row['createdAt'] ?? null) ?? now(),
                'updated_at' => $this->time($row['updatedAt'] ?? null) ?? now(),
            ]);
        }
    }

    private function importAudit(): void
    {
        foreach ($this->rows('adminAudit') as $row) {
            $note = $this->text($row['note'] ?? null, 255);

            $this->write('admin_audit', [
                'actor_uid' => $this->text($row['actorUid'] ?? null, 28) ?? '',
                'action' => $this->text($row['action'] ?? null, 48) ?? '',
                'target_type' => $this->text($row['targetType'] ?? null, 24) ?? '',
                'target_id' => $this->text($row['targetId'] ?? null, 32) ?? '',
                'created_at' => $this->time($row['at'] ?? null) ?? now(),
            ], [
                'detail' => $note === null ? null : json_encode(['note' => $note], JSON_UNESCAPED_UNICODE),
            ]);
        }
    }

    // ── media ────────────────────────────────────────────────────────────────

    /**
     * A URL the new site can serve.
     *
     * When the file was downloaded it is copied onto the public disk and the
     * URL is rewritten to the local one. When it was not, the Firebase URL is
     * kept exactly as it is — that is the whole reason §10 says to keep the
     * bucket alive after the cut-over: a listing imported without its images
     * still renders, and a second run once the download finishes moves it
     * across.
     */
    private function media(mixed $url): ?string
    {
        $url = $this->text($url, 500);
        if ($url === null) {
            return null;
        }

        $path = $this->storagePath($url);
        if ($path === null) {
            return $url;
        }

        $source = $this->mediaRoot.'/'.$path;
        if (! File::exists($source)) {
            return $url;
        }

        if (! $this->dry && ! Storage::disk('public')->exists($path)) {
            Storage::disk('public')->put($path, File::get($source));
        }

        return Storage::disk('public')->url($path);
    }

    /**
     * The object's path inside the bucket, dug out of whichever URL shape
     * Firebase handed back.
     *
     * Two shapes exist in the data: the download URL, which percent-encodes the
     * path into one segment, and the plain storage.googleapis.com one, which
     * does not. A URL that is neither is somebody's own CDN and is left alone.
     */
    private function storagePath(mixed $url): ?string
    {
        $url = (string) ($url ?? '');

        if (preg_match('#/o/([^?]+)#', $url, $m)) {
            return urldecode($m[1]);
        }

        if (preg_match('#^https://storage\.googleapis\.com/[^/]+/(.+?)(?:\?|$)#', $url, $m)) {
            return urldecode($m[1]);
        }

        return null;
    }

    // ── plumbing ─────────────────────────────────────────────────────────────

    /**
     * One exported collection, decoded and counted.
     *
     * Read whole rather than streamed: the biggest file here is `listings`, and
     * at this site's size that is a few megabytes. A streaming JSON reader
     * would be the right call at ten times the data and is not worth carrying
     * for a command that runs once.
     *
     * @return list<array<string, mixed>>
     */
    private function rows(string $name): array
    {
        if (isset($this->cache[$name])) {
            return $this->cache[$name];
        }

        $file = "{$this->path}/{$name}.json";

        if (! File::exists($file)) {
            $this->problems[] = "{$name}.json is missing from the export";

            return $this->cache[$name] = [];
        }

        $rows = json_decode(File::get($file), true);

        if (! is_array($rows)) {
            $this->problems[] = "{$name}.json is not valid JSON";

            return $this->cache[$name] = [];
        }

        $this->tally[$name]['read'] = count($rows);

        return $this->cache[$name] = $rows;
    }

    /**
     * The keys a parent step accepted, plus whatever is already in the table.
     *
     * The union covers both directions: a dry run has nothing in the table and
     * everything in `accepted`, and a `--only=comments` re-run has the reverse.
     *
     * @return array<string, true>
     */
    private function keysOf(string $table, string $column, string $step): array
    {
        return ($this->accepted[$step] ?? [])
            + array_fill_keys(DB::table($table)->pluck($column)->all(), true);
    }

    /** Remember a key this step accepted, for the steps that hang off it. */
    private function accept(string $step, string $key): void
    {
        $this->accepted[$step][$key] = true;
    }

    /**
     * @param  array<string, mixed>  $key
     * @param  array<string, mixed>  $values
     */
    private function write(string $table, array $key, array $values): void
    {
        $collection = $this->step;
        $this->tally[$collection]['written'] = ($this->tally[$collection]['written'] ?? 0) + 1;

        if ($this->dry) {
            return;
        }

        DB::table($table)->updateOrInsert($key, $values);
    }

    private function skip(string $collection, string $why): void
    {
        $this->tally[$collection]['skipped'] = ($this->tally[$collection]['skipped'] ?? 0) + 1;

        // Ten is enough to see the shape of a problem; a thousand identical
        // lines only buries the other problems under it.
        if (($this->tally[$collection]['skipped'] ?? 0) <= 10) {
            $this->problems[] = "skipped: {$why}";
        }
    }

    private function text(mixed $value, int $max): ?string
    {
        if (! is_string($value) && ! is_numeric($value)) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' ? null : mb_substr($value, 0, $max);
    }

    private function int(mixed $value): ?int
    {
        return is_numeric($value) ? (int) $value : null;
    }

    private function float(mixed $value): ?float
    {
        return is_numeric($value) ? (float) $value : null;
    }

    /** Epoch milliseconds, which is what every timestamp in the export is. */
    private function time(mixed $value): ?Carbon
    {
        if (! is_numeric($value) || (int) $value <= 0) {
            return null;
        }

        return Carbon::createFromTimestampMs((int) $value);
    }

    private function report(): int
    {
        $this->newLine();

        $rows = [];
        foreach ($this->tally as $collection => $counts) {
            $rows[] = [
                $collection,
                $counts['read'] ?? 0,
                $counts['written'] ?? 0,
                $counts['skipped'] ?? 0,
            ];
        }

        $this->table(['collection', 'in export', 'imported', 'skipped'], $rows);

        // The manifest is the export's own count of what it wrote. Comparing
        // against it catches a truncated copy to the server — a file that lost
        // its tail is still valid JSON.
        $manifest = File::exists("{$this->path}/manifest.json")
            ? json_decode(File::get("{$this->path}/manifest.json"), true)
            : null;

        foreach ($manifest['counts'] ?? [] as $collection => $expected) {
            $read = $this->tally[$collection]['read'] ?? 0;
            if ($read !== $expected) {
                $this->problems[] = "{$collection}: the export says {$expected} documents, the file holds {$read}";
            }
        }

        if ($this->problems !== []) {
            $this->newLine();
            $this->warn('Problems:');
            foreach ($this->problems as $problem) {
                $this->line("  · {$problem}");
            }
        }

        $skipped = array_sum(array_column($this->tally, 'skipped'));

        if ($skipped > 0 || $this->problems !== []) {
            // Non-zero so a scripted run stops here rather than carrying on to
            // point DNS at a half-imported database.
            $this->newLine();
            $this->error('Finished with problems — read them before pointing DNS.');

            return self::FAILURE;
        }

        $this->newLine();
        $this->info($this->dry ? 'Dry run clean. Re-run without --dry-run.' : 'Imported cleanly.');

        return self::SUCCESS;
    }
}
