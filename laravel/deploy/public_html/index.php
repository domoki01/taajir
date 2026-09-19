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

/*
 * Find the application tree.
 *
 * Accounts differ: the document root is `~/domains/DOMAIN/public_html` on most
 * DirectAdmin setups and plain `~/public_html` on others, and there is no way
 * to tell from in here which one this is. So rather than assume a depth, walk
 * up from this file and look for `taajir-app` beside each ancestor. That finds
 * it in every layout where the two were uploaded as a pair.
 *
 * TAAJIR_APP_BASE in the environment overrides the search.
 */
$candidates = [];

if ($fromEnv = getenv('TAAJIR_APP_BASE')) {
    $candidates[] = rtrim($fromEnv, '/');
}

$dir = __DIR__;
for ($level = 0; $level < 6; $level++) {
    $candidates[] = $dir.'/taajir-app';
    $parent = dirname($dir);
    if ($parent === $dir) {
        break;
    }
    $dir = $parent;
}

$base = null;
foreach ($candidates as $candidate) {
    if (is_file($candidate.'/vendor/autoload.php')) {
        $base = $candidate;
        break;
    }
}

if ($base === null) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');

    // Saying where it looked is the difference between a two-minute fix and an
    // evening. Only paths are shown, and only ones derived from this file's own
    // location — nothing about the account that a visitor could not already
    // guess from the URL.
    echo "لم يتم العثور على مجلّد taajir-app.\n\n";
    echo "هذا الملف موجود في:\n  ".__DIR__."\n\n";
    echo "بحثت عن vendor/autoload.php في:\n";
    foreach ($candidates as $candidate) {
        echo '  '.(is_dir($candidate) ? '[موجود لكن بلا vendor] ' : '[غير موجود] ').$candidate."\n";
    }
    echo "\nارفع مجلّد taajir-app إلى أحد هذه المسارات، أو عدّل السطر\n";
    echo "getenv('TAAJIR_APP_BASE') في هذا الملف ليشير إلى مكانه.\n";
    exit;
}

// Tells bootstrap/app.php that the document root is here rather than at
// <base>/public, which does not exist in this layout.
define('TAAJIR_PUBLIC_PATH', __DIR__);
define('APP_BASE', $base);
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
