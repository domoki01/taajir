<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Console\Command;

/**
 * Hand the admin role to an account, by email.
 *
 * The bootstrap problem this solves: a uid is minted per Firebase project, so
 * moving projects — newmokit to taajir-a11c4 — gives everyone a new one. The
 * old admin row is still in the table, still holding the role, and keyed to a
 * uid nobody can sign in as any more. The person who owns the site signs in and
 * arrives as an ordinary user, locked out of the screen that grants roles.
 *
 * Nothing here trusts an address on its own: the row must already exist, which
 * means Firebase has already verified that someone signed in with it. This
 * promotes an account; it does not create one.
 */
final class MakeAdmin extends Command
{
    protected $signature = 'taajir:make-admin {email : the address on the account}';

    protected $description = 'Give the admin role to the account with this email';

    public function handle(): int
    {
        $email = mb_strtolower(trim((string) $this->argument('email')));

        // users.email is unique, so this matches one row or none.
        /** @var list<User> $matches */
        $matches = User::query()->whereRaw('LOWER(email) = ?', [$email])->get()->all();

        if ($matches === []) {
            $this->error("No account has the email {$email}.");
            // The likeliest reason, and the fix, rather than a bare failure.
            $this->line('Sign in with that Google account once, then run this again —');
            $this->line('the account has to exist before it can be promoted.');

            return self::FAILURE;
        }

        $user = $matches[0];

        if ($user->role_id === Role::Admin->value) {
            $this->info("{$email} is already an admin.");

            return self::SUCCESS;
        }

        $was = $user->role_id;
        $user->role_id = Role::Admin->value;
        $user->save();

        $this->info("{$email} ({$user->uid}) is now an admin — was {$was}.");

        return self::SUCCESS;
    }
}
