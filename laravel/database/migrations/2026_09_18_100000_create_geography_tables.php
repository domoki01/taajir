<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Algeria moved to 69 wilayas (loi 26-06, JO n°25 of 5 April 2026), with
 * competence transfer running to 31 December 2026. Most people, and every
 * competitor site, still think in the old 58, so the dataset carries both:
 * `code` (1–69, current law) and `code58` (the parent wilaya).
 *
 * The real identifier is the SLUG. URLs key off it so that a future
 * reassignment is a redirect rather than a migration — "bou-saada" stays
 * "bou-saada" whichever number the state gives it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wilayas', function (Blueprint $table) {
            // The code is the primary key because the commune table has to join
            // on something, and 1–69 is what the dataset is indexed by. It is
            // not what URLs use.
            $table->smallInteger('code')->unsigned()->primary();
            $table->smallInteger('code58')->unsigned();
            $table->string('name_ar', 64);
            $table->string('name_fr', 64);
            $table->string('slug', 48)->unique();
            // Alternate spellings and the pre-2026 parent name, so someone
            // typing "M'sila" still finds Bou Saâda after it was split off.
            $table->json('aliases');
            $table->boolean('is_new_2026')->default(false);
            $table->smallInteger('commune_count')->unsigned()->default(0);

            $table->index('code58');
        });

        Schema::create('communes', function (Blueprint $table) {
            $table->id();
            $table->smallInteger('wilaya_code')->unsigned();
            $table->string('slug', 64);
            $table->string('name_ar', 96);
            $table->string('name_fr', 96);
            $table->string('postal_code', 8)->nullable();
            $table->decimal('lat', 9, 6)->nullable();
            $table->decimal('lng', 9, 6)->nullable();

            // A slug is unique inside its wilaya, not nationally: several
            // wilayas have an "el-hamra".
            $table->unique(['wilaya_code', 'slug']);
            // …which is why the bare slug is only an index. A URL always names
            // the wilaya alongside it.
            $table->index('slug');

            $table->foreign('wilaya_code')->references('code')->on('wilayas')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('communes');
        Schema::dropIfExists('wilayas');
    }
};
