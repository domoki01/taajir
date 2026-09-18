<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Enums\TransactionType;
use App\Support\Nav;
use Tests\TestCase;

final class NavTest extends TestCase
{
    public function test_the_home_tab_is_current_only_at_the_root(): void
    {
        $home = ['href' => '/', 'also' => []];

        $this->assertTrue(Nav::isCurrent('/', $home));
        $this->assertFalse(Nav::isCurrent('/recherche', $home));
        // Every path starts with "/", so a prefix match here would light the
        // home tab on every screen of the site.
        $this->assertFalse(Nav::isCurrent('/cgu', $home));
    }

    public function test_a_destination_claims_its_own_subtree(): void
    {
        $dashboard = ['href' => '/tableau-de-bord', 'also' => []];

        $this->assertTrue(Nav::isCurrent('/tableau-de-bord', $dashboard));
        $this->assertTrue(Nav::isCurrent('/tableau-de-bord/annonces', $dashboard));
        // A sibling that merely shares a prefix is a different destination.
        $this->assertFalse(Nav::isCurrent('/tableau-de-bordeaux', $dashboard));
    }

    public function test_the_browse_routes_mark_the_search_tab(): void
    {
        $search = ['href' => '/recherche', 'also' => ['/vente', '/location', '/vacances', '/echange']];

        // The browse routes are "results" to the person looking at them, the
        // same as a search; leaving them unmarked reads as a bug.
        $this->assertTrue(Nav::isCurrent('/vente/appartement/alger', $search));
        $this->assertTrue(Nav::isCurrent('/location', $search));
        $this->assertFalse(Nav::isCurrent('/demandes', $search));
    }

    public function test_only_one_destination_can_be_current(): void
    {
        foreach (['/', '/recherche', '/vente/appartement/alger', '/demandes', '/tableau-de-bord/profil'] as $path) {
            $matches = array_filter(Nav::items(), fn (array $item) => Nav::isCurrent($path, $item));

            $this->assertLessThanOrEqual(1, count($matches), "more than one tab claims {$path}");
        }
    }

    public function test_the_screens_that_own_the_bottom_of_the_viewport(): void
    {
        foreach (['/annonce/abc123/villa-alger', '/publier', '/merci', '/connexion', '/admin/moderation'] as $path) {
            $this->assertTrue(Nav::isImmersiveRoute($path), "{$path} should hide the bottom bar");
        }

        foreach (['/', '/recherche', '/demandes', '/cgu', '/tableau-de-bord'] as $path) {
            $this->assertFalse(Nav::isImmersiveRoute($path), "{$path} should keep the bottom bar");
        }
    }

    public function test_browse_links_are_built_from_the_taxonomy_it_is_given(): void
    {
        $links = Nav::browseLinks([['slug' => 'vente', 'label' => 'بيع']]);

        $hrefs = array_column($links, 'href');

        // A hidden category must be absent rather than linked to a page an admin
        // deliberately took down, so the list can only ever hold what it is fed.
        $this->assertSame(['/', '/vente', '/recherche', '/demandes'], $hrefs);
    }

    public function test_the_menu_words_a_deal_the_way_someone_searching_would(): void
    {
        $labels = array_column(TransactionType::deals(), 'label', 'slug');

        // A buyer and a seller are on opposite sides of one set of ads, so the
        // word a buyer looks for belongs in the label even though "شراء" is not
        // a filter value of its own.
        $this->assertSame('للبيع / شراء', $labels['vente']);
        $this->assertSame('للكراء', $labels['location']);
    }
}
