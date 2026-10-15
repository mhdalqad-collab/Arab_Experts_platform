BEGIN;

CREATE TABLE taxonomy.taxonomy_schemes (
  taxonomy_scheme_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_code varchar(60) NOT NULL UNIQUE,
  name_ar varchar(200) NOT NULL,
  name_en varchar(200) NOT NULL,
  description_ar text,
  description_en text,
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE taxonomy.taxonomy_versions (
  taxonomy_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_scheme_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_schemes(taxonomy_scheme_id) ON DELETE RESTRICT,
  version_no integer NOT NULL CHECK (version_no > 0),
  version_label varchar(40) NOT NULL,
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'REVIEW', 'PUBLISHED', 'SUPERSEDED', 'RETIRED')),
  effective_from date,
  effective_to date,
  change_summary text,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by_party_id uuid REFERENCES core.parties(party_id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_at timestamptz,
  CONSTRAINT ck_taxonomy_version_period
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
  UNIQUE (taxonomy_scheme_id, version_no),
  UNIQUE (taxonomy_scheme_id, version_label)
);

CREATE UNIQUE INDEX uq_taxonomy_published_version
  ON taxonomy.taxonomy_versions(taxonomy_scheme_id)
  WHERE status_code = 'PUBLISHED';

CREATE TABLE taxonomy.taxonomy_levels (
  taxonomy_level_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_scheme_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_schemes(taxonomy_scheme_id) ON DELETE CASCADE,
  level_code varchar(50) NOT NULL,
  name_ar varchar(140) NOT NULL,
  name_en varchar(140) NOT NULL,
  level_order smallint NOT NULL CHECK (level_order > 0),
  expected_children_count smallint CHECK (expected_children_count > 0),
  is_required boolean NOT NULL DEFAULT true,
  UNIQUE (taxonomy_scheme_id, level_code),
  UNIQUE (taxonomy_scheme_id, level_order)
);

CREATE TABLE taxonomy.taxonomy_nodes (
  taxonomy_node_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_version_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_versions(taxonomy_version_id) ON DELETE CASCADE,
  taxonomy_level_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_levels(taxonomy_level_id) ON DELETE RESTRICT,
  parent_node_id uuid REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id),
  node_code varchar(100) NOT NULL,
  name_ar varchar(300) NOT NULL,
  name_en varchar(300),
  description_ar text,
  description_en text,
  path_code text NOT NULL,
  depth smallint NOT NULL CHECK (depth BETWEEN 1 AND 12),
  display_order integer NOT NULL CHECK (display_order > 0),
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT', 'ACTIVE', 'DEPRECATED', 'MERGED', 'RETIRED')),
  merged_into_node_id uuid REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_taxonomy_node_not_self_parent
    CHECK (parent_node_id IS NULL OR parent_node_id <> taxonomy_node_id),
  CONSTRAINT ck_taxonomy_node_merge
    CHECK (
      (status_code = 'MERGED' AND merged_into_node_id IS NOT NULL
        AND merged_into_node_id <> taxonomy_node_id)
      OR
      (status_code <> 'MERGED' AND merged_into_node_id IS NULL)
    ),
  UNIQUE (taxonomy_version_id, node_code),
  UNIQUE (taxonomy_version_id, path_code),
  UNIQUE NULLS NOT DISTINCT (taxonomy_version_id, parent_node_id, display_order)
);

CREATE TABLE taxonomy.taxonomy_node_names (
  taxonomy_node_name_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_node_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id) ON DELETE CASCADE,
  language_code varchar(12) NOT NULL REFERENCES reference.languages(language_code),
  name_type_code varchar(30) NOT NULL
    CHECK (name_type_code IN ('PRIMARY', 'SYNONYM', 'ABBREVIATION', 'LEGACY')),
  name_value varchar(300) NOT NULL,
  normalized_value varchar(300) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (taxonomy_node_id, language_code, name_type_code, normalized_value)
);

