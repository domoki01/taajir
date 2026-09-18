<?php

declare(strict_types=1);

namespace App\Support;

/**
 * ── SITE NAVIGATION ──────────────────────────────────────────────────────────
 * One list of destinations, two presentations: a bottom bar on phones and the
 * header menu on desktop. Defining it once is the point — a phone menu and a
 * desktop menu that drift apart is how a site ends up with pages only half its
 * users can find.
 *
 * Ported from src/lib/nav.ts. `icon` is the name of an <x-icon.*> Blade
 * component rather than an imported React component; the icon set is the same
 * Lucide one.
 */
final class Nav
{
    public const PUBLISH_HREF = '/publier';

    /**
     * Four, because the bottom bar seats five and the middle seat is the publish
     * button. Past that the labels stop being readable at 11px and the targets
     * drop under the 44px minimum.
     *
     * "حسابي" is the answer to "all the user's tools" — it opens the dashboard,
     * which already holds إعلاناتي، تنبيهاتي and معلوماتي. It is a plain link
     * with no auth check on purpose: the auth middleware redirects a signed-out
     * visitor to /connexion?next=… by itself.
     *
     * @return list<array{href: string, label: string, icon: string, also: list<string>}>
     */
    public static function items(): array
    {
        return [
            ['href' => '/', 'label' => 'الرئيسية', 'icon' => 'home', 'also' => []],
            [
                'href' => '/recherche',
                'label' => 'بحث',
                'icon' => 'search',
                // The browse routes are "results" to the person looking at them,
                // the same as a search. Leaving them with no destination marked
                // reads as a bug.
                'also' => ['/vente', '/location', '/vacances', '/echange'],
            ],
            ['href' => '/demandes', 'label' => 'طلبات', 'icon' => 'megaphone', 'also' => []],
            ['href' => '/tableau-de-bord', 'label' => 'حسابي', 'icon' => 'user-round', 'also' => []],
        ];
    }

    /**
     * Screens behind /tableau-de-bord. Listed for everyone: the auth middleware
     * sends a signed-out visitor to /connexion?next=… by itself, and hiding the
     * five links would only move that decision somewhere less obvious.
     *
     * @return list<array{href: string, label: string}>
     */
    public static function accountLinks(): array
    {
        return [
            ['href' => '/tableau-de-bord', 'label' => 'لوحتي'],
            ['href' => '/tableau-de-bord/publications', 'label' => 'منشوراتي'],
            ['href' => '/tableau-de-bord/annonces', 'label' => 'إعلاناتي'],
            ['href' => '/tableau-de-bord/alertes', 'label' => 'تنبيهاتي'],
            ['href' => '/tableau-de-bord/parrainage', 'label' => 'ادعُ أصحابك'],
            ['href' => '/tableau-de-bord/profil', 'label' => 'معلوماتي'],
        ];
    }

    /**
     * The pages the footer used to carry, and nothing else linked to.
     *
     * @return list<array{href: string, label: string}>
     */
    public static function infoLinks(): array
    {
        return [
            ['href' => '/articles', 'label' => 'المقالات'],
            ['href' => '/a-propos', 'label' => 'من نحن'],
            ['href' => '/aide', 'label' => 'المساعدة'],
            ['href' => '/securite', 'label' => 'نصائح الأمان'],
            ['href' => '/cgu', 'label' => 'شروط الاستعمال'],
            ['href' => '/confidentialite', 'label' => 'سياسة الخصوصية'],
        ];
    }

    /**
     * Browse destinations, built from the *live* taxonomy rather than a constant.
     * Categories are admin-editable and hideable, and a menu that offers one an
     * admin has hidden is a link to a page they deliberately took down.
     *
     * @param  list<array{slug: string, label: string}>  $deals
     * @return list<array{href: string, label: string}>
     */
    public static function browseLinks(array $deals): array
    {
        return [
            ['href' => '/', 'label' => 'الرئيسية'],
            ...array_map(
                fn (array $deal) => ['href' => '/'.$deal['slug'], 'label' => $deal['label']],
                $deals,
            ),
            ['href' => '/recherche', 'label' => 'بحث متقدّم'],
            ['href' => '/demandes', 'label' => 'طلبات العقار'],
        ];
    }

    /**
     * Screens that own the bottom of the phone viewport themselves.
     *
     * The listing page pins the price and the call buttons there and the publish
     * form pins its submit button; both are the whole point of those screens. Two
     * stacked bars would eat a sixth of the viewport, so the nav stands down and a
     * back bar takes its place at the top.
     */
    public static function isImmersiveRoute(string $path): bool
    {
        $immersive = [
            '/annonce/',
            '/publier',
            '/modifier',
            // The funnel and the two wizards behind it: one decision per screen,
            // with the button pinned to the thumb. A nav bar under that is a
            // second row of targets competing with the only one that matters.
            '/bienvenue',
            '/demandes/nouvelle',
            '/merci',
            // Sign-in and sign-up sit between a funnel button and the form it
            // leads to.
            '/connexion',
            '/inscription',
            // The admin panel is its own context with its own navigation. The
            // visitor bar underneath it was not just redundant — its publish
            // button is a floating circle that sat on top of whatever card was at
            // the bottom of an admin screen, which is how the launch switch ended
            // up half-covered.
            '/admin',
        ];

        foreach ($immersive as $prefix) {
            if (str_contains($path, $prefix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * The path of the request being rendered, with its leading slash.
     *
     * Every bar in the layout needs it to mark the current destination, and
     * Laravel's request()->path() drops the slash and answers "/" at the root —
     * which would make the root "//" if each caller glued one on itself.
     */
    public static function currentPath(): string
    {
        $path = request()->path();

        return $path === '/' ? '/' : '/'.$path;
    }

    /**
     * Is this destination the one currently being looked at?
     *
     * @param  array{href: string, also?: list<string>}  $item
     */
    public static function isCurrent(string $path, array $item): bool
    {
        if ($item['href'] === '/') {
            return $path === '/';
        }

        foreach ([$item['href'], ...($item['also'] ?? [])] as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix.'/')) {
                return true;
            }
        }

        return false;
    }
}
