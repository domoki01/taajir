<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

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

// ── Everything the framework knows about itself ──────────────────────────────
/*
 * Booted, deliberately, after the checks above have already answered the
 * questions that survive a broken boot.
 *
 * This section exists because every question asked from a distance costs a
 * round trip, and a round trip here is a person at a File Manager. Each block
 * below is a thing that was actually guessed at, wrongly, at some point: which
 * Firebase project the site really serves, whether geography was ever seeded,
 * whether the scheduler can spawn anything, whether the class a 500 named is on
 * disk. One page, pasted once, instead of six exchanges.
 */
echo "\n──────────────────────────────\nالإطار:\n\n";

try {
    require $base.'/vendor/autoload.php';
    $app = require $base.'/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();

    // Firebase, resolved — not what .env says, what the site actually serves.
    // A masked key pasted from a console reads as a real value everywhere else.
    $key = (string) config('firebase.api_key');
    printf("Firebase project: %s\n", config('firebase.project_id') ?: '(فارغ)');
    printf("Firebase authDomain: %s\n", config('firebase.auth_domain') ?: '(فارغ)');
    printf(
        "Firebase apiKey: %s…%s  (%d حرفاً)%s\n",
        mb_substr($key, 0, 8),
        mb_substr($key, -4),
        mb_strlen($key),
        preg_match('/^AIza[0-9A-Za-z_-]{35}$/', $key) === 1 ? '  ✔' : '  ✖ الشكل غير صحيح',
    );
    printf("APP_URL: %s\n", config('app.url'));
    printf("اللغة: %s | الكاش: %s | الجلسات: %s\n", config('app.locale'), config('cache.default'), config('session.driver'));

    // Row counts. "The communes are missing" is either an empty table or a
    // broken page, and nothing else distinguishes them from outside.
    echo "\nالجداول:\n";
    foreach (['wilayas', 'communes', 'users', 'listings', 'roles', 'settings'] as $table) {
        try {
            printf("  %-12s %s\n", $table, number_format(DB::table($table)->count()));
        } catch (Throwable $e) {
            printf("  %-12s ✖ %s\n", $table, mb_substr($e->getMessage(), 0, 90));
        }
    }

    // Classes a 500 has already named once. Cheaper to check than to read a
    // stack trace for.
    echo "\nالمكتبات:\n";
    foreach ([
        'Intervention\Image\ImageManager' => 'معالجة الصور',
        'Firebase\JWT\JWT' => 'التحقّق من التوكن',
    ] as $class => $what) {
        printf("  %-14s %s\n", $what, class_exists($class) ? '✔' : '✖ ناقصة — vendor قديم');
    }

    echo "\nالكاش:\n";
    foreach (['config' => 'الإعدادات', 'routes-v7' => 'المسارات', 'packages' => 'الحزم'] as $file => $what) {
        printf("  %-10s %s\n", $what, is_file($base."/bootstrap/cache/{$file}.php") ? 'مبني' : '—');
    }
} catch (Throwable $e) {
    echo '✖ الإطار ما قلعش: '.$e->getMessage()."\n";
    echo '   '.$e->getFile().':'.$e->getLine()."\n";
}

// proc_open: the scheduler spawns `php artisan` through it, so without it every
// scheduled job dies at the spawn while the cron reports success.
printf(
    "\nproc_open: %s\n",
    function_exists('proc_open') && ! in_array('proc_open', array_map('trim', explode(',', (string) ini_get('disable_functions'))), true)
        ? '✔ متاح'
        : '✖ مطفي — المهامّ المجدولة لازم تخدم داخل العملية',
);
printf("رفع الملفات: upload_max_filesize=%s  post_max_size=%s\n", ini_get('upload_max_filesize'), ini_get('post_max_size'));

// ── The actual error ─────────────────────────────────────────────────────────
echo "\n──────────────────────────────\nآخر الأخطاء:\n\n";

$log = $base.'/storage/logs/laravel.log';
if (! is_file($log)) {
    echo "لا يوجد سجلّ بعد.\n";
    exit;
}

/*
 * The last entries' first lines, deduplicated.
 *
 * One entry was what this printed before, and it was repeatedly the wrong one:
 * the error a person notices is often several behind the newest, and a page
 * that 500s twice fills the tail with the same line. A Laravel stack trace is
 * hundreds of lines of framework internals, so only the message matters — the
 * first line of each entry.
 */
$lines = file($log, FILE_IGNORE_NEW_LINES) ?: [];
$entries = [];
foreach ($lines as $line) {
    if (preg_match('/^\[\d{4}-\d{2}-\d{2}/', $line) === 1) {
        $entries[] = mb_substr($line, 0, 300);
    }
}

if ($entries === []) {
    echo "السجلّ فارغ.\n";
    exit;
}

$recent = array_slice($entries, -40);
$seen = [];
$shown = 0;
foreach (array_reverse($recent) as $entry) {
    // Same message, different timestamp, is one problem — count it, print once.
    $body = preg_replace('/^\[[^\]]+\]\s*/', '', $entry);
    if (isset($seen[$body])) {
        $seen[$body]++;

        continue;
    }
    $seen[$body] = 1;
}

foreach ($seen as $body => $count) {
    if ($shown++ >= 8) {
        break;
    }
    printf("%s%s\n\n", $body, $count > 1 ? "   ×{$count}" : '');
}
