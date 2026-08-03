# تاجر — عقارات الجزائر

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

المشروع منشور على Vercel. لا يحتاج `vercel.json` ولا سكربت بناء خاص — Vercel
يتعرّف على Next.js تلقائياً. المتغيّرات تُضبط من
Settings → Environment Variables.

## الاصطلاحات

مكتوبة في [`CLAUDE.md`](./CLAUDE.md): قواعد الاتجاه RTL، تخزين الأسعار بالدينار،
مسألة الولايات الـ69 مقابل الـ58، ولماذا لا يكتب العميل في مجموعة `listings` أبداً.
