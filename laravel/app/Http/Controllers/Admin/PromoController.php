<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Promo;
use App\Services\PromoService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * The home-page carousel.
 *
 * The permission is checked on the route group, again here, and a third time
 * inside the service — the page guard and the action guard protect against
 * different mistakes, and a banner is the one thing on the home page that
 * every visitor sees.
 */
final class PromoController extends Controller
{
    public function __construct(private readonly PromoService $promos) {}

    private function authorizeAction(Request $request): void
    {
        abort_unless($request->user()?->hasPermission(Permission::PromosManage) === true, 403);
    }

    public function index(Request $request): View
    {
        $this->authorizeAction($request);

        return view('admin.promos', [
            'promos' => Promo::query()->orderBy('order')->orderBy('id')->get(),
            'max' => PromoService::MAX,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate([
            'image' => ['required', 'image', 'mimes:jpeg,png,webp', 'max:4096'],
            'title' => ['required', 'string', 'max:140'],
            'link_url' => ['required', 'string', 'max:500'],
        ]);

        $this->promos->create(
            $request->user(),
            $validated['image'],
            $validated['title'],
            $validated['link_url'],
        );

        return back()->with('status', __('admin.promos.created'));
    }

    public function update(Request $request, Promo $promo): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:140'],
            'link_url' => ['required', 'string', 'max:500'],
        ]);

        $this->promos->update($request->user(), $promo, $validated['title'], $validated['link_url']);

        return back()->with('status', __('admin.promos.updated'));
    }

    public function toggle(Request $request, Promo $promo): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate(['active' => ['required', 'boolean']]);

        $this->promos->setActive($request->user(), $promo, (bool) $validated['active']);

        return back();
    }

    public function move(Request $request, Promo $promo): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate(['direction' => ['required', 'in:up,down']]);

        $this->promos->move($request->user(), $promo, $validated['direction']);

        return back();
    }

    public function destroy(Request $request, Promo $promo): RedirectResponse
    {
        $this->authorizeAction($request);

        $this->promos->delete($request->user(), $promo);

        return back()->with('status', __('admin.promos.deleted'));
    }
}
