<?php

declare(strict_types=1);

/*
 * Twenty demands, spread over twenty wilayas.
 *
 * Written the way somebody actually posts one: Algerian derja, short, a budget
 * said in ملايين because that is how it is said out loud, and the thing they
 * care about stated plainly. Not MSA — a demand written like a press release
 * reads as a fake demand, and the feed is the part of the site that lives or
 * dies on sounding like people.
 *
 * `intent` uses the listing vocabulary on purpose: `vente` here means "I want
 * to buy", which is what a `vente` ad offers, so a demand and the ads that
 * answer it speak one language.
 *
 * They are spread across several demo accounts because one account may hold
 * only five open demands — the cap that keeps the feed from being one person's
 * noticeboard — and the command would otherwise stop at the sixth.
 */

return [
    ['intent' => 'vente', 'wilaya' => 'alger', 'commune' => 'kouba',
        'title' => 'نحوس على شقة F3 في القبة', 'description' => "راني نحوس على شقة F3 في القبة ولا اللي قريب منها. الميزانية حوالي 6000 مليون، نقدر نزيد شوية إذا الشقة تستاهل.\n\nنفضّل طابق ماشي عالي بزاف، ويكون فيها مصعد. الأوراق لازم تكون كاملة."],
    ['intent' => 'location', 'wilaya' => 'alger', 'commune' => 'hussein-dey',
        'title' => 'كراء شقة F2 في حسين داي', 'description' => "عائلة صغيرة، نحوسو على F2 للكراء في حسين داي ولا الجوار. الكراء حتى 45 ألف في الشهر.\n\nنحبو تكون قريبة من المدرسة. مستعدين ندفعو ضمان."],
    ['intent' => 'vente', 'wilaya' => 'oran', 'commune' => 'oran',
        'title' => 'نشري فيلا في وهران', 'description' => "نحوس على فيلا في وهران، أرض من 200 م² وفوق. الميزانية 30000 مليون.\n\nيهمني يكون الحي هادئ وفيه بلاصة للسيارة. الدفتر العقاري شرط."],
    ['intent' => 'location', 'wilaya' => 'constantine', 'commune' => 'constantine',
        'title' => 'نحوس على استوديو للكراء في قسنطينة', 'description' => "طالب جامعي، نحوس على استوديو ولا غرفة مستقلة قريب من الجامعة.\n\nحتى 25 ألف في الشهر. مفروش ولا خاوي، ما كاين مشكل."],
    ['intent' => 'vente', 'wilaya' => 'setif', 'commune' => 'setif',
        'title' => 'نشري أرض للبناء في سطيف', 'description' => "نحوس على قطعة أرض من 200 لـ400 م² صالحة للبناء في سطيف ولا اللي حواليها.\n\nالميزانية حوالي 4000 مليون. لازم تكون فيها شهادة التعمير."],
    ['intent' => 'location', 'wilaya' => 'annaba', 'commune' => 'annaba',
        'title' => 'كراء محل تجاري في عنابة', 'description' => "نحوس على محل من 30 لـ50 م² في شارع فيه حركة.\n\nالنشاط تاعي بيع الملابس. الكراء حتى 50 ألف في الشهر، وندفع الضمان اللي يطلبو."],
    ['intent' => 'vente', 'wilaya' => 'blida', 'commune' => 'blida',
        'title' => 'شقة F4 في البليدة', 'description' => "عائلة كبيرة، نحوسو على F4 في البليدة. الميزانية 7000 مليون.\n\nنفضّلو عمارة جديدة وفيها مصعد. الأوراق كاملة."],
    ['intent' => 'location', 'wilaya' => 'bejaia', 'commune' => 'bejaia',
        'title' => 'نحوس على منزل بالليلة في بجاية للصيف', 'description' => "نحوس على منزل ولا شقة للكراء بالليلة في بجاية، شهر أوت.\n\nنكونو 5 أشخاص. نحبو يكون قريب من البحر. العرض يكون واضح على السعر."],
    ['intent' => 'vente', 'wilaya' => 'tizi-ouzou', 'commune' => 'tizi-ouzou',
        'title' => 'نشري منزل في تيزي وزو', 'description' => "نحوس على منزل في تيزي وزو ولا في دائرة قريبة منها.\n\nالميزانية حتى 12000 مليون. يكون صالح للسكن دغيا، ما نحبش بناء ناقص."],
    ['intent' => 'location', 'wilaya' => 'tlemcen', 'commune' => 'tlemcen',
        'title' => 'كراء شقة مفروشة في تلمسان', 'description' => "نخدم في تلمسان ونحوس على شقة مفروشة F2 ولا F3.\n\nالكراء حتى 40 ألف. لمدة سنة على الأقل، نقدر ندفع 3 أشهر مقدّم."],
    ['intent' => 'vente', 'wilaya' => 'batna', 'commune' => 'batna',
        'title' => 'شقة عدل ولا LPP في باتنة', 'description' => "نحوس على شقة في برنامج عدل ولا LPP في باتنة، F3 ولا F4.\n\nالميزانية حوالي 5000 مليون. الأوراق لازم تكون سليمة والتنازل قانوني."],
    ['intent' => 'location', 'wilaya' => 'ouargla', 'commune' => 'ouargla',
        'title' => 'نحوس على منزل للكراء في ورقلة', 'description' => "عائلة، نحوسو على منزل ولا شقة كبيرة في ورقلة.\n\nالكراء حتى 60 ألف في الشهر. نحبو يكون فيه كليماتيزور وبلاصة للسيارة."],
    ['intent' => 'vente', 'wilaya' => 'boumerdes', 'commune' => 'boumerdes',
        'title' => 'نشري شقة قريبة من البحر في بومرداس', 'description' => "نحوس على شقة F3 في بومرداس، يفضّل تكون قريبة من البحر.\n\nالميزانية 9000 مليون. حتى لو تحتاج شوية ترميم ما كاين مشكل."],
    ['intent' => 'location', 'wilaya' => 'mostaganem', 'commune' => 'mostaganem',
        'title' => 'كراء مكتب صغير في مستغانم', 'description' => "نحوس على مكتب من 25 لـ40 م² في وسط مستغانم.\n\nنحتاج العنوان للسجل التجاري. الكراء حتى 35 ألف في الشهر."],
    ['intent' => 'vente', 'wilaya' => 'skikda', 'commune' => 'skikda',
        'title' => 'أرض فلاحية في سكيكدة', 'description' => "نحوس على أرض فلاحية من هكتار لـ3 هكتار في سكيكدة ولا الجوار.\n\nيهمني يكون فيها الماء. الميزانية نتناقشو فيها حسب الأرض والأوراق."],
    ['intent' => 'location', 'wilaya' => 'djelfa', 'commune' => 'djelfa',
        'title' => 'نحوس على مستودع للكراء في الجلفة', 'description' => "نحتاج مستودع من 200 م² وفوق في الجلفة، للتخزين.\n\nلازم تدخلو الشاحنة. الكراء نتفاهمو عليه."],
    ['intent' => 'vente', 'wilaya' => 'bechar', 'commune' => 'bechar',
        'title' => 'نشري منزل في بشار', 'description' => "نحوس على منزل في بشار، ثلاث غرف على الأقل.\n\nالميزانية حتى 8000 مليون. نفضّل حي هادئ وقريب من المدرسة."],
    ['intent' => 'location', 'wilaya' => 'ghardaia', 'commune' => 'ghardaia',
        'title' => 'كراء شقة في غرداية', 'description' => "نخدم في غرداية ونحوس على شقة F2 ولا F3 للكراء.\n\nالكراء حتى 45 ألف. مفروشة يكون أحسن بصح ماشي شرط."],
    ['intent' => 'vente', 'wilaya' => 'tipaza', 'commune' => 'tipaza',
        'title' => 'نحوس على أرض في تيبازة', 'description' => "قطعة أرض للبناء في تيبازة، من 300 م² وفوق.\n\nالميزانية حوالي 6000 مليون. لازم الطريق يوصلها والكهرباء قريبة."],
    ['intent' => 'location', 'wilaya' => 'biskra', 'commune' => 'biskra',
        'title' => 'كراء محل في بسكرة', 'description' => "نحوس على محل صغير في بسكرة، في بلاصة فيها ناس.\n\nالنشاط مأكولات خفيفة. الكراء حتى 40 ألف في الشهر."],
];
