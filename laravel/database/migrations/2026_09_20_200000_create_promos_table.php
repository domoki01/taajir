<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Paid banners in the home-page carousel.
 *
 * A table of their own rather than rows in `listings`, on purpose: these are
 * advertising slots sold to agencies, not property. They must never appear in
 * search results, never count against a quota, and never carry a price or a
 * wilaya. Putting them in `listings` would mean excluding them from every
 * listing query forever, and one forgotten `where` would leak an advert into
 * the results.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promos', function (Blueprint $table) {
            $table->id();
            $table->string('image_url', 500);
            // Kept so deleting the banner can delete the file rather than
            // orphan it in storage.
            $table->string('storage_path', 500);
            // The intrinsic size of the stored image, so the carousel can
            // reserve the space before it loads and not shift the page.
            $table->integer('width')->default(1200);
            $table->integer('height')->default(400);
            // Validated to http(s) or a site-relative path before it is
            // written: an admin panel is not a reason to let a `javascript:`
            // URL into an href.
            $table->string('link_url', 500);
            // Doubles as the alt text, so it describes the advert rather than
            // naming it — an empty one costs a blind visitor the whole slide.
            $table->string('title', 140);
            $table->boolean('is_active')->default(true);
            // Ascending. Gaps are fine; only the relative order is meaningful.
            $table->integer('order')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promos');
    }
};
