<?php

declare(strict_types=1);

return [
    'title' => 'تحديث الموقع',
    'subtitle' => 'ارفع حزمة وطبّقها.',
    'file_label' => 'ملف الحزمة (.zip)',
    'limit' => 'أقصى حجم: :size ميغا',
    'apply' => 'طبّق التحديث',
    'applying' => 'راه يطبّق…',
    'patience' => 'يمكن ياخذ دقيقة. ما تسكّرش الصفحة وما تعاودش الضغط.',
    'applied' => 'تطبّق التحديث. :app ملف في التطبيق، :docroot في الـdocument root.',
    'migrations_ran' => 'الجداول اللي تزادت',

    'what_it_does' => 'واش يدير',
    'step_extract' => 'يفكّ الحزمة ويستبدل ملفات الكود كاملة.',
    'step_keep' => 'ما يمسّش .env ولا storage ولا vendor ولا index.php — كل واحد فيهم يطيّح الموقع لو تبدّل.',
    'step_cache' => 'يمسح الـcaches والقوالب المترجمة — هاذو اللي يخلّيو كود قديم يخدم بعد التحديث.',
    'step_migrate' => 'يدير migrations وseeds ويعاود يبني الـcaches.',

    'exposed' => 'مجلّد التطبيق راه داخل public_html. مسكّر بـ.htaccess، بصح انقلو لفوق كي تقدر — .htaccess كي يحبس يتقرا كلش يرجع مكشوف.',

    'no_zip_extension' => 'إضافة zip غير مفعّلة في PHP.',
    'unreadable' => 'ما قدرناش نفتحو الملف — يمكن الرفع تقطّع. عاود.',
    'no_staging' => 'ما قدرناش نصنعو مجلّد مؤقّت — شوف المساحة والصلاحيات.',
    'extract_failed' => 'فشل فكّ الحزمة — يمكن ما كاش بلاصة في القرص.',
    'not_a_release' => 'هذي ماشي حزمة تأجير — لازم تكون فيها taajir-app/ و public_html/.',
    'command_failed' => 'فشل الأمر :command',
];
