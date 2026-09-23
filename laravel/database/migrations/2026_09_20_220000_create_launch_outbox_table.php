<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One intended message per row, written before anything is sent.
 *
 * The launch plan asks for three channels — email, SMS, and a push alert — and
 * none of them has a provider in this project. That is an account and a key,
 * not code, and pretending otherwise would mean a launch that silently reaches
 * nobody.
 *
 * So every intended message is written here first. A row that stays `queued` is
 * a message waiting for credentials, not a message lost: wiring a provider
 * later is one adapter and a pass over this table, with no second guess about
 * who was told and who was not.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('launch_outbox', function (Blueprint $table) {
            $table->id();
            $table->string('uid', 28);
            $table->enum('channel', ['push', 'email', 'sms']);
            // The address this is for — an email, a phone, or "device" for a
            // push. Denormalised at write time: an account that later changes
            // its email must not rewrite the history of what was sent where.
            $table->string('target', 255);
            // What it says. Kept per row rather than joined to a campaign: the
            // rows are the record of what went out, and a message edited after
            // the fact would make that record a lie.
            $table->string('title', 120);
            $table->string('body', 300);
            $table->string('url', 500)->default('/');
            $table->enum('status', ['queued', 'sent', 'failed', 'skipped'])->default('queued');
            $table->string('error')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('sent_at')->nullable();

            $table->index(['status', 'channel']);
            $table->index('uid');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('launch_outbox');
    }
};
