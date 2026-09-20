<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Console\Output\BufferedOutput;

/*
 * The updater, for an account with no SSH.
 *
 * setup.php installs once and deletes itself. This is the other half: what you
 * run after every upload, when the code on the server is newer than the schema
 * and the caches behind it. It runs migrations, remakes the image symlink and
 * rebuilds the three caches, and it is safe to run twice — every step it takes
 * is one that does nothing when there is nothing to do.
 *
 * It does NOT delete itself, because updating is not a one-time act. That makes
 * the token the only thing standing between the public and a script that can
 * migrate the database, so it refuses to run on a short one.
 *
 * It reports every step in plain words. The whole point of this file is that
 * the person running it has no terminal: with APP_DEBUG=false, which is correct
 * for a live site, an uncaught exception renders "Server Error" and tells them
 * nothing at all.
 */

// The same search index.php and setup.php do: accounts differ on how deep the
// document root sits, so walk up and look for taajir-app beside each ancestor.
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
    echo "لم يتم العثور على مجلّد taajir-app.\n\nهذا الملف في:\n  ".__DIR__."\n\nبحثت في:\n";
    foreach ($candidates as $candidate) {
        echo '  '.(is_dir($candidate) ? '[موجود بلا vendor] ' : '[غير موجود] ').$candidate."\n";
    }
    exit;
}

define('TAAJIR_PUBLIC_PATH', __DIR__);

require $base.'/vendor/autoload.php';

/*
 * The caches are cleared before the application boots, not after.
 *
 * A config:cache written by the previous version is read during bootstrap, so
 * an update that added a config key would boot with the old file and then fail
 * somewhere unrelated. Deleting the files first is the only order that works,
 * and it is why this happens before bootstrap() rather than in the step list.
 */
foreach (['config.php', 'routes-v7.php', 'packages.php', 'services.php'] as $stale) {
    @unlink($base.'/bootstrap/cache/'.$stale);
}

$app = require_once $base.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

header('Content-Type: text/plain; charset=utf-8');

$expected = (string) env('SETUP_TOKEN', '');

if ($expected === '') {
    http_response_code(403);
    exit("SETUP_TOKEN غير مضبوط في ملف .env.\n");
}

// Short enough to guess is short enough to refuse. This script can migrate the
// database, and unlike setup.php it stays on the document root afterwards.
if (strlen($expected) < 24) {
    http_response_code(403);
    exit("SETUP_TOKEN قصير جداً — لازم 24 حرف على الأقل.\nولّد واحد: openssl rand -hex 24\n");
}

if (! hash_equals($expected, (string) ($_GET['token'] ?? ''))) {
    http_response_code(403);
    exit("الرمز غير مطابق.\n");
}

echo "تأجير — التحديث\n===============\n\n";

$fail = function (string $message): never {
    echo "\n✖ ".$message."\n";
    echo "\nالموقع ما زال يخدم بالنسخة القديمة. صحّح المشكل وأعد تحميل هذه الصفحة.\n";
    exit(1);
};

// ── What has to be true before anything is written ───────────────────────────

foreach (['storage', 'bootstrap/cache'] as $writable) {
    if (! is_writable($base.'/'.$writable)) {
        $fail("المجلد {$writable} غير قابل للكتابة. اضبط صلاحياته على 775 من File Manager.");
    }
}

// ext-intl became a hard requirement with the Arabic text fold: without it the
// search, the slugs and half the listing page fatal at runtime rather than
// failing to install. Named here because the PHP selector is where it is fixed,
// and because the error it otherwise produces says nothing about intl.
if (! extension_loaded('intl')) {
    $fail('إضافة intl غير مفعّلة في PHP. فعّلها من DirectAdmin → Select PHP Version → Extensions، ثم أعد تحميل هذه الصفحة.');
}

if ((string) config('app.key') === '') {
    $fail('APP_KEY فارغ. هذا تنصيب جديد وليس تحديثاً — استعمل setup.php.');
}

try {
    DB::connection()->getPdo();
} catch (Throwable $e) {
    $fail('تعذّر الاتصال بقاعدة البيانات: '.$e->getMessage());
}

echo "✔ intl مفعّلة\n✔ الاتصال بقاعدة البيانات ناجح\n";

// The compiled assets are not in git and are not built on the host, so a deploy
// that forgot to upload them is a site with no styling at all — which looks
// like a much stranger bug than it is.
if (! is_file(__DIR__.'/build/manifest.json')) {
    echo "! build/manifest.json غير موجود — الموقع يظهر بلا تنسيق.\n";
    echo "  دير `npm run build` عندك وارفع public/build/ لهنا.\n";
}

echo "\n";

// ── The work ─────────────────────────────────────────────────────────────────

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

/*
 * Migrations first, and the output is shown rather than swallowed: the one
 * thing worth reading on this page is which tables the update added. Nothing
 * here is destructive — every migration in this project creates — so running it
 * unattended is safe in a way a drop would not be.
 */
$migrations = $run('migrate', ['--force' => true]);

foreach (preg_split('/\r?\n/', trim($migrations)) as $line) {
    if (trim($line) !== '') {
        echo '    '.$line."\n";
    }
}

/*
 * The seeders are idempotent by construction — the roles seeder upserts and
 * only inserts permissions that are missing, and the geography seeder keys on
 * the slug — so a re-run never undoes an admin's edits. That is what makes it
 * safe to run on every update, which in turn is what picks up a new wilaya or a
 * new permission without anyone remembering to.
 */
$run('db:seed', ['--force' => true]);

// Rebuilt, not just cleared: a live site should never be reading config off
// disk on every request.
$run('config:cache');
$run('route:cache');
$run('view:cache');

// `artisan storage:link` cannot make this one: it writes into public/storage,
// and in the split layout public/ is not where the document root is.
$link = __DIR__.'/storage';

if (! file_exists($link)) {
    echo @symlink($base.'/storage/app/public', $link)
        ? "✔ رابط مجلد الصور\n"
        : "! تعذّر إنشاء رابط مجلد الصور — الصور المرفوعة ما تظهرش. أنشئه يدوياً.\n";
} else {
    echo "• رابط مجلد الصور موجود\n";
}

echo "\n──────────────────────────────────\n";
echo "تمّ التحديث.\n\n";

// The cron is the one thing this script cannot do for them, and the one whose
// absence is silent: the site works, and the launch, the expiry and the queue
// simply never run.
echo "تأكّد من سطر الـcron (مرّة وحدة برك، كل دقيقة):\n";
echo '  * * * * * cd '.$base." && php artisan schedule:run >/dev/null 2>&1\n\n";
echo 'الموقع: '.config('app.url')."\n";
