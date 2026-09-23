<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Nav;
use App\Support\ReferralCode;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Cookie;

/**
 * `/r/CODE` — the link a referrer shares on WhatsApp.
 *
 * Parks the code in a cookie and sends the visitor to the home page. The code
 * is not resolved to an account here: that happens once, at account creation,
 * in SessionController. Resolving it now would cost a query on every click of
 * a link that mostly gets closed again.
 *
 * An invalid code is not an error the visitor should see. They followed a link
 * a friend sent; the worst outcome is that nobody gets credited.
 */
final class ReferralController extends Controller
{
    public function __invoke(string $code): RedirectResponse
    {
        $response = redirect()->to(Nav::href('/'));

        if (ReferralCode::isValid($code)) {
            $response->withCookie(Cookie::make(
                ReferralCode::COOKIE,
                $code,
                ReferralCode::COOKIE_DAYS * 24 * 60,
                httpOnly: true,
            ));
        }

        return $response;
    }
}
