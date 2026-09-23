<?php

declare(strict_types=1);

/*
    Latin runs inside Arabic prose are wrapped in U+2066 / U+2069 (an isolate).
    Without them the bidi algorithm reorders the run against the sentence, and
    a path comes out as "vente/{slug}/alger/" — the slashes migrate. The .ltr-nums
    class does this job where there is an element to hang it on; inside a lang
    string there is not, and this is what the characters are for.
*/
return [
    'articles' => 'مقالات',
    'meta_description' => 'مقالات عن سوق العقار في الجزائر: كيفاش تكري، كيفاش تبيع، والأوراق اللي تحتاجها.',
    'index_subtitle' => 'نصائح وشروحات على سوق العقار في الجزائر.',
    'none' => 'ما كاش مقالات للدرك.',
    'none_admin' => 'ما كاش مقالات. ابدا بواحد جديد.',
    'read_minutes' => ':count دقائق قراءة',
    'sign_in_to_comment' => 'سجّل الدخول باش تعلّق',
    'comment_posted' => 'تنشر تعليقك',

    'admin_subtitle' => 'المسوّدات والمنشور، مرتّبين بآخر تعديل.',
    'new' => 'مقال جديد',
    'edit' => 'تعديل',
    'view' => 'شوفه في الموقع',
    'save' => 'حفظ المقال',
    'saved' => 'تحفظ المقال',
    'delete' => 'امسح المقال (والتعليقات تاعه)',
    'deleted' => 'تمسح المقال',

    'title' => 'العنوان',
    'slug' => 'الرابط (لاتيني)',
    'excerpt' => 'الملخّص',
    'excerpt_hint' => 'جملة ولا جوج. يستعملو في نتائج البحث وفي بطاقة المقال.',
    'body' => 'النص',
    'cover' => 'صورة الغلاف',
    'cover_hint' => 'رابط ⁦https⁩ ولا مسار داخل الموقع يبدا بـ ⁦/⁩ .',
    'cover_alt' => 'وصف الصورة',
    'tags' => 'الوسوم',
    'tags_placeholder' => 'كراء، الجزائر العاصمة، نصائح',
    'status_label' => 'الحالة',

    'status' => [
        'draft' => 'مسوّدة',
        'published' => 'منشور',
    ],

    // The whole syntax, in one hint. More than this and an editor writing in a
    // textarea stops remembering any of it.
    'syntax' => "## عنوان فرعي\n- نقطة في قائمة\n> اقتباس\nأي سطر آخر يولّي فقرة. **نص غليظ** بين نجمتين.",

    'too_short' => 'المقال قصير برك — اكتب على الأقل 3 فقرات',
    'bad_slug' => 'الرابط لازم بحروف لاتينية وشرطات (مثال: ⁦marche-immobilier-algerie⁩)',
    'reserved_slug' => 'هذا الرابط محجوز، اختر واحد آخر',
    'slug_taken' => 'كاين مقال بنفس الرابط',
    'not_open' => 'ما يمكنش التعليق على هذا المقال',
];
