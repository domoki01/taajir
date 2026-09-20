<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\Permission;
use App\Models\AuditEntry;
use App\Models\Listing;
use App\Models\PropertyRequest;
use App\Models\RequestReply;
use App\Models\Setting;
use App\Models\User;
use App\Support\Links;
use App\Support\ListingId;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * The demand feed and its replies.
 *
 * Nothing moderates this feed before it appears, so the caps are what stop one
 * person owning the first screen.
 */
final class RequestService
{
    /** Four in five minutes. */
    private const PER_WINDOW = 4;

    private const WINDOW = 300;

    public function create(User $owner, array $input): PropertyRequest
    {
        $this->throttle('request:'.$owner->uid, self::PER_WINDOW, self::WINDOW);

        // Five is more demands than anyone genuinely has at once, and the cap
        // is what keeps the feed from being one person's noticeboard.
        $open = PropertyRequest::query()
            ->where('owner_uid', $owner->uid)
            ->whereIn('status', ['visible', 'pending', 'pendingLaunch'])
            ->count();

        if ($open >= config('taajir.max_open_requests')) {
            throw ValidationException::withMessages([
                'title' => __('community.too_many_requests', ['max' => config('taajir.max_open_requests')]),
            ]);
        }

        $verdict = Policy::check((string) $input['title'], (string) $input['description']);

        if ($verdict['decision'] === Policy::REJECT) {
            throw ValidationException::withMessages(['description' => $verdict['reason']]);
        }

        return PropertyRequest::create([
            'id' => ListingId::mint(),
            'owner_uid' => $owner->uid,
            // From the verified session, never from the request body.
            'owner_name' => $owner->display_name,
            'owner_photo_url' => $owner->photo_url,
            'intent' => $input['intent'],
            'title' => trim((string) $input['title']),
            'description' => trim((string) $input['description']),
            'wilaya_slug' => $input['wilaya'],
            'commune_slug' => $input['commune'] ?? null,
            'status' => $this->statusFor($verdict),
            'policy_rule' => $verdict['rule'] !== '' ? $verdict['rule'] : null,
            'reply_count' => 0,
            'created_at' => now(),
        ]);
    }

    /**
     * A reply, optionally carrying one of the author's own ads.
     *
     * "Their own" is checked here rather than trusted: attaching somebody
     * else's listing would let anyone advertise an ad they do not control on a
     * thread full of ready buyers.
     */
    public function reply(User $author, PropertyRequest $request, string $text, ?string $listingId = null): RequestReply
    {
        $this->throttle('reply:'.$author->uid, 8, 60);

        if (Links::present($text)) {
            throw ValidationException::withMessages(['text' => Links::refusalMessage()]);
        }

        $listing = null;
        if ($listingId !== null && $listingId !== '') {
            $listing = Listing::query()
                ->where('owner_uid', $author->uid)
                ->published()
                ->find($listingId);

            if ($listing === null) {
                throw ValidationException::withMessages(['listing_id' => __('community.not_your_listing')]);
            }
        }

        return DB::transaction(function () use ($author, $request, $text, $listing) {
            $reply = $request->replies()->getQuery()->create([
                'request_id' => $request->id,
                'author_uid' => $author->uid,
                'author_name' => $author->display_name,
                'author_photo_url' => $author->photo_url,
                'is_owner' => $author->uid === $request->owner_uid,
                'text' => trim($text),
                'listing_id' => $listing?->id,
                'status' => 'visible',
                'created_at' => now(),
            ]);

            // A counter on the row, so a feed card needs no second query.
            $request->increment('reply_count');

            return $reply;
        });
    }

    private function statusFor(array $verdict): string
    {
        if ((Setting::read('launch')['held'] ?? false) === true) {
            return 'pendingLaunch';
        }

        return $verdict['decision'] === Policy::REVIEW ? 'pending' : 'visible';
    }

    private function throttle(string $key, int $limit, int $seconds): void
    {
        if (RateLimiter::tooManyAttempts($key, $limit)) {
            throw ValidationException::withMessages([
                'title' => __('community.too_fast', ['seconds' => RateLimiter::availableIn($key)]),
            ]);
        }

        RateLimiter::hit($key, $seconds);
    }

    /**
     * A moderator's decision on a demand.
     *
     * Three states and no fourth: visible, hidden with a reason, or refused
     * with one. Hidden and refused both keep the row and both stay readable to
     * their author, because a post that vanishes without a word reads as a bug
     * and gets written again an hour later.
     */
    public function moderate(User $actor, PropertyRequest $request, string $status, string $reason = ''): void
    {
        abort_unless($actor->hasPermission(Permission::RequestsModerate), 403);
        abort_unless(in_array($status, ['visible', 'hidden', 'rejected'], true), 422);

        $reason = trim($reason);

        // A refusal with no reason is one the author cannot act on, so they
        // post the same thing again — the rule the listing queue already holds.
        if ($status !== 'visible' && $reason === '') {
            throw ValidationException::withMessages(['reason' => __('admin.requests.needs_reason')]);
        }

        $request->forceFill([
            'status' => $status,
            'hidden_reason' => $status === 'hidden' ? $reason : null,
            'rejection_reason' => $status === 'rejected' ? $reason : null,
            'moderated_by' => $actor->uid,
            'moderated_at' => now(),
        ])->save();

        AuditEntry::record($actor, 'request.'.$status, 'request', $request->id, $reason === '' ? [] : ['reason' => $reason]);
    }
}
