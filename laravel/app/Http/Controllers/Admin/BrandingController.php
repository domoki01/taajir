<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\AuditEntry;
use App\Models\Setting;
use App\Services\Branding;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * The name, the tagline, the logo and the six brand colours.
 *
 * A save repaints the site on the next request with no deploy, which is the
 * whole point — and the reason the screen validates hard. Everything it stores
 * is rendered somewhere unescapable: the colours land inside a <style> body and
 * the logo inside an <img src>.
 */
final class BrandingController extends Controller
{
    private function authorizeAction(Request $request): void
    {
        abort_unless($request->user()?->hasPermission(Permission::BrandingEdit) === true, 403);
    }

    public function index(Request $request): View
    {
        $this->authorizeAction($request);

        return view('admin.branding', [
            'branding' => Branding::current(),
            // What the build ships, so each field can show what clearing it
            // falls back to rather than just emptying.
            'defaults' => [
                'siteName' => __('brand.name'),
                'tagline' => __('brand.tagline'),
            ],
        ]);
    }

    public function save(Request $request): RedirectResponse
    {
        $this->authorizeAction($request);

        $validated = $request->validate([
            'site_name' => ['required', 'string', 'min:2', 'max:30'],
            'tagline' => ['required', 'string', 'min:3', 'max:60'],
            // https only, and no character that could break out of the
            // attribute it lands in. The URL ends up as an <img src>, so "an
            // admin typed it" is not enough on its own.
            'logo_url' => ['nullable', 'string', 'max:500', 'regex:/^https:\/\/[^\s"\'<>]+$/i'],
            'colors' => ['array'],
            'colors.*' => ['nullable', 'string', 'regex:'.Branding::HEX],
        ], [
            'logo_url.regex' => __('admin.branding.bad_logo'),
            'colors.*.regex' => __('admin.branding.bad_colour'),
        ]);

        $colors = [];
        foreach ($validated['colors'] ?? [] as $key => $value) {
            $value = trim((string) $value);
            // Cleared means "fall back to the build's colour", not "store an
            // empty string" — which would be a token with no value in it.
            if ($value !== '' && isset(Branding::VARIABLES[$key])) {
                $colors[$key] = mb_strtolower($value);
            }
        }

        Setting::query()->updateOrCreate(['key' => 'branding'], [
            'value' => [
                'siteName' => trim($validated['site_name']),
                'tagline' => trim($validated['tagline']),
                'logoUrl' => trim((string) ($validated['logo_url'] ?? '')) ?: null,
                'colors' => $colors,
            ],
            'updated_at' => now(),
            'updated_by' => $request->user()->uid,
        ]);

        Branding::forget();
        AuditEntry::record($request->user(), 'branding.save', 'settings', 'branding', [
            'note' => trim($validated['site_name']),
        ]);

        return back()->with('status', __('admin.branding.saved'));
    }

    /** Back to the palette and the name the build ships with. */
    public function reset(Request $request): RedirectResponse
    {
        $this->authorizeAction($request);

        Setting::query()->whereKey('branding')->delete();
        Branding::forget();
        AuditEntry::record($request->user(), 'branding.reset', 'settings', 'branding');

        return back()->with('status', __('admin.branding.reset_done'));
    }
}
