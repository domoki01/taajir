<?php

declare(strict_types=1);

namespace App\Services\Auth;

/**
 * The token did not check out.
 *
 * Carries a reason for the log and never for the response: the reason can name
 * the project, quote claim values and describe internals, and the caller is
 * entitled to none of that. Everything that throws this answers 401.
 */
final class InvalidIdToken extends \RuntimeException {}
