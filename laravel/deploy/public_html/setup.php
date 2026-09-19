<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Console\Output\BufferedOutput;

/*
 * One-time installer, for an account with no SSH.
 *
 * Generates APP_KEY, creates the schema and seeds the geography and the roles —
 * the three things that otherwise need `php artisan` at a terminal. It deletes
 * itself when it is done.
 *
 * It refuses to run unless SETUP_TOKEN is set in .env and matches ?token=. A
 * script that can create tables and write APP_KEY is not something to leave
 * open on a public document root for even the few minutes between uploading and
 * running it.
 *
 * Every step reports in plain words. The whole point of this file is that the
 * person running it has no terminal and no stack trace to read, so a failure
 * that renders Laravel's "Server Error" page would tell them nothing at all —
 * and with APP_DEBUG=false, which is correct for a live site, that is exactly
 * what an uncaught exception produces.
 */

$base = dirname(__DIR__, 3).'/taajir-app';
if (! is_file($base.'/vendor/autoload.php')) {
    $base = dirname(__DIR__).'/taajir-app';
}

if (! is_file($base.'/vendor/autoload.php')) {
    http_response_code(500);
    exit("لم يتم العثور على مجلد taajir-app. تأكّد أنه مرفوع فوق public_html.\n");
}

define('TAAJIR_PUBLIC_PATH', __DIR__);

require $base.'/vendor/autoload.php';

$app = require_once $base.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

header('Content-Type: text/plain; charset=utf-8');

$expected = (string) env('SETUP_TOKEN', '');
if ($expected === '' || ! hash_equals($expected, (string) ($_GET['token'] ?? ''))) {
    http_response_code(403);
    exit("SETUP_TOKEN غير مضبوط في ملف .env، أو الرمز غير مطابق.\n");
}

echo "تأجير — التنصيب\n===============\n\n";

// ── Checks that produce a useful sentence instead of a stack trace ───────────
$fail = function (string $message): never {
    echo "\n✖ ".$message."\n";
    echo "\nصحّح ملف taajir-app/.env وأعد تحميل هذه الصفحة.\n";
    exit(1);
};

foreach (['storage', 'bootstrap/cache'] as $writable) {
    if (! is_writable($base.'/'.$writable)) {
        $fail("المجلد {$writable} غير قابل للكتابة. اضبط صلاحياته على 775 من File Manager.");
    }
}

if (config('database.default') === 'mysql') {
    foreach (['database', 'username'] as $field) {
        if ((string) config("database.connections.mysql.{$field}") === '') {
            $fail('DB_'.strtoupper($field).' فارغ في ملف .env. أنشئ قاعدة البيانات من DirectAdmin ثم ضع بياناتها هنا.');
        }
    }
}

try {
    DB::connection()->getPdo();
} catch (Throwable $e) {
    $fail('تعذّر الاتصال بقاعدة البيانات: '.$e->getMessage());
}

echo "✔ الاتصال بقاعدة البيانات ناجح\n\n";

// ── The work ─────────────────────────────────────────────────────────────────
$run = function (string $command, array $parameters = []) use ($kernel, $fail): void {
    $output = new BufferedOutput;

    try {
        $status = $kernel->call($command, $parameters, $output);
    } catch (Throwable $e) {
        $fail("فشل الأمر {$command}: ".$e->getMessage());
    }

    if ($status !== 0) {
        $fail("فشل الأمر {$command}:\n".$output->fetch());
    }

    echo "✔ {$command}\n";
};

// APP_KEY first: everything else needs it, and it must never be a value that
// travelled anywhere. It is generated here, on the server, once.
if ((string) config('app.key') === '') {
    $run('key:generate', ['--force' => true]);
} else {
    echo "• APP_KEY موجود مسبقاً\n";
}

$run('migrate', ['--force' => true]);
$run('db:seed', ['--force' => true]);
$run('config:cache');
$run('route:cache');
$run('view:cache');

// The storage symlink, which `artisan storage:link` cannot make in this layout:
// it writes into public/storage, and public/ is not where the document root is.
$link = __DIR__.'/storage';
if (! file_exists($link)) {
    echo @symlink($base.'/storage/app/public', $link)
        ? "✔ رابط مجلد الصور\n"
        : "! تعذّر إنشاء رابط مجلد الصور — أنشئه يدوياً وإلا الصور المرفوعة ما تظهرش\n";
}

echo "\n──────────────────────────────────\n";

if (@unlink(__FILE__)) {
    echo "تمّ التنصيب. حذف هذا الملف نفسه.\n";
} else {
    echo "تمّ التنصيب. احذف public_html/setup.php الآن — لم يستطع حذف نفسه.\n";
}

echo 'افتح الموقع: '.config('app.url')."\n";
