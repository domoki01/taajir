<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Support\Nav;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Every link the site draws must go somewhere.
 *
 * Three entries in the account menu did not. The owner reported
 * /tableau-de-bord/profil as a 404 — "معلوماتي مراهيش تمشي" — and checking the
 * rest turned up /publications and /parrainage in the same state: links written
 * alongside a menu whose pages were never built.
 *
 * That failure is invisible to every other test, because nothing asserts that
 * a href resolves; it is only visible to someone pressing it. A dead link is
 * also worse than a missing one — the person concludes the feature is broken
 * rather than absent, and stops looking.
 */
final class NavLinksTest extends TestCase
{
    /** @return list<array{href: string, label: string}> */
    private function allLinks(): array
    {
        return [...Nav::accountLinks(), ...Nav::infoLinks()];
    }

    public function test_every_nav_link_resolves_to_a_route(): void
    {
        $routes = collect(Route::getRoutes())->map(fn ($route) => '/'.ltrim($route->uri(), '/'))->all();

        foreach ($this->allLinks() as $link) {
            $this->assertContains(
                $link['href'],
                $routes,
                "{$link['href']} ({$link['label']}) is in the menu and has no route — it is a 404",
            );
        }
    }

    public function test_the_links_are_latin_and_carry_no_arabic(): void
    {
        // URL segments are Latin and French-derived by decision: Arabic in a
        // URL percent-encodes into unreadable bytes and breaks the WhatsApp
        // preview, which is the main way anything is shared here.
        foreach ($this->allLinks() as $link) {
            $this->assertMatchesRegularExpression(
                '#^/[a-z0-9/_-]*$#',
                $link['href'],
                "{$link['href']} is not a Latin URL",
            );
        }
    }
}
