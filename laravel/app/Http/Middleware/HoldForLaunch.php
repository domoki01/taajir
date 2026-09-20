<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Services\Launch;
use App\Support\Nav;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keep the public out of the catalogue while the site is held.
 *
 * Middleware, where the Next app had to call a guard from inside each page:
 * verifying a Firebase session cookie needed the Admin SDK, which does not run
 * on the edge, so its middleware could only ever guess who was asking. Laravel
 * has the session here, so the check goes in one place and no page can be added
 * later that forgets to make it.
 *
 * Staff walk through. Somebody has to be able to look at the site they are
 * about to launch, and reviewing the queue means opening the pages it holds.
 */
final class HoldForLaunch
{
    public function handle(Request $request, Closure $next): Response
    {
        if (Launch::current()->admits($request->user())) {
            return $next($request);
        }

        // A redirect, not a 404 or a 503: the visitor is not lost and nothing
        // is broken — there is a page that explains, and it is the one the
        // whole pre-launch funnel is pointing at.
        return redirect()->to(Nav::href('/lancement'));
    }
}
