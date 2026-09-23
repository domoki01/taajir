<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The editorial side of the site.
 *
 * Articles exist for one reason that is not editorial at all: a classifieds
 * site with nothing but listings has almost no text a search engine can index
 * against a question. Somebody typing "كيفاش نكري دار في الجزائر بلا سمسار" is
 * a future user, and today that query lands on a competitor's blog. These pages
 * are the answer, and they are static, long-lived and linkable — everything a
 * listing is not.
 *
 * **The body is blocks, not HTML.** Storing markup would mean rendering it, and
 * rendering stored markup means printing unescaped over a field a staff account
 * can write — one compromised account away from script on every page of the
 * site. A block never becomes markup: it becomes a <p> with text inside it, and
 * Blade escapes the text.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('articles', function (Blueprint $table) {
            $table->id();
            // Latin and French-derived, like every other URL here. An Arabic
            // slug percent-encodes into unreadable bytes and breaks the
            // WhatsApp preview these are shared through.
            $table->string('slug', 70)->unique();
            $table->string('title', 120);
            // One or two sentences: the meta description and the card summary.
            $table->string('excerpt', 300);
            $table->json('body');
            $table->string('cover_url', 500)->nullable();
            $table->string('cover_alt', 140)->nullable();

            // The first publisher keeps the byline. An editor fixing a typo
            // three months later does not become the author of the piece — and
            // this is a column rather than a join for the same reason a
            // listing carries its owner's name.
            $table->string('author_uid', 28);
            $table->string('author_name', 80);

            $table->enum('status', ['draft', 'published'])->default('draft');
            $table->json('tags')->nullable();
            // Derived from the body on save, never typed.
            $table->smallInteger('read_minutes')->unsigned()->default(1);

            // Set once, on the first publish. Re-publishing after an edit must
            // not move the piece back to the top of the list or change its
            // dateline.
            $table->timestamp('published_at')->nullable();
            $table->integer('comment_count')->default(0);
            $table->timestamps();

            $table->index(['status', 'published_at']);
        });

        Schema::create('article_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('article_id')->constrained()->cascadeOnDelete();
            $table->string('author_uid', 28);
            // Denormalised from the verified session at write time, never from
            // client input — otherwise anyone could post as "وكالة موثّقة" and
            // borrow its credibility.
            $table->string('author_name', 80);
            $table->string('author_photo_url', 500)->nullable();
            $table->string('text', 1000);
            // Hidden keeps the row: a deleted comment loses the evidence of
            // what was said, which is exactly what a moderator needs later.
            $table->enum('status', ['visible', 'hidden'])->default('visible');
            $table->string('hidden_reason')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['article_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('article_comments');
        Schema::dropIfExists('articles');
    }
};
