<?php

declare(strict_types=1);

use App\Support\ListingId;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Public profiles, following, and the notifications a follower sees.
 *
 * Three things that only make sense together: a page for a seller, a way to
 * subscribe to one, and something that reaches you when they post.
 */
return new class extends Migration
{
    public function up(): void
    {
        /*
         * A public identifier that is not the Firebase uid.
         *
         * The uid works as a key and is wrong as a URL: it is twenty-eight
         * characters of someone else's namespace, it changes if the project
         * ever moves again — which it just did — and it is the string the
         * whole auth layer is keyed on. A short id of our own keeps
         * /vendeur/… readable and keeps the uid where it belongs.
         */
        Schema::table('users', function (Blueprint $table): void {
            $table->string('public_id', 12)->nullable()->unique()->after('uid');
        });

        // Backfilled here rather than lazily: a null public_id is a profile
        // with no address, and doing it on first view means the column is
        // nullable forever and every read has to cope.
        foreach (DB::table('users')->whereNull('public_id')->pluck('uid') as $uid) {
            DB::table('users')->where('uid', $uid)->update([
                'public_id' => ListingId::mint(),
            ]);
        }

        Schema::create('follows', function (Blueprint $table): void {
            $table->id();
            $table->string('follower_uid', 28);
            $table->string('followed_uid', 28);
            $table->timestamp('created_at')->nullable();

            // One row per pair: following twice is the same as following once,
            // and without this a double-tapped button sends every notification
            // twice.
            $table->unique(['follower_uid', 'followed_uid']);
            // "Who follows me", for the count on a profile.
            $table->index('followed_uid');

            $table->foreign('follower_uid')->references('uid')->on('users')->cascadeOnDelete();
            $table->foreign('followed_uid')->references('uid')->on('users')->cascadeOnDelete();
        });

        /*
         * In-site notifications, which are not the outbox.
         *
         * launch_outbox records messages meant to leave the site — push, email,
         * SMS — none of which has a provider wired, by the decision in §8 that
         * keeps a service-account credential off this host. A row there is a
         * message nobody has received.
         *
         * This table is the other thing: what a person sees when they open the
         * site. It needs no provider, so it works today, which is the whole
         * reason it is separate rather than a fourth channel on the outbox.
         */
        Schema::create('notifications', function (Blueprint $table): void {
            $table->id();
            $table->string('uid', 28);
            $table->string('type', 32);
            $table->string('title', 160);
            $table->string('body', 300)->nullable();
            $table->string('url', 500)->default('/');
            // The actor, so a notification can show who did the thing without
            // a join, and survive them deleting the listing.
            $table->string('actor_name', 80)->nullable();
            $table->string('actor_photo_url', 500)->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at')->nullable();

            // The two queries there are: the unread count, and the page.
            $table->index(['uid', 'read_at']);
            $table->index(['uid', 'created_at']);

            $table->foreign('uid')->references('uid')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('follows');

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('public_id');
        });
    }
};
