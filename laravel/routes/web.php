<?php

use App\Enums\Locale;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\BrowseController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\ListingController;
use App\Http\Controllers\ReferralController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\SitemapController;
use App\Http\Controllers\StaticPageController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\URL;

/*
|--------------------------------------------------------------------------
| Public routes
|--------------------------------------------------------------------------
|
| The URL scheme is the contract with Google and with every WhatsApp message
| ever sent, so every Arabic path here is byte-identical to the one the Next
| app serves. Segments are Latin and French-derived; Arabic never appears in a
| URL.
|
| The same set is registered twice: once behind /fr and /en, and once bare for
| Arabic. Arabic keeps the unprefixed paths because they are the ones already
| indexed and already shared — the two additions are what take a prefix.
|
| Order matters. The prefixed group goes first, because the bare browse
| catch-all would otherwise read /fr/cgu as a transaction type called "fr".
|
*/

$routes = function (): void {
    Route::get('/', HomeController::class)->name('home');

    Route::get('/recherche', SearchController::class)->name('search');

    // The id resolves it; the slug is for humans. A wrong slug 301s to the
    // right one rather than 404ing, so old links keep landing.
    Route::get('/annonce/{id}/{slug}', [ListingController::class, 'show'])
        ->where('id', '[a-z0-9]{12}')
        ->name('listing');

    /*
     * The content pages. Listed one by one rather than as `/{page}` so that the
     * browse catch-all cannot resolve `/cgu` as a transaction type and 404 it.
     */
    foreach (['a-propos', 'aide', 'cgu', 'confidentialite', 'securite'] as $page) {
        Route::get("/{$page}", StaticPageController::class)
            ->defaults('page', $page)
            ->name("static.{$page}");
    }

    /*
     * Sign-in. The pages host the Firebase widget; the exchange is what the
     * site actually trusts — see SessionController.
     */
    Route::get('/connexion', [AuthController::class, 'signIn'])->name('sign-in');
    Route::get('/inscription', [AuthController::class, 'signUp'])->name('sign-up');
    Route::post('/auth/session', [SessionController::class, 'store'])->name('session.store');
    Route::delete('/auth/session', [SessionController::class, 'destroy'])->name('session.destroy');

    Route::get('/tableau-de-bord', DashboardController::class)
        ->middleware('auth.session')
        ->name('dashboard');

    /*
     * The SEO catch-all: /vente/appartement/alger/bab-ezzouar.
     *
     * Registered last, after every fixed path. The controller checks each
     * segment against the live taxonomy and the seeded geography in order —
     * deal, property type, wilaya, commune — and 404s on anything else, so a
     * crawler cannot walk an unbounded set of empty pages.
     */
    Route::get('/{transaction}/{rest?}', BrowseController::class)
        ->where('rest', '.*')
        ->name('browse');
};

/*
 * Arabic has no prefix, so /ar/... is not one of the site's URLs — but it is an
 * obvious thing to type or to hand-write into a link. Redirecting keeps exactly
 * one canonical URL per page per language while not punishing the guess.
 */
Route::redirect('/'.Locale::default()->value, '/', 301);
Route::get('/'.Locale::default()->value.'/{rest}', fn (string $rest) => redirect('/'.$rest, 301))
    ->where('rest', '.*');

/*
 * The referral link. Outside the locale group on purpose: it is pasted into
 * WhatsApp and typed off paper, so it stays as short as it can be, and it
 * redirects rather than rendering anything.
 */
Route::get('/sitemap.xml', SitemapController::class)->name('sitemap');

Route::get('/r/{code}', ReferralController::class)
    ->where('code', '[A-Z0-9]{6}')
    ->name('referral');

Route::prefix('{locale}')
    ->where(['locale' => Locale::prefixedPattern()])
    ->name('localized.')
    ->group($routes);

$routes();
