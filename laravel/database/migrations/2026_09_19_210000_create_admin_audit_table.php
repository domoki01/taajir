<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who did what, to which thing, and when.
 *
 * Every moderation action writes a row. The point is not compliance theatre —
 * it is that a moderator's decision can be questioned later by the person it
 * affected, and "the system did it" is not an answer anyone can act on.
 *
 * `actor_uid` is deliberately not a foreign key: the trail has to outlive the
 * account that made the decision, and losing it because someone was deleted is
 * exactly backwards.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_audit', function (Blueprint $table) {
            $table->id();
            $table->string('actor_uid', 28);
            $table->string('actor_name', 80)->nullable();
            $table->string('action', 48);
            $table->string('target_type', 24);
            $table->string('target_id', 32);
            $table->json('detail')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['target_type', 'target_id']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_audit');
    }
};
