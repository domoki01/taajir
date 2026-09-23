<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\Locale;
use App\Models\Article;
use App\Models\Listing;
use App\Services\Geo;
use App\Services\Taxonomy;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;

/**
 * The sitemap.
 *
 * Only the clean, canonical combinations: the content pages, one browse page
 * per deal and per deal+wilaya, and every published ad. `/recherche` is not in
 * it and never will be — it can express an unbounded number of filter
 * permutations, and offering those to a crawler is how a site ends up
 * competing with itself.
 *
 * Cached for an hour, which is what `revalidate = 3600` did on the other side.
 */
final class SitemapController extends Controller
{
    public function __invoke(): Response
    {
        $xml = Cache::remember('sitemap', now()->addHour(), fn () => $this->build());

        return response($xml, 200, ['Content-Type' => 'application/xml; charset=utf-8']);
    }

    private function build(): string
    {
        $taxonomy = Taxonomy::current();
        $paths = ['/'];

        foreach (['/a-propos', '/aide', '/cgu', '/confidentialite', '/securite', '/demandes', '/articles'] as $page) {
            $paths[] = $page;
        }

        foreach (array_keys($taxonomy->transactionTypes) as $deal) {
            $paths[] = '/'.$deal;

            foreach (Geo::wilayas() as $wilaya) {
                $paths[] = '/'.$deal.'/appartement/'.$wilaya->slug;
            }
        }

        $xml = ['<?xml version="1.0" encoding="UTF-8"?>'];
        // sitemaps.org, with the s. The namespace is the schema's identity,
        // not a link anyone follows, and a sitemap declaring a namespace that
        // is not the one in the spec is rejected whole — which is a silent
        // failure: the file serves 200 and nothing in it is ever crawled.
        $xml[] = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">';

        foreach ($paths as $path) {
            $xml[] = $this->url($path);
        }

        // The masthead. These are the pages that answer a question rather
        // than offer a property, so they are the ones most likely to be the
        // entry point from a search.
        foreach (Article::query()->public()->select(['slug', 'published_at'])->get() as $article) {
            $xml[] = $this->url($article->path(), $article->published_at?->toAtomString());
        }

        // Chunked: this is every published ad, and holding them all in memory
        // on a shared host is how a sitemap becomes a 500.
        Listing::query()->published()->select(['id', 'slug', 'published_at'])
            ->orderByDesc('published_at')
            ->chunk(500, function ($listings) use (&$xml) {
                foreach ($listings as $listing) {
                    $xml[] = $this->url($listing->path(), $listing->published_at?->toAtomString());
                }
            });

        $xml[] = '</urlset>';

        return implode("\n", $xml);
    }

    /** Each URL with its alternates, so the three languages are not duplicates. */
    private function url(string $path, ?string $lastmod = null): string
    {
        $out = '  <url>';
        $out .= "\n    <loc>".e(url(Locale::default()->path($path))).'</loc>';

        foreach (Locale::cases() as $locale) {
            $out .= "\n    ".sprintf(
                '<xhtml:link rel="alternate" hreflang="%s" href="%s"/>',
                $locale->htmlLang(),
                e(url($locale->path($path))),
            );
        }

        if ($lastmod !== null) {
            $out .= "\n    <lastmod>".e($lastmod).'</lastmod>';
        }

        return $out."\n  </url>";
    }
}
