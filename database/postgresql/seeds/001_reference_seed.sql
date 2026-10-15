BEGIN;

INSERT INTO reference.languages
  (language_code, name_ar, name_en, native_name, is_featured, display_order)
VALUES
  ('ar', 'العربية', 'Arabic', 'العربية', true, 1),
  ('en', 'الإنجليزية', 'English', 'English', true, 2),
  ('fr', 'الفرنسية', 'French', 'Français', true, 3),
  ('de', 'الألمانية', 'German', 'Deutsch', true, 4),
  ('es', 'الإسبانية', 'Spanish', 'Español', true, 5),
  ('zh', 'الصينية', 'Chinese', '中文', true, 6),
  ('hi', 'الهندية', 'Hindi', 'हिन्दी', true, 7)
ON CONFLICT (language_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  native_name = EXCLUDED.native_name,
  is_featured = EXCLUDED.is_featured,
  display_order = EXCLUDED.display_order,
  is_active = true;

INSERT INTO reference.currencies
  (currency_code, name_ar, name_en, symbol, decimal_places)
VALUES
  ('USD', 'دولار أمريكي', 'US Dollar', '$', 2),
  ('EUR', 'يورو', 'Euro', '€', 2),
  ('OMR', 'ريال عماني', 'Omani Rial', 'ر.ع.', 3)
ON CONFLICT (currency_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  symbol = EXCLUDED.symbol,
  decimal_places = EXCLUDED.decimal_places,
  is_active = true;

INSERT INTO reference.contact_method_types
  (contact_method_type_code, name_ar, name_en, value_pattern, display_order)
VALUES
  ('EMAIL', 'البريد الإلكتروني', 'Email', '^[^@\s]+@[^@\s]+\.[^@\s]+$', 1),
  ('MOBILE', 'الهاتف المحمول', 'Mobile', '^\+?[0-9]{7,15}$', 2),
  ('PHONE', 'الهاتف', 'Phone', '^\+?[0-9]{7,15}$', 3),
  ('WHATSAPP', 'واتساب', 'WhatsApp', '^\+?[0-9]{7,15}$', 4),
  ('LINKEDIN', 'لينكدإن', 'LinkedIn', '^https://(www\.)?linkedin\.com/.+$', 5),
  ('WEBSITE', 'الموقع الإلكتروني', 'Website', '^https?://.+$', 6)
ON CONFLICT (contact_method_type_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  value_pattern = EXCLUDED.value_pattern,
  display_order = EXCLUDED.display_order,
  is_active = true;

INSERT INTO reference.delivery_modes
  (delivery_mode_code, name_ar, name_en, display_order)
VALUES
  ('IN_PERSON', 'حضوري', 'In person', 1),
  ('REMOTE', 'عن بعد', 'Remote', 2),
  ('HYBRID', 'هجين', 'Hybrid', 3)
ON CONFLICT (delivery_mode_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  display_order = EXCLUDED.display_order,
  is_active = true;

INSERT INTO reference.confidentiality_levels
  (confidentiality_level_code, name_ar, name_en, sensitivity_rank)
VALUES
  ('PUBLIC', 'جميع المعلومات متاحة للجميع', 'Public', 1),
  ('ALLOWED_INFORMATION_ONLY', 'إظهار المعلومات المسموحة فقط', 'Allowed information only', 2),
  ('AUTHORIZED_CLIENTS', 'متاح للعملاء المخولين فقط', 'Authorized clients only', 3),
  ('PLATFORM_ADMIN_ONLY', 'المعلومات المخفية متاحة لمدير المنصة فقط', 'Platform administrator only', 4)
ON CONFLICT (confidentiality_level_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  sensitivity_rank = EXCLUDED.sensitivity_rank,
  is_active = true;

INSERT INTO reference.legal_entity_types
  (legal_entity_type_code, name_ar, name_en, display_order)
VALUES
  ('LIMITED_LIABILITY_COMPANY', 'شركة ذات مسؤولية محدودة (ذ.م.م)', 'Limited Liability Company', 1),
  ('SOLE_PROPRIETORSHIP', 'مؤسسة فردية', 'Sole Proprietorship', 2),
  ('SINGLE_PERSON_COMPANY', 'شركة شخص واحد', 'Single Person Company', 3),
  ('PRIVATE_JOINT_STOCK', 'شركة مساهمة خاصة', 'Private Joint Stock Company', 4),
  ('NON_PROFIT', 'مؤسسة غير ربحية / جمعية نفع عام', 'Non-profit / Public Benefit Association', 5),
  ('FOREIGN_BRANCH', 'فرع لشركة أو مؤسسة أجنبية', 'Foreign Company or Institution Branch', 6),
  ('OFFICIAL_ENTITY_UNIT', 'وحدة أو مركز تابع لجهة رسمية قائمة', 'Unit or Center of an Existing Official Entity', 7)
ON CONFLICT (legal_entity_type_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  display_order = EXCLUDED.display_order,
  is_active = true;

INSERT INTO membership.membership_types
  (membership_type_code, name_ar, name_en, is_publicly_selectable,
   requires_review, requires_paid_subscription, display_order)
VALUES
  ('EXPERT', 'خبير', 'Expert', true, true, false, 1),
  ('TRAINER', 'مدرب', 'Trainer', true, true, false, 2),
  ('CONSULTANT', 'مستشار', 'Consultant', true, true, false, 3),
  ('RESEARCHER_ACADEMIC', 'باحث / أكاديمي', 'Researcher / Academic', true, true, false, 4),
  ('TRAINING_CENTER', 'مركز تدريب', 'Training Center', true, true, true, 5),
  ('CLIENT', 'العميل', 'Client', true, false, false, 6),
  ('PLATFORM_STAFF', 'مدير المنصة / المشغلون', 'Platform Staff / Administrators', false, true, false, 7)
ON CONFLICT (membership_type_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_publicly_selectable = EXCLUDED.is_publicly_selectable,
  requires_review = EXCLUDED.requires_review,
  requires_paid_subscription = EXCLUDED.requires_paid_subscription,
  display_order = EXCLUDED.display_order,
  is_active = true;

COMMIT;
