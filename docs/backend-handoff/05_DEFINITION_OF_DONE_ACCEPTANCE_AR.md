# معيار الإنجاز والقبول — V113 R5

## لكل Endpoint

- مدرج في OpenAPI مع request/response/error schemas.
- authentication وauthorization خادميان ومختبران سلبياً.
- validation موحد وحدود حجم وطول وقوائم مسموحة.
- idempotency للأوامر التي قد تتكرر.
- transaction وحدود اتساق واضحة.
- audit event وcorrelation ID دون كشف أسرار أو بيانات حساسة.
- pagination وحدود قصوى للقوائم.
- اختبارات unit وintegration وcontract.
- مؤشرات latency/error rate وrunbook.

## لكل Migration

- اسم متسلسل ووصف أثر البيانات.
- اختبار على PostgreSQL 16 فارغة وترقية من آخر إصدار.
- قرار rollback أو forward-fix موثق.
- لا تغيير هادم غير معتمد.
- فهارس واستعلامات حرجة مفحوصة بـ`EXPLAIN`.

## لكل متطلب MVP

- رابط إلى Requirement ID في مصفوفة V113.
- سيناريو قبول إيجابي وسلبي وحدّي.
- إثبات خصوصية وصلاحيات عند التعامل مع البيانات الشخصية.
- شاشة/مسار متكامل مع Backend، لا Demo/localStorage.
- اعتماد مالك المنتج عند الحاجة.

## بوابة الإصدار

- TypeScript وESLint: صفر أخطاء وتحذيرات.
- الاختبارات الآلية وPostgreSQL integration: ناجحة.
- لا ثغرات حرجة أو عالية مفتوحة دون استثناء معتمد.
- أهداف الأداء والسعة ناجحة.
- restore drill ناجح ضمن RTO/RPO.
- WCAG وE2E وUAT موثقة.
- SHA-256 وبيان محتويات وتقارير إصدار.

