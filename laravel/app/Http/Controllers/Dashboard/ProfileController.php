<?php

declare(strict_types=1);

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Follows;
use App\Services\Geo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * "معلوماتي" — the account's own details.
 *
 * This page is why the link in the account menu was a 404: Nav has pointed at
 * /tableau-de-bord/profil since the menu was written, and the route was never
 * added. A link to a page that does not exist is worse than no link, because
 * the person assumes the feature is broken rather than absent.
 */
final class ProfileController extends Controller
{
    public function __construct(private readonly Follows $follows) {}

    public function edit(Request $request): View
    {
        $user = $request->user();

        return view('dashboard.profile', [
            'user' => $user,
            'wilayas' => Geo::wilayas(),
            'followerCount' => $this->follows->followerCount($user),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'display_name' => ['required', 'string', 'min:2', 'max:80'],
            // Nullable on purpose: a Google account arrives without one, and
            // forcing a number to save a name would teach people to type
            // anything.
            'phone' => ['nullable', 'string', 'max:20'],
            'wilaya' => ['nullable', 'string', 'exists:wilayas,slug'],
            'notify_on_message' => ['nullable', 'boolean'],
            'notify_on_saved_search' => ['nullable', 'boolean'],
        ]);

        $wilaya = $data['wilaya'] ?? null;

        $user->update([
            'display_name' => trim($data['display_name']),
            'phone' => $data['phone'] ?? null,
            'wilaya_code' => $wilaya !== null ? Geo::wilaya($wilaya)?->code : null,
            // An unchecked box sends nothing at all, so absence is false here
            // rather than "leave it alone" — otherwise a preference can be
            // turned on and never off again.
            'notify_on_message' => $request->boolean('notify_on_message'),
            'notify_on_saved_search' => $request->boolean('notify_on_saved_search'),
        ]);

        /*
         * The denormalised copy on every ad they own.
         *
         * owner_name is copied onto listings so a page of cards is one query.
         * Renaming yourself and leaving the old name on thirty ads is the cost
         * of that, and this is where it is paid.
         */
        $user->listings()->update(['owner_name' => $user->display_name]);

        return back()->with('status', __('profile.saved'));
    }
}
