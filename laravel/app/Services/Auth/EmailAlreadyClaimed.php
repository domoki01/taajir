<?php

declare(strict_types=1);

namespace App\Services\Auth;

use RuntimeException;

/**
 * The address on a verified token already belongs to a different uid.
 *
 * users.email is unique and a uid is minted per Firebase project, so this is
 * what a project move looks like from inside a sign-in: the same person, a new
 * uid, and the row they left behind still holding their address.
 *
 * Raised rather than resolved. Joining the two means re-keying an account
 * across every table that references a uid, and a sign-in is not the place to
 * decide that on someone's behalf.
 */
final class EmailAlreadyClaimed extends RuntimeException
{
    public function __construct(public readonly string $existingUid, string $email)
    {
        parent::__construct("{$email} is already on uid {$existingUid}");
    }
}
