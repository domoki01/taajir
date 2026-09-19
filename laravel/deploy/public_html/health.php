<?php

/*
 * Diagnostic. Answers "why is it a 500?" without turning APP_DEBUG on.
 *
 * APP_DEBUG=true on a live site is the wrong way to find this out: it puts the
 * database password, the environment and a full stack trace on a public URL for
 * as long as it takes to notice it is still on. This reads the same information
 * and prints only what is needed to act.
 *
 * Guarded by SETUP_TOKEN, like setup.php: it reports which extensions are
 * missing and the last error from the log, which is a map of the installation.
 * Delete it once the site is up.
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
    if (is_dir($candidate)) {
        $base = $candidate;
        break;
    }
}

header('Content-Type: text/plain; charset=utf-8');

echo "تأجير — فحص التنصيب\n====================\n\n";

// ── Things that need no framework, so they still answer when it will not boot ─
printf("PHP: %s%s\n", PHP_VERSION, version_compare(PHP_VERSION, '8.3', '>=') ? '  ✔' : '  ✖ لازم 8.3 أو أحدث');

$required = ['mbstring', 'intl', 'pdo_mysql', 'gd', 'zip', 'fileinfo', 'openssl'];
$missing = array_values(array_filter($required, fn ($e) => ! extension_loaded($e)));
echo 'الإضافات: '.($missing === [] ? '✔ كلّها موجودة' : '✖ ناقص: '.implode(', ', $missing))."\n";

if ($base === null) {
    exit("\n✖ مجلّد taajir-app غير موجود.\n");
}

echo "\nمجلّد التطبيق: {$base}\n";
echo 'vendor: '.(is_file($base.'/vendor/autoload.php') ? "✔\n" : "✖ ناقص — الرفع تقطّع\n");
echo '.env: '.(is_file($base.'/.env') ? "✔\n" : "✖ ناقص\n");

foreach (['storage', 'storage/framework/views', 'storage/logs', 'bootstrap/cache'] as $path) {
    printf("%-26s %s\n", $path, is_writable($base.'/'.$path) ? '✔ قابل للكتابة' : '✖ غير قابل للكتابة — اضبطه على 775');
}

if (! is_file($base.'/.env') || ! is_file($base.'/vendor/autoload.php')) {
    exit("\nصحّح ما سبق ثم أعد المحاولة.\n");
}

/*
 * Read .env directly rather than booting: the point is to work when booting is
 * what fails.
 *
 * Carefully, because this file is edited in a text editor on someone's desktop
 * and uploaded. A Windows editor writes CRLF, and FILE_IGNORE_NEW_LINES strips
 * only the \n — leaving a \r glued to every value, which is invisible in a
 * panel and makes a token comparison fail for no visible reason. A BOM does the
 * same to the first key. Laravel's own parser handles both; this one has to as
 * well or it reports problems that are its own.
 */
$env = [];
$contents = file_get_contents($base.'/.env');
$contents = preg_replace('/^\xEF\xBB\xBF/', '', $contents);

foreach (preg_split("/\r\n|\n|\r/", $contents) as $line) {
    $line = trim($line);
    if ($line === '' || $line[0] === '#' || ! str_contains($line, '=')) {
        continue;
    }
    [$key, $value] = explode('=', $line, 2);
    $key = trim(preg_replace('/^export\s+/', '', trim($key)));
    $env[$key] = trim(trim($value), "\"'");
}

$token = $env['SETUP_TOKEN'] ?? '';
$given = (string) ($_GET['token'] ?? '');

if ($token === '') {
    http_response_code(403);
    exit("\n✖ SETUP_TOKEN فارغ في ملف .env.\n   افتح taajir-app/.env وضع له قيمة، ثم أعد المحاولة بنفس القيمة.\n");
}

if (! hash_equals($token, $given)) {
    http_response_code(403);
    // Lengths, never the values — enough to spot a typo or a stray character
    // without printing the thing the guard exists to protect.
    printf(
        "\n✖ التوكن غير مطابق.\n   في .env: %d حرفاً\n   في الرابط: %d حرفاً\n\n   إن تساوى الطول فالفرق مسافة أو حرف مخفي.\n",
        mb_strlen($token),
        mb_strlen($given),
    );
    exit;
}

echo "\n";
echo 'APP_KEY: '.(($env['APP_KEY'] ?? '') !== ''
    ? "✔ مضبوط\n"
    : "✖ فارغ — هذا يعطي 500 في كل صفحة. شغّل setup.php\n");
echo 'APP_URL: '.($env['APP_URL'] ?? '(فارغ)')."\n";
echo 'DB: '.($env['DB_DATABASE'] ?? '(فارغ)').' / '.($env['DB_USERNAME'] ?? '(فارغ)')."\n";

if (($env['DB_CONNECTION'] ?? 'mysql') === 'mysql') {
    try {
        new PDO(
            sprintf('mysql:host=%s;port=%s;dbname=%s', $env['DB_HOST'] ?? '127.0.0.1', $env['DB_PORT'] ?? '3306', $env['DB_DATABASE'] ?? ''),
            $env['DB_USERNAME'] ?? '',
            $env['DB_PASSWORD'] ?? '',
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
        );
        echo "الاتصال بقاعدة البيانات: ✔\n";
    } catch (Throwable $e) {
        echo 'الاتصال بقاعدة البيانات: ✖ '.$e->getMessage()."\n";
    }
}

echo "\nذاكرة الإعدادات: ";
$configCache = $base.'/bootstrap/cache/config.php';
echo is_file($configCache)
    ? "موجودة. إن عدّلت .env بعدها، احذف bootstrap/cache/config.php\n"
    : "غير موجودة\n";

// ── The actual error ─────────────────────────────────────────────────────────
echo "\n──────────────────────────────\nآخر خطأ في السجلّ:\n\n";

$log = $base.'/storage/logs/laravel.log';
if (! is_file($log)) {
    echo "لا يوجد سجلّ بعد.\n";
    exit;
}

// The last entry only, and only its first lines: a Laravel stack trace is
// hundreds of lines of framework internals and the message is the first one.
$lines = file($log, FILE_IGNORE_NEW_LINES);
$start = 0;
foreach ($lines as $i => $line) {
    if (preg_match('/^\[\d{4}-\d{2}-\d{2}/', $line) === 1) {
        $start = $i;
    }
}

foreach (array_slice($lines, $start, 6) as $line) {
    echo mb_substr($line, 0, 400)."\n";
}
