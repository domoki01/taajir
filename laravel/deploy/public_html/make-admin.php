<?php

use Illuminate\Contracts\Console\Kernel;
use Symfony\Component\Console\Output\BufferedOutput;

/*
 * Give the admin role to one account, from the browser.
 *
 * `php artisan taajir:make-admin someone@example.com` is the real thing; this
 * exists because a shared account has no shell to run it in. It calls the same
 * command in this process — proc_open is disabled here, so nothing can be
 * spawned — and prints what the command printed.
 *
 * The problem it solves: a uid is minted per Firebase project, so moving
 * projects leaves the old admin row holding the role under a uid nobody can
 * sign in as. The owner signs in, arrives as an ordinary user, and gets a 403
 * from the one screen that could fix it.
 *
 * Guarded by SETUP_TOKEN, like setup.php and install-update.php, and it deletes
 * itself once it has worked. A URL that hands out the admin role is not
 * something to leave lying in a document root.
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
    if (is_dir($candidate) && is_file($candidate.'/.env')) {
        $base = $candidate;
        break;
    }
}

header('Content-Type: text/plain; charset=utf-8');

if ($base === null) {
    http_response_code(500);
    echo "لم يتم العثور على مجلّد taajir-app فيه ملف .env.\n\nبحثت في:\n";
    foreach ($candidates as $candidate) {
        echo '  '.(is_dir($candidate) ? '[موجود بلا .env] ' : '[غير موجود] ').$candidate."\n";
    }
    exit(1);
}

/*
 * The token, read straight out of .env — the framework is not loaded yet.
 * Tolerant of CRLF and of a UTF-8 BOM: a .env saved from Windows leaves a \r
 * glued to the value, which rejects a token that is character-for-character
 * correct.
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

echo "تأجير — منح دور الأدمين\n=======================\n\n";

$email = trim((string) ($_GET['email'] ?? ''));

if ($email === '') {
    http_response_code(400);
    echo "ناقص البريد.\n\nالاستعمال:\n  make-admin.php?token=<SETUP_TOKEN>&email=<البريد>\n";
    exit(1);
}

echo "البريد: {$email}\n\n";

require $base.'/vendor/autoload.php';

$app = require_once $base.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

$output = new BufferedOutput;

/*
 * Wrapped because the likeliest failure here is not the command failing but
 * the command being absent: run against an install that predates it, Laravel
 * renders its own 500 page and the person reading it learns nothing. The fix
 * is to apply the update first, so that is what it says.
 */
try {
    $status = $kernel->call('taajir:make-admin', ['email' => $email], $output);
} catch (Throwable $e) {
    http_response_code(500);
    echo $output->fetch();
    echo "\n✖ ".$e->getMessage()."\n";

    if (str_contains($e->getMessage(), 'does not exist')) {
        echo "\nهذا معناه أنّ التحديث ما تركّبش بعد.\n";
        echo "ركّب آخر حزمة بـinstall-update.php، ثمّ أعد تحميل هذه الصفحة.\n";
    }

    exit(1);
}

echo $output->fetch();

if ($status !== 0) {
    echo "\n✖ ما تمّش. هذا الملف ما تمسحش — صحّح وأعد المحاولة.\n";
    exit(1);
}

echo "\n──────────────────────────────────\n";

/*
 * Best-effort, and deliberately unable to fail the request.
 *
 * The role itself is read from the database on every request, so the promotion
 * above is already complete and durable; this only drops a resolved permission
 * set that might be sitting in the cache. It ran unguarded once and took the
 * whole page down with "no such table: cache" — the cache store was configured
 * for a table this install had never migrated — after the account had already
 * been promoted. Reporting success as a 500 is worse than not clearing a cache.
 */
try {
    $kernel->call('cache:clear', [], $output);
    $output->fetch();
    echo "✔ مسحت الكاش\n";
} catch (Throwable $e) {
    echo '⚠ ما نجحش مسح الكاش: '.$e->getMessage()."\n";
    echo "  الدور تبدّل على كل حال. إذا /admin ما زال يرفض، امسح\n";
    echo "  taajir-app/bootstrap/cache/*.php من File Manager.\n";
}

echo @unlink(__FILE__)
    ? "✔ حذفت هذا الملف.\n"
    : "⚠ احذف make-admin.php يدوياً — الرابط يعطي دور الأدمين.\n";

echo "\nروح لـ /admin وأعد تحميل الصفحة.\n";
