BEGIN;

INSERT INTO reference.need_types
  (need_type_code, name_ar, name_en, display_order)
VALUES
  ('NEW_RESEARCH', 'بحث جديد', 'New Research', 1),
  ('PRODUCT_DEVELOPMENT', 'تطوير منتج', 'Product Development', 2),
  ('CONSULTING', 'استشارات', 'Consulting', 3),
  ('OBJECTIVE_STUDY', 'دراسات موضوعية', 'Objective Studies', 4),
  ('FEASIBILITY_STUDY', 'إعداد دراسات جدوى فنية واقتصادية', 'Technical and Economic Feasibility Studies', 5),
  ('DESIGN_MODEL', 'تصميم أو إيجاد نماذج', 'Design or Model Development', 6),
  ('PROJECT_MANAGEMENT', 'إدارة مشاريع', 'Project Management', 7),
  ('APPLIED_PROJECT', 'تنفيذ مشاريع تطبيقية', 'Applied Project Implementation', 8),
  ('SUPERVISION', 'إشراف', 'Supervision', 9),
  ('AUDIT', 'تدقيق', 'Audit', 10),
  ('EVALUATION', 'تقييم', 'Evaluation', 11),
  ('ARBITRATION', 'تحكيم', 'Arbitration', 12),
  ('TRAINING', 'تدريب', 'Training', 13)
ON CONFLICT (need_type_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  display_order = EXCLUDED.display_order,
  is_active = true;

INSERT INTO reference.matching_criteria
  (matching_criterion_code, name_ar, name_en, data_type_code,
   default_weight, supports_hard_constraint, display_order)
VALUES
  ('SPECIALIZATION_MATCH', 'تطابق التخصص', 'Specialization Match', 'SCORE', 30, true, 1),
  ('EVIDENCE_CERTAINTY', 'الأدلة ودرجة اليقين', 'Evidence and Certainty', 'SCORE', 20, true, 2),
  ('EXPERIENCE_ROLE', 'الخبرة ودور المساهمة', 'Experience and Contribution Role', 'SCORE', 15, true, 3),
  ('AVAILABILITY', 'التوفر', 'Availability', 'SCORE', 10, true, 4),
  ('PRICE', 'السعر', 'Price', 'SCORE', 10, true, 5),
  ('LANGUAGE_COUNTRY', 'اللغة والدولة', 'Language and Country', 'SCORE', 5, true, 6),
  ('REPUTATION_QUALITY', 'السمعة والجودة', 'Reputation and Quality', 'SCORE', 10, false, 7)
ON CONFLICT (matching_criterion_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  data_type_code = EXCLUDED.data_type_code,
  default_weight = EXCLUDED.default_weight,
  supports_hard_constraint = EXCLUDED.supports_hard_constraint,
  display_order = EXCLUDED.display_order,
  is_active = true;

COMMIT;
