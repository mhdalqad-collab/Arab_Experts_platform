BEGIN;

INSERT INTO governance.data_classifications
  (classification_code, name_ar, name_en, sensitivity_rank, default_visibility_code,
   encryption_required, masking_required, description_ar)
VALUES
  ('PUBLIC', 'عام', 'Public', 1, 'PUBLIC', false, false, 'بيانات معتمدة للنشر العام.'),
  ('MEMBER', 'خاص بالأعضاء', 'Members only', 3, 'MEMBERS', false, false, 'بيانات تظهر للمستخدمين المسجلين وفق الغرض.'),
  ('RESTRICTED', 'مقيد', 'Restricted', 6, 'RESTRICTED', true, true, 'بيانات شخصية أو مهنية لا تعرض إلا بصلاحية صريحة.'),
  ('CONFIDENTIAL', 'سري', 'Confidential', 8, 'PRIVATE', true, true, 'بيانات تعاقدية أو مالية أو بحثية حساسة.'),
  ('HIGHLY_CONFIDENTIAL', 'سري للغاية', 'Highly confidential', 10, 'PRIVATE', true, true, 'أسرار اعتماد أو مفاتيح أو أدلة شديدة الحساسية.')
ON CONFLICT (classification_code) DO NOTHING;

INSERT INTO governance.data_purposes
  (purpose_code, name_ar, name_en, legal_basis_code, description_ar, is_optional)
VALUES
  ('ACCOUNT_ADMINISTRATION', 'إدارة الحساب والعضوية', 'Account and membership administration',
   'CONTRACT', 'إنشاء الحساب وإدارة العضويات والتحقق والتواصل التشغيلي.', false),
  ('PUBLIC_PROFILE', 'عرض الملف العام', 'Public profile publishing',
   'CONSENT', 'نشر الحقول التي اختار صاحبها إتاحتها في الملف العام.', true),
  ('SEARCH_MATCHING', 'البحث والمطابقة', 'Search and matching',
   'CONTRACT', 'فهرسة البيانات المهنية المسموح بها وتوليد نتائج البحث والمطابقة.', false),
  ('SERVICE_DELIVERY', 'تنفيذ الخدمات', 'Service delivery',
   'CONTRACT', 'إدارة الطلبات والعروض والعقود والتسليمات.', false),
  ('PAYMENT_BILLING', 'الدفع والفوترة', 'Payment and billing',
   'CONTRACT', 'إدارة الفواتير والمدفوعات والاسترداد والتجديد.', false),
  ('VERIFICATION_QUALITY', 'التحقق وضمان الجودة', 'Verification and quality assurance',
   'LEGITIMATE_INTEREST', 'التحقق من الأدلة وحماية موثوقية الشبكة.', false),
  ('RESEARCH_KNOWLEDGE', 'البحث وإدارة المعرفة', 'Research and knowledge management',
   'CONSENT', 'إدارة المخرجات البحثية والمعرفية المرخصة للنشر أو المشاركة.', true),
  ('SECURITY_AUDIT', 'الأمن والتدقيق', 'Security and audit',
   'LEGAL_OBLIGATION', 'حماية المنصة وإثبات الإجراءات والتحقيق في المخالفات.', false),
  ('ANALYTICS_IMPROVEMENT', 'التحليلات والتحسين', 'Analytics and improvement',
   'CONSENT', 'تحسين الخدمات باستخدام بيانات مجمعة أو مجهولة قدر الإمكان.', true)
ON CONFLICT (purpose_code) DO NOTHING;

INSERT INTO governance.roles
  (role_code, name_ar, name_en, role_scope_code, is_system_role, is_privileged, description_ar)
