<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Article;
use App\Services\CoverImage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

/**
 * The guides section, written and illustrated.
 *
 * Separate from taajir:demo because these are not demo data: they are the
 * articles the site ships with, and deleting them with --fresh should not be a
 * side-effect of reseeding listings.
 *
 * Covers are drawn at run time rather than shipped. Six WebP files would add
 * most of a megabyte to every release for images that never change, and
 * CoverImage is deterministic, so re-running this produces byte-identical
 * covers instead of reshuffling the section.
 */
final class SeedArticles extends Command
{
    protected $signature = 'taajir:articles {--fresh : rewrite the articles that are already there}';

    protected $description = 'Write the guides section, with a cover for each article';

    public function handle(): int
    {
        $rows = require database_path('demo/articles.php');
        $written = 0;

        foreach ($rows as $row) {
            $existing = Article::query()->where('slug', $row['slug'])->first();

            if ($existing !== null && ! $this->option('fresh')) {
                $this->line("  — {$row['slug']} (موجود)");

                continue;
            }

            $cover = $this->cover($row['slug'], (float) $row['hue']);

            Article::updateOrCreate(
                ['slug' => $row['slug']],
                [
                    'title' => $row['title'],
                    'excerpt' => $row['excerpt'],
                    'body' => $row['body'],
                    'cover_url' => $cover,
                    'cover_alt' => $row['title'],
                    'author_uid' => 'editorial-0000000000000001',
                    'author_name' => 'تحرير تأجير',
                    'status' => 'published',
                    'tags' => $row['tags'],
                    'read_minutes' => $row['read_minutes'],
                    // Spaced a day apart so the section does not read as one
                    // batch published in the same minute.
                    'published_at' => now()->subDays(count($rows) - $written),
                ],
            );

            $this->line("  ✔ {$row['title']}");
            $written++;
        }

        $this->info("\n{$written} article(s) written.");

        return self::SUCCESS;
    }

    /** Draw the cover, store it, and return the URL the page will use. */
    private function cover(string $slug, float $hue): string
    {
        $path = "articles/{$slug}.webp";

        File::ensureDirectoryExists(storage_path('app/public/articles'));
        Storage::disk('public')->put($path, CoverImage::render($hue, $slug));

        // A path, not a full URL: cover_url is validated to https or
        // same-origin before it is stored, and a relative path survives the
        // site changing domain — which this one has.
        return '/storage/'.$path;
    }
}
