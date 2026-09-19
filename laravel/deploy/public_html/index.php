<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

/*
 * Front controller for a DirectAdmin / cPanel account, where the document root
 * is a fixed `public_html` that cannot be moved.
 *
 * The application tree lives ABOVE the document root and only the contents of
 * Laravel's `public/` go inside it. That is the whole point of the split: `.env`
 * holds APP_KEY, the database password and — later — the key that decrypts the
 * payout destinations, and `vendor/` is tens of thousands of files nobody should
 * be able to fetch by URL. Anything reachable by URL is reachable by everyone.
 */

// Where the application tree is. The standard DirectAdmin layout puts the
// document root at ~/domains/DOMAIN/public_html, so ~/taajir-app is three
// levels up — which is why this usually needs no editing at all. Set
// TAAJIR_APP_BASE in the environment, or edit the last candidate, if the
// account is laid out differently.
$candidates = [
    getenv('TAAJIR_APP_BASE') ?: null,
    dirname(__DIR__, 3).'/taajir-app',
    dirname(__DIR__).'/taajir-app',
    '/home/CHANGEME/taajir-app',
];

$base = null;
foreach ($candidates as $candidate) {
    if ($candidate !== null && is_file($candidate.'/vendor/autoload.php')) {
        $base = $candidate;
        break;
    }
}

if ($base === null) {
    http_response_code(500);
    exit('Application not found. Set TAAJIR_APP_BASE or edit public_html/index.php.');
}

define('APP_BASE', $base);
define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = APP_BASE.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
// Tells bootstrap/app.php that the document root is here rather than at
// <base>/public, which does not exist in this layout.
define('TAAJIR_PUBLIC_PATH', __DIR__);

require APP_BASE.'/vendor/autoload.php';

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once APP_BASE.'/bootstrap/app.php';

$app->handleRequest(Request::capture());
