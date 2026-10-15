BEGIN;

CREATE SCHEMA IF NOT EXISTS localization;

CREATE TABLE localization.locales (
  locale_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale_code varchar(20) NOT NULL UNIQUE,
  language_code varchar(12) NOT NULL REFERENCES reference.languages(language_code) ON DELETE RESTRICT,
  country_code char(2) REFERENCES reference.countries(country_code) ON DELETE RESTRICT,
  writing_direction_code varchar(3) NOT NULL CHECK (writing_direction_code IN ('RTL','LTR')),
  calendar_code varchar(20) NOT NULL DEFAULT 'GREGORIAN' CHECK (calendar_code IN ('GREGORIAN','HIJRI','DUAL')),
  default_currency_code char(3) REFERENCES reference.currencies(currency_code) ON DELETE RESTRICT,
  date_format_code varchar(30) NOT NULL,
  number_format_code varchar(30) NOT NULL,
  fallback_locale_id uuid REFERENCES localization.locales(locale_id) ON DELETE RESTRICT,
  status_code varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status_code IN ('DRAFT','ACTIVE','SUSPENDED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (fallback_locale_id IS NULL OR fallback_locale_id <> locale_id)
);

CREATE TABLE localization.resource_keys (
  resource_key_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_key varchar(180) NOT NULL UNIQUE,
  resource_scope_code varchar(24) NOT NULL CHECK (resource_scope_code IN ('UI','VALIDATION','EMAIL','NOTIFICATION','TAXONOMY','PUBLIC_CONTENT','LEGAL','REPORT','ACCESSIBILITY')),
  source_text text NOT NULL,
  source_language_code varchar(12) NOT NULL REFERENCES reference.languages(language_code) ON DELETE RESTRICT,
  context_description text NOT NULL,
  interpolation_variables jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(interpolation_variables) = 'array'),
  sensitivity_code varchar(16) NOT NULL CHECK (sensitivity_code IN ('PUBLIC','INTERNAL','CONFIDENTIAL')),
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  status_code varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status_code IN ('DRAFT','ACTIVE','DEPRECATED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE localization.translation_versions (
  translation_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_key_id uuid NOT NULL REFERENCES localization.resource_keys(resource_key_id) ON DELETE RESTRICT,
  locale_id uuid NOT NULL REFERENCES localization.locales(locale_id) ON DELETE RESTRICT,
  version_number integer NOT NULL CHECK (version_number > 0),
  translated_text text NOT NULL,
  translation_method_code varchar(20) NOT NULL CHECK (translation_method_code IN ('HUMAN','MACHINE','MACHINE_REVIEWED','PROFESSIONAL')),
  translator_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  reviewer_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  quality_status_code varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (quality_status_code IN ('DRAFT','LINGUISTIC_REVIEW','DOMAIN_REVIEW','APPROVED','REJECTED','SUPERSEDED')),
  source_hash char(64) NOT NULL,
  translation_hash char(64) NOT NULL,
  effective_from timestamptz,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (resource_key_id, locale_id, version_number),
  CHECK (reviewed_at IS NULL OR reviewer_party_id IS NOT NULL),
  CHECK (reviewer_party_id IS NULL OR reviewer_party_id <> translator_party_id),
  CHECK (quality_status_code <> 'APPROVED' OR reviewed_at IS NOT NULL),
  CHECK (effective_to IS NULL OR (effective_from IS NOT NULL AND effective_to > effective_from))
);

CREATE TABLE localization.content_localizations (
  content_localization_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type varchar(80) NOT NULL,
  resource_id uuid NOT NULL,
  field_path varchar(180) NOT NULL,
  locale_id uuid NOT NULL REFERENCES localization.locales(locale_id) ON DELETE RESTRICT,
  localized_value text NOT NULL,
  source_value_hash char(64) NOT NULL,
  localization_hash char(64) NOT NULL,
  status_code varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK (status_code IN ('DRAFT','REVIEW','APPROVED','PUBLISHED','STALE','WITHDRAWN')),
  reviewed_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (resource_type, resource_id, field_path, locale_id, localization_hash),
  CHECK (reviewed_at IS NULL OR reviewed_by_party_id IS NOT NULL),
  CHECK (published_at IS NULL OR (status_code = 'PUBLISHED' AND reviewed_at IS NOT NULL))
);

CREATE TABLE localization.accessibility_requirements (
  accessibility_requirement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_code varchar(70) NOT NULL UNIQUE,
  standard_code varchar(30) NOT NULL CHECK (standard_code IN ('WCAG_2_2_A','WCAG_2_2_AA','WCAG_2_2_AAA','WAI_ARIA','PLATFORM_POLICY')),
  principle_code varchar(20) NOT NULL CHECK (principle_code IN ('PERCEIVABLE','OPERABLE','UNDERSTANDABLE','ROBUST')),
  requirement_text_ar text NOT NULL,
  applies_to_scope jsonb NOT NULL CHECK (jsonb_typeof(applies_to_scope) = 'array'),
  severity_code varchar(12) NOT NULL CHECK (severity_code IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  automated_test_possible boolean NOT NULL DEFAULT false,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  status_code varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status_code IN ('DRAFT','ACTIVE','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (applies_to_scope <> '[]'::jsonb)
);

CREATE TABLE localization.accessibility_assessments (
  accessibility_assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accessibility_requirement_id uuid NOT NULL REFERENCES localization.accessibility_requirements(accessibility_requirement_id) ON DELETE RESTRICT,
  resource_type varchar(80) NOT NULL,
  resource_reference text NOT NULL,
  locale_id uuid REFERENCES localization.locales(locale_id) ON DELETE RESTRICT,
  viewport_code varchar(20) CHECK (viewport_code IS NULL OR viewport_code IN ('MOBILE','TABLET','DESKTOP','SCREEN_READER')),
  assessment_method_code varchar(20) NOT NULL CHECK (assessment_method_code IN ('AUTOMATED','MANUAL','ASSISTIVE_TECH','USER_TEST')),
  outcome_code varchar(16) NOT NULL CHECK (outcome_code IN ('PASSED','FAILED','PARTIAL','NOT_APPLICABLE')),
  evidence_reference text NOT NULL,
  evidence_hash char(64) NOT NULL,
  assessed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  assessed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  remediated_at timestamptz,
  verified_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  verified_at timestamptz,
  CHECK (verified_at IS NULL OR verified_by_party_id IS NOT NULL),
  CHECK (verified_by_party_id IS NULL OR verified_by_party_id <> assessed_by_party_id),
  CHECK (remediated_at IS NULL OR outcome_code IN ('FAILED','PARTIAL'))
);

CREATE VIEW localization.v_localization_release_readiness AS
SELECT l.locale_id,l.locale_code,
       CASE
         WHEN l.status_code <> 'ACTIVE' THEN 'LOCALE_NOT_ACTIVE'
         WHEN EXISTS (
           SELECT 1 FROM localization.resource_keys k
           WHERE k.status_code = 'ACTIVE' AND k.resource_scope_code IN ('UI','VALIDATION','LEGAL')
             AND NOT EXISTS (
               SELECT 1 FROM localization.translation_versions t
               WHERE t.resource_key_id = k.resource_key_id AND t.locale_id = l.locale_id
                 AND t.quality_status_code = 'APPROVED'
                 AND (t.effective_to IS NULL OR t.effective_to > clock_timestamp())
             )
         ) THEN 'REQUIRED_TRANSLATION_MISSING'
         WHEN EXISTS (
           SELECT 1 FROM localization.accessibility_assessments a
           JOIN localization.accessibility_requirements q ON q.accessibility_requirement_id = a.accessibility_requirement_id
           WHERE (a.locale_id = l.locale_id OR a.locale_id IS NULL)
             AND q.status_code = 'ACTIVE' AND q.severity_code IN ('HIGH','CRITICAL')
             AND a.outcome_code IN ('FAILED','PARTIAL') AND a.verified_at IS NULL
         ) THEN 'ACCESSIBILITY_REMEDIATION_REQUIRED'
         ELSE 'READY_FOR_LOCALIZED_RELEASE'
       END AS readiness_code
FROM localization.locales l;

COMMIT;
