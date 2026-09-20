<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\Launch;
use App\Services\RunLaunch;
use App\Support\Nav;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * The closed door, and the two ways through it.
 */
final class LaunchController extends Controller
{
    /** The countdown page. */
    public function show(Request $request): View|RedirectResponse
    {
        $launch = Launch::current();

        // Nothing to wait for once the doors are open. Someone who bookmarked
        // this page, or left the tab sitting here overnight, lands on the real
        // site instead of a countdown to a moment that has passed.
        if (! $launch->isHeld()) {
            return redirect()->to(Nav::href('/'));
        }

        return view('launch', ['launch' => $launch, 'user' => $request->user()]);
    }

    /**
     * What the countdown polls.
     *
     * Tiny and public on purpose: it says whether the site is open and when it
     * plans to be, which is exactly what the closed page already tells every
     * visitor. Nothing about who is asking, so it needs no session.
     */
    public function state(): JsonResponse
    {
        return response()
            ->json(Launch::current()->toPayload())
            ->header('Cache-Control', 'no-store');
    }

    /**
     * Fire the launch when the countdown reaches zero, with nobody watching.
     *
     * Needs a cron hitting it with CRON_SECRET as a bearer token. Until that
     * job exists the route answers 503 and the launch stays where it already
     * works — the admin's switch. That ordering is deliberate rather than an
     * oversight: an automated launch that half-works is worse than one that
     * plainly does not.
     */
    public function cron(Request $request, RunLaunch $run): JsonResponse
    {
        $secret = (string) config('taajir.cron_secret');

        if ($secret === '') {
            return response()->json(['error' => 'cron not configured'], 503);
        }

        $presented = (string) str($request->header('Authorization', ''))->after('Bearer ');

        // hash_equals, not ===. This guards a switch that makes a whole site
        // public, so it gets a comparison whose running time says nothing about
        // how much of the secret was right.
        if ($presented === '' || ! hash_equals($secret, $presented)) {
            return response()->json(['error' => 'unauthorized'], 401);
        }

        $launch = Launch::current();

        if (! $launch->isHeld()) {
            return response()->json(['skipped' => 'already active']);
        }

        if (! $launch->timerElapsed()) {
            return response()->json(['skipped' => 'timer has not elapsed']);
        }

        return response()->json(['launched' => true, ...$run('cron')]);
    }
}
