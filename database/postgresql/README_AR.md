# قاعدة PostgreSQL الإنتاجية — EIM 6.3 / DDL V6

هذه الحزمة هي المخطط المنطقي الإنتاجي المحدث لشبكة الخبراء العرب. وهي مستقلة
عن قاعدة D1 التجريبية المستخدمة في العرض الحالي، ولا تغير سلوك العرض التفاعلي.

## المتطلبات

- PostgreSQL 16 أو أحدث.
- صلاحية إنشاء الامتداد `pgcrypto`.
- قاعدة بيانات فارغة بترميز UTF-8.

## ترتيب التنفيذ

نفّذ ملفات `migrations` بترتيب أسمائها:

آخر حزمة: `0560_v110_api_product_lifecycle_governance.sql`.

المسار القياسي الوحيد لتطبيق السلسلة هو المشغل التالي، وهو يكتشف جميع الملفات
ويرتبها اسمياً، ثم ينفذ seeds بعد اكتمال migrations:

```bash
DATABASE_MIGRATION_URL="$DATABASE_MIGRATION_URL" \
  ./scripts/run-all.sh --all
```

يمكن استخدام `--migrations-only` أو `--seeds-only` في عمليات النشر المحكومة.
القائمة اليدوية التالية مرجع تاريخي لشرح البدايات فقط وليست أمراً تشغيلياً؛
لا تستخدمها بدلاً من `run-all.sh` لأنها لا تسرد الحزم اللاحقة كاملة.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0000_platform_foundation.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0010_reference.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0020_core.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0030_iam.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0040_membership.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0045_professional_reference.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0050_taxonomy.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0060_professional.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0070_evidence.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0075_market_reference.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0080_services.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0090_training.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0100_crm.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0105_needs_matching_reference.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0110_needs.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0120_matching.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0130_delivery.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0140_contracts_ip.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0150_billing.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0160_knowledge_research_publishing_events.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0170_governance_rbac_policies.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0180_privacy_consent_audit.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0190_integrations_interoperability.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0200_v71_foundation_non_destructive.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0210_v73_client_identity_resolution.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f migrations/0220_v74_professional_training_unification.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f seeds/000_countries_seed.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f seeds/001_reference_seed.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f seeds/002_professional_reference_seed.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f seeds/003_market_reference_seed.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f seeds/004_needs_matching_seed.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f seeds/005_subscription_plan_seed.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f seeds/006_governance_knowledge_seed.sql
```

يمكن إجراء تحقق بنيوي سريع دون قاعدة PostgreSQL:

```bash
node scripts/validate-ddl.mjs
```

## القرارات المعمارية

- `core.parties` هو السجل الموحد للأشخاص والمنظمات.
- `iam.user_accounts` حساب دخول واحد لكل شخص.
- تعدد الأدوار يتم بواسطة `membership.memberships`، وليس بحسابات مكررة.
- تستخدم الحقول `archived_at` للأرشفة المنطقية عند الحاجة.
- لا يُسمح للواجهة بتغيير حالات الكيانات مباشرة؛ تحفظ الانتقالات في جداول التاريخ.
- جميع التواريخ الزمنية من نوع `timestamptz`.
- القيم المالية مستقبلًا ستكون `numeric(18,3)`.
- المفتاح الرسمي للدولة حاليًا هو ISO Alpha-2. حقلا Alpha-3 والرقم الدولي
  قابلان للإفراغ إلى أن يحمّلا من مصدر ISO رسمي معتمد.

## وثائق التصميم الملزمة

يحتوي مجلد `docs` على تحليل الفجوات، النموذج المفاهيمي، قواعد الأعمال، قاموس
البيانات، مصفوفة RBAC والخصوصية، ERD، خطة الترحيل والتراجع، ومعايير القبول.

أضيف إلى خط الأساس:

- [النموذج المنطقي الموحد V70](docs/09_LOGICAL_MODEL_V70_AR.md)
- [قاموس البيانات المركزي V70](docs/10_CENTRAL_DATA_DICTIONARY_V70_AR.md)
- [قرارات المطابقة والترحيل V71](docs/11_RECONCILIATION_DECISIONS_V71_AR.md)
- [السجل الكامل لتصنيف الجداول](docs/11_CURRENT_TARGET_RECONCILIATION_V71.csv)
- [الحزمة A التأسيسية غير الهادمة V72](docs/12_PACKAGE_A_FOUNDATION_V72_AR.md)
- [الحزمة B لهوية العميل والعلاقات المؤسسية V73](docs/13_PACKAGE_B_CLIENT_IDENTITY_V73_AR.md)
- [الحزمة C للخبرات ومحتوى الدورات V74](docs/14_PACKAGE_C_PROFESSIONAL_TRAINING_V74_AR.md)
- [الحزمة D للعقود والحقوق والجودة V75](docs/15_PACKAGE_D_CONTRACT_RIGHTS_QUALITY_V75_AR.md)
- [الحزمة E لدورة حياة طلب الخدمة V76](docs/16_PACKAGE_E_SERVICE_LIFECYCLE_V76_AR.md)
- [الحزمة F لحوكمة انتقالات قضية الخدمة V77](docs/17_PACKAGE_F_WORKFLOW_GOVERNANCE_V77_AR.md)
- [الحزمة G لمشغل أوامر قضية الخدمة V78](docs/18_PACKAGE_G_COMMAND_EXECUTOR_V78_AR.md)
- [الحزمة H لاستئناف الموافقات وتسليم Outbox V79](docs/19_PACKAGE_H_APPROVAL_OUTBOX_V79_AR.md)
- [الحزمة I للاختبارات التكاملية وجاهزية الإنفاذ V80](docs/20_PACKAGE_I_INTEGRATION_READINESS_V80_AR.md)
- [الحزمة J للتفعيل التدريجي المحكوم V81](docs/21_PACKAGE_J_GOVERNED_ROLLOUT_V81_AR.md)
- [الحزمة K لمنفذ الأوامر المدرك للتفعيل V82](docs/22_PACKAGE_K_ROLLOUT_AWARE_EXECUTOR_V82_AR.md)
- [الحزمة L لمؤشرات Canary وحدود السلامة V83](docs/23_PACKAGE_L_CANARY_METRICS_V83_AR.md)
- [الحزمة M للوحة تشغيل سير العمل V84](docs/24_PACKAGE_M_OPERATIONS_CONSOLE_V84_AR.md)

يمثلان الهدف المنطقي للمطابقة، ولا يلغي وجودهما migrations الحالية قبل اكتمال
مصفوفة `KEEP/RENAME/MOVE/SPLIT/MERGE/ADD/RETIRE` واعتماد ترحيل غير هادم.

## ما تغطيه الحزمة الحالية

1. المخططات والامتدادات والدوال المشتركة.
2. البيانات المرجعية الأساسية.
3. الأطراف والأشخاص والمنظمات والعناوين ووسائل الاتصال والملفات.
4. الحسابات والتحقق والجلسات والاستعادة والحماية.
5. أنواع العضوية والطلبات والمتطلبات والمراجعات وسجل الحالات.
6. التصنيف المهني والتدريبي بإصداراته ومستوياته وعقده وروابطه.
7. الملفات المهنية والمؤهلات والخبرات والتوفر والتسعير.
8. محفظة البصمات المهنية الديناميكية ومكوناتها وسياقاتها ونتائجها.
9. الأدلة متعددة الملفات والتحقق ودرجة اليقين والتقييم والشكاوى.
10. كتالوج الخدمات والقدرات والعروض وإصداراتها وتسعيرها.
11. المراكز والدورات والإصدارات والطروحات والتسجيل والحضور والتقييم.
12. سجل العميل الفردي والمؤسسي وممثلوه وتفاعلاته وفوترته ومخاطره.
13. الاحتياجات وإصداراتها وأهدافها ومخرجاتها وقيودها.
14. بصمة المهمة ومتطلبات القدرات والأدلة.
15. طلب الخدمة ودورة حالته والدعوات والمقترحات وإصداراتها.
16. المطابقة بالأوزان والتفسير والمقارنة والقوائم المختصرة.
17. تكوين فرق الخبراء وأدوارها وتوافقها.
18. المشاركات المهنية والمشاريع والمراحل والمهام والمعالم.
19. التسليمات وإصداراتها وملفاتها ومراجعتها وقبول العميل.
20. طلبات التغيير وتحليل أثرها والمخاطر والمشكلات والقرارات.
21. الوقت والاتصالات والإغلاق والدروس المستفادة.
22. العقود وأطرافها وإصداراتها وبنودها وتوقيعاتها.
23. الملكية الفكرية والملكية والمساهمات والتراخيص والسرية.
24. باقات الاشتراك والتغطية والتجديد والتغيير.
25. الفواتير وخطط الدفع والمدفوعات والاسترداد والنزاعات والتسويات.
26. البحث العلمي والمنشورات وإصداراتها ومراجعة الأقران.
27. الفعاليات والجلسات والتسجيل والحضور.
28. الأصول المعرفية وإصداراتها وعلاقاتها واستخدامها.
29. RBAC والتفويض وفصل المهام ومراجعة الوصول والاعتمادات.
30. الخصوصية على مستوى الحقل والموافقات والاحتفاظ وحقوق صاحب البيانات.
31. سجل تدقيق غير قابل للتعديل وحالات التدقيق والإجراءات التصحيحية.
32. التكاملات وعقود البيانات والخرائط والمزامنة وOutbox/Inbox وWebhooks.

الأسعار الموجودة في بذور الباقات قيم صفرية مؤقتة متعمدة إلى أن تعتمد الإدارة
سياسة التسعير؛ لا يجوز استخدامها كأسعار تجارية نهائية.