VALUES
  ('PUBLIC_VISITOR', 'زائر عام', 'Public visitor', 'PUBLIC', true, false, 'وصول إلى المحتوى العام والبحث العام.'),
  ('MEMBER_SELF', 'عضو يدير بياناته', 'Member self-service', 'MEMBER', true, false, 'إدارة حساب العضو وملفاته وخصوصيته.'),
  ('CLIENT_MEMBER', 'عميل', 'Client member', 'MEMBER', true, false, 'إدارة الاحتياجات وطلبات الخدمة والمقارنة والتعاقد.'),
  ('PROFESSIONAL_MEMBER', 'عضو مهني', 'Professional member', 'MEMBER', true, false, 'خبير أو مدرب أو مستشار أو باحث يدير عروضه المهنية.'),
  ('CENTER_ADMIN', 'مدير مركز تدريبي', 'Training center administrator', 'ORGANIZATION', true, false, 'إدارة المركز والدورات والطروحات والمدربين المرتبطين.'),
  ('ORG_ADMIN', 'مدير منظمة', 'Organization administrator', 'ORGANIZATION', true, true, 'إدارة العضويات والبيانات ضمن نطاق المنظمة.'),
  ('VERIFIER', 'مدقق أدلة', 'Evidence verifier', 'PLATFORM', true, true, 'مراجعة الأدلة ومنح قرارات التحقق.'),
  ('CONTENT_MODERATOR', 'منسق محتوى', 'Content moderator', 'PLATFORM', true, true, 'مراجعة النشر والفعاليات والأصول المعرفية.'),
  ('FINANCE_OPERATOR', 'مشغل مالي', 'Finance operator', 'PLATFORM', true, true, 'تشغيل الفواتير والمدفوعات والاسترداد دون إدارة الصلاحيات.'),
  ('PLATFORM_OPERATOR', 'مشغل المنصة', 'Platform operator', 'PLATFORM', true, true, 'تشغيل الطلبات والجودة والدعم ضمن صلاحيات محددة.'),
  ('AUDITOR', 'مدقق مستقل', 'Auditor', 'PLATFORM', true, true, 'قراءة السجلات وإدارة حالات التدقيق دون تعديل الأصل.'),
  ('PLATFORM_ADMIN', 'مدير المنصة', 'Platform administrator', 'PLATFORM', true, true, 'إدارة التكوين والصلاحيات مع فصل مهام الاعتماد.')
ON CONFLICT (role_code) DO NOTHING;

INSERT INTO governance.permissions
  (permission_code, name_ar, name_en, domain_code, action_code, resource_type,
   risk_level_code, requires_step_up_auth, requires_reason)
VALUES
  ('public.search.read', 'استخدام البحث العام', 'Use public search', 'PUBLIC', 'READ', 'search', 'LOW', false, false),
  ('public.profile.read', 'عرض الملفات العامة', 'Read public profiles', 'PUBLIC', 'READ', 'public_profile', 'LOW', false, false),
  ('account.self.manage', 'إدارة الحساب الشخصي', 'Manage own account', 'IAM', 'MANAGE_SELF', 'user_account', 'NORMAL', true, false),
  ('privacy.self.manage', 'إدارة خصوصية الحقول', 'Manage own field privacy', 'PRIVACY', 'MANAGE_SELF', 'field_privacy', 'NORMAL', true, false),
  ('membership.self.apply', 'تقديم طلب عضوية', 'Apply for membership', 'MEMBERSHIP', 'CREATE', 'membership_application', 'NORMAL', false, false),
  ('professional.self.manage', 'إدارة الملف المهني', 'Manage own professional profile', 'PROFESSIONAL', 'MANAGE_SELF', 'professional_profile', 'NORMAL', false, false),
  ('client.need.manage', 'إدارة احتياجات العميل', 'Manage client needs', 'NEEDS', 'MANAGE', 'client_need', 'NORMAL', false, false),
  ('client.request.manage', 'إدارة طلب الخدمة', 'Manage service requests', 'SERVICES', 'MANAGE', 'service_request', 'HIGH', true, false),
  ('organization.members.manage', 'إدارة أعضاء المنظمة', 'Manage organization members', 'ORGANIZATION', 'MANAGE', 'organization_membership', 'HIGH', true, true),
  ('training.catalog.manage', 'إدارة كتالوج التدريب', 'Manage training catalog', 'TRAINING', 'MANAGE', 'training_catalog', 'NORMAL', false, false),
  ('training.offering.publish', 'نشر طرح تدريبي', 'Publish training offering', 'TRAINING', 'PUBLISH', 'course_offering', 'HIGH', true, true),
  ('evidence.verify', 'التحقق من الأدلة', 'Verify evidence', 'EVIDENCE', 'VERIFY', 'evidence', 'HIGH', true, true),
  ('knowledge.review', 'مراجعة المعرفة والنشر', 'Review knowledge and publishing', 'KNOWLEDGE', 'REVIEW', 'knowledge_asset', 'HIGH', true, true),
  ('knowledge.publish', 'اعتماد النشر المعرفي', 'Approve knowledge publishing', 'KNOWLEDGE', 'PUBLISH', 'knowledge_asset', 'HIGH', true, true),
  ('finance.invoice.issue', 'إصدار فاتورة', 'Issue invoice', 'FINANCE', 'ISSUE', 'invoice', 'HIGH', true, true),
  ('finance.refund.request', 'طلب استرداد', 'Request refund', 'FINANCE', 'REQUEST', 'refund', 'HIGH', true, true),
  ('finance.refund.approve', 'اعتماد استرداد', 'Approve refund', 'FINANCE', 'APPROVE', 'refund', 'CRITICAL', true, true),
  ('governance.access.assign', 'إسناد الصلاحيات', 'Assign access', 'GOVERNANCE', 'ASSIGN', 'access', 'CRITICAL', true, true),
  ('governance.access.approve', 'اعتماد الصلاحيات', 'Approve access', 'GOVERNANCE', 'APPROVE', 'access', 'CRITICAL', true, true),
  ('audit.events.read', 'قراءة سجل التدقيق', 'Read audit events', 'AUDIT', 'READ', 'audit_event', 'HIGH', true, true),
  ('audit.case.manage', 'إدارة حالات التدقيق', 'Manage audit cases', 'AUDIT', 'MANAGE', 'audit_case', 'HIGH', true, true),
  ('integration.manage', 'إدارة التكاملات', 'Manage integrations', 'INTEGRATION', 'MANAGE', 'integration', 'CRITICAL', true, true)
