# تحديث الموقع الحيّ

الموقع راه خدّام بنسخة قديمة — المرحلتين 1 و2 برك. هذا الملف هو كيفاش تطلّعو
للنسخة الحالية (المراحل 1 حتى 8): الحسابات، الدخول، النشر، البحث، التعليقات،
الطلبات، لوحة الإدارة، وبوابة الإطلاق.

**التحديث ماشي التنصيب.** `setup.php` يتدار مرّة وحدة ويمسح روحو. هذا الملف
على `update.php`، اللي يتدار كل مرّة ويبقى.

---

## قبل ما تبدا — جوج حوايج توقّف كلش

### 1. `intl` لازم تكون مفعّلة في PHP

من **DirectAdmin → Select PHP Version → Extensions** علّم على `intl`.

بلاها: `composer install` يطيح، وحتى لو عدّى، الطيّ العربي (اللي يخلّي «الجزاير»
تلقى «الجزائر») يطيح في وقت التشغيل — يعني البحث، الروابط، ونصف صفحة الإعلان.
`composer.json` ولّى يطلبها صراحة باش تطيح في التنصيب ماشي في الوجه تاع مستعمل.

### 2. الشهادة

هذي ما تبدّلاتش وما زالت أهم حاجة. الموقع القديم كان يبعث
`Strict-Transport-Security` مدّتها سنتين — يعني أي واحد زارو من قبل، متصفّحو
رافض يفتحو بلا شهادة صالحة، **وما كاينش زرّ «كمّل على كل حال»**. حلّها من
DirectAdmin → SSL Certificates → Let's Encrypt قبل أي حاجة أخرى.

---

## 1. جهّز عندك في الدار

```bash
cd laravel
npm run build          # يولّد public/build — ماشي في git وما يتبنى على الهوست
```

`public/build` مستثنى في `.gitignore`، والهوست ما عندوش Node. يعني الأصول
تتبنى عندك وترفعهم. إذا نسيتهم: الموقع يخدم بصح بلا تنسيق حتى، واللي يبان بحال
عطب غريب بزّاف وهو ماشي كذلك — `update.php` يقوللك.

## 2. ارفع الكود

**إذا عندك git deploy** (الـhook تاع `deploy/post-receive`):

```bash
git push origin main
rsync -avz laravel/public/build/ USER@HOST:~/domains/taajirdz.com/public_html/build/
```

**إذا ترفع باليد** (File Manager ولا FTP):

- محتوى `laravel/` كامل → `~/taajir-app/` — **ما تمسّش** `.env` ولا `storage/`
- محتوى `laravel/public/` → `~/domains/taajirdz.com/public_html/` — **ما تمسّش**
  `index.php` (هذاك واحد آخر، تاع التخطيط المقسوم)
- `laravel/deploy/public_html/update.php` → نفس الـdocument root

## 3. زيد المتغيّرات الجديدة في `.env`

الملف فوق الـdocument root، في `~/taajir-app/.env`. زيد هاذو:

```ini
# Firebase — الدخول. كامل ماشي أسرار، المتصفّح ياخذهم عادي.
# انسخهم من .env.local تاع مشروع Next، بلا بادئة NEXT_PUBLIC_
FIREBASE_PROJECT_ID=
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_APP_ID=
FIREBASE_MESSAGING_SENDER_ID=

# الرمز اللي يحمي update.php. 24 حرف على الأقل، وإلا يرفض يخدم.
#   openssl rand -hex 24
SETUP_TOKEN=

# اختيارية: بوابة الإطلاق عبر HTTP. خلّيها فارغة والمفتاح يبقى في اللوحة.
CRON_SECRET=

# ما كاينش قناة موصولة. خلّيهم كيما هما.
EMAIL_PROVIDER_KEY=
SMS_PROVIDER_KEY=
FCM_READY=false
```

**`FIREBASE_PROJECT_ID` فارغ = كل دخول يفشل.** وهذا مقصود: هو الجمهور اللي
يتأكّد بيه كل token، وفارغ يعني «ارفض كلش» ماشي «اقبل كلش».

## 4. دير التحديث

**بلا SSH** — حلّ في المتصفّح:

```
https://taajirdz.com/update.php?token=<SETUP_TOKEN>
```

يطبّعلك كل خطوة بالكلام: intl، قاعدة البيانات، الجداول الجديدة، الـcaches،
ورابط الصور. إذا طاح، الموقع يبقى يخدم بالقديم ويقوللك وين المشكل.

