# BQ

تطبيق تعارف ودردشة بالعربي (RTL). بعد إنشاء الحساب يتم استكمال الملف الشخصي (النوع والتفضيل) قبل الدخول.

الدخول بالبريد وكلمة المرور. أول حساب يحصل على علامة التوثيق ولوحة الإدارة.

على أندرويد: من Chrome افتح القائمة ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».

## الأمان

انظر [docs/SECURITY_SECRETS.md](docs/SECURITY_SECRETS.md) للمفاتيح البيئية المطلوبة (VAPID، GROK_AUTH، TURN).

## Production build

Run `npm ci --include=dev` then `npm run build` (Vercel preset).
The production-ready source changes are already committed. The historical
`scripts/patches/` files and `apply-prod-ready-patch.mjs` are not part of the
production build, so deploying does not depend on a system `patch` executable
or attempt to reapply changes to the current source tree.
