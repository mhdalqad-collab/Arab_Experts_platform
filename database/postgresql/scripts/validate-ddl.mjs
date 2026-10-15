import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationDir = resolve(root, "migrations");
const seedDir = resolve(root, "seeds");
const migrationFiles = readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const seedFiles = readdirSync(seedDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const failures = [];
const createdTables = new Set(["integration.schema_migrations"]);
const allSql = [];

function stripSql(sql) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/\$\$[\s\S]*?\$\$/g, "$$$$");
}

function checkBalancedParentheses(name, sql) {
  const stripped = stripSql(sql);
  let depth = 0;
  for (const character of stripped) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth < 0) {
      failures.push(`${name}: closing parenthesis without opener`);
      return;
    }
  }
  if (depth !== 0) failures.push(`${name}: unbalanced parentheses (${depth})`);
}

function checkNoSelectInsideCheck(name, sql) {
  const stripped = stripSql(sql);
  const pattern = /\bCHECK\s*\(/gi;
  for (const match of stripped.matchAll(pattern)) {
    const openingIndex = stripped.indexOf("(", match.index);
    let depth = 0;
    let closingIndex = -1;
    for (let index = openingIndex; index < stripped.length; index += 1) {
      if (stripped[index] === "(") depth += 1;
      if (stripped[index] === ")") depth -= 1;
      if (depth === 0) {
        closingIndex = index;
        break;
      }
    }
    const expression = stripped.slice(openingIndex + 1, closingIndex);
    if (/\bSELECT\b/i.test(expression)) {
      failures.push(`${name}: PostgreSQL does not allow SELECT inside CHECK constraints`);
    }
  }
}

for (const name of migrationFiles) {
  const sql = readFileSync(resolve(migrationDir, name), "utf8");
  allSql.push(sql);
  if (!/^\s*BEGIN\s*;/im.test(sql)) failures.push(`${name}: missing BEGIN`);
  if (!/COMMIT\s*;\s*$/i.test(sql)) failures.push(`${name}: missing final COMMIT`);
  checkNoSelectInsideCheck(name, sql);
  checkBalancedParentheses(name, sql);

  for (const match of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+([a-z_]+\.[a-z_]+)/gi)) {
    createdTables.add(match[1].toLowerCase());
  }
}

