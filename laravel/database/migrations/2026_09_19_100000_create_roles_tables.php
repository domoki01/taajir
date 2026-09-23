<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What a role may do.
 *
 * The permission *catalogue* is code (App\Enums\Permission), because every
 * entry names a real code path and a permission an admin could invent would
 * guard nothing. What is data is which role holds which of them — that is these
 * two tables.
 *
 * `firestore.rules` is gone and with it the reason roles lived in Firebase
 * custom claims. Laravel reads `users.role_id` directly: one less thing to keep
 * in sync, and a role change takes effect on the next request instead of on the
 * user's next token refresh.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            // Latin and stable. It used to land in a token; it still lands in
            // URLs and in the audit log.
            $table->string('id', 24)->primary();
            $table->string('label', 64);
            // Ships with the code. Cannot be deleted; only its permissions may
            // move — and not even those, for `admin`.
            $table->boolean('builtin')->default(false);
        });

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->string('role_id', 24);
            $table->string('permission', 32);

            $table->primary(['role_id', 'permission']);
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('roles');
    }
};
