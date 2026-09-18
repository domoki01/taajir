<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per settings document the Firestore app keeps under `settings/*`:
 * access, affiliate, branding, filter, launch.
 *
 * A key/JSON table rather than a column per setting, for the same reason the
 * documents exist: these are edited from the admin panel as whole objects, they
 * are read as whole objects, and nothing joins on them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->string('key', 32)->primary();
            $table->json('value');
            $table->timestamp('updated_at')->nullable();
            // The uid of the admin who last wrote it. Not a foreign key: a
            // setting outlives the account that changed it, and losing the
            // audit trail because someone was deleted is the wrong trade.
            $table->string('updated_by', 28)->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
