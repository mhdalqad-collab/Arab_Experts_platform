# قاموس البيانات المختصر V6

## المعرفة

| الكيان | الغرض | المفتاح/العلاقات الأساسية |
|---|---|---|
| `knowledge.research_projects` | سجل المشروع البحثي | lead_party، organization، status |
| `knowledge.publications` | الهوية الثابتة للمنشور | owner_party، project، current_version |
| `knowledge.publication_versions` | محتوى المنشور المؤرّخ | publication + version_no |
| `knowledge.events` | الفعالية المستقلة | organizer_party، delivery_mode |
| `knowledge.event_sessions` | جلسات الفعالية | event + period |
| `knowledge.knowledge_assets` | الأصل المعرفي الموحد | owner_party، type، current_version |
| `knowledge.knowledge_asset_versions` | محتوى الأصل وإصداره | asset + version_no |

## الحوكمة والخصوصية

| الكيان | الغرض |
|---|---|
| `governance.roles` / `permissions` | تعريف RBAC دون ربطه بمستخدم |
| `governance.user_role_assignments` | الإسناد الفعلي مع النطاق والمدة |
| `governance.access_delegations` | تفويض مؤقت ومقيد |
| `governance.approval_requests/decisions` | اعتماد محكوم وفصل مهام |
| `governance.data_field_catalog` | تصنيف كل حقل وغرضه |
| `governance.consent_records/history` | الموافقة الحالية وتاريخها |
| `governance.field_privacy_preferences` | اختيار صاحب البيانات لكل حقل |
| `governance.audit_events` | سجل غير قابل للتعديل |

## التكامل

| الكيان | الغرض |
|---|---|
| `integration.external_systems` | سجل الأنظمة الخارجية |
| `integration.integration_connections` | اتصال حسب البيئة والاتجاه |
| `integration.data_contracts/versions/fields` | عقد بنية البيانات وإصداراته |
| `integration.mapping_sets/field_mappings` | تحويل الحقول والقيم |
| `integration.sync_jobs/runs/errors` | تشغيل ومراقبة المزامنة |
| `integration.outbox_events/inbox_messages` | موثوقية الأحداث وعدم التكرار |

جميع المفاتيح الداخلية UUID، وجميع الأزمنة التشغيلية `timestamptz`. الرموز
البشرية NAE مستقرة ولا تستخدم بديلاً عن المفتاح الداخلي.

