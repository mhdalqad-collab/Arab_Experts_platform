# الدليل العربي للحزمة النهائية الكاملة — EIM V113 R5

## 1. تعريف الحزمة

هذه الحزمة هي آخر نسخة مطوّرة ومجمّعة من تصميم وتنفيذ منصة شبكة الخبراء العرب EIM، بعد استكمال المراحل حتى 0940، وتشمل Frontend وBackend وقاعدة البيانات وعقود API والنشر والأمن والاختبارات والقبول التشغيلي.

الحالة الرسمية للنسخة:

`PREPARED_PENDING_EXTERNAL_VALIDATION`

أي أن التطوير الممكن داخل بيئة العمل قد اكتمل، بينما يبقى اعتمادها للإنتاج مرتبطًا بالتنصيب على السيرفر وربط الخدمات الحقيقية وتنفيذ الاختبارات الخارجية وUAT.

## 2. نقطة البداية للمستلم

يُنصح بقراءة الملفات بهذا الترتيب:

1. `00_FINAL_PACKAGE_GUIDE_AR.md` — هذا الدليل.
2. `00_READ_ME_FIRST_AR.md` — ملخص الأرشيف وحالة النسخة.
3. `docs/backend-handoff/00_BACKEND_HANDOFF_EXECUTIVE_R5_AR.md` — الملخص التنفيذي للتسليم.
4. `docs/backend-handoff/11_PRODUCTION_GO_NO_GO_CHECKLIST_AR.md` — شروط قرار الإنتاج.
5. `deployment/README_AR.md` — خطوات التنصيب بالحاويات.
6. `release/RC1_READINESS_REPORT_AR.md` — حالة الجاهزية الحالية.
7. `release/UAT_TEST_CASES_AR.csv` — حالات قبول المستخدم الأربعون.

## 3. خريطة المحتويات

| المسار | المحتوى والغرض |
|---|---|
| `app/` | تطبيق Frontend ومسارات Same-Origin API المبنية بـReact/Next/Vinext |
| `public/eim/` | أصول واجهة المنصة، CSS وJavaScript وبيانات العرض |
| `backend/src/` | مصدر Backend لخدمة Node.js/PostgreSQL |
| `backend/tests/` | اختبارات Backend المصدرية |
| `backend/dist/` | آخر Backend مترجم محفوظ قبل الأرشفة |
| `database/postgresql/migrations/` | الترحيلات الـ93 بترتيبها |
| `database/postgresql/rollback/` و`rollbacks/` | ملفات التراجع المتاحة |
| `database/postgresql/seeds/` | البيانات المرجعية الأولية |
| `database/postgresql/tests/` | اختبارات PostgreSQL والتكامل |
| `database/postgresql/scripts/` | تشغيل الترحيلات والاختبارات وBackup/Restore |
| `drizzle/` و`db/` | مخططات Drizzle وسجل الترحيلات |
| `openapi/` | عقدا Same-Origin وBackend API |
| `docs/` | مواصفات النموذج المفاهيمي والمجالات والحوكمة والخصوصية |
| `docs/v113/` | متطلبات MVP والتغطية والتتبّع وسلامة البناء |
| `docs/backend-handoff/` | وثائق التسليم والمراحل 0910–0940 والأمن وUAT والتشغيل |
| `deployment/` | Docker Compose وNginx ونموذج البيئة ودليل التنصيب |
| `.github/workflows/` | بوابات CI للبناء والاختبارات والأمن والحاويات |
| `scripts/` | البناء والتحقق وOpenAPI وPreflight وSmoke والأمن والجاهزية |
| `tests/` | اختبارات الواجهة والمعمارية ورحلات الأدوار |
| `dist/` | آخر بناء إنتاجي محفوظ للواجهة |
| `.openai/` | إعداد الاستضافة |
| `release/` | تقارير RC1 وSBOM وحالات UAT وتعليمات فك الضغط |
| `eim-v113-sbom.cdx.json` | قائمة CycloneDX لـ719 مكوّنًا برمجيًا |
| `FILE_INVENTORY.txt` | فهرس كل ملفات الحزمة |
| `MANIFEST_SHA256.txt` | بصمة SHA-256 لكل ملف داخل الحزمة |