**بـSSH**:

```bash
sh ~/taajir-app/deploy/update.sh
```

الزوج يديرو نفس الحاجة: `composer install` → مسح الـcaches → `migrate` →
`db:seed` → رابط الصور → إعادة بناء الـcaches.

> **علاش تمسح الـcaches قبل الـmigrate؟** `config.php` المخزّن يتقرا في كل إقلاع،
> يعني تحديث زاد مفتاح جديد في الإعدادات كان يقلع بالملف القديم ويطيح في بلاصة
> ما عندها علاقة. هذا الترتيب الوحيد اللي يخدم.

### واش يزيد في قاعدة البيانات

10 جداول جديدة: `users`، `listings` (+ الصور والمرافق)، `admin_audit`،
`comments`، `requests`، `request_replies`، `saved_searches`، `promos`،
`articles` (+ التعليقات)، `launch_outbox`، `points_ledger`.

كلهم **يزيدو برك** — ما كاينش حتى migration يمسح ولا يبدّل عمود موجود. وهذا هو
اللي يخلّي `--force` بلا ما تشوف آمن هنا.

## 5. سطر الـcron — مرّة وحدة

**DirectAdmin → Advanced Features → Cron Jobs**، كل دقيقة:

```
* * * * * cd /home/USER/taajir-app && php artisan schedule:run >/dev/null 2>&1
```

هذا السطر وحدو يشغّل:

| | |
|---|---|
| `taajir:launch --if-due` | كل ساعة — يفتح الموقع غير إذا كان مغلوق وعدّادو كمّل |
| `taajir:expire-listings` | كل ليلة 03:20 — إعلانات فاتت 60 يوم، ويحرّر حصّة صاحبها |
| `queue:work --stop-when-empty` | كل 5 دقائق — يفرّغ الطابور ويخرج |

غيابو صامت: الموقع يخدم عادي، وهاذو الثلاثة ما يجريو أبداً.

## 6. أوّل حساب مشرف

بعد التحديث، الأدوار موجودة بصح كل الحسابات على `user`. سجّل الدخول مرّة باش
يتصنع حسابك، وبعدها من phpMyAdmin:

```sql
UPDATE users SET role_id = 'admin' WHERE email = 'ton@email.dz';
```

مرّة وحدة برك — من بعد تدير كلش من `/admin/utilisateurs`.

---

## تأكّد

- [ ] `/` تحلّ وفيها التنسيق (إذا بلا تنسيق: `public_html/build/` ناقص)
- [ ] `/connexion` تحلّ، والدخول بـGoogle يوصلك للوحة
- [ ] `/admin` تحلّ بعد ما تدير روحك admin، و13 شاشة يبانو
- [ ] `/publier` تقبل إعلان بصورة — **جرّب الصورة بالذات**، هي الطريق اللي
      يحتاج `intl` والـsymlink مع بعض
- [ ] `/sitemap.xml` يرجع 200
- [ ] `/vente/appartement/alger` تحلّ

## إذا حبست

- **«Server Error» في كل صفحة** → `.env` ناقص ولا `storage/` ماشي قابل للكتابة
  (775). حلّ `health.php` يقوللك.
- **الموقع بلا تنسيق** → `public_html/build/` ناقص. `npm run build` وارفعو.
- **الصور المرفوعة ما تبانش** → رابط `public_html/storage` ناقص. `update.php`
  يحاول يديرو ويقولك إذا فشل.
- **«الرمز غير مطابق»** → `SETUP_TOKEN` فيه مسافة ولا سطر زايد. الملف يتحمّل
  CRLF، بصح ما يتحمّلش مسافة في الوسط.
- **الدخول يفشل دائماً** → `FIREBASE_PROJECT_ID` فارغ، ولا النطاق ماشي في
  Firebase → Authentication → Settings → Authorized domains.

---

## واحدة ما زالت ناقصة

**ترويسات الأمان** (CSP، `X-Frame-Options`، `Referrer-Policy`,
`Permissions-Policy`) — §12 تطلبهم وما تدارو بعد. ماشي حاجز للنشر، بصح ولّاو
يهمّو أكثر من قبل: الموقع ولّى فيه دخول ولوحة إدارة. الـCSP يحتاج يسمح لمضيفات
Google (reCAPTCHA ونافذة الدخول) وإلا الدخول روحو يطيح — يعني ماشي سطر يتزاد
بالعجلة في ليلة نشر. قوللي وندير middleware واحد مع اختبارات.
