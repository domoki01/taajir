# تأجير — عقارات الجزائر

منصة إعلانات مبوبة لكراء وبيع العقارات في الجزائر: شقق، فيلات، أراضي ومحلات
تجارية. الأفراد ينشرون إعلاناتهم مجاناً، والوكالات العقارية تشترك في باقات تمنحها
حصة أكبر وتمييزاً لإعلاناتها وشارة توثيق.

## التقنيات

- **Next.js 16** (App Router) — العرض من الخادم ضروري هنا: الزبون يصل للإعلان عبر
  بحث Google، فلا بد أن يكون محتوى الصفحة في الـ HTML الأولي.
- **React 19** و **TypeScript** و **Tailwind CSS v4**
- **Firebase** — Firestore للبيانات، Auth للحسابات، Storage لصور الإعلانات
- الخط **Cairo** عبر `next/font`، وواجهة عربية RTL بالكامل

## التشغيل محلياً

```bash
npm install
cp .env.example .env.local   # ثم عمّر القيم
npm run dev
```

الموقع يصبح على http://localhost:3000

## المتغيّرات

كل المفاتيح موصوفة في `.env.example`. ملاحظة مهمة: مفاتيح Firebase التي تبدأ بـ
`NEXT_PUBLIC_` **ليست أسراراً** — هي معرّفات عامة تُشحن مع الصفحة بالتصميم، والحماية
الحقيقية هي `firestore.rules` و `storage.rules` المحفوظان في هذا المستودع. أما
`FIREBASE_SERVICE_ACCOUNT_JSON` و `CRON_SECRET` فأسرار خادم لا تُنشر أبداً.

## الفحوصات

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (لم يعد next build يشغّله في الإصدار 16)
npm run format:check # prettier
npm run build
```

## النشر

المشروع منشور على **Firebase App Hosting**، وإعداده كلّه في `apphosting.yaml`.
كل دفعة إلى الفرع الحيّ تُطلق نشراً جديداً تلقائياً.

للربط أول مرة: Firebase Console ← App Hosting ← Get started، ثم اختيار المنطقة
`europe-west1`، وربط مستودع GitHub، وضبط الفرع الحيّ على `main` ومجلد الجذر على `/`.

**قيد مهم على الإصدار**: App Hosting يعتبر Next.js 15.0–15.2 «نشطاً» فقط، وهذا
المشروع على 16.3 أي في حالة «معاينة». هذا اختيار مقصود لا سهو: سلسلة 15.2 فيها 26
ثغرة عالية الخطورة مفتوحة (SSRF، تسميم الكاش، XSS، حجب الخدمة) مُرقَّعة كلها في 16.3.
ولهذا السبب تحديداً أوامر البناء والتشغيل مكتوبة صراحة في `apphosting.yaml` بدل
الاعتماد على الاكتشاف التلقائي للإطار.

## تجربة على استضافة cPanel

الموقع يحتاج Node.js على الخادم — كل الصفحات تقريباً تُبنى عند الطلب، والنشر
والإشراف يمرّان عبر Server Actions، فلا يصلح معه تصدير ساكن. على حساب cPanel
يقدّم **Setup Node.js App** بـ Node 20.9 فأعلى:

```bash
NEXT_PUBLIC_SITE_URL=https://test.taajirdz.com NEXT_IMAGE_UNOPTIMIZED=true \
  npm run build:cpanel -- --slim
```

يبني المشروع على جهازك ويُخرج `dist/taajir-cpanel.tgz` جاهزاً للرفع. الخطوات
كاملة — ملف البيئة، فحص `preflight.js`، إعداد Passenger، وحدود هذه الاستضافة —
في [`docs/cpanel.md`](./docs/cpanel.md). هذا مسار تجربة لا يغيّر شيئاً في نشر
App Hosting: إعداده كلّه خلف متغيّرات بيئة مطفأة افتراضياً.

## الاصطلاحات

مكتوبة في [`CLAUDE.md`](./CLAUDE.md): قواعد الاتجاه RTL، تخزين الأسعار بالدينار،
مسألة الولايات الـ69 مقابل الـ58، ولماذا لا يكتب العميل في مجموعة `listings` أبداً.
