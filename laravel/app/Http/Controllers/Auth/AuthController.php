<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * The two pages that host the Firebase sign-in widget.
 *
 * Deliberately not Livewire. The widget talks to the Firebase SDK in the
 * browser — Google popup, phone SMS and reCAPTCHA — and then posts one token to
 * /auth/session. Putting a server round trip in the middle of that would buy
 * nothing and break the popup flow.
 */
final class AuthController extends Controller
{
    public function signIn(Request $request): View
    {
        return view('auth.sign-in', [
            'next' => $this->safeNext($request),
            'signUp' => false,
        ]);
    }

    public function signUp(Request $request): View
    {
        return view('auth.sign-in', [
            'next' => $this->safeNext($request),
            'signUp' => true,
        ]);
    }

    /**
     * Where to send someone once they are in.
     *
     * Only a path on this site, never a full URL. `?next=https://evil.example`
     * on a sign-in page is the oldest open-redirect there is, and a sign-in
     * page is exactly where it is most valuable to whoever sends the link.
     * A protocol-relative `//evil.example` is a URL too, which is why the
     * second slash is rejected as well.
     */
    private function safeNext(Request $request): string
    {
        $next = (string) $request->query('next', '');

        if ($next === '' || ! str_starts_with($next, '/') || str_starts_with($next, '//')) {
            return '/tableau-de-bord';
        }

        return $next;
    }
}
