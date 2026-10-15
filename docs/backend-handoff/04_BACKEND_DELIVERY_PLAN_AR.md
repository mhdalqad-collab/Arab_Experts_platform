# خطة تنفيذ Backend المرحلية — V113 R5

| المرحلة | النطاق | مخرجات إلزامية | بوابة الخروج |
|---|---|---|---|
| 0 — Foundation | CI، PostgreSQL، secrets، observability | بيئات، migration runner، OpenAPI validation | نشر Test قابل للإعادة |
| 1 — Identity | الحساب، الطرف، المنظمة، الجلسة، MFA | OIDC، session، RBAC middleware، audit | اختبارات انتحال وتصعيد ناجحة |
| 2 — Membership/Profile | العضويات والملف والخصوصية والأدلة | lifecycle، field privacy، signed files | UAT للحالات والمراجعة |
| 3 — Taxonomy/Discovery | 7×7×7، الأنطولوجيا، البحث | versioned taxonomy، indexing، directory API | دقة وكمون معتمدَان |
| 4 — Client/Matching | العميل والاحتياج والبصمة والمطابقة | frozen need، ranking explainability، shortlist | سيناريوهات المطابقة مقبولة |
| 5 — Proposal/Delivery | المقترح والعقد والمشروع والتسليم | idempotent commands، approvals، outbox | دورة خدمة E2E ناجحة |
| 6 — Finance/Quality | الفواتير والدفع والإغلاق والسمعة والشكاوى | PSP adapter، reconciliation، appeals | تسوية واختبارات فصل مهام |
| 7 — Hardening | أمن، أداء، DR، WCAG، UAT | تقارير مستقلة وrunbooks | موافقة إطلاق إنتاجي |

## الربط بمتطلبات V113

- المرحلة 1–2: Package 02 ومتطلبات الهوية والعضوية والملف والخصوصية.
- المرحلة 3: Package 03 ومتطلبات البحث والأنطولوجيا والتدريب.
- المرحلة 4: Package 04 ومتطلبات العميل والاحتياج والمطابقة والفرق.
- المرحلة 5–6: Package 05 ومتطلبات المقترح والعقد والمشروع والمال.
- المرحلة 7: متطلبات القبول المشتركة في Coverage Master وTraceability.

## قاعدة التخطيط

لا تعد النسبة المئوية للتقدم دليلاً للقبول. يغلق المتطلب فقط عند وجود كود
ومراجعة واختبار آلي وأدلة أمن/خصوصية وUAT عند الحاجة.

