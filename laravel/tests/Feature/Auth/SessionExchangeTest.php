<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Models\Setting;
use App\Models\User;
use App\Services\Auth\InvalidIdToken;
use App\Services\Auth\VerifiesIdTokens;
use App\Support\ReferralCode;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

/**
 * The session exchange is the only place the whole site trusts: no session
 * cookie, no account, nothing but whatever exists in Firebase Auth. Every gate
 * that matters is enforced there, so every gate is pinned here.
 *
 * The verifier itself is swapped out at the VerifiesIdTokens seam — its own
 * checks are covered in FirebaseTokenVerifierTest, and minting a
 * validly-signed Google token to test the controller would be testing Google.
 */
final class SessionExchangeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    /** @param array<string, mixed> $claims */
    private function tokenReturns(array $claims): void
    {
        $verifier = $this->createMock(VerifiesIdTokens::class);
        $verifier->method('verify')->willReturn($claims);
        $this->app->instance(VerifiesIdTokens::class, $verifier);
    }

    private function tokenIsRejected(): void
    {
        $verifier = $this->createMock(VerifiesIdTokens::class);
        $verifier->method('verify')->willThrowException(new InvalidIdToken('nope'));
        $this->app->instance(VerifiesIdTokens::class, $verifier);
    }

    /** @return array<string, mixed> */
    private function googleClaims(array $overrides = []): array
    {
        return array_merge([
            'sub' => 'uid-google-0000000000000001',
            'email' => 'someone@example.com',
            'email_verified' => true,
            'name' => 'سيدي محمد',
            'picture' => 'https://example.test/p.jpg',
            'firebase' => (object) ['sign_in_provider' => 'google.com'],
        ], $overrides);
    }

    public function test_a_verified_token_creates_an_account_and_signs_it_in(): void
    {
        $this->tokenReturns($this->googleClaims());

        $this->postJson('/auth/session', ['idToken' => 'x'])
            ->assertOk()
            ->assertJson(['ok' => true]);

        $user = User::find('uid-google-0000000000000001');
        $this->assertNotNull($user);
        $this->assertSame('سيدي محمد', $user->display_name);
        $this->assertSame('user', $user->role_id);
        $this->assertTrue($user->email_verified);
        $this->assertSame(config('taajir.free_listing_quota'), $user->listing_quota);
        $this->assertTrue(Auth::check());
    }

    public function test_signing_in_again_does_not_create_a_second_account(): void
    {
        $this->tokenReturns($this->googleClaims());

        $this->postJson('/auth/session', ['idToken' => 'x'])->assertOk();
        $this->post('/auth/session', ['idToken' => 'x'])->assertOk();

        $this->assertSame(1, User::count());
    }

    public function test_email_password_is_refused_outright(): void
    {
        // The form is not a gate: the Firebase web API key is public and the
        // Identity Toolkit REST endpoint accepts it from anywhere. The live site
        // was mass-registered that way — 213 accounts in under an hour — and
        // this is what closes it.
        $this->tokenReturns($this->googleClaims([
            'firebase' => (object) ['sign_in_provider' => 'password'],
        ]));

        $this->postJson('/auth/session', ['idToken' => 'x'])
            ->assertForbidden()
            ->assertJson(['code' => 'password-disabled']);

        $this->assertSame(0, User::count());
        $this->assertFalse(Auth::check());
    }

    public function test_a_token_that_does_not_verify_is_a_401_and_says_nothing_else(): void
    {
        $this->tokenIsRejected();

        $response = $this->postJson('/auth/session', ['idToken' => 'x'])->assertUnauthorized();

        // The reason can carry project ids, claim values and internals. The log
        // is the place for it.
        $this->assertSame(['error' => 'unauthorized'], $response->json());
    }

    public function test_a_missing_token_is_a_422_not_a_500(): void
    {
        $this->postJson('/auth/session', [])->assertUnprocessable();
    }

    public function test_a_banned_account_gets_no_session(): void
    {
        User::create([
            'uid' => 'uid-google-0000000000000001',
            'display_name' => 'Banned',
            'role_id' => 'user',
            'is_banned' => true,
            'referral_code' => ReferralCode::mint(),
            'created_at' => now(),
        ]);
        $this->tokenReturns($this->googleClaims());

        $this->postJson('/auth/session', ['idToken' => 'x'])
            ->assertForbidden()
            ->assertJson(['code' => 'account-banned']);

        $this->assertFalse(Auth::check());
    }

    public function test_the_phone_door_is_shut_by_default(): void
    {
        /*
         * Hiding the form does not close a door: a token minted anywhere —
         * another tab, a copy of the page, the SDK from a console — posts to
         * this endpoint just the same. A switch the server does not honour is a
         * switch that means nothing.
         */
        $this->assertFalse(config('taajir.phone_signin_enabled'));

        $this->tokenReturns([
            'sub' => 'uid-phone-00000000000000009',
            'phone_number' => '+213555000999',
            'firebase' => (object) ['sign_in_provider' => 'phone'],
        ]);

        $this->postJson('/auth/session', ['idToken' => 'x'])
            ->assertForbidden()
            ->assertJsonPath('code', 'phone-disabled');

        $this->assertNull(User::find('uid-phone-00000000000000009'));
    }

    public function test_a_phone_account_gets_a_name_and_keeps_its_number(): void
    {
        // This test is about what happens *after* a phone token is accepted,
        // so it opens the door it depends on rather than inheriting the
        // default — which is shut.
        config(['taajir.phone_signin_enabled' => true]);

        $this->tokenReturns([
            'sub' => 'uid-phone-00000000000000001',
            'phone_number' => '+213555000111',
            'firebase' => (object) ['sign_in_provider' => 'phone'],
        ]);

        $this->postJson('/auth/session', ['idToken' => 'x'])->assertOk();

        $user = User::find('uid-phone-00000000000000001');
        $this->assertSame(__('auth.default_name'), $user->display_name);
        $this->assertSame('+213555000111', $user->phone);
        $this->assertNull($user->email);
    }

    public function test_approval_is_settled_at_creation_and_google_walks_through(): void
    {
        Setting::create(['key' => 'access', 'value' => ['requireApproval' => true]]);

        // Google proved the address before Firebase issued the token; a
        // moderator opening that row by hand has nothing left to check.
        $this->tokenReturns($this->googleClaims());
        $this->postJson('/auth/session', ['idToken' => 'x'])->assertOk();
        $this->assertTrue(User::find('uid-google-0000000000000001')->approved);
    }

    public function test_approval_holds_a_phone_signup_when_the_switch_is_on(): void
    {
        // This test is about what happens *after* a phone token is accepted,
        // so it opens the door it depends on rather than inheriting the
        // default — which is shut.
        config(['taajir.phone_signin_enabled' => true]);

        Setting::create(['key' => 'access', 'value' => ['requireApproval' => true]]);

        // Phone proves a number, not a person, and one SIM is cheap enough to
        // buy in bulk.
        $this->tokenReturns([
            'sub' => 'uid-phone-00000000000000001',
            'phone_number' => '+213555000111',
            'firebase' => (object) ['sign_in_provider' => 'phone'],
        ]);

        $this->postJson('/auth/session', ['idToken' => 'x'])->assertOk();
        $this->assertFalse(User::find('uid-phone-00000000000000001')->approved);
    }

    public function test_everyone_is_approved_when_the_switch_is_off(): void
    {
        // This test is about what happens *after* a phone token is accepted,
        // so it opens the door it depends on rather than inheriting the
        // default — which is shut.
        config(['taajir.phone_signin_enabled' => true]);

        $this->tokenReturns([
            'sub' => 'uid-phone-00000000000000001',
            'phone_number' => '+213555000111',
            'firebase' => (object) ['sign_in_provider' => 'phone'],
        ]);

        $this->postJson('/auth/session', ['idToken' => 'x'])->assertOk();
        $this->assertTrue(User::find('uid-phone-00000000000000001')->approved);
    }

    public function test_an_invite_is_attributed_once_at_creation_and_the_cookie_is_spent(): void
    {
        $referrer = User::create([
            'uid' => 'uid-referrer-000000000000001',
            'display_name' => 'Referrer',
            'role_id' => 'user',
            'referral_code' => 'BCDFGH',
            'created_at' => now(),
        ]);
        $this->tokenReturns($this->googleClaims());

        $response = $this->withCredentials()->withCookie(ReferralCode::COOKIE, 'BCDFGH')
            ->postJson('/auth/session', ['idToken' => 'x'])
            ->assertOk();

        $this->assertSame($referrer->uid, User::find('uid-google-0000000000000001')->referred_by);
        // Spent: leaving it would re-offer the same code to whoever signs in on
        // this device next, and a shared phone is not unusual here.
        $this->assertSame('', $response->getCookie(ReferralCode::COOKIE)?->getValue());
    }

    public function test_a_second_invite_never_re_attributes_an_existing_account(): void
    {
        // Anything else is a referral programme paying twice for one user.
        User::create([
            'uid' => 'uid-referrer-000000000000001',
            'display_name' => 'First',
            'role_id' => 'user',
            'referral_code' => 'BCDFGH',
            'created_at' => now(),
        ]);
        User::create([
            'uid' => 'uid-referrer-000000000000002',
            'display_name' => 'Second',
            'role_id' => 'user',
            'referral_code' => 'JKLMNP',
            'created_at' => now(),
        ]);
        $this->tokenReturns($this->googleClaims());

        $this->withCredentials()->withCookie(ReferralCode::COOKIE, 'BCDFGH')->postJson('/auth/session', ['idToken' => 'x']);
        $this->withCredentials()->withCookie(ReferralCode::COOKIE, 'JKLMNP')->postJson('/auth/session', ['idToken' => 'x']);

        $this->assertSame(
            'uid-referrer-000000000000001',
            User::find('uid-google-0000000000000001')->referred_by,
        );
    }

    public function test_a_junk_invite_code_is_ignored_rather_than_an_error(): void
    {
        // They followed a link a friend sent; the worst outcome is that nobody
        // gets credited.
        $this->tokenReturns($this->googleClaims());

        $this->withCredentials()->withCookie(ReferralCode::COOKIE, 'not-a-code')
            ->postJson('/auth/session', ['idToken' => 'x'])
            ->assertOk();

        $this->assertNull(User::find('uid-google-0000000000000001')->referred_by);
    }

    public function test_every_account_gets_a_referral_code_of_its_own(): void
    {
        $this->tokenReturns($this->googleClaims());
        $this->postJson('/auth/session', ['idToken' => 'x'])->assertOk();

        $code = User::find('uid-google-0000000000000001')->referral_code;

        $this->assertTrue(ReferralCode::isValid($code), "{$code} is not a usable code");
    }

    public function test_signing_out_ends_the_session(): void
    {
        $this->tokenReturns($this->googleClaims());
        $this->postJson('/auth/session', ['idToken' => 'x'])->assertOk();
        $this->assertTrue(Auth::check());

        $this->deleteJson('/auth/session')->assertOk();
        $this->assertFalse(Auth::check());
    }
}
