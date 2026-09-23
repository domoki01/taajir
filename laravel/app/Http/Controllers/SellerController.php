<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\PropertyRequest;
use App\Models\User;
use App\Services\Follows;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Somebody's public page: their ads, their demands, and a follow button.
 *
 * Keyed on public_id rather than the uid. The uid is twenty-eight characters
 * of Firebase's namespace, it is what the whole auth layer is keyed on, and it
 * changes if the project moves — which it has. A short id of our own keeps the
 * URL readable and keeps the uid out of it.
 */
final class SellerController extends Controller
{
    public function __construct(private readonly Follows $follows) {}

    public function __invoke(Request $request, string $publicId): View
    {
        $seller = User::query()->where('public_id', $publicId)->firstOrFail();

        // A banned account's page is a 404, not an empty profile: the ads are
        // already gone from every listing page, and a profile that still
        // renders is a way back onto the site.
        abort_if($seller->is_banned, 404);

        return view('seller', [
            'seller' => $seller,
            // Only what the public may see. The owner's own drafts and
            // pending ads belong on their dashboard, not on a page anyone
            // can open.
            'listings' => Listing::query()
                ->where('owner_uid', $seller->uid)
                ->where('status', ListingStatus::Published->value)
                ->latest('published_at')
                ->with('images')
                ->paginate(12),
            'requests' => PropertyRequest::query()
                ->where('owner_uid', $seller->uid)
                ->where('status', 'visible')
                ->latest('created_at')
                ->limit(10)
                ->get(),
            'followerCount' => $this->follows->followerCount($seller),
            'isFollowing' => $this->follows->follows($request->user(), $seller),
            'isSelf' => $request->user()?->uid === $seller->uid,
        ]);
    }
}
