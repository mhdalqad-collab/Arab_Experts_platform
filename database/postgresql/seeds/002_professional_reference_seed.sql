BEGIN;

INSERT INTO reference.academic_qualification_types
  (qualification_type_code, name_ar, name_en, qualification_rank, display_order)
VALUES
  ('DOCTORATE', 'دكتوراه', 'Doctorate', 4, 1),
  ('MASTERS', 'ماجستير', 'Master''s Degree', 3, 2),
  ('HIGHER_DIPLOMA', 'دبلوم عالٍ', 'Higher Diploma', 2, 3),
  ('BACHELOR_DIPLOMA', 'بكالوريوس / دبلوم', 'Bachelor''s Degree / Diploma', 1, 4)
ON CONFLICT (qualification_type_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  qualification_rank = EXCLUDED.qualification_rank,
  display_order = EXCLUDED.display_order,
  is_active = true;

INSERT INTO reference.job_levels
  (job_level_code, name_ar, name_en, level_rank, display_order)
VALUES
  ('EXECUTIVE_MANAGEMENT', 'إدارة تنفيذية', 'Executive Management', 7, 1),
  ('SENIOR_MANAGEMENT', 'إدارة عليا', 'Senior Management', 6, 2),
  ('MIDDLE_MANAGEMENT', 'إدارة وسطى', 'Middle Management', 5, 3),
  ('OPERATIONAL_MANAGEMENT', 'إدارة تشغيلية', 'Operational Management', 4, 4),
  ('PROJECT_PROGRAM_MANAGEMENT', 'إدارة مشاريع وبرامج', 'Project and Program Management', 3, 5),
  ('EXPERT_CONSULTANT_RESEARCHER', 'خبير / مستشار / باحث', 'Expert / Consultant / Researcher', 2, 6),
  ('TRAINER_ENGINEER_SPECIALIST', 'مدرب / مهندس / اختصاصي', 'Trainer / Engineer / Specialist', 1, 7)
ON CONFLICT (job_level_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  level_rank = EXCLUDED.level_rank,
  display_order = EXCLUDED.display_order,
  is_active = true;

INSERT INTO reference.experience_levels
  (experience_level_code, name_ar, name_en, level_rank, display_order)
VALUES
  ('EXPERT_TRAINEE', 'خبير متمرن', 'Trainee Expert', 1, 1),
  ('EXPERT_PRACTITIONER', 'خبير ممارس', 'Practitioner Expert', 2, 2),
  ('EXPERT_CONSULTANT', 'خبير استشاري', 'Consulting Expert', 3, 3)
ON CONFLICT (experience_level_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  level_rank = EXCLUDED.level_rank,
  display_order = EXCLUDED.display_order,
  is_active = true;

INSERT INTO reference.expert_roles
  (expert_role_code, name_ar, name_en, responsibility_weight, display_order)
VALUES
  ('FULL_RESPONSIBILITY', 'مسؤولية كاملة', 'Full Responsibility', 100, 1),
  ('PARTIAL_RESPONSIBILITY', 'مسؤولية جزئية', 'Partial Responsibility', 75, 2),
  ('ACTIVE_RESPONSIBILITY', 'مسؤولية فعالة', 'Active Responsibility', 60, 3),
  ('LIMITED_PARTICIPATION', 'مشاركة محدودة', 'Limited Participation', 35, 4),
  ('ADVISORY_PARTICIPATION', 'مشاركة استشارية', 'Advisory Participation', 25, 5)
ON CONFLICT (expert_role_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  responsibility_weight = EXCLUDED.responsibility_weight,
  display_order = EXCLUDED.display_order,
  is_active = true;

INSERT INTO reference.experience_types
  (experience_type_code, name_ar, name_en, display_order)
VALUES
  ('ADMIN_LEADERSHIP', 'إدارية وقيادية', 'Administrative and Leadership', 1),
  ('TECHNICAL', 'تقنية وفنية', 'Technical', 2),
  ('OPERATIONS_LOGISTICS', 'تشغيلية ولوجستية', 'Operations and Logistics', 3),
  ('FINANCE_ECONOMICS', 'مالية واقتصادية', 'Finance and Economics', 4),
  ('MARKETING_SALES', 'تسويقية ومبيعات', 'Marketing and Sales', 5),
  ('HUMAN_RESOURCES', 'موارد بشرية', 'Human Resources', 6),
  ('LEGAL', 'قانونية', 'Legal', 7)
ON CONFLICT (experience_type_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  display_order = EXCLUDED.display_order,
  is_active = true;

INSERT INTO reference.work_natures
  (work_nature_code, name_ar, name_en, lifecycle_order)
VALUES
  ('ESTABLISHMENT', 'التأسيس', 'Establishment', 1),
  ('DESIGN', 'التصميم', 'Design', 2),
  ('IMPLEMENTATION', 'التنفيذ', 'Implementation', 3),
  ('OPERATION', 'التشغيل', 'Operation', 4),
  ('CONTROL', 'الرقابة', 'Control', 5),
  ('DEVELOPMENT', 'التطوير', 'Development', 6),
  ('COMPREHENSIVE_MANAGEMENT', 'الإدارة الشاملة', 'Comprehensive Management', 7)
ON CONFLICT (work_nature_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  lifecycle_order = EXCLUDED.lifecycle_order,
  is_active = true;

INSERT INTO reference.course_levels
  (course_level_code, name_ar, name_en, level_rank, display_order)
VALUES
  ('FOUNDATIONAL', 'تأسيسي', 'Foundational', 1, 1),
  ('INTERMEDIATE', 'متوسط', 'Intermediate', 2, 2),
  ('ADVANCED', 'متقدم', 'Advanced', 3, 3),
  ('SPECIALIZED', 'تخصصي', 'Specialized', 4, 4),
  ('LEADERSHIP', 'قيادي', 'Leadership', 5, 5),
  ('PROFESSIONAL_CERT_PREP', 'تحضيري لشهادة مهنية', 'Professional Certification Preparation', 6, 6)
ON CONFLICT (course_level_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  level_rank = EXCLUDED.level_rank,
  display_order = EXCLUDED.display_order,
  is_active = true;

INSERT INTO reference.industry_sectors
  (industry_sector_code, name_ar, name_en, display_order)
VALUES
  ('ENERGY', 'الطاقة', 'Energy', 1),
  ('INDUSTRY_PRODUCTION_MINING', 'الصناعة والإنتاج والتعدين', 'Industry, Production and Mining', 2),
  ('CONSTRUCTION_INFRASTRUCTURE_REAL_ESTATE', 'الإنشاءات والبنية التحتية والعقارات', 'Construction, Infrastructure and Real Estate', 3),
  ('OPERATIONS_TRANSPORT_SUPPLY_LOGISTICS_SERVICE', 'العمليات والنقل وسلاسل الإمداد واللوجستيات وخدمة العملاء', 'Operations, Transport, Supply Chains, Logistics and Customer Service', 4),
  ('NETWORKS_CYBER_TELECOM_AI', 'الشبكات والأمن السيبراني والاتصالات والذكاء الاصطناعي', 'Networks, Cybersecurity, Telecommunications and AI', 5),
  ('FINANCE_ACCOUNTING_TRADE_ECONOMICS', 'الخدمات المالية والمحاسبة والتجارة والاقتصاد', 'Financial Services, Accounting, Trade and Economics', 6),
  ('PUBLIC_LEGAL_EDUCATION_COMMUNITY', 'الخدمات العامة والقانون والتعليم والتنمية المجتمعية', 'Public Services, Law, Education and Community Development', 7),
  ('AGRICULTURE_NATURAL_RESOURCES_ENVIRONMENT', 'الزراعة والموارد الطبيعية والبيئة', 'Agriculture, Natural Resources and Environment', 8)
ON CONFLICT (industry_sector_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  display_order = EXCLUDED.display_order,
  is_active = true;

COMMIT;
