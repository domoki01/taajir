<?php

use App\Http\Controllers\BrowseController;
use App\Http\Controllers\StaticPageController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public routes
|--------------------------------------------------------------------------
|
| The URL scheme is the contract with Google and with every WhatsApp message
| ever sent, so every path here is byte-identical to the one the Next app
| serves. Segments are Latin and French-derived; Arabic never appears in a URL.
|
*/

Route::view('/', 'home')->name('home');

/*
 * The content pages. Listed one by one rather than as `/{page}` so that the
 * browse catch-all — `/{transaction}/{rest?}`, arriving in phase 2 — cannot
 * resolve `/cgu` as a transaction type and 404 it.
 */
foreach (['a-propos', 'aide', 'cgu', 'confidentialite', 'securite'] as $page) {
    Route::get("/{$page}", StaticPageController::class)
        ->defaults('page', $page)
        ->name("static.{$page}");
}

/*
 * The SEO catch-all: /vente/appartement/alger/bab-ezzouar.
 *
 * Registered last, after every fixed path, because it would otherwise resolve
 * /cgu as a transaction type. The controller checks each segment against the
 * live taxonomy and the seeded geography in order — deal, property type,
 * wilaya, commune — and 404s on anything else, so a crawler cannot walk an
 * unbounded set of empty pages.
 */
Route::get('/{transaction}/{rest?}', BrowseController::class)
    ->where('rest', '.*')
    ->name('browse');
