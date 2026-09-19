<?php

use App\Enums\Locale;
use App\Http\Controllers\BrowseController;
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
    Route::view('/', 'home')->name('home');

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

Route::prefix('{locale}')
    ->where(['locale' => Locale::prefixedPattern()])
    ->name('localized.')
    ->group($routes);

$routes();
