<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\Setting;
use App\Models\User;
use App\Support\ListingId;
use App\Support\ListingSlug;
use App\Support\Text;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Every write to `listings` goes through here.
 *
 * Not a controller, not a view, not a job. This is what makes the quota, the
 * policy verdict, the slug and the derived fields impossible to bypass — the
 * job `firestore.rules` did by denying clients every write to the collection.
 * A second path into this table is a second place for all of it to be wrong.
 */
final class ListingService
{
    /**
     * @param  array<string, mixed>  $input
     * @param  list<array{url: string, storage_path?: string|null, width?: int|null, height?: int|null}>  $images
     *
     * @throws ValidationException when the account may not publish, or the policy refuses
     */
    public function create(User $user, array $input, array $images = []): Listing
    {
        $verdict = Policy::check((string) $input['title'], (string) $input['description']);

        // A refusal never reaches the database. The author gets the reason and
        // their text back; nothing is stored, so nothing has to be cleaned up.
        if ($verdict['decision'] === Policy::REJECT) {
            throw ValidationException::withMessages(['description' => $verdict['reason']]);
        }

        return DB::transaction(function () use ($user, $input, $images, $verdict): Listing {
            /*
             * The lock is the whole point of §4.4.
             *
             * Without it two submissions from two tabs both read the same
             * count, both pass a check only one should, and the quota is a
             * suggestion. Firestore had an optimistic transaction for this;
             * here it is a row lock held until the insert and the increment are
             * both done.
             */
            $owner = User::query()->lockForUpdate()->findOrFail($user->uid);

            if ($owner->is_banned) {
                throw ValidationException::withMessages(['title' => __('listing.banned')]);
            }

            $requireApproval = (Setting::read('access')['requireApproval'] ?? false) === true;
            if ($requireApproval && ! $owner->approved) {
                throw ValidationException::withMessages(['title' => __('listing.awaiting_approval')]);
            }

            if ($owner->active_listing_count >= $owner->listing_quota) {
                throw ValidationException::withMessages([
                    'title' => __('listing.quota_reached', ['quota' => $owner->listing_quota]),
                ]);
            }

            $listing = Listing::create($this->row($owner, $input, $verdict, $images));

            foreach (array_values($images) as $position => $image) {
                $listing->images()->create([
                    'url' => $image['url'],
                    'storage_path' => $image['storage_path'] ?? null,
                    'width' => $image['width'] ?? null,
                    'height' => $image['height'] ?? null,
                    'position' => $position,
                ]);
            }

            foreach ((array) ($input['amenities'] ?? []) as $amenity) {
                $listing->amenities()->create(['amenity' => $amenity]);
            }

            // Counted while it is pending as well as published: a quota that
            // only counted live ads would let someone queue fifty.
            if ($listing->status()->countsAgainstQuota()) {
                $owner->increment('active_listing_count');
            }

            return $listing;
        });
    }

    /**
     * @param  array<string, mixed>  $input
     * @param  array{decision: string, rule: string, reason: string}  $verdict
     * @param  list<array<string, mixed>>  $images
     * @return array<string, mixed>
     */
    private function row(User $owner, array $input, array $verdict, array $images): array
    {
        $wilaya = Geo::wilaya((string) $input['wilaya']);
        $status = $this->statusFor($verdict);

        $title = trim((string) $input['title']);

        return [
            'id' => $input['id'] ?? ListingId::mint(),
            'slug' => ListingSlug::build(
                (string) $input['transaction_type'],
                (string) $input['property_type'],
                $input['rooms_code'] ?? null,
                $input['commune'] ?? null,
                (string) $input['wilaya'],
            ),

            'owner_uid' => $owner->uid,
            'owner_type' => $owner->agency_id !== null ? 'agency' : 'individual',
            'agency_id' => $owner->agency_id,
            // Derived, so a page of cards is one query. Refreshed when the
            // owner saves their profile.
            'owner_name' => $owner->display_name,
            'owner_is_verified' => false,

            'transaction_type' => $input['transaction_type'],
            'sale_form' => $input['sale_form'] ?? null,
            'property_type' => $input['property_type'],
            'housing_program' => $input['housing_program'] ?? null,

            // Whole dinars, converted by the one helper that may do it.
            'price' => (int) ($input['price'] ?? 0),
            'price_unit' => $input['price_unit'] ?? 'total',
            'price_on_request' => (bool) ($input['price_on_request'] ?? false),
            'is_negotiable' => (bool) ($input['is_negotiable'] ?? false),

            'area_built' => $input['area_built'] ?? null,
            'area_land' => $input['area_land'] ?? null,
            'rooms_code' => $input['rooms_code'] ?? null,
            'bathrooms' => $input['bathrooms'] ?? null,
            'floor' => $input['floor'] ?? null,
            'condition_code' => $input['condition_code'] ?? null,
            'paperwork' => $input['paperwork'] ?? null,

            'wilaya_code' => $wilaya?->code ?? 0,
            'wilaya_slug' => $input['wilaya'],
            'commune_slug' => $input['commune'] ?? '',
            'quartier' => $input['quartier'] ?? null,

            'title' => $title,
            'description' => trim((string) $input['description']),
            // images[0], so a card needs no array access.
            'cover_url' => $images[0]['url'] ?? null,
            // The same fold the search query runs through, or nothing matches.
            'search_text' => Text::normalize(implode(' ', array_filter([
                $title,
                $input['commune'] ?? null,
                $wilaya?->name_ar,
                $wilaya?->name_fr,
                $input['wilaya'],
            ]))),

            'contact_phone' => $input['contact_phone'] ?? $owner->phone,
            'show_phone' => (bool) ($input['show_phone'] ?? true),
            'allow_whatsapp' => (bool) ($input['allow_whatsapp'] ?? true),

            'status' => $status->value,
            // Explicit rather than left to the column default: the model
            // returned from create() carries what was written, not what the
            // database filled in, and a null here reads as "unknown" to every
            // caller that asks whether this ad is cleared for the launch.
            'approved_for_launch' => false,
            'policy_rule' => $verdict['rule'] !== '' ? $verdict['rule'] : null,
            'published_at' => $status === ListingStatus::Published ? now() : null,
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    /**
     * Where a new ad lands.
     *
     * Three outcomes, in this order. The launch hold wins over everything: an
     * ad submitted before the site opens is held whatever the policy thought of
     * it, and `approved_for_launch` is what a moderator sets during the hold —
     * reusing `published` for "approved" would put it on the site the moment
     * they clicked.
     */
    private function statusFor(array $verdict): ListingStatus
    {
        if ($this->siteIsHeld()) {
            return ListingStatus::PendingLaunch;
        }

        return $verdict['decision'] === Policy::REVIEW
            ? ListingStatus::Pending
            : ListingStatus::Published;
    }

    private function siteIsHeld(): bool
    {
        // Phase 8 owns this switch; reading it here is what makes the hold
        // real, and its default is "open" so a missing row never stops anyone
        // publishing.
        return Launch::current()->isHeld();
    }
}