## 4. المؤشرات الفنية المثبتة

- PostgreSQL: ‏93 ترحيلًا و538 جدولًا في آخر تحقق كامل.
- Backend: ‏82 مسارًا و90 عملية.
- Same-Origin API: ‏22 مسارًا و52 عملية.
- طلبات JSON: ‏48 عملية مرتبطة بـ41 مخطط Command دقيقًا.
- الاستجابات: ‏90 مخطط استجابة خاصًا بالعمليات.
- OpenAPI: انحراف صفري عن مسارات Backend.
- SBOM: ‏719 مكوّنًا.
- UAT: ‏40 حالة اختبار.
- الاختبارات السابقة قبل استبعاد الاعتماديات: Backend ‏52/52، والعامة ‏112/112.

## 5. أوامر التحقق الأساسية

بعد تثبيت Node.js 22.13 أو أحدث والاعتماديات:

```bash
npm ci
npm run lint
npm test
npm run test:postgresql
npm run validate:openapi
npm run security:baseline
npm run release:readiness
```

## 6. خطوات التنصيب المختصرة

```bash
cp deployment/.env.example deployment/.env
# استبدل جميع القيم التوضيحية واحفظ الأسرار خارج Git
npm run deploy:preflight -- deployment/.env
docker compose --env-file deployment/.env -f deployment/docker-compose.yml up -d postgres
docker compose --env-file deployment/.env -f deployment/docker-compose.yml --profile migrate run --rm migrate
docker compose --env-file deployment/.env -f deployment/docker-compose.yml up -d --build backend frontend
npm run deploy:smoke
```

راجع `deployment/README_AR.md` قبل التنفيذ. لا تُستخدم بيانات أو كلمات مرور حقيقية داخل الملفات التوضيحية.

## 7. ما يجب توفيره على السيرفر

- Docker Engine وDocker Compose v2.
- PostgreSQL 16 أو خدمة PostgreSQL مُدارة.
- مزود OIDC حقيقي وبيانات JWKS والجمهور.
- Object Storage خاص.
- خدمة Malware Scanner.
- مزود إشعارات/بريد.
- DNS وشهادة TLS.
- Secret Manager.
- Monitoring وLogging وتنبيهات.
- مساحة Backup منفصلة عن الخادم.

## 8. البوابات المعلقة قبل الإنتاج

- نجاح CI على Commit الإصدار.
- بناء صور Docker وتسجيل Digests.
- تجربة الترحيلات على PostgreSQL 16.
- تجربة Backup/Restore.
- اختبار OIDC وStep-up والصلاحيات.
- اختبار الملفات والفحص الأمني.
- اختبار الإشعارات والمحاولات وDead Letters.
- Smoke وPerformance وUAT.
- التحقق من DNS وTLS والمراقبة.

يبقى القرار `NO-GO` حتى إغلاق هذه البوابات بأدلة، وفق `docs/backend-handoff/11_PRODUCTION_GO_NO_GO_CHECKLIST_AR.md`.

## 9. الملفات المستبعدة عمدًا

لم تُضمّن المجلدات المؤقتة أو القابلة لإعادة الإنشاء مثل:

- `node_modules/`
- `.sites-runtime/`
- `.vinext/`
- `.wrangler/`
- مخابئ البناء المحلية

يمكن استعادة الاعتماديات المثبتة من `package-lock.json` باستخدام `npm ci`. استبعادها يخفض حجم الحزمة بنحو 1 غيغابايت ولا يحذف أي مصدر أو تصميم أصلي.

## 10. ضوابط الحفظ

- احتفظ بملف ZIP الأصلي دون تعديل.
- تحقق من بصمة SHA-256 المعلنة قبل فك الضغط.
- استخدم `MANIFEST_SHA256.txt` للتحقق من الملفات بعد الفك.
- أنشئ نسخة عمل منفصلة ولا تعدّل النسخة المحفوظة.
- لا تضف ملفات `.env` أو أسرارًا إلى الأرشيف.

تم إعداد هذا التصدير النهائي بتاريخ 2 أغسطس 2026.
