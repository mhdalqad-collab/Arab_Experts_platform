BEGIN;

CREATE TABLE finance.contracts (
  contract_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number varchar(50) NOT NULL UNIQUE,
  engagement_id uuid REFERENCES delivery.engagements(engagement_id) ON DELETE RESTRICT,
  service_request_id uuid REFERENCES needs.service_requests(service_request_id) ON DELETE RESTRICT,
  contract_type_code varchar(50) NOT NULL,
  title_ar varchar(320) NOT NULL,
  title_en varchar(320),
  governing_country_code char(2) REFERENCES reference.countries(country_code),
  governing_law_text text,
  start_date date,
  end_date date,
  total_value numeric(18,3) CHECK (total_value IS NULL OR total_value >= 0),
  currency_code char(3) REFERENCES reference.currencies(currency_code),
  confidentiality_level_code varchar(50) NOT NULL
    REFERENCES reference.confidentiality_levels(confidentiality_level_code),
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'NEGOTIATION', 'INTERNAL_REVIEW', 'AWAITING_SIGNATURES',
      'SIGNED', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'TERMINATED',
      'EXPIRED', 'VOID'
    )),
  current_version_no integer NOT NULL DEFAULT 1 CHECK (current_version_no > 0),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  activated_at timestamptz,
  terminated_at timestamptz,
  termination_reason text,
  CONSTRAINT ck_contract_period CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT ck_contract_value_currency CHECK (total_value IS NULL OR currency_code IS NOT NULL),
  CONSTRAINT ck_contract_source CHECK (engagement_id IS NOT NULL OR service_request_id IS NOT NULL)
);

CREATE UNIQUE INDEX uq_contract_engagement
  ON finance.contracts(engagement_id) WHERE engagement_id IS NOT NULL;

CREATE TABLE finance.contract_parties (
  contract_party_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES finance.contracts(contract_id) ON DELETE RESTRICT,
  party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  party_role_code varchar(40) NOT NULL,
  represented_organization_id uuid REFERENCES core.organizations(party_id),
  authorized_representative_party_id uuid REFERENCES core.persons(party_id),
  signature_required boolean NOT NULL DEFAULT true,
  liability_percentage numeric(5,2)
    CHECK (liability_percentage IS NULL OR liability_percentage BETWEEN 0 AND 100),
  payment_recipient boolean NOT NULL DEFAULT false,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  CONSTRAINT ck_contract_party_period CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (contract_id, party_id, party_role_code, effective_from),
  UNIQUE (contract_party_id, contract_id)
);

