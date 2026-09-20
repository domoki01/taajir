<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The door to /admin.
 *
 * It asks one question — does this account hold any permission at all — and
 * nothing more. What a member of staff may do once inside is decided per
 * screen, and again by every action behind every button: reaching a page is
 * never treated as proof of anything.
 *
 * 403, not 404. Hiding the section's existence sounds appealing until you
 * notice what it would leak: a moderator without comments.moderate gets 403 on
 * /admin/commentaires while a plain visitor gets 404 on the same URL, so the
 * two status codes answer "are you staff?" for anyone who checks. One code for
 * "not yours" says less, and the paths are in the repository anyway.
 */
final class EnsureStaff
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->isStaff() === true, 403);

        return $next($request);
    }
}
