<?php

use Illuminate\Contracts\Console\Kernel;
use Symfony\Component\Console\Output\BufferedOutput;

/*
 * Unpack a release zip and finish the deploy, in one request.
 *
 * update.php assumes the new code is already on disk and does the rest.
 * This does the "already on disk" part too, because doing it by hand in a
 * phone's file manager is a dozen steps where two of them silently do nothing:
 * an extractor that skips existing files leaves half the application on the
 * previous version, and the failure surfaces much later as an undefined
 * variable in a view whose controller was never replaced.
 *
 * Order matters and is the whole design:
 *
 *   1. Everything that touches files happens with plain PHP, BEFORE Laravel is
 *      booted. The application on disk may be the broken half-updated one; if
 *      booting it were a prerequisite, this script could not fix the state that
 *      stops it booting.
 *   2. Only then is the framework loaded, to run the migrations and rebuild the
 *      caches.
 *
 * It refuses to run without SETUP_TOKEN, and deletes itself and the zip when it
 * is done.
 */

header('Content-Type: text/plain; charset=utf-8');

$DOCROOT = __DIR__;

// ── Find the application, the same walk-up the front controller does ─────────
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
    if (is_file($candidate.'/.env')) {
        $base = $candidate;
        break;
    }
}

if ($base === null) {
    http_response_code(500);
    echo "لم يتم العثور على مجلّد taajir-app فيه ملف .env.\n\nبحثت في:\n";
    foreach ($candidates as $candidate) {
        echo '  '.(is_dir($candidate) ? '[موجود بلا .env] ' : '[غير موجود] ').$candidate."\n";
    }
    exit(1);
}

/*
 * The token, read straight out of .env.
 *
 * Parsed here rather than through the framework because the framework is not
 * loaded yet — and must not be, since the code it would load is the code this
 * script exists to replace. Tolerant of CRLF and of a UTF-8 BOM: a .env saved
 * from Windows leaves a \r glued to the value, which rejects a token that is
 * character-for-character correct.
 */
$token = '';
foreach (preg_split('/\r\n|\r|\n/', (string) file_get_contents($base.'/.env')) as $line) {
    $line = ltrim($line, "\xEF\xBB\xBF \t");
    if (str_starts_with($line, 'SETUP_TOKEN')) {
        $value = trim((string) substr($line, strpos($line, '=') + 1));
        $token = trim($value, "\"' \t\r\n");
        break;
    }
}

if ($token === '') {
    http_response_code(403);
    exit("SETUP_TOKEN فارغ في ملف .env.\n");
}

if (strlen($token) < 24) {
    http_response_code(403);
    exit("SETUP_TOKEN قصير جداً — لازم 24 حرف على الأقل.\n");
}

if (! hash_equals($token, (string) ($_GET['token'] ?? ''))) {
    http_response_code(403);
    printf(
        "✖ التوكن غير مطابق.\n   في .env: %d حرفاً\n   في الرابط: %d حرفاً\n",
        strlen($token),
        strlen((string) ($_GET['token'] ?? '')),
    );
    exit(1);
}

echo "تأجير — فكّ ونشر\n================\n\n";

$fail = function (string $message): never {
    echo "\n✖ ".$message."\n\nالموقع ما زال كيما كان. صحّح المشكل وأعد تحميل هذه الصفحة.\n";
    exit(1);
};

// ── The zip ──────────────────────────────────────────────────────────────────
$zip = null;
foreach (glob(__DIR__.'/*.zip') ?: [] as $found) {
    $zip = $found;
    break;
}

if ($zip === null) {
    $fail('ما لقيت حتى ملف .zip حذا هذا السكريبت. ارفع حزمة التحديث في نفس المجلّد.');
}

echo 'الحزمة: '.basename($zip)."\n";

if (! class_exists(ZipArchive::class)) {
    $fail('إضافة zip غير مفعّلة في PHP.');
}

$archive = new ZipArchive;
if ($archive->open($zip) !== true) {
    $fail('ما قدرتش نفتح الحزمة — يمكن الرفع تقطّع. عاود ارفعها.');
}

