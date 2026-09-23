<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The three threads and the alerts. §4.2 of the roadmap.
 *
 * Author names are columns rather than joins, here as everywhere: they are
 * denormalised from the verified session at write time, never from client
 * input — otherwise anyone could post as "وكالة موثّقة" and borrow its
 * credibility.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comments', function (Blueprint $table) {
            $table->id();
            $table->string('listing_id', 12);
            $table->string('author_uid', 28);
            $table->string('author_name', 80);
            $table->string('author_photo_url', 500)->nullable();
            // True when the commenter is the person who posted the ad.
            $table->boolean('is_owner')->default(false);
            $table->string('text', 1000);
            // Hidden keeps the row: a deleted comment loses the evidence of
            // what was said, which is exactly what a moderator needs later.
            $table->enum('status', ['visible', 'hidden'])->default('visible');
            $table->string('hidden_reason')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('edited_at')->nullable();

            $table->index(['listing_id', 'created_at']);
            $table->foreign('listing_id')->references('id')->on('listings')->cascadeOnDelete();
        });

        Schema::create('requests', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('owner_uid', 28);
            $table->string('owner_name', 80);
            $table->string('owner_photo_url', 500)->nullable();
            // The same vocabulary a listing uses, so a demand and the ads that
            // answer it speak one language: `vente` here means "I want to buy",
            // which is what a `vente` ad offers.
            $table->enum('intent', ['vente', 'location']);
            $table->string('title', 90);
            $table->text('description');
            // Required. A placeless demand is not one anyone can answer.
            $table->string('wilaya_slug', 48);
            $table->string('commune_slug', 64)->nullable();
            $table->string('status', 16)->default('visible');
            $table->string('hidden_reason')->nullable();
            $table->string('rejection_reason')->nullable();
            $table->string('policy_rule', 64)->nullable();
            $table->string('moderated_by', 28)->nullable();
            $table->timestamp('moderated_at')->nullable();
            // Derived, so a feed card needs no second query.
            $table->integer('reply_count')->default(0);
            $table->timestamp('created_at')->nullable();

            $table->index(['status', 'created_at']);
            $table->index('owner_uid');
            $table->foreign('owner_uid')->references('uid')->on('users')->cascadeOnDelete();
        });

        Schema::create('request_replies', function (Blueprint $table) {
            $table->id();
            $table->string('request_id', 12);
            $table->string('author_uid', 28);
            $table->string('author_name', 80);
            $table->string('author_photo_url', 500)->nullable();
            $table->boolean('is_owner')->default(false);
            $table->string('text', 1000);
            // A reply may carry one of the author's own ads — which is the
            // point of the feed: someone says what they want, someone else
            // shows them the thing.
            $table->string('listing_id', 12)->nullable();
            $table->enum('status', ['visible', 'hidden'])->default('visible');
            $table->string('hidden_reason')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['request_id', 'created_at']);
            $table->foreign('request_id')->references('id')->on('requests')->cascadeOnDelete();
            $table->foreign('listing_id')->references('id')->on('listings')->nullOnDelete();
        });

        Schema::create('saved_searches', function (Blueprint $table) {
            $table->id();
            $table->string('owner_uid', 28);
            $table->string('transaction_type', 32)->nullable();
            $table->string('property_type', 32)->nullable();
            // The wilaya is required and the commune optional, which is how
            // people actually describe what they are after. A search with no
            // place would match every ad on the platform and turn the alert
            // into spam that gets notifications switched off for good.
            $table->string('wilaya_slug', 48);
            $table->string('commune_slug', 64)->nullable();
            // Built server-side so the list and the push agree.
            $table->string('label', 160);
            // Off keeps the search saved but silent.
            $table->boolean('notify')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('last_notified_at')->nullable();
            $table->integer('match_count')->default(0);

            $table->index('owner_uid');
            $table->foreign('owner_uid')->references('uid')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_searches');
        Schema::dropIfExists('request_replies');
        Schema::dropIfExists('requests');
        Schema::dropIfExists('comments');
    }
};
