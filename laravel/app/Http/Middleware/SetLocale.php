<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Enums\Locale;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Decide which language this request is in, and get the `{locale}` segment out
 * of the way before it reaches a controller.
 *
 * The URL is the only authority. A prefix means that language; no prefix means
 * Arabic. Nothing here sniffs Accept-Language or reads a cookie to *change* the
 * page that a URL names — a shared link has to open the same page for everyone
 * who taps it, and in this market the link arrives by WhatsApp and gets opened
 * by twenty people whose browsers disagree. The visitor's preference decides
 * where the *bare* domain sends them, and nothing else (see RedirectToPreferredLocale).
 */
final class SetLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $locale = Locale::tryFrom((string) $request->route()?->parameter('locale'))
            ?? Locale::default();

        app()->setLocale($locale->value);

        // The prefix is a routing concern, not an argument. Without this every
        // controller in the application would have to accept a $locale it has
        // no use for, and the two registrations of each route would differ.
        $request->route()?->forgetParameter('locale');

        return $next($request);
    }
}
