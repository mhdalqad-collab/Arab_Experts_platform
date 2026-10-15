BEGIN;

INSERT INTO reference.service_types
  (service_type_code, name_ar, name_en, display_order)
VALUES
  ('RESEARCH_DEVELOPMENT', 'بحث وتطوير', 'Research and Development', 1),
  ('CONSULTING', 'استشارات', 'Consulting', 2),
  ('IMPLEMENTATION', 'تنفيذ', 'Implementation', 3),
  ('TRAINING', 'تدريب', 'Training', 4),
  ('STUDIES', 'إعداد دراسات', 'Studies Preparation', 5),
  ('DESIGN', 'تصميم', 'Design', 6),
  ('SUPERVISION', 'إشراف', 'Supervision', 7),
  ('PROJECT_MANAGEMENT', 'إدارة مشاريع', 'Project Management', 8),
  ('AUDIT', 'تدقيق', 'Audit', 9),
  ('ARBITRATION', 'تحكيم', 'Arbitration', 10),
  ('EVALUATION', 'تقييم', 'Evaluation', 11)
ON CONFLICT (service_type_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  display_order = EXCLUDED.display_order,
  is_active = true;

INSERT INTO reference.client_types
  (client_type_code, name_ar, name_en, is_organization, display_order)
VALUES
  ('INDEPENDENT_INDIVIDUAL', 'فردي مستقل', 'Independent Individual', false, 1),
  ('PRIVATE_ORGANIZATION', 'مؤسسة أو شركة خاصة', 'Private Organization or Company', true, 2),
  ('ACADEMIC_SECTOR', 'قطاع أكاديمي', 'Academic Sector', true, 3),
  ('JOINT_SECTOR', 'قطاع مشترك', 'Joint Sector', true, 4),
  ('GOVERNMENT_ORGANIZATION', 'منظمات حكومية', 'Government Organizations', true, 5),
  ('REGIONAL_ORGANIZATION', 'منظمات إقليمية', 'Regional Organizations', true, 6),
  ('INTERNATIONAL_ORGANIZATION', 'منظمات دولية', 'International Organizations', true, 7)
ON CONFLICT (client_type_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_organization = EXCLUDED.is_organization,
  display_order = EXCLUDED.display_order,
  is_active = true;

INSERT INTO reference.client_registration_purposes
  (registration_purpose_code, name_ar, name_en, display_order)
VALUES
  ('SPECIALIZED_CONSULTING', 'طلب استشارة متخصصة', 'Request Specialized Consulting', 1),
  ('TRAINING_WORKSHOPS', 'طلب تدريب أو ورش عمل', 'Request Training or Workshops', 2),
  ('PROJECT_MANAGEMENT_SUPPORT', 'طلب إدارة أو دعم مشروع', 'Request Project Management or Support', 3),
  ('AUDIT_REVIEW', 'طلب تقييم أو مراجعة', 'Request Audit or Review', 4),
  ('TEMPORARY_EXPERT_TEAM', 'طلب خبير للانضمام لفريق عمل مؤقت', 'Request Expert for a Temporary Team', 5),
  ('APPLIED_RESEARCH_STUDIES', 'طلب دراسات أو أبحاث تطبيقية', 'Request Applied Studies or Research', 6)
ON CONFLICT (registration_purpose_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  display_order = EXCLUDED.display_order,
  is_active = true;

COMMIT;
