<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Accounts, keyed by the Firebase uid.
 *
 * Not an auto-increment id: the uid is the join between the two systems
 * forever, and it is the only thing a Firebase ID token gives us to look an
 * account up by. §4.2 of the roadmap.
 *
 * There is no password column and no password-reset table. This site has no
 * password accounts — the session exchange refuses the `password` provider
 * outright — so the framework's own users migration was removed rather than
 * edited.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->string('uid', 28)->primary();
            $table->string('email')->nullable()->unique();
            $table->string('display_name', 80);
            $table->string('photo_url', 500)->nullable();
            $table->string('phone', 20)->nullable();
            // Proven by the provider, never by the account holder typing it.
            $table->boolean('email_verified')->default(false);

            $table->string('role_id', 24)->default('user');
            // Whether this account may publish. Written once at creation: see
            // the comment on SessionController. Not a live read of the access
            // setting, so flipping that switch never retroactively mutes
            // anybody, and a moderator's decision to revoke it sticks.
            $table->boolean('approved')->default(true);

            $table->string('agency_id', 20)->nullable();
            $table->smallInteger('wilaya_code')->unsigned()->nullable();

            $table->integer('active_listing_count')->default(0);
            $table->integer('listing_quota')->default(3);
            $table->integer('featured_quota')->default(0);

            $table->boolean('is_banned')->default(false);
            $table->string('ban_reason')->nullable();
            $table->integer('strike_count')->default(0);

            $table->boolean('notify_on_message')->default(true);
            $table->boolean('notify_on_saved_search')->default(true);
            $table->string('locale', 5)->default('ar');

            // A cache. points_ledger is the truth — §4.5.
            $table->integer('points_balance')->default(0);
            $table->string('referred_by', 28)->nullable();
            $table->char('referral_code', 6)->nullable()->unique();

            /*
             * The one column from the framework's users table that survives.
             *
             * It is not password scaffolding: remember-me is about how long a
             * *session* persists, and how the person authenticated in the first
             * place has nothing to do with it. Without it Auth::login(remember:
             * true) fails on the UPDATE, and the roadmap's §5 sign-in does pass
             * remember: true — a market where people sign in once on a shared
             * phone and come back a fortnight later is not one to log out
             * nightly.
             */
            $table->rememberToken();

            $table->timestamp('created_at')->nullable();
            $table->timestamp('last_seen_at')->nullable();

            $table->index('role_id');
            $table->index('is_banned');
            $table->index('referred_by');

            $table->foreign('role_id')->references('id')->on('roles');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
