<?php

declare(strict_types=1);

return [
    'overview' => 'نظرة عامة',
    'overview_subtitle' => 'حالة المنصة، وآخر ما دار فيها.',
    'back_to_panel' => 'رجوع للوحة الإشراف',

    'tiles' => [
        'pending' => 'في المراجعة',
        'published' => 'منشورة',
        'users' => 'الحسابات',
        'banned' => 'موقّفة',
    ],

    'groups' => [
        'content' => 'المحتوى',
        'people' => 'الناس',
        'growth' => 'النمو',
        'platform' => 'المنصّة',
    ],

    'nav' => [
        'queue' => 'طابور المراجعة',
        'comments' => 'التعليقات',
        'articles' => 'المقالات',
        'taxonomy' => 'الفئات والفلتر',
        'users' => 'الحسابات',
        'roles' => 'الأدوار',
        'promos' => 'الإشهارات',
        'affiliate' => 'برنامج الدعوة',
        'push' => 'إشعار عام',
        'launch' => 'الإطلاق',
        'branding' => 'الهوية',
        'audit' => 'السجلّ',
    ],

    // One line under each row: a label alone makes you open a screen to find out.
    'hints' => [
        'queue' => 'الإعلانات اللي تستنّى قرار',
        'comments' => 'راجع وخبّي التعليقات',
        'articles' => 'اكتب وانشر مقالات',
        'taxonomy' => 'الفئات والفلاتر متاع البحث',
        'users' => 'الأدوار، الحصص والحظر',
        'roles' => 'شكون يقدر يدير واش',
        'promos' => 'البانرات في الصفحات',
        'affiliate' => 'النقاط، المسابقة والجوائز',
        'push' => 'ابعث إشعار لكل المستعملين',
        'launch' => 'غلق الموقع، العدّاد ومفتاح الفتح',
        'branding' => 'الاسم، اللوقو والألوان',
        'audit' => 'كل قرار إشراف، مع صاحبه ووقته',
    ],

    'recent' => 'آخر العمليات',
    'audit_count' => 'آخر :count عملية',
    'audit_note' => 'كل قرار إشراف يتسجّل هنا مع صاحبه. السجلّ يُكتب من الخادم فقط ولا يُعدَّل ولا يُمسح — هذا اللي يخلّيه يعني شيئاً.',
    'audit_unavailable' => 'ما قدرناش نجيبو السجلّ.',
    'audit_empty' => 'ما دار والو بعد.',

    'audit' => [
        'actions' => [
            'listing' => [
                'approve' => 'وافق على إعلان',
                'approve_for_launch' => 'وافق على إعلان قبل الإطلاق',
                'reject' => 'رفض إعلان',
                'feature' => 'ميّز إعلان',
                'unfeature' => 'ألغى تمييز إعلان',
                'archive' => 'أرشف إعلان',
            ],
        ],
        'targets' => [
            'listing' => 'إعلان',
            'user' => 'حساب',
            'promo' => 'إشهار',
            'role' => 'دور',
            'comment' => 'تعليق',
            'article' => 'مقال',
            'settings' => 'إعدادات',
        ],
    ],

    // ── The moderation queue ────────────────────────────────────────────────
    'moderation' => 'المراجعة',
    'approve' => 'تأكيد',
    'reject' => 'رفض',
    'reject_reason' => 'سبب الرفض',
    'archive' => 'أرشفة',
    'approved' => 'تأكد الإعلان',
    'rejected' => 'ترفض الإعلان',
    'archived' => 'تأرشف الإعلان',
    'queue_empty' => 'ما كاين حتى إعلان يستنّى المراجعة.',
];
