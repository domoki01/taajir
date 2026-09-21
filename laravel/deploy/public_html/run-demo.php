<?php

use Illuminate\Contracts\Console\Kernel;
use Symfony\Component\Console\Output\BufferedOutput;

/*
 * Run `php artisan taajir:demo` from the browser.
 *
 * Same shape as make-admin.php, and for the same reason: this account has no
 * shell. The command is called in this process, since proc_open is disabled
 * here. Guarded by SETUP_TOKEN, and it deletes itself when it has worked.
 *
 *   run-demo.php?token=<SETUP_TOKEN>          create them
 *   run-demo.php?token=<SETUP_TOKEN>&fresh=1  delete the previous run first
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
    exit("لم يتم العثور على مجلّد taajir-app فيه ملف .env.\n");
}

$token = '';
foreach (preg_split('/\r\n|\r|\n/', (string) file_get_contents($base.'/.env')) as $line) {
    $line = ltrim($line, "\xEF\xBB\xBF \t");
    if (str_starts_with($line, 'SETUP_TOKEN')) {
        $value = trim((string) substr($line, strpos($line, '=') + 1));
        $token = trim($value, "\"' \t\r\n");
        break;
    }
}

if ($token === '' || strlen($token) < 24) {
    http_response_code(403);
    exit("SETUP_TOKEN فارغ أو قصير في ملف .env.\n");
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

echo "تأجير — إعلانات وطلبات للتجريب\n==============================\n\n";

require $base.'/vendor/autoload.php';

$app = require_once $base.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

$output = new BufferedOutput;

// Generating thirty WebP derivatives is not a one-second job on a shared host.
@set_time_limit(300);

try {
    $status = $kernel->call(
        'taajir:demo',
        isset($_GET['fresh']) ? ['--fresh' => true] : [],
        $output,
    );
} catch (Throwable $e) {
    http_response_code(500);
    echo $output->fetch();
    echo "\n✖ ".$e->getMessage()."\n";

    if (str_contains($e->getMessage(), 'does not exist')) {
        echo "\nهذا معناه أنّ التحديث ما تركّبش بعد. ركّب آخر حزمة وأعد المحاولة.\n";
    }

    exit(1);
}

echo $output->fetch();

if ($status !== 0) {
    echo "\n✖ ما تمّش. هذا الملف ما تمسحش — صحّح وأعد المحاولة.\n";
    exit(1);
}

echo "\n──────────────────────────────────\n";
echo @unlink(__FILE__)
    ? "✔ حذفت هذا الملف.\n"
    : "⚠ احذف run-demo.php يدوياً.\n";

echo "\nروح للصفحة الرئيسية ولـ/demandes.\n";
