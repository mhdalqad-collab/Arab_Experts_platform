# مصفوفة البيئة والتكاملات — V113 R5

## البيئات

| البيئة | البيانات | التكاملات | النشر | الغرض |
|---|---|---|---|---|
| Local | صناعية فقط | محاكيات | يدوي | التطوير السريع |
| Test | صناعية قابلة للإعادة | Sandbox | CI | التكامل والانحدار |
| Staging | مجهولة/صناعية مماثلة | Sandbox كامل | CI محكوم | E2E والأداء والأمن وUAT |
| Production | حقيقية | Production | موافقة وفصل مهام | التشغيل الفعلي |

## المتغيرات الأساسية

| المتغير | مطلوب | سري | المالك | الاستخدام |
|---|---:|---:|---|---|
| `DATABASE_URL` | نعم | نعم | Platform | اتصال PostgreSQL للتطبيق |
| `DATABASE_MIGRATION_URL` | نعم عند النشر | نعم | DBA | مستخدم DDL منفصل |
| `OBJECT_STORAGE_BUCKET` | نعم | لا | Platform | اسم حاوية الملفات |
| `OBJECT_STORAGE_ENDPOINT` | نعم | لا | Platform | عنوان التخزين |
| `OBJECT_STORAGE_ACCESS_KEY_ID` | نعم | نعم | Security | هوية خدمة التخزين |
| `OBJECT_STORAGE_SECRET_ACCESS_KEY` | نعم | نعم | Security | سر خدمة التخزين |
| `IDENTITY_ISSUER_URL` | نعم | لا | IAM | OIDC issuer |
| `IDENTITY_CLIENT_ID` | نعم | لا | IAM | معرف العميل |
| `IDENTITY_CLIENT_SECRET` | نعم | نعم | IAM | سر العميل |
| `PLATFORM_ADMIN_EMAILS` | مؤقت | حساس | Security | bootstrap غير إنتاجي فقط |
| `POSTGRES_OPERATIONS_API_URL` | نعم للتشغيل | لا | Platform | Operations adapter |
| `POSTGRES_OPERATIONS_API_TOKEN` | نعم للتشغيل | نعم | Security | اعتماد adapter |
| `POSTGRES_OPERATIONS_ACTIONS_ENABLED` | نعم | لا | Operations | مفتاح تفعيل الأوامر |
| `POSTGRES_OPERATIONS_STEP_UP_READY` | نعم | لا | IAM | جاهزية step-up |
| `EMAIL_PROVIDER_API_KEY` | حسب النطاق | نعم | Communications | إرسال البريد |
| `PAYMENT_PROVIDER_SECRET` | حسب النطاق | نعم | Finance | الدفع والتسوية |
| `PAYMENT_WEBHOOK_SECRET` | حسب النطاق | نعم | Finance | تحقق webhooks |
| `SIGNATURE_PROVIDER_SECRET` | حسب النطاق | نعم | Legal | التوقيع الإلكتروني |
| `MALWARE_SCANNER_URL` | نعم للملفات | لا | Security | فحص الملفات |
| `MALWARE_SCANNER_TOKEN` | نعم للملفات | نعم | Security | اعتماد الفحص |

## ضوابط الأسرار

- لا تحفظ الأسرار في المستودع أو ملفات ZIP أو السجلات.
- تخزن في Secret Manager وتدور وفق تصنيفها.
- تستخدم هويات خدمات منفصلة لكل بيئة وبأقل صلاحية.
- يمنع استخدام `PLATFORM_ADMIN_EMAILS` كآلية إدارة دائمة في الإنتاج.

## قبول التكامل

كل تكامل يحتاج: مالكاً، Sandbox، timeout، retry/backoff، idempotency، webhook
verification، مراقبة، runbook، واختبار فشل واستعادة قبل تفعيله إنتاجياً.