// Unpacked to a temp directory first. Extracting straight over a live
// application means a request served halfway through sees a tree that is half
// one version and half the other.
$staging = $DOCROOT.'/.taajir-staging-'.bin2hex(random_bytes(4));

if (! @mkdir($staging, 0755, true)) {
    $fail("ما قدرتش نصنع مجلّد مؤقّت في {$DOCROOT}.");
}

if (! $archive->extractTo($staging)) {
    $fail('فشل فكّ الحزمة — يمكن ما كاش بلاصة في القرص.');
}
$archive->close();

if (! is_dir($staging.'/taajir-app') || ! is_dir($staging.'/public_html')) {
    $fail('هذي ماشي حزمة تأجير — لازم تكون فيها taajir-app/ و public_html/.');
}

echo "✔ تفكّت الحزمة\n\n";

/**
 * Copy a tree over another, overwriting.
 *
 * `$skip` names paths, relative to the root of the copy, that belong to the
 * server and not to the release: the real .env, the writable tree, the
 * installed dependencies, and the front controller that was tuned for this
 * account. Every one of them would take the site down if a deploy replaced it.
 *
 * @param  list<string>  $skip
 */
$mirror = function (string $from, string $to, array $skip = []) use (&$mirror): int {
    $copied = 0;

    foreach (scandir($from) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }

        if (in_array($entry, $skip, true)) {
            continue;
        }

        $source = $from.'/'.$entry;
        $target = $to.'/'.$entry;

        if (is_dir($source)) {
            if (! is_dir($target)) {
                @mkdir($target, 0755, true);
            }
            // Only the top level is protected: a nested file called .env is
            // not the one that matters, and skipping by name at every depth
            // would quietly refuse to update resources/views/storage/*.
            $copied += $mirror($source, $target);
        } else {
            $copied += @copy($source, $target) ? 1 : 0;
        }
    }

    return $copied;
};

echo "→ مجلّد التطبيق\n";
/*
 * .env and storage are the installation, not the code, and are never replaced.
 *
 * vendor and node_modules are kept only because a release usually leaves them
 * out — they are built on the server in the ordinary case. This account has no
 * SSH and no proc_open, so composer cannot run on it at all; when a release
 * does carry vendor/, carrying it is the entire point, and skipping it would
 * leave the site throwing "Class not found" at whoever reaches the new code
 * first.
 */
$keep = ['.env', 'storage'];
foreach (['vendor', 'node_modules'] as $tree) {
    if (! is_dir($staging.'/taajir-app/'.$tree)) {
        $keep[] = $tree;
    }
}
if (is_dir($staging.'/taajir-app/vendor')) {
    echo "  الحزمة فيها vendor — يتبدّل كامل\n";
}
$copied = $mirror($staging.'/taajir-app', $base, $keep);
echo "✔ {$copied} ملف\n";

echo "→ الـdocument root\n";
// index.php stays: it is the split-layout front controller, and on an account
// where TAAJIR_APP_BASE was set by hand, replacing it loses that.
$copied = $mirror($staging.'/public_html', $DOCROOT, ['index.php', 'storage']);
echo "✔ {$copied} ملف\n\n";

// ── The caches that make old code keep running ───────────────────────────────
//
// Deleted before the framework is loaded, for the same reason as everything
// above: a config.php written by the previous version is read during bootstrap,
// and a compiled view from it is what serves a page whose controller has
// already been replaced.
$cleared = 0;
foreach (glob($base.'/bootstrap/cache/*.php') ?: [] as $stale) {
    $cleared += @unlink($stale) ? 1 : 0;
}
foreach (glob($base.'/storage/framework/views/*.php') ?: [] as $stale) {
    $cleared += @unlink($stale) ? 1 : 0;
}
echo "✔ مسحت {$cleared} ملف كاش\n";

