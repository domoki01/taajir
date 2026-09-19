<?php

declare(strict_types=1);

namespace App\Services\Auth;

/**
 * Turn an ID token from the browser into claims worth trusting, or refuse.
 *
 * An interface because this is the one seam in the application where "who is
 * this?" is answered, and the session exchange should depend on the question
 * rather than on Google's particular answer to it. It is also what lets the
 * exchange's own gates — the provider check, the ban check, the referral
 * attribution — be tested without minting a validly-signed Google token, which
 * would be testing Google.
 */
interface VerifiesIdTokens
{
    /**
     * @return array<string, mixed> the verified claims
     *
     * @throws InvalidIdToken when the token is not one this application accepts
     */
    public function verify(string $idToken): array;
}