const combined = allSql.join("\n");
const requiredV6Tables = [
  "knowledge.research_projects",
  "knowledge.publications",
  "knowledge.events",
  "knowledge.knowledge_assets",
  "governance.roles",
  "governance.permissions",
  "governance.approval_requests",
  "governance.field_privacy_preferences",
  "governance.audit_events",
  "integration.external_systems",
  "integration.data_contracts",
  "integration.outbox_events",
  "professional.experience_records",
  "taxonomy.concept_status_history",
  "taxonomy.mapping_decisions",
  "contract.contract_amendments",
  "delivery.project_baselines",
  "delivery.acceptance_criteria",
  "delivery.progress_reports",
  "delivery.project_contributions",
  "rights.disclosure_records",
  "rights.information_use_restrictions",
  "finance.ledger_accounts",
  "finance.ledger_transactions",
  "finance.ledger_entries",
  "finance.revenue_shares",
  "quality.reputation_model_versions",
  "quality.corrective_actions",
  "governance.access_decisions",
  "governance.automated_decision_records",
  "core.party_match_keys",
  "core.party_duplicate_candidates",
  "core.party_merge_reviews",
  "core.party_merge_field_decisions",
  "core.party_merge_plans",
  "core.party_merge_events",
  "crm.client_identity_links",
  "crm.client_contact_roles",
  "crm.client_identity_resolution_runs",
  "integration.data_reconciliation_runs",
  "integration.data_reconciliation_metrics",
  "training.course_contents",
  "training.course_content_versions",
  "training.course_content_version_names",
  "training.course_offering_content_links",
  "training.course_content_fingerprints",
  "training.course_content_duplicate_candidates",
  "contract.contract_records",
  "rights.intellectual_assets",
  "quality.evaluations",
  "quality.complaint_cases",
  "quality.reputation_profiles",
  "delivery.service_cases",
  "delivery.service_case_links",
  "delivery.service_case_stage_events",
  "delivery.service_case_gates",
  "delivery.service_case_exceptions",
  "delivery.service_case_workflow_versions",
  "delivery.service_case_transition_rules",
  "delivery.service_case_transition_roles",
  "delivery.service_case_transition_gate_requirements",
  "delivery.service_case_command_receipts",
  "delivery.service_case_transition_attempts",
  "delivery.service_case_transition_approvals",
  "delivery.service_case_transition_outbox_links",
  "integration.outbox_dispatch_leases",
  "delivery.service_workflow_readiness_assessments",
  "delivery.service_workflow_rollout_plans",
  "delivery.service_workflow_rollout_windows",
  "delivery.service_workflow_rollout_events",
  "delivery.service_workflow_rollout_recommendations",
  "delivery.workflow_operations_command_receipts",
  "delivery.workflow_operations_approval_links",
  "delivery.workflow_operations_incidents",
  "delivery.workflow_operations_incident_events",
  "delivery.workflow_incident_root_cause_analyses",
  "delivery.workflow_incident_corrective_actions",
  "delivery.workflow_incident_lessons",
  "delivery.workflow_reliability_objectives",
  "delivery.workflow_reliability_measurements",
  "delivery.workflow_reliability_budget_events",
  "delivery.platform_change_requests",
  "delivery.platform_releases",
  "delivery.platform_release_changes",
  "delivery.platform_deployments",
  "delivery.platform_continuity_plans",
  "delivery.platform_backup_runs",
  "delivery.platform_recovery_exercises",
  "delivery.platform_capacity_plans",
  "delivery.platform_capacity_metrics",
  "delivery.platform_load_tests",
  "delivery.platform_scaling_policies",
  "finance.platform_cost_centers",
  "finance.platform_cost_budgets",
  "finance.platform_cost_observations",
  "finance.platform_unit_economics",
  "integration.platform_vendors",
  "integration.platform_vendor_dependencies",
  "integration.platform_vendor_slas",
  "integration.platform_vendor_assessments",
  "governance.data_retention_targets",
  "governance.data_disposition_assessments",
  "governance.data_disposition_batches",
  "governance.data_disposition_items",
  "governance.compliance_frameworks",
  "governance.compliance_obligations",
  "governance.compliance_controls",
  "governance.compliance_control_mappings",
  "governance.compliance_control_tests",
  "governance.enterprise_risks",
  "governance.enterprise_risk_assessments",
  "governance.enterprise_risk_control_links",
  "governance.enterprise_risk_treatment_plans",
  "governance.enterprise_risk_indicators",
  "governance.security_assets",
  "governance.security_asset_dependencies",
  "governance.security_vulnerabilities",
  "governance.security_remediation_plans",
  "governance.security_verification_runs",
  "governance.privileged_access_requests",
  "governance.privileged_access_grants",
  "governance.privileged_access_sessions",
  "governance.privileged_access_session_events",
  "governance.privileged_access_attestations",
  "governance.security_secret_policies",
  "governance.security_secret_records",
  "governance.security_secret_bindings",
  "governance.security_secret_rotation_events",
  "governance.security_certificate_inventory",
  "quality.data_products",
  "quality.data_quality_rules",
  "quality.data_quality_runs",
  "quality.data_quality_results",
  "quality.data_quality_issues",
  "quality.data_catalog_terms",
  "quality.data_catalog_fields",
  "quality.data_lineage_nodes",
  "quality.data_lineage_edges",
  "quality.data_lineage_impact_assessments",
  "governance.ai_systems",
  "governance.ai_model_versions",
  "governance.ai_model_evaluations",
  "governance.ai_model_monitoring_observations",
  "governance.ai_governance_decisions",
  "governance.ai_decision_explanations",
  "governance.ai_decision_notices",
  "governance.ai_human_override_records",
  "governance.ai_decision_contests",
  "governance.ai_decision_incidents",
  "analytics.metric_definitions",
  "analytics.metric_definition_versions",
  "analytics.metric_dimensions",
  "analytics.metric_observations",
  "analytics.report_definitions",
  "analytics.report_runs",
  "communication.notification_topics",
  "communication.notification_preferences",
  "communication.message_templates",
  "communication.outbound_messages",
  "communication.delivery_attempts",
  "communication.contact_suppressions",
  "localization.locales",
  "localization.resource_keys",
  "localization.translation_versions",
  "localization.content_localizations",
  "localization.accessibility_requirements",
  "localization.accessibility_assessments",
  "governance.configuration_definitions",
  "governance.configuration_versions",
  "governance.feature_flags",
  "governance.feature_flag_rules",
  "governance.controlled_experiments",
  "governance.experiment_assignments",
  "integration.api_products",
  "integration.api_product_versions",
  "integration.api_subscriptions",
  "integration.api_quota_policies",
  "integration.api_usage_windows",
  "integration.api_deprecation_notices",
];

for (const table of requiredV6Tables) {
  if (!createdTables.has(table)) failures.push(`Missing required V6 table: ${table}`);
}

for (const match of combined.matchAll(/REFERENCES\s+([a-z_]+\.[a-z_]+)\s*\(/gi)) {
  const referenced = match[1].toLowerCase();
  if (!createdTables.has(referenced)) {
    failures.push(`Unresolved referenced table: ${referenced}`);
  }
}

for (const name of seedFiles) {
  const sql = readFileSync(resolve(seedDir, name), "utf8");
  checkBalancedParentheses(name, sql);
  if (!/^\s*(?:--.*\n)*BEGIN\s*;/im.test(sql)) failures.push(`${name}: missing BEGIN`);
  if (!/COMMIT\s*;\s*$/i.test(sql)) failures.push(`${name}: missing final COMMIT`);
}

const countrySeed = readFileSync(resolve(seedDir, "000_countries_seed.sql"), "utf8");
const countryRows = [...countrySeed.matchAll(/^\s*\('[A-Z]{2}',/gm)].length;
if (countryRows !== 249) {
  failures.push(`Expected 249 ISO country rows, found ${countryRows}`);
}

const requiredMemberships = [
  "EXPERT",
  "TRAINER",
  "CONSULTANT",
  "RESEARCHER_ACADEMIC",
  "TRAINING_CENTER",
  "CLIENT",
  "PLATFORM_STAFF",
];
const referenceSeed = readFileSync(resolve(seedDir, "001_reference_seed.sql"), "utf8");
for (const code of requiredMemberships) {
  if (!referenceSeed.includes(`('${code}'`)) {
    failures.push(`Missing membership seed: ${code}`);
  }
}

if (failures.length) {
  console.error("DDL validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `DDL structure valid: ${migrationFiles.length} migrations, ` +
    `${seedFiles.length} seeds, ${createdTables.size} tables, ${countryRows} countries.`,
);
