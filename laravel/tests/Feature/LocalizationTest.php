<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\Locale;
use App\Services\Geo;
use Database\Seeders\GeographySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

final class LocalizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(GeographySeeder::class);
        Geo::forget();
    }

    public function test_arabic_keeps_every_url_it_already_had(): void
    {
        // The whole reason Arabic is the unprefixed locale: these paths are
        // already indexed and already shared, and /ar/cgu would have broken
        // every one of them.
        foreach (['/', '/cgu', '/a-propos', '/vente/appartement/alger'] as $path) {
            $this->get($path)->assertOk()->assertSee('dir="rtl"', false);
        }
    }

    #[DataProvider('prefixedPaths')]
    public function test_the_added_languages_live_behind_a_prefix(string $path, string $lang, string $dir): void
    {
        $this->get($path)
            ->assertOk()
            ->assertSee('<html lang="'.$lang.'" dir="'.$dir.'"', false);
    }

    /** @return list<array{string, string, string}> */
    public static function prefixedPaths(): array
    {
        return [
            ['/fr', 'fr-DZ', 'ltr'],
            ['/en', 'en', 'ltr'],
            ['/fr/cgu', 'fr-DZ', 'ltr'],
            ['/en/cgu', 'en', 'ltr'],
            ['/fr/vente/appartement/alger', 'fr-DZ', 'ltr'],
            ['/en/vente/appartement/alger/bab-ezzouar', 'en', 'ltr'],
        ];
    }

    public function test_a_language_the_site_does_not_speak_is_a_404(): void
    {
        // Otherwise /de/cgu, /es/cgu and every other two-letter guess answers
        // 200 with the Arabic page, which is a duplicate for a crawler to index.
        $this->get('/de/cgu')->assertNotFound();
        $this->get('/es/vente/appartement/alger')->assertNotFound();
    }

    public function test_the_arabic_prefix_redirects_rather_than_serving_a_duplicate(): void
    {
        // /ar/... is not one of the site's URLs, but it is an obvious guess.
        $this->get('/ar/cgu')->assertRedirect('/cgu');
        $this->get('/ar')->assertRedirect('/');
        $this->get('/ar/vente/appartement/alger')->assertRedirect('/vente/appartement/alger');
    }

    public function test_junk_is_still_junk_inside_a_locale(): void
    {
        $this->get('/fr/pas-un-deal')->assertNotFound();
        $this->get('/en/vente/appartement/pas-une-wilaya')->assertNotFound();
        $this->get('/fr/vente/appartement/alger/pas-une-commune')->assertNotFound();
    }

    public function test_every_version_of_a_page_points_at_the_others(): void
    {
        // Three URLs serve the same page. Without this Google picks one and
        // drops the other two as duplicates.
        $response = $this->get('/fr/vente/appartement/alger');

        $response->assertOk()
            ->assertSee('<link rel="canonical" href="'.url('/fr/vente/appartement/alger').'">', false)
            ->assertSee('hreflang="ar-DZ" href="'.url('/vente/appartement/alger').'"', false)
            ->assertSee('hreflang="fr-DZ" href="'.url('/fr/vente/appartement/alger').'"', false)
            ->assertSee('hreflang="en" href="'.url('/en/vente/appartement/alger').'"', false)
            // x-default is Arabic: the site's own language, and what every
            // existing inbound link already resolves to.
            ->assertSee('hreflang="x-default" href="'.url('/vente/appartement/alger').'"', false);
    }

    public function test_the_switcher_offers_this_page_not_the_home_page(): void
    {
        // Being thrown back to the start of the site is the thing a language
        // switcher most often gets wrong.
        $this->get('/cgu')
            ->assertOk()
            ->assertSee('href="/fr/cgu"', false)
            ->assertSee('href="/en/cgu"', false);
    }

    public function test_navigation_links_stay_in_the_readers_language(): void
    {
        $this->get('/fr/cgu')
            ->assertOk()
            ->assertSee('href="/fr/securite"', false)
            ->assertSee('href="/fr/publier"', false)
            ->assertDontSee('href="/securite"', false);
    }

    public function test_the_menu_lights_up_on_the_same_page_in_every_language(): void
    {
        // The destinations are stored unprefixed, so /cgu, /fr/cgu and /en/cgu
        // are one page as far as "you are here" is concerned.
        foreach (['/cgu', '/fr/cgu', '/en/cgu'] as $path) {
            $this->get($path)->assertOk()->assertSee('aria-current="page"', false);
        }
    }

    public function test_each_language_gets_its_own_content_page(): void
    {
        $this->get('/cgu')->assertSee('شروط الاستعمال');
        $this->get('/fr/cgu')->assertSee("Conditions d'utilisation", false);
        $this->get('/en/cgu')->assertSee('Terms of use');
    }

    public function test_the_deal_reads_as_a_phrase_in_each_language(): void
    {
        // Arabic prefixes لل, French says "à vendre", English says "for sale".
        // Gluing a preposition onto a label works in exactly one of the three.
        $this->get('/vente/appartement/alger')->assertSee('شقة للبيع في الجزائر');
        $this->get('/fr/vente/appartement/alger')->assertSee('Appartement à vendre à Alger', false);
        $this->get('/en/vente/appartement/alger')->assertSee('Apartment for sale in Algiers');
    }

    public function test_an_english_exonym_does_not_leak_into_french(): void
    {
        // Lang::has() walks the fallback chain unless told not to, which is how
        // "à Algiers" reached a French heading.
        $this->get('/fr/vente/appartement/alger')
            ->assertOk()
            ->assertSee('Alger', false)
            ->assertDontSee('Algiers', false);
    }

    public function test_a_wilaya_with_no_exonym_keeps_its_french_name(): void
    {
        $this->get('/en/vente/villa/oran')->assertOk()->assertSee('Villa for sale in Oran');
    }

    public function test_a_place_uses_its_own_languages_comma(): void
    {
        app()->setLocale('ar');
        $this->assertSame('باب الزوار، الجزائر', Geo::placeLabel('alger', 'bab-ezzouar'));

        app()->setLocale('fr');
        $this->assertSame('Bab Ezzouar, Alger', Geo::placeLabel('alger', 'bab-ezzouar'));

        app()->setLocale('en');
        $this->assertSame('Bab Ezzouar, Algiers', Geo::placeLabel('alger', 'bab-ezzouar'));
    }

    public function test_the_locale_prefix_never_reaches_a_controller(): void
    {
        // BrowseController takes ($transaction, $rest). If {locale} stayed a
        // route parameter it would arrive as $transaction and nothing would
        // resolve.
        $this->get('/fr/vente/appartement/alger')->assertOk();
    }

    #[DataProvider('everyLocale')]
    public function test_every_content_page_answers_in_every_language(string $prefix): void
    {
        foreach (['a-propos', 'aide', 'cgu', 'confidentialite', 'securite'] as $page) {
            $this->get($prefix.'/'.$page)->assertOk();
        }
    }

    /** @return list<array{string}> */
    public static function everyLocale(): array
    {
        return [[''], ['/fr'], ['/en']];
    }

    public function test_the_default_locale_does_not_depend_on_an_env_variable(): void
    {
        // config/app.php ships 'en' as the framework default. With a real
        // English locale in the build, a deploy that forgot APP_LOCALE would
        // otherwise serve the entire site in the wrong language.
        $this->assertSame('ar', Locale::default()->value);
        $this->assertSame('ar', config('app.locale'));
        $this->assertSame('ar', config('app.fallback_locale'));
    }
}
