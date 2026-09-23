<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The ads. §4.2 of the roadmap.
 *
 * Three fields the Firestore documents carry are deliberately absent:
 * `priceBucket`, `areaBucket` and `searchTokens`. All three exist to work
 * around queries Firestore refused — a range, a second range, and a text match.
 * SQL answers all three directly, and keeping them would mean maintaining a
 * fiction. `search_text` replaces the tokens as one normalised string with a
 * FULLTEXT index over it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('listings', function (Blueprint $table) {
            // Kept as a string id rather than renumbered: these are in live URLs.
            $table->string('id', 12)->primary();
            $table->string('slug', 160);

            $table->string('owner_uid', 28);
            $table->enum('owner_type', ['individual', 'agency'])->default('individual');
            $table->string('agency_id', 20)->nullable();
            // Denormalised, refreshed when the owner saves their profile. Saves
            // a join per card on a results page.
            $table->string('owner_name', 80);
            $table->boolean('owner_is_verified')->default(false);

            // Slugs, admin-extensible, so VARCHAR rather than ENUM.
            $table->string('transaction_type', 32);
            $table->string('sale_form', 24)->nullable();
            $table->string('property_type', 32);
            $table->string('housing_program', 16)->nullable();

            // Whole Algerian dinars. Always. See App\Support\Price.
            $table->unsignedBigInteger('price')->default(0);
            $table->string('price_unit', 8)->default('total');
            $table->boolean('price_on_request')->default(false);
            $table->boolean('is_negotiable')->default(false);

            $table->integer('area_built')->nullable();
            $table->integer('area_land')->nullable();
            $table->string('rooms_code', 4)->nullable();
            $table->tinyInteger('bathrooms')->unsigned()->nullable();
            $table->smallInteger('floor')->nullable();
            $table->string('condition_code', 16)->nullable();
            $table->string('paperwork', 32)->nullable();

            $table->smallInteger('wilaya_code')->unsigned();
            $table->string('wilaya_slug', 48);
            $table->string('commune_slug', 64);
            $table->string('quartier', 80)->nullable();
            $table->decimal('lat', 9, 6)->nullable();
            $table->decimal('lng', 9, 6)->nullable();

            $table->string('title', 90);
            $table->text('description');
            $table->string('cover_url', 500)->nullable();
            // Normalised title + place, folded by App\Support\Text. The same
            // fold runs over the query, or nothing matches.
            $table->text('search_text')->nullable();

            $table->string('contact_phone', 20)->nullable();
            $table->boolean('show_phone')->default(true);
            $table->boolean('allow_whatsapp')->default(true);

            $table->string('status', 16)->default('draft');
            $table->string('rejection_reason')->nullable();
            // Which policy rule sent this to the queue, so a moderator opens an
            // ad already knowing what was flagged.
            $table->string('policy_rule', 64)->nullable();
            // Separate from the status on purpose: an ad approved during the
            // pre-launch hold must stay invisible until the switch.
            $table->boolean('approved_for_launch')->default(false);
            $table->boolean('is_featured')->default(false);
            $table->timestamp('pinned_until')->nullable();

            $table->integer('view_count')->default(0);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('published_at')->nullable();

            // The four shapes every public query takes. Each leads with status,
            // because nothing unpublished is ever read by the public.
            $table->index(['status', 'published_at']);
            $table->index(['status', 'transaction_type', 'wilaya_slug', 'published_at']);
            $table->index(['status', 'transaction_type', 'property_type', 'wilaya_slug', 'commune_slug', 'published_at'], 'listings_browse_index');
            $table->index(['status', 'price']);
            $table->index(['owner_uid', 'status']);

            $table->foreign('owner_uid')->references('uid')->on('users')->cascadeOnDelete();
        });

        // FULLTEXT is MySQL-only. The test suite runs on sqlite, where the
        // search falls back to LIKE over the same normalised column — see
        // ListingQuery. Guarding here rather than skipping the index means
        // production gets the real thing.
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE listings ADD FULLTEXT ft_search (search_text)');
        }

        Schema::create('listing_images', function (Blueprint $table) {
            $table->id();
            $table->string('listing_id', 12);
            $table->string('url', 500);
            $table->string('storage_path', 500)->nullable();
            $table->integer('width')->nullable();
            $table->integer('height')->nullable();
            $table->smallInteger('position')->unsigned()->default(0);

            $table->index(['listing_id', 'position']);
            $table->foreign('listing_id')->references('id')->on('listings')->cascadeOnDelete();
        });

        Schema::create('listing_amenities', function (Blueprint $table) {
            $table->string('listing_id', 12);
            $table->string('amenity', 24);

            $table->primary(['listing_id', 'amenity']);
            $table->foreign('listing_id')->references('id')->on('listings')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listing_amenities');
        Schema::dropIfExists('listing_images');
        Schema::dropIfExists('listings');
    }
};
