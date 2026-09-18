<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;

/**
 * A stub until phase 3.
 *
 * The real table is specified in §4.2 of the port roadmap and looks nothing
 * like Laravel's default: the primary key is the Firebase uid (`CHAR(28)`),
 * which is the join between the two systems forever, and there is no password
 * column at all — this site has no password accounts, and sign-in provider
 * `password` is rejected. That is also why the framework's
 * `create_users_table` migration, its factory and the password-reset scaffolding
 * are not in this repository: they describe an auth flow the port will not have.
 *
 * Phase 3 replaces this class and writes the migration that matches it.
 */
class User extends Authenticatable
{
    //
}
