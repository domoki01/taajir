<?php

use App\Http\Middleware\EnsureAccountIsActive;
use App\Http\Middleware\EnsureStaff;
use App\Http\Middleware\RedirectIfUnauthenticated;
use App\Http\Middleware\SetLocale;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Every page is in one of three languages, and which one is decided by
        // the URL before anything renders.
        $middleware->web(append: [SetLocale::class, EnsureAccountIsActive::class]);

        // Named rather than global: most of this site is readable signed out,
        // and that is deliberate — browsing needs no account.
        $middleware->alias([
            'auth.session' => RedirectIfUnauthenticated::class,
            // The door to /admin, and nothing more: it asks whether this
            // account holds any permission at all. Which screens it may open
            // is decided per screen, and again by every action behind every
            // button.
            'staff' => EnsureStaff::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();

/*
 * On a DirectAdmin or cPanel account the document root is a fixed `public_html`
 * that cannot be moved, so the application tree sits above it and only the
 * contents of `public/` go inside — which means `<base>/public` does not exist
 * on the server at all.
 *
 * Laravel still looks there for anything it serves by path, and the first thing
 * that breaks is the Vite manifest: every page 500s with "Vite manifest not
 * found" on a deployment that is otherwise perfectly correct. The front
 * controller in deploy/public_html defines this constant; locally it is absent
 * and the default stands.
 */
if (defined('TAAJIR_PUBLIC_PATH')) {
    $app->usePublicPath(TAAJIR_PUBLIC_PATH);
}

return $app;