// ── The writable tree ────────────────────────────────────────────────────────
//
// Before bootstrap, because view.compiled is resolved with realpath() during
// it and realpath() answers false for a directory that is not there.
foreach (['app/public', 'framework/cache/data', 'framework/sessions', 'framework/views', 'logs'] as $directory) {
    if (! is_dir($base.'/storage/'.$directory)) {
        @mkdir($base.'/storage/'.$directory, 0775, true);
    }
}
@mkdir($base.'/bootstrap/cache', 0775, true);

// ── Is the application inside the document root? ─────────────────────────────
//
// It should not be: anything under the document root is reachable by URL, and
// this tree holds .env, the logs and every dependency. LiteSpeed blocks
// dotfiles, so .env itself is usually safe — but storage/logs/laravel.log is
// not a dotfile, and a log is where a stack trace prints a connection string.
$exposed = str_starts_with($base.'/', $DOCROOT.'/');

if ($exposed) {
    // A deny rule closes it now. Moving the tree above the document root is
    // still the real fix — an .htaccess that stops being read re-exposes
    // everything silently, and a path that is not served cannot.
    @file_put_contents($base.'/.htaccess', "Require all denied\n");
    echo "✔ كتبت .htaccess يسكّر المجلّد على الويب\n";
}

// ── Now, and only now, the framework ─────────────────────────────────────────
if (! is_file($base.'/vendor/autoload.php')) {
    $fail('vendor/autoload.php ناقص — دير composer install في '.$base);
}

define('TAAJIR_PUBLIC_PATH', $DOCROOT);

require $base.'/vendor/autoload.php';

$app = require_once $base.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

echo "\n→ قاعدة البيانات\n";

$run = function (string $command, array $parameters = []) use ($kernel, $fail): string {
    $output = new BufferedOutput;

    try {
        $status = $kernel->call($command, $parameters, $output);
    } catch (Throwable $e) {
        $fail("فشل الأمر {$command}: ".$e->getMessage());
    }

    $text = $output->fetch();

    if ($status !== 0) {
        $fail("فشل الأمر {$command}:\n".$text);
    }

    echo "✔ {$command}\n";

    return $text;
};

foreach (preg_split('/\r?\n/', trim($run('migrate', ['--force' => true]))) as $line) {
    if (trim($line) !== '') {
        echo '    '.$line."\n";
    }
}

$run('db:seed', ['--force' => true]);
$run('config:cache');
$run('route:cache');
$run('view:cache');

// artisan storage:link cannot make this one: it writes into public/storage,
// and in this layout public/ is not the document root.
if (! file_exists($DOCROOT.'/storage')) {
    echo @symlink($base.'/storage/app/public', $DOCROOT.'/storage')
        ? "✔ رابط مجلد الصور\n"
        : "! تعذّر إنشاء رابط مجلد الصور — الصور المرفوعة ما تظهرش\n";
}

// ── Clean up after itself ────────────────────────────────────────────────────
$rm = function (string $path) use (&$rm): void {
    if (is_dir($path)) {
        foreach (scandir($path) ?: [] as $entry) {
            if ($entry !== '.' && $entry !== '..') {
                $rm($path.'/'.$entry);
            }
        }
        @rmdir($path);
    } else {
        @unlink($path);
    }
};

$rm($staging);
@unlink($zip);

echo "\n──────────────────────────────────\n";
echo 'تمّ. ';
echo @unlink(__FILE__) ? "حذفت الحزمة وهذا الملف.\n" : "احذف install-update.php يدوياً.\n";

if ($exposed) {
    echo "\n⚠ مجلّد التطبيق راه داخل public_html.\n";
    echo "  سكّرتو بـ.htaccess، بصح الحلّ الصحيح نقلو لفوق public_html.\n";
    echo "  دير هذا كي تكون على كمبيوتر.\n";
}

echo "\nتأكّد من سطر الـcron (مرّة وحدة):\n";
echo '  * * * * * cd '.$base." && php artisan schedule:run >/dev/null 2>&1\n\n";
echo 'الموقع: '.config('app.url')."\n";
