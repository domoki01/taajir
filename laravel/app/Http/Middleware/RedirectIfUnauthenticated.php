<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\Nav;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The door to anything behind a login.
 *
 * Sends a signed-out visitor to /connexion?next=… in their own language, which
 * is the same contract the Next app's requireUser() had — which is why the nav
 * lists the account screens for everybody rather than resolving a session to
 * decide whether to show six links.
 */
final class RedirectIfUnauthenticated
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() !== null) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            return response()->json(['error' => 'unauthenticated'], Response::HTTP_UNAUTHORIZED);
        }

        return redirect()->to(
            Nav::href('/connexion').'?next='.urlencode(Nav::currentPath())
        );
    }
}