CREATE TABLE finance.contract_versions (
  contract_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES finance.contracts(contract_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  version_status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (version_status_code IN ('DRAFT', 'REVIEW', 'APPROVED', 'SIGNING', 'SIGNED', 'SUPERSEDED', 'VOID')),
  effective_date date,
  change_summary text,
  document_file_id uuid REFERENCES core.files(file_id) ON DELETE RESTRICT,
  content_hash char(64),
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_at timestamptz,
  UNIQUE (contract_id, version_no),
  UNIQUE (contract_version_id, contract_id)
);

CREATE TABLE finance.contract_clauses (
  contract_clause_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_version_id uuid NOT NULL
    REFERENCES finance.contract_versions(contract_version_id) ON DELETE CASCADE,
  clause_code varchar(60) NOT NULL,
  clause_type_code varchar(50) NOT NULL,
  title_ar varchar(260) NOT NULL,
  content_ar text NOT NULL,
  content_en text,
  is_mandatory boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL CHECK (display_order > 0),
  UNIQUE (contract_version_id, clause_code),
  UNIQUE (contract_version_id, display_order)
);

CREATE TABLE finance.contract_signatures (
  contract_signature_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES finance.contracts(contract_id) ON DELETE RESTRICT,
  contract_version_id uuid NOT NULL,
  contract_party_id uuid NOT NULL,
  signer_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  signature_method_code varchar(40) NOT NULL,
  signature_status_code varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (signature_status_code IN ('PENDING', 'SIGNED', 'DECLINED', 'EXPIRED', 'REVOKED')),
  signed_at timestamptz,
  verification_reference text,
  ip_address inet,
  document_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (contract_version_id, contract_id)
    REFERENCES finance.contract_versions(contract_version_id, contract_id) ON DELETE RESTRICT,
  FOREIGN KEY (contract_party_id, contract_id)
    REFERENCES finance.contract_parties(contract_party_id, contract_id) ON DELETE RESTRICT,
  UNIQUE (contract_version_id, contract_party_id)
);

CREATE TABLE finance.contract_status_history (
  contract_status_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES finance.contracts(contract_id) ON DELETE RESTRICT,
  from_status_code varchar(30),
  to_status_code varchar(30) NOT NULL,
  reason_code varchar(50),
  comment text,
  changed_by_party_id uuid REFERENCES core.parties(party_id),
  is_automatic boolean NOT NULL DEFAULT false,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE finance.ip_assets (
  ip_asset_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code varchar(60) NOT NULL UNIQUE,
  asset_type_code varchar(50) NOT NULL,
  title_ar varchar(320) NOT NULL,
  title_en varchar(320),
  description_ar text,
  source_entity_type varchar(80),
  source_entity_id uuid,
  creation_date date,
  registration_number varchar(140),
  registration_country_code char(2) REFERENCES reference.countries(country_code),
  protection_status_code varchar(30) NOT NULL DEFAULT 'UNREGISTERED',
  confidentiality_level_code varchar(50) NOT NULL
    REFERENCES reference.confidentiality_levels(confidentiality_level_code),
  current_version_no integer NOT NULL DEFAULT 1 CHECK (current_version_no > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE finance.ip_asset_versions (
  ip_asset_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_asset_id uuid NOT NULL REFERENCES finance.ip_assets(ip_asset_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  description_ar text,
  file_id uuid REFERENCES core.files(file_id),
  content_hash char(64),
  change_summary text,
  created_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (ip_asset_id, version_no)
);

CREATE TABLE finance.ip_owners (
  ip_owner_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_asset_id uuid NOT NULL REFERENCES finance.ip_assets(ip_asset_id) ON DELETE RESTRICT,
  owner_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  ownership_type_code varchar(40) NOT NULL,
  ownership_percentage numeric(5,2) NOT NULL
    CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  basis_document_file_id uuid REFERENCES core.files(file_id),
  CONSTRAINT ck_ip_owner_period CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (ip_asset_id, owner_party_id, effective_from)
);

CREATE TABLE finance.ip_contributors (
  ip_contributor_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_asset_id uuid NOT NULL REFERENCES finance.ip_assets(ip_asset_id) ON DELETE CASCADE,
  contributor_party_id uuid NOT NULL REFERENCES core.persons(party_id) ON DELETE RESTRICT,
  contribution_role_code varchar(50) NOT NULL,
  contribution_description_ar text,
  contribution_percentage numeric(5,2)
    CHECK (contribution_percentage IS NULL OR contribution_percentage BETWEEN 0 AND 100),
  is_acknowledged boolean NOT NULL DEFAULT false,
  UNIQUE (ip_asset_id, contributor_party_id, contribution_role_code)
);

CREATE TABLE finance.ip_licenses (
  ip_license_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_asset_id uuid NOT NULL REFERENCES finance.ip_assets(ip_asset_id) ON DELETE RESTRICT,
  contract_id uuid REFERENCES finance.contracts(contract_id) ON DELETE RESTRICT,
  licensor_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  licensee_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  license_type_code varchar(30) NOT NULL
    CHECK (license_type_code IN ('EXCLUSIVE', 'NON_EXCLUSIVE', 'LIMITED', 'OPEN')),
  territory_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_scope_ar text NOT NULL,
  commercial_use_allowed boolean NOT NULL DEFAULT false,
  sublicensing_allowed boolean NOT NULL DEFAULT false,
  valid_from date NOT NULL,
  valid_to date,
  fee_amount numeric(18,3) CHECK (fee_amount IS NULL OR fee_amount >= 0),
  currency_code char(3) REFERENCES reference.currencies(currency_code),
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED')),
  CONSTRAINT ck_ip_license_parties CHECK (licensor_party_id <> licensee_party_id),
  CONSTRAINT ck_ip_license_period CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT ck_ip_license_fee_currency CHECK (fee_amount IS NULL OR currency_code IS NOT NULL)
);

CREATE TABLE finance.confidentiality_agreements (
  confidentiality_agreement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES finance.contracts(contract_id) ON DELETE RESTRICT,
  disclosing_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  receiving_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  confidentiality_scope_ar text NOT NULL,
  permitted_purpose_ar text NOT NULL,
  valid_from date NOT NULL,
  valid_to date,
  survival_end_date date,
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED')),
  document_file_id uuid REFERENCES core.files(file_id),
  CONSTRAINT ck_confidentiality_parties CHECK (disclosing_party_id <> receiving_party_id),
  CONSTRAINT ck_confidentiality_period CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT ck_confidentiality_survival
    CHECK (survival_end_date IS NULL OR valid_to IS NULL OR survival_end_date >= valid_to)
);

CREATE INDEX idx_contracts_status_dates
  ON finance.contracts(status_code, start_date, end_date);
CREATE INDEX idx_contract_parties_party
  ON finance.contract_parties(party_id, effective_from DESC);
CREATE INDEX idx_contract_signatures_pending
  ON finance.contract_signatures(signature_status_code, created_at)
  WHERE signature_status_code = 'PENDING';
CREATE INDEX idx_ip_assets_source
  ON finance.ip_assets(source_entity_type, source_entity_id);
CREATE INDEX idx_ip_owners_party
  ON finance.ip_owners(owner_party_id, effective_from DESC);
CREATE INDEX idx_ip_licenses_parties
  ON finance.ip_licenses(licensor_party_id, licensee_party_id, status_code);

CREATE TRIGGER trg_contracts_updated_at
BEFORE UPDATE ON finance.contracts
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_contracts_controlled_status
BEFORE UPDATE OF status_code ON finance.contracts
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_ip_assets_updated_at
BEFORE UPDATE ON finance.ip_assets
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0140_contracts_ip')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