ON CONFLICT (permission_code) DO NOTHING;

INSERT INTO governance.role_permissions (role_id, permission_id, constraint_expression)
SELECT r.role_id, p.permission_id,
  CASE
    WHEN r.role_code IN ('MEMBER_SELF', 'CLIENT_MEMBER', 'PROFESSIONAL_MEMBER')
      THEN '{"scope":"self"}'::jsonb
    WHEN r.role_code IN ('CENTER_ADMIN', 'ORG_ADMIN')
      THEN '{"scope":"organization"}'::jsonb
    ELSE '{"scope":"platform"}'::jsonb
  END
FROM governance.roles r
JOIN governance.permissions p ON
  (r.role_code = 'PUBLIC_VISITOR' AND p.permission_code IN ('public.search.read', 'public.profile.read'))
  OR (r.role_code = 'MEMBER_SELF' AND p.permission_code IN (
    'public.search.read', 'public.profile.read', 'account.self.manage',
    'privacy.self.manage', 'membership.self.apply'))
  OR (r.role_code = 'CLIENT_MEMBER' AND p.permission_code IN (
    'public.search.read', 'public.profile.read', 'account.self.manage',
    'privacy.self.manage', 'client.need.manage', 'client.request.manage'))
  OR (r.role_code = 'PROFESSIONAL_MEMBER' AND p.permission_code IN (
    'public.search.read', 'public.profile.read', 'account.self.manage',
    'privacy.self.manage', 'professional.self.manage'))
  OR (r.role_code = 'CENTER_ADMIN' AND p.permission_code IN (
    'account.self.manage', 'privacy.self.manage', 'organization.members.manage',
    'training.catalog.manage', 'training.offering.publish'))
  OR (r.role_code = 'ORG_ADMIN' AND p.permission_code IN (
    'organization.members.manage', 'client.need.manage', 'client.request.manage'))
  OR (r.role_code = 'VERIFIER' AND p.permission_code = 'evidence.verify')
  OR (r.role_code = 'CONTENT_MODERATOR' AND p.permission_code IN ('knowledge.review', 'knowledge.publish'))
  OR (r.role_code = 'FINANCE_OPERATOR' AND p.permission_code IN (
    'finance.invoice.issue', 'finance.refund.request'))
  OR (r.role_code = 'PLATFORM_OPERATOR' AND p.permission_code IN (
    'evidence.verify', 'knowledge.review', 'audit.case.manage'))
  OR (r.role_code = 'AUDITOR' AND p.permission_code IN ('audit.events.read', 'audit.case.manage'))
  OR (r.role_code = 'PLATFORM_ADMIN' AND p.permission_code IN (
    'governance.access.assign', 'governance.access.approve', 'audit.events.read',
    'integration.manage'))
ON CONFLICT (role_id, permission_id, valid_from) DO NOTHING;

INSERT INTO governance.segregation_of_duties_rules
  (rule_code, name_ar, first_permission_id, second_permission_id, enforcement_code, rationale)
SELECT 'SOD_REFUND_REQUEST_APPROVE', 'فصل طلب الاسترداد عن اعتماده',
       p1.permission_id, p2.permission_id, 'BLOCK',
       'لا يجوز للمستخدم نفسه طلب الاسترداد واعتماده.'
FROM governance.permissions p1, governance.permissions p2
WHERE p1.permission_code = 'finance.refund.request'
  AND p2.permission_code = 'finance.refund.approve'
ON CONFLICT (rule_code) DO NOTHING;

INSERT INTO governance.segregation_of_duties_rules
  (rule_code, name_ar, first_permission_id, second_permission_id, enforcement_code, rationale)
SELECT 'SOD_ACCESS_ASSIGN_APPROVE', 'فصل إسناد الصلاحية عن اعتمادها',
       p1.permission_id, p2.permission_id, 'BLOCK',
       'لا يجوز للمستخدم نفسه إنشاء صلاحية حساسة واعتمادها.'
FROM governance.permissions p1, governance.permissions p2
WHERE p1.permission_code = 'governance.access.assign'
  AND p2.permission_code = 'governance.access.approve'
ON CONFLICT (rule_code) DO NOTHING;

COMMIT;
