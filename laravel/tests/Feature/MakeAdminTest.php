<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use App\Support\ReferralCode;
use Database\Seeders\RoleSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The door back in after a Firebase project move.
 *
 * A uid is minted per project, so the old admin row survives keyed to a uid
 * nobody can sign in as, and the owner arrives as an ordinary user — locked out
 * of the screen that hands out roles.
 */
final class MakeAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function user(string $uid, ?string $email, string $role = 'user'): User
    {
        return User::create([
            'uid' => $uid,
            'display_name' => 'Someone',
            'email' => $email,
            'role_id' => $role,
            'referral_code' => ReferralCode::mint(),
            'created_at' => now(),
        ]);
    }

    public function test_it_promotes_the_account_with_that_email(): void
    {
        $this->user('uid-new-000000000000000001', 'owner@example.com');

        $this->artisan('taajir:make-admin', ['email' => 'owner@example.com'])
            ->assertSuccessful();

        $this->assertSame(Role::Admin->value, User::find('uid-new-000000000000000001')->role_id);
    }

    public function test_the_address_is_matched_regardless_of_case(): void
    {
        // Google hands back whatever the person typed when they made the
        // account, and nobody types their own address the same way twice.
        $this->user('uid-new-000000000000000001', 'Owner@Example.com');

        $this->artisan('taajir:make-admin', ['email' => '  OWNER@example.COM  '])
            ->assertSuccessful();

        $this->assertSame(Role::Admin->value, User::find('uid-new-000000000000000001')->role_id);
    }

    public function test_an_unknown_address_fails_and_says_what_to_do(): void
    {
        // Promoting an address that has no row would have to create one, and an
        // account created from a command line has proved nothing to anybody.
        $this->artisan('taajir:make-admin', ['email' => 'nobody@example.com'])
            ->expectsOutputToContain('No account has the email nobody@example.com')
            ->expectsOutputToContain('Sign in with that Google account once')
            ->assertFailed();

        $this->assertSame(0, User::where('role_id', Role::Admin->value)->count());
    }

    public function test_one_address_cannot_be_on_two_accounts(): void
    {
        /*
         * The case this command was written for — the old uid still holding the
         * role, the new one the only one that can sign in — cannot arise,
         * because users.email is unique. That is worth pinning: it is also why
         * this command never has to choose between two rows, and why signing in
         * under a new Firebase project with an address already in the table
         * collides instead of quietly making a second account.
         */
        $this->user('uid-old-000000000000000001', 'owner@example.com', 'admin');

        $this->expectException(QueryException::class);
        $this->user('uid-new-000000000000000002', 'owner@example.com');
    }

    public function test_promoting_an_admin_again_is_not_an_error(): void
    {
        $this->user('uid-new-000000000000000001', 'owner@example.com', 'admin');

        $this->artisan('taajir:make-admin', ['email' => 'owner@example.com'])
            ->expectsOutputToContain('already an admin')
            ->assertSuccessful();
    }

    public function test_an_account_with_no_email_is_never_matched(): void
    {
        // Phone accounts have a null email. A LOWER(NULL) comparison must not
        // quietly match an empty argument.
        $this->user('uid-phone-00000000000000001', null);

        $this->artisan('taajir:make-admin', ['email' => ''])->assertFailed();

        $this->assertSame('user', User::find('uid-phone-00000000000000001')->role_id);
    }
}
