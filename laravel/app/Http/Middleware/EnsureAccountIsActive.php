<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * A banned account loses access on the next request, not whenever its session
 * happens to expire.
 *
 * The Next app got this from `verifySessionCookie(session, true)` — Firebase
 * checked revocation on every read. Laravel's session does not: once it exists
 * it is good until it is destroyed, so a ban would otherwise leave the banned
 * person signed in for a fortnight. This is the replacement, and it runs on
 * every web request rather than only behind the login, because a banned account
 * should stop appearing signed in everywhere, not just on the screens it can no
 * longer reach.
 */
final class EnsureAccountIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null && $user->is_banned) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return $next($request);
    }
}
