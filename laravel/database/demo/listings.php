<?php

declare(strict_types=1);

/*
 * Ten listings for trying the site out.
 *
 * Invented, not collected. Real ads on the Algerian classifieds carry sellers'
 * phone numbers, and republishing those on another site is not a thing to do
 * to people who never asked. Made-up ads are also better test data: identical
 * on every run, deletable and re-creatable, and they cover the cases on
 * purpose rather than by luck — a villa and a studio, a sale and a monthly
 * rent, a nightly let, a price on request.
 *
 * Prices are whole dinars, as everywhere in this codebase. Algerians quote in
 * ملايين — 1 مليون = 10 000 DZD — so "8 000 مليون" for an Alger flat is the
 * 80 000 000 below, not eight million. Getting this wrong is a 10 000× error,
 * which is why they are written out in full rather than computed.
 *
 * Wilaya and commune slugs are real and must stay real: the command checks
 * them against the geography table, so a typo here fails loudly instead of
 * producing an ad in a place that does not exist.
 */

return [
    [
        'transaction_type' => 'vente',
        'property_type' => 'appartement',
        'title' => 'شقة F3 في الأبيار، إطلالة على البحر',
        'description' => "شقة F3 في الطابق الرابع بعمارة حديثة. مساحة 105 م²، صالون واسع وغرفتين، مطبخ مجهّز، حمّامين. الشقة مشمسة والإطلالة على البحر من الصالون.\n\nالعمارة فيها مصعد وحارس، وكراج تحت الأرض. الأوراق كاملة وجاهزة للتوثيق. قريبة من المدرسة والمحلات.",
        'price' => 80000000,
        'price_unit' => 'total',
        'area_built' => 105,
        'bathrooms' => 2,
        'floor' => 4,
        'wilaya_slug' => 'alger',
        'commune_slug' => 'el-biar',
        'quartier' => 'حيدرة',
        'is_negotiable' => true,
        'tone' => [205, 45, 42],
    ],
    [
        'transaction_type' => 'location',
        'property_type' => 'studio',
        'title' => 'استوديو مفروش في باب الزوار للكراء',
        'description' => "استوديو مفروش بالكامل، قريب من الجامعة ومن المترو. مساحة 38 م²، فيه سرير وخزانة ومكتب، مطبخ صغير مجهّز وحمّام.\n\nالكراء شهري، الماء والكهرباء ماشي داخلين في السعر. مناسب لطالب ولا لواحد يخدم وحدو. الضمان شهرين.",
        'price' => 350000,
        'price_unit' => 'mois',
        'area_built' => 38,
        'bathrooms' => 1,
        'floor' => 2,
        'wilaya_slug' => 'alger',
        'commune_slug' => 'bab-ezzouar',
        'tone' => [28, 60, 48],
    ],
    [
        'transaction_type' => 'vente',
        'property_type' => 'villa',
        'title' => 'فيلا R+1 بحديقة في بئر الجير',
        'description' => "فيلا R+1 على أرض 320 م²، المبني 240 م². الطابق الأرضي: صالون كبير، مطبخ، غرفة وحمّام. الطابق الأول: ثلاث غرف نوم وحمّامين وتيراس.\n\nحديقة أمامية وكراج لسيارتين. البناء تكمّل في 2019 والحالة ممتازة. عقد موثّق ودفتر عقاري.",
        'price' => 420000000,
        'price_unit' => 'total',
        'area_built' => 240,
        'area_land' => 320,
        'bathrooms' => 3,
        'wilaya_slug' => 'oran',
        'commune_slug' => 'bir-el-djir',
        'quartier' => 'حي السلام',
        'is_negotiable' => true,
        'tone' => [150, 40, 44],
    ],
    [
        'transaction_type' => 'vente',
        'property_type' => 'terrain',
        'title' => 'أرض 600 م² صالحة للبناء',
        'description' => "قطعة أرض 600 م² في موقع هادئ، الطريق معبّد والماء والكهرباء على الحدود. صالحة للبناء، شهادة التعمير موجودة.\n\nالأرض مستوية وما تحتاجش ردم. مناسبة لبناء فيلا ولا عمارة صغيرة حسب المخطّط.",
        'price' => 90000000,
        'price_unit' => 'total',
        'area_land' => 600,
        'wilaya_slug' => 'tizi-ouzou',
        'commune_slug' => 'tizi-ouzou',
        'tone' => [95, 38, 46],
    ],
    [
        'transaction_type' => 'location',
        'property_type' => 'local',
        'title' => 'محل تجاري 45 م² في وسط قسنطينة',
        'description' => "محل تجاري 45 م² في شارع تجاري نشيط. واجهة زجاجية 5 أمتار، مرحاض وبلاصة تخزين في الخلف.\n\nمناسب لأي نشاط تجاري. السجل التجاري يتبدّل بلا مشكل. الكراء شهري والضمان ثلاثة أشهر.",
        'price' => 600000,
        'price_unit' => 'mois',
        'area_built' => 45,
        'wilaya_slug' => 'constantine',
        'commune_slug' => 'constantine',
        'quartier' => 'وسط المدينة',
        'tone' => [12, 55, 46],
    ],
    [
        'transaction_type' => 'vente',
        'property_type' => 'appartement',
        'title' => 'شقة F4 عدل في سطيف',
        'description' => "شقة F4 في برنامج عدل، الطابق الثاني. مساحة 85 م²، ثلاث غرف وصالون، مطبخ وحمّام ومرحاض منفصل.\n\nالحي فيه مدرسة ومسجد ومحلات. الشقة ما سكنهاش حتى واحد. الأوراق تاع عدل كاملة.",
        'price' => 55000000,
        'price_unit' => 'total',
        'area_built' => 85,
        'bathrooms' => 1,
        'floor' => 2,
        'wilaya_slug' => 'setif',
        'commune_slug' => 'setif',
        'tone' => [222, 50, 45],
    ],
    [
        'transaction_type' => 'vacances',
        'property_type' => 'maison',
        'title' => 'منزل للكراء بالليلة في بجاية، على البحر',
        'description' => "منزل قريب من الشاطئ، يسع 6 أشخاص. غرفتين نوم، صالون بأريكة تتحوّل سرير، مطبخ مجهّز وحمّام.\n\nتيراس يشوف على البحر، وبلاصة للسيارة. الكراء بالليلة، والأسعار تتبدّل في الصيف. التنظيف داخل في السعر.",
        'price' => 8000,
        'price_unit' => 'nuit',
        'area_built' => 90,
        'bathrooms' => 1,
        'wilaya_slug' => 'bejaia',
        'commune_slug' => 'bejaia',
        'tone' => [188, 55, 46],
    ],
    [
        'transaction_type' => 'vente',
        'property_type' => 'duplex',
        'title' => 'دوبلكس 140 م² في عنابة',
        'description' => "دوبلكس في الطابق الأخير، 140 م² على مستويين. تحت: صالون ومطبخ وغرفة وحمّام. فوق: غرفتين وحمّام وتيراس كبير.\n\nالعمارة جديدة وفيها مصعد. الحي هادئ وقريب من كل شي. الأوراق جاهزة.",
        'price' => 180000000,
        'price_unit' => 'total',
        'area_built' => 140,
        'bathrooms' => 2,
        'floor' => 5,
        'wilaya_slug' => 'annaba',
        'commune_slug' => 'annaba',
        'is_negotiable' => true,
        'tone' => [265, 35, 46],
    ],
    [
        'transaction_type' => 'location',
        'property_type' => 'bureau',
        'title' => 'مكتب 60 م² في بن عكنون',
        'description' => "مكتب 60 م² في الطابق الثالث، مقسّم على ثلاث بلايص وقاعة استقبال. كليماتيزور ومرحاض خاص.\n\nالعمارة فيها مصعد وحارس. مناسب لمكتب دراسات ولا شركة صغيرة. يمكن استعمال العنوان للسجل التجاري.",
        'price' => 900000,
        'price_unit' => 'mois',
        'area_built' => 60,
        'floor' => 3,
        'wilaya_slug' => 'alger',
        'commune_slug' => 'ben-aknoun',
        'tone' => [340, 35, 46],
    ],
    [
        'transaction_type' => 'vente',
        'property_type' => 'hangar',
        'title' => 'مستودع 800 م² في المنطقة الصناعية بالبليدة',
        'description' => "مستودع 800 م² في المنطقة الصناعية، الارتفاع 7 أمتار. باب كبير تدخل منو الشاحنة، وساحة أمامية للتفريغ.\n\nكهرباء صناعية وماء. مكتب صغير ومرحاض داخل. الأوراق كاملة.",
        'price' => 0,
        'price_on_request' => true,
        'price_unit' => 'total',
        'area_built' => 800,
        'wilaya_slug' => 'blida',
        'commune_slug' => 'blida',
        'tone' => [40, 30, 44],
    ],
];