CREATE TABLE taxonomy.taxonomy_relations (
  taxonomy_relation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id) ON DELETE CASCADE,
  relation_type_code varchar(30) NOT NULL
    CHECK (relation_type_code IN (
      'RELATED_TO', 'PREREQUISITE_OF', 'PART_OF', 'REPLACED_BY', 'EQUIVALENT_TO'
    )),
  weight numeric(6,5) CHECK (weight IS NULL OR weight BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_taxonomy_relation_not_self CHECK (source_node_id <> target_node_id),
  UNIQUE (source_node_id, target_node_id, relation_type_code)
);

CREATE TABLE taxonomy.taxonomy_mappings (
  taxonomy_mapping_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id) ON DELETE CASCADE,
  mapping_type_code varchar(30) NOT NULL
    CHECK (mapping_type_code IN ('EXACT', 'BROADER', 'NARROWER', 'RELATED')),
  confidence_score numeric(6,5) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  approved_by_party_id uuid REFERENCES core.parties(party_id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_taxonomy_mapping_not_self CHECK (source_node_id <> target_node_id),
  UNIQUE (source_node_id, target_node_id, mapping_type_code)
);

CREATE TABLE taxonomy.taxonomy_usage_assignments (
  taxonomy_usage_assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_node_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id) ON DELETE RESTRICT,
  entity_type varchar(80) NOT NULL,
  entity_id uuid NOT NULL,
  assignment_role_code varchar(40) NOT NULL DEFAULT 'PRIMARY',
  proficiency_level_code varchar(40)
    REFERENCES reference.experience_levels(experience_level_code),
  expert_role_code varchar(50)
    REFERENCES reference.expert_roles(expert_role_code),
  is_primary boolean NOT NULL DEFAULT false,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  created_by_party_id uuid REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_taxonomy_assignment_period CHECK (valid_to IS NULL OR valid_to >= valid_from),
  UNIQUE (taxonomy_node_id, entity_type, entity_id, assignment_role_code, valid_from)
);

CREATE TABLE taxonomy.taxonomy_change_requests (
  taxonomy_change_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_scheme_id uuid NOT NULL
    REFERENCES taxonomy.taxonomy_schemes(taxonomy_scheme_id),
  target_node_id uuid REFERENCES taxonomy.taxonomy_nodes(taxonomy_node_id),
  request_type_code varchar(30) NOT NULL
    CHECK (request_type_code IN ('ADD', 'EDIT', 'MOVE', 'MERGE', 'DEPRECATE', 'TRANSLATE')),
  proposed_payload jsonb NOT NULL,
  justification text NOT NULL,
  status_code varchar(30) NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status_code IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'IMPLEMENTED')),
  requested_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  reviewed_by_party_id uuid REFERENCES core.parties(party_id),
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  decided_at timestamptz
);

CREATE INDEX idx_taxonomy_nodes_parent
  ON taxonomy.taxonomy_nodes(taxonomy_version_id, parent_node_id, display_order);
CREATE INDEX idx_taxonomy_nodes_active_name_ar
  ON taxonomy.taxonomy_nodes(name_ar) WHERE status_code = 'ACTIVE';
CREATE INDEX idx_taxonomy_node_names_search
  ON taxonomy.taxonomy_node_names(language_code, normalized_value);
CREATE INDEX idx_taxonomy_usage_entity
  ON taxonomy.taxonomy_usage_assignments(entity_type, entity_id)
  WHERE valid_to IS NULL;

CREATE TRIGGER trg_taxonomy_schemes_updated_at
BEFORE UPDATE ON taxonomy.taxonomy_schemes
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_taxonomy_versions_updated_at
BEFORE UPDATE ON taxonomy.taxonomy_versions
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_taxonomy_nodes_updated_at
BEFORE UPDATE ON taxonomy.taxonomy_nodes
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_taxonomy_versions_controlled_status
BEFORE UPDATE OF status_code ON taxonomy.taxonomy_versions
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0050_taxonomy')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
