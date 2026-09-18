<?php

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
