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
 *
 * Set APP_BASE to the absolute path of the application tree, then copy the rest
 * of `public/` (`.htaccess`, `build/`, `favicon.ico`, `robots.txt`) in beside
 * this file. Everything below this line is Laravel's own index.php with the
 * three `__DIR__/..` paths repointed.
 */

define('APP_BASE', '/home/CHANGEME/taajir-app');

define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = APP_BASE.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require APP_BASE.'/vendor/autoload.php';

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once APP_BASE.'/bootstrap/app.php';

$app->handleRequest(Request::capture());
