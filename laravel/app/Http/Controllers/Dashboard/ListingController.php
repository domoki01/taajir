<?php

declare(strict_types=1);

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * «إعلاناتي» — every ad this account has, in every state.
 *
 * Including the rejected ones, with the reason. An owner who cannot see why
 * their ad was refused posts the same thing again.
 */
final class ListingController extends Controller
{
    public function index(Request $request): View
    {
        return view('dashboard.listings', [
            'listings' => Listing::query()
                ->where('owner_uid', $request->user()->uid)
                ->latest('created_at')
                ->paginate(20),
        ]);
    }
}
