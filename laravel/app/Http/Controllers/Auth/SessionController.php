<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\User;
use App\Services\Auth\EmailAlreadyClaimed;
use App\Services\Auth\InvalidIdToken;
use App\Services\Auth\VerifiesIdTokens;
use App\Support\ReferralCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/**
 * ── SESSION EXCHANGE ─────────────────────────────────────────────────────────
 * The browser signs in with the Firebase SDK and posts its ID token here; we
 * verify it and start a Laravel session. From that point on every request is
 * authenticated by Laravel's own session cookie and the Firebase token is never
 * looked at again — §5 of the roadmap. The ID token is never stored anywhere:
 * it is short-lived and not revocable server-side.
 *
 * This route is the only place the whole site actually trusts. No session
 * cookie, no account, nothing but "whatever exists in Firebase Auth" — so every
 * gate that matters is enforced right here.
 */
final class SessionController extends Controller
{
    public function __construct(private readonly VerifiesIdTokens $verifier) {}

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'idToken' => ['required', 'string', 'max:4096'],
        ]);

        // A token is cheap to post and expensive to verify: the first failure
        // costs a round trip to Google. Keyed by IP because there is no account
        // yet to key it by.
        $throttle = 'auth:'.$request->ip();
        if (RateLimiter::tooManyAttempts($throttle, 20)) {
            return response()->json(
                ['error' => 'too many attempts'],
                Response::HTTP_TOO_MANY_REQUESTS,
            );
        }
        RateLimiter::hit($throttle, 300);

        try {
            $claims = $this->verifier->verify($validated['idToken']);
        } catch (InvalidIdToken $e) {
            // Never echo the underlying reason: it can carry project ids, claim
            // values and internals. The log is the place for it.
            report($e);

            return response()->json(['error' => 'unauthorized'], Response::HTTP_UNAUTHORIZED);
        }

        // ── THE PROVIDER GATE ────────────────────────────────────────────────
        // Enforced here, not in the sign-up form, because the form is not a
        // gate. The Firebase web API key is public by design and the Identity
        // Toolkit REST endpoint accepts it from anywhere, so removing a button
        // removes a button — an attacker calls accounts:signUp directly and
        // never sees the page.
        //
        // The live site was mass-registered from that endpoint — 213 accounts
        // in under an hour, on invented addresses — which is what this closes.
        //
        // Email/password is refused outright rather than merely required to be
        // verified: an unverified address is a claim on somebody else's inbox,
        // and the launch mail-out would have delivered to every one of them.
        // Google and phone both prove the identifier before Firebase ever
        // issues the token.
        $provider = $this->signInProvider($claims);
        if ($provider === 'password') {
            return response()->json(
                ['error' => 'provider disabled', 'code' => 'password-disabled'],
                Response::HTTP_FORBIDDEN,
            );
        }

        /*
         * The phone door, when it is shut.
         *
         * Checked here and not only in the view, because hiding a form does not
         * close a door: a token minted anywhere — another tab, a copy of the
         * page, the SDK from a console — posts to this endpoint just the same.
         * A switch the server does not honour is a switch that means nothing.
         */
        if ($provider === 'phone' && ! config('taajir.phone_signin_enabled')) {
            return response()->json(
                ['error' => 'provider disabled', 'code' => 'phone-disabled'],
                Response::HTTP_FORBIDDEN,
            );
        }

        try {
            $user = $this->account($claims, $provider, $request);
        } catch (EmailAlreadyClaimed $e) {
            /*
             * The address is on an account with a different uid.
             *
             * A uid is minted per Firebase project, so moving projects gives
             * everyone a new one while users.email stays unique — and the same
             * person signing in again collides with the row they left behind.
             * Left alone this is an unhandled constraint violation: a 500, a
             * stack trace in the log, and a visitor told nothing.
             *
             * Refused rather than resolved. Adopting the old row means re-keying
             * it across seven tables that reference a uid, and doing that
             * silently, inside a sign-in, on data nobody has looked at, is not a
             * thing to decide on a visitor's behalf. taajir:adopt-account is
             * where that decision belongs.
             */
            Log::warning('sign-in blocked: email already on another uid', [
                'uid' => $claims['sub'] ?? null,
                'existing_uid' => $e->existingUid,
            ]);

            return response()->json(
                ['error' => 'email already claimed', 'code' => 'email-claimed'],
                Response::HTTP_CONFLICT,
            );
        }

        // A banned account must not get a session at all. Everything else —
        // waiting on approval included — signs in fine and is gated at the
        // point of writing, not at the door.
        if ($user->is_banned) {
            return response()->json(
                ['error' => 'banned', 'code' => 'account-banned'],
                Response::HTTP_FORBIDDEN,
            );
        }

        $request->session()->regenerate();
        Auth::login($user, remember: true);

        $response = response()->json(['ok' => true]);

        // Spent. Leaving it would re-offer the same code to whoever signs in on
        // this device next — a shared phone in a cybercafé is not unusual here.
        if ($request->cookie(ReferralCode::COOKIE) !== null) {
            $response->withCookie(Cookie::forget(ReferralCode::COOKIE));
        }

        return $response;
    }

    public function destroy(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    /**
     * Find or create the account behind a verified token.
     *
     * In a transaction because two tabs finishing sign-in together would
     * otherwise both see "no row" and both insert; the uid is the primary key,
     * so the second insert is an error rather than a duplicate, but the
     * referral attribution and the minted code are worth doing exactly once.
     *
     * @param  array<string, mixed>  $claims
     */
    private function account(array $claims, ?string $provider, Request $request): User
    {
        $uid = (string) $claims['sub'];

        return DB::transaction(function () use ($uid, $claims, $provider, $request): User {
            $user = User::query()->lockForUpdate()->find($uid);

            if ($user !== null) {
                $user->forceFill([
                    'last_seen_at' => now(),
                    // Refreshed every sign-in: an address can become verified
                    // after the account was made, and rows written before this
                    // field existed must not read as verified by their absence.
                    'email_verified' => ($claims['email_verified'] ?? false) === true,
                ]);

                // A returning phone user whose row predates this field gets it
                // filled in, but a number they later edited in their profile is
                // never overwritten.
                if ($user->phone === null && isset($claims['phone_number'])) {
                    $user->phone = (string) $claims['phone_number'];
                }

                $user->save();

                return $user;
            }

            $email = $claims['email'] ?? null;

            // users.email is unique. Checked here rather than left to the
            // constraint so the caller gets a named failure with the uid that
            // holds the address, instead of a QueryException it would have to
            // parse a driver message out of.
            if ($email !== null) {
                $holder = User::query()->where('email', $email)->first();

                if ($holder !== null) {
                    throw new EmailAlreadyClaimed($holder->uid, (string) $email);
                }
            }

            return User::create([
                'uid' => $uid,
                'email' => $email,
                'display_name' => $this->displayName($claims),
                'photo_url' => $claims['picture'] ?? null,
                // Present only for accounts created through phone sign-in. It
                // is the one way to reach those users, and the publish form
                // prefills the contact field from it rather than asking for a
                // number they just typed.
                'phone' => $claims['phone_number'] ?? null,
                'email_verified' => ($claims['email_verified'] ?? false) === true,
                'role_id' => 'user',
                'approved' => $this->approvedOnCreation($provider),
                'listing_quota' => config('taajir.free_listing_quota'),
                'referral_code' => ReferralCode::mint(),
                'referred_by' => $this->referrer($uid, $request),
                'locale' => app()->getLocale(),
                'created_at' => now(),
                'last_seen_at' => now(),
            ]);
        });
    }

    /**
     * A new account is approved on the spot unless an admin switched
     * registration approval on — and even then, a provider that already proved
     * the person walks straight through.
     *
     * Written at creation rather than read live, so the publish gate is one
     * column and so flipping the switch later never retroactively mutes
     * anybody. Creation-only is also what keeps revoking approval meaningful:
     * re-deciding this on every sign-in would hand a Google account back its
     * approval the next morning and quietly undo the moderator who took it away.
     */
    private function approvedOnCreation(?string $provider): bool
    {
        $requireApproval = (Setting::read('access')['requireApproval'] ?? false) === true;

        return ! $requireApproval || $this->skipsApprovalQueue($provider);
    }

    /**
     * Sign-in providers that skip the approval queue.
     *
     * Approval exists to filter accounts opened on invented identifiers. A
     * Google account is not one of those: Google proved the address before
     * Firebase ever issued the token, and a moderator opening that row by hand
     * has nothing left to check.
     *
     * Phone is deliberately not on the list: it proves a number, not a person,
     * and one SIM is cheap enough to buy in bulk.
     */
    private function skipsApprovalQueue(?string $provider): bool
    {
        return $provider === 'google.com';
    }

    /**
     * The uid behind the invite link this visitor arrived through, if any.
     *
     * Settled here rather than at the click, because this is the first moment
     * an account exists to attach it to, and written exactly once at creation
     * and never afterwards. Anything else lets an account be re-attributed by
     * clicking a second invite link — which is a referral programme paying
     * twice for one user.
     */
    private function referrer(string $uid, Request $request): ?string
    {
        $code = $request->cookie(ReferralCode::COOKIE);

        if (! is_string($code) || ! ReferralCode::isValid($code)) {
            return null;
        }

        $referrer = User::query()->where('referral_code', $code)->value('uid');

        // Self-referral cannot happen — the referrer's row existed before this
        // one did — but the check costs nothing and documents the intent.
        return $referrer !== null && $referrer !== $uid ? $referrer : null;
    }

    /**
     * `firebase.sign_in_provider`, straight off the verified token.
     *
     * JWT::decode hands back stdClass for nested claims; the cast in verify()
     * only flattens the top level. Reading both shapes means a change in the
     * library's decode options cannot silently turn the provider gate into a
     * no-op, which is the kind of failure that opens a door rather than closing
     * one.
     *
     * @param  array<string, mixed>  $claims
     */
    private function signInProvider(array $claims): ?string
    {
        $firebase = $claims['firebase'] ?? null;

        $provider = match (true) {
            is_object($firebase) => $firebase->sign_in_provider ?? null,
            is_array($firebase) => $firebase['sign_in_provider'] ?? null,
            default => null,
        };

        return is_string($provider) ? $provider : null;
    }

    /** @param array<string, mixed> $claims */
    private function displayName(array $claims): string
    {
        $name = trim((string) ($claims['name'] ?? ''));

        // A phone account has no name at all until its owner sets one.
        return $name !== '' ? mb_substr($name, 0, 80) : __('auth.default_name');
    }
}
