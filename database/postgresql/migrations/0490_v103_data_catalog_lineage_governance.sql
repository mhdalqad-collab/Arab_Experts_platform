BEGIN;

CREATE TABLE quality.data_catalog_terms (
  data_catalog_term_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_code varchar(80) NOT NULL UNIQUE,
  name_ar varchar(240) NOT NULL,
  name_en varchar(240),
  definition_text text NOT NULL,
  domain_code varchar(60) NOT NULL,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  steward_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  parent_term_id uuid REFERENCES quality.data_catalog_terms(data_catalog_term_id) ON DELETE RESTRICT,
  synonyms jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(synonyms) = 'array'),
  status_code varchar(16) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT','ACTIVE','SUPERSEDED','RETIRED')),
  approved_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (owner_party_id <> steward_party_id),
  CHECK (status_code <> 'ACTIVE' OR (approved_by_party_id IS NOT NULL AND approved_at IS NOT NULL))
);

CREATE TABLE quality.data_catalog_fields (
  data_catalog_field_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_product_id uuid NOT NULL
    REFERENCES quality.data_products(data_product_id) ON DELETE RESTRICT,
  field_path varchar(240) NOT NULL,
  label_ar varchar(240) NOT NULL,
  data_type_code varchar(30) NOT NULL,
  business_term_id uuid
    REFERENCES quality.data_catalog_terms(data_catalog_term_id) ON DELETE RESTRICT,
  data_classification_id uuid
    REFERENCES governance.data_classifications(data_classification_id) ON DELETE RESTRICT,
  nullable_allowed boolean NOT NULL DEFAULT true,
  authoritative boolean NOT NULL DEFAULT false,
  description_text text NOT NULL,
  source_reference text NOT NULL,
  status_code varchar(16) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('DRAFT','ACTIVE','DEPRECATED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (data_product_id, field_path)
);

CREATE TABLE quality.data_lineage_nodes (
  data_lineage_node_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_code varchar(100) NOT NULL UNIQUE,
  node_type_code varchar(24) NOT NULL
    CHECK (node_type_code IN ('SOURCE','DATA_PRODUCT','FIELD','TRANSFORMATION','API','REPORT','SEARCH_INDEX','MATCHING_FEATURE','EXPORT')),
  data_product_id uuid REFERENCES quality.data_products(data_product_id) ON DELETE RESTRICT,
  data_catalog_field_id uuid REFERENCES quality.data_catalog_fields(data_catalog_field_id) ON DELETE RESTRICT,
  security_asset_id uuid REFERENCES governance.security_assets(security_asset_id) ON DELETE RESTRICT,
  name_ar varchar(240) NOT NULL,
  technical_reference text NOT NULL,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  status_code varchar(16) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('ACTIVE','DEGRADED','DEPRECATED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (num_nonnulls(data_product_id, data_catalog_field_id) <= 1)
);

CREATE TABLE quality.data_lineage_edges (
  data_lineage_edge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upstream_node_id uuid NOT NULL
    REFERENCES quality.data_lineage_nodes(data_lineage_node_id) ON DELETE RESTRICT,
  downstream_node_id uuid NOT NULL
    REFERENCES quality.data_lineage_nodes(data_lineage_node_id) ON DELETE RESTRICT,
  transformation_type_code varchar(24) NOT NULL
    CHECK (transformation_type_code IN ('COPY','FILTER','JOIN','AGGREGATE','DERIVE','MASK','TOKENIZE','ENRICH','SCORE','PUBLISH')),
  transformation_reference text NOT NULL,
  transformation_hash char(64) NOT NULL,
  data_contract_version varchar(40) NOT NULL,
  verified_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  verified_at timestamptz NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  valid_to timestamptz,
  UNIQUE (upstream_node_id, downstream_node_id, transformation_hash),
  CHECK (upstream_node_id <> downstream_node_id),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE quality.data_lineage_impact_assessments (
  data_lineage_impact_assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_code varchar(80) NOT NULL UNIQUE,
  changed_node_id uuid NOT NULL
    REFERENCES quality.data_lineage_nodes(data_lineage_node_id) ON DELETE RESTRICT,
  change_type_code varchar(24) NOT NULL
    CHECK (change_type_code IN ('SCHEMA_CHANGE','SEMANTIC_CHANGE','SOURCE_CHANGE','TRANSFORMATION_CHANGE','CLASSIFICATION_CHANGE','RETIREMENT')),
  affected_node_ids jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(affected_node_ids) = 'array'),
  search_impact_code varchar(16) NOT NULL
    CHECK (search_impact_code IN ('NONE','LOW','MEDIUM','HIGH','BLOCKING')),
  matching_impact_code varchar(16) NOT NULL
    CHECK (matching_impact_code IN ('NONE','LOW','MEDIUM','HIGH','BLOCKING')),
  privacy_impact_code varchar(16) NOT NULL
    CHECK (privacy_impact_code IN ('NONE','LOW','MEDIUM','HIGH','BLOCKING')),
  mitigation_plan text NOT NULL,
  assessed_by_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  assessed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_by_party_id uuid REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  status_code varchar(20) NOT NULL DEFAULT 'UNDER_REVIEW'
    CHECK (status_code IN ('UNDER_REVIEW','APPROVED','REJECTED','SUPERSEDED')),
  CHECK (approved_by_party_id IS NULL OR approved_by_party_id <> assessed_by_party_id),
  CHECK (status_code <> 'APPROVED' OR (approved_by_party_id IS NOT NULL AND approved_at IS NOT NULL))
);

CREATE VIEW quality.v_data_lineage_readiness AS
SELECT
  n.data_lineage_node_id,
  n.node_code,
  n.node_type_code,
  n.status_code,
  count(e.data_lineage_edge_id) FILTER (WHERE e.valid_to IS NULL) AS downstream_edge_count,
  CASE
    WHEN n.status_code <> 'ACTIVE' THEN 'NODE_NOT_ACTIVE'
    WHEN n.node_type_code NOT IN ('SOURCE','TRANSFORMATION') AND NOT EXISTS (
      SELECT 1 FROM quality.data_lineage_edges i
      WHERE i.downstream_node_id = n.data_lineage_node_id AND i.valid_to IS NULL
    ) THEN 'UPSTREAM_LINEAGE_REQUIRED'
    WHEN n.node_type_code IN ('REPORT','SEARCH_INDEX','MATCHING_FEATURE','EXPORT') AND NOT EXISTS (
      SELECT 1 FROM quality.data_lineage_impact_assessments a
      WHERE a.changed_node_id = n.data_lineage_node_id AND a.status_code = 'APPROVED'
    ) THEN 'IMPACT_ASSESSMENT_REQUIRED'
    ELSE 'TRACEABLE'
  END AS readiness_code
FROM quality.data_lineage_nodes n
LEFT JOIN quality.data_lineage_edges e ON e.upstream_node_id = n.data_lineage_node_id
GROUP BY n.data_lineage_node_id, n.node_code, n.node_type_code, n.status_code;

COMMIT;
