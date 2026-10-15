# المرحلة 0920 — جاهزية النشر والتكامل

تاريخ التنفيذ: 2 أغسطس 2026

## الإضافات

- `Dockerfile.backend`: بناء متعدد المراحل، مستخدم غير root، Health Check، وإيقاف منضبط.
- `Dockerfile.frontend`: بناء إنتاجي متعدد المراحل وHealth Check.
- `.dockerignore`: استبعاد الاعتماديات والمخابئ والأرشيفات.
- `deployment/docker-compose.yml`: PostgreSQL 16 وMigrations وBackend وFrontend.
- `deployment/.env.example`: متغيرات النشر دون أسرار حقيقية.
- `deployment/README_AR.md`: دليل التشغيل والتوقف والتشخيص.
- `scripts/deployment-preflight.sh`: فحص الملفات والأسرار والبيئة وCompose.
- `scripts/deployment-smoke-test.sh`: اختبار Live وReady وMeta وFrontend والعقود الأساسية.
- أوامر npm: `deploy:preflight` و`deploy:smoke`.

## ضوابط الحماية

- شبكة PostgreSQL داخلية وغير منشورة.
- Backend مربوط محليًا افتراضيًا.
- الحاويات تعمل بـ`no-new-privileges` ونظام ملفات للقراءة فقط مع `/tmp` مؤقت.
- عمليات PostgreSQL الخطرة تبدأ معطلة.
- فحص صريح للقيم التوضيحية وطول رموز الخدمات الداخلية.
- فصل الترحيلات في خدمة تنتهي بعد التنفيذ.

## التحقق المنفذ

- Bash syntax: ناجح.
- Deployment preflight بقيم اختبار آمنة: ناجح.
- بنية Compose الساكنة والخدمات والشبكة الخاصة: ناجحة.
- OpenAPI: ناجح، 90 عملية وانحراف صفري.
- Docker Compose runtime: لم يكن متاحًا في بيئة الإنشاء؛ لذلك يلزم تنفيذ `docker compose config` وبناء الصور على خادم Docker الفعلي.
- Smoke Test: جاهز للتنفيذ عند تشغيل الخدمات الفعلية.

## حدود المرحلة

هذه المرحلة توفر ملفات وأدوات جاهزية النشر، ولا تزعم نجاح تشغيل خدمات خارجية غير متاحة حاليًا. يلزم في بيئة السيرفر توفير OIDC وObject Storage وPostgreSQL والأسرار وDNS/TLS ثم تشغيل Preflight وMigrations وSmoke/UAT.
