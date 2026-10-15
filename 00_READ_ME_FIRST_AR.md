# أرشيف منصة EIM V113 R5 الكامل

هذه هي النسخة المطوّرة الأخيرة المحفوظة بتاريخ 2 أغسطس 2026، بعد المرحلة 0940 الخاصة بالقبول التشغيلي وUAT وتقارير جاهزية RC1.

## محتويات الأرشيف

| المجلد/الملف | المحتوى |
|---|---|
| `app/` | واجهة Frontend ومسارات Same-Origin API |
| `public/eim/` | الواجهة الأصلية المعاد تنظيمها، CSS وJavaScript وبيانات العرض |
| `backend/src/` | مصدر Backend لخدمة Node/PostgreSQL |
| `backend/tests/` | اختبارات Backend |
| `backend/dist/` | آخر ناتج بناء Backend |
| `database/postgresql/` | مخطط PostgreSQL والترحيلات والـrollback والبذور والاختبارات |
| `drizzle/` و`db/` | مخططات Drizzle وسجل الترحيلات |
| `openapi/` | عقود Same-Origin وBackend API |
| `docs/` | النموذج المفاهيمي، متطلبات MVP، التتبّع، ووثائق Backend Handoff |
| `tests/` | اختبارات سلامة البناء والمعمارية ورحلات الأدوار |
| `scripts/` | البناء والتحقق وتوليد OpenAPI والتحقق من الحزمة |
| `dist/` | آخر بناء إنتاجي للواجهة |
| `.openai/` | إعداد الاستضافة |
| `release/` | تعليمات الإصدار وفك الضغط على Windows |
| `deployment/` | Docker Compose وبيئة النشر ودليل التشغيل |
| `Dockerfile.backend` و`Dockerfile.frontend` | بناء حاويات الإنتاج |
| `.github/workflows/` | بوابات CI للبناء والاختبارات والأمن وSBOM |
| `package.json` و`package-lock.json` | الاعتماديات وأوامر التشغيل المثبتة |
| `ARCHITECTURE.md` | ملخص المعمارية |
| `DESIGN_AUDIT.md` | تدقيق التصميم |
| `FILE_INVENTORY.txt` | قائمة كاملة بكل الملفات الموجودة في الأرشيف |
| `MANIFEST_SHA256.txt` | بصمات سلامة جميع الملفات |

## حالة النسخة

- قاعدة البيانات: 93 ترحيلًا، 538 جدولًا.
- Backend API: 82 مسارًا، 90 عملية، وانحراف OpenAPI يساوي صفرًا.
- عقود الطلب: 48 عملية JSON مرتبطة بـ41 مخطط Command دقيقًا.
- عقود الاستجابة: 90 استجابة خاصة بالعمليات، مع حالات الأخطاء والأمثلة وPagination.
- جاهزية النشر: حاويات Frontend وBackend وPostgreSQL، ترحيلات مستقلة، Preflight وSmoke Tests.
- جاهزية الإصدار: CI، SBOM، خط أمني، Nginx، Backup/Restore، وقائمة Go/No-Go.
- جاهزية القبول: 40 حالة UAT، مصفوفة تشغيل، Runbook للتراجع، وتقرير RC1 آلي.
- Same-Origin API: 22 مسارًا، 52 عملية.
- اختبارات Backend: 52/52 ناجحة.
- الاختبارات العامة: 112/112 ناجحة.
- TypeScript وESLint والبناء الإنتاجي: ناجحة.

## البدء

يتطلب المشروع Node.js 22.13 أو أحدث وPostgreSQL 16.

```bash
npm run install:ci
cp .env.example .env
npm run validate:openapi
npm run backend:test
npm run build
```

اضبط قيم البيئة الفعلية وOIDC وقاعدة البيانات ومخزن الملفات وفق وثائق `docs/backend-handoff/`، ولا تستخدم القيم التوضيحية في الإنتاج.

## الملفات المستبعدة عمدًا

لم تُضمّن `node_modules` أو مخابئ أدوات البناء المحلية؛ لأنها قابلة لإعادة الإنشاء من `package-lock.json`، وكان تضمينها سيزيد الأرشيف بنحو 1 غيغابايت دون إضافة أي تصميم أو مصدر أصلي.
