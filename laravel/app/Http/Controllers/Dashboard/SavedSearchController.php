<?php

declare(strict_types=1);

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\SavedSearch;
use App\Services\SavedSearchService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class SavedSearchController extends Controller
{
    public function __construct(private readonly SavedSearchService $searches) {}

    public function index(Request $request): View
    {
        return view('dashboard.alerts', [
            'searches' => SavedSearch::where('owner_uid', $request->user()->uid)->latest('created_at')->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'transaction' => ['nullable', 'string', 'max:32'],
            'type' => ['nullable', 'string', 'max:32'],
            // Required: a search with no place matches every ad on the
            // platform and turns the alert into the kind of spam that gets
            // notifications switched off for good.
            'wilaya' => ['required', 'string', 'exists:wilayas,slug'],
            'commune' => ['nullable', 'string', 'max:64'],
            'notify' => ['nullable', 'boolean'],
        ]);

        $this->searches->create($request->user(), $validated);

        return back();
    }

    public function destroy(Request $request, SavedSearch $savedSearch): RedirectResponse
    {
        $this->searches->delete($request->user(), $savedSearch);

        return back();
    }
}
