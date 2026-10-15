import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const app = path.join(root, "public", "eim");
const manifest = JSON.parse(
  fs.readFileSync(path.join(app, "module-manifest.json"), "utf8"),
);

test("EIM entry point loads one generated runtime bundle", () => {
  const html = fs.readFileSync(path.join(app, manifest.entry), "utf8");

  for (const file of manifest.javascript) {
    const token = `./js/${file}`;
    const position = html.indexOf(token);
    assert.ok(position >= 0, `${file} is missing`);
    assert.equal(html.indexOf(token, position + token.length), -1, `${file} is duplicated`);
  }
  for (const file of manifest.sourceModules) {
    assert.equal(html.includes(`./js/${file}`), false, `${file} must remain a source module`);
  }
});

test("large reference datasets are isolated from workflow modules", () => {
  const sizes = Object.fromEntries(
    manifest.sourceModules.map((file) => [
      file,
      fs.statSync(path.join(app, "js", file)).size,
    ]),
  );

  assert.ok(sizes["04-training-catalog.js"] > 500_000);
  assert.ok(sizes["01-professional-taxonomy.js"] > 50_000);
  assert.ok(sizes["10-state-core.js"] < 50_000);
  assert.ok(sizes["20-router-navigation.js"] < 20_000);
});

test("stable monolith remains available as a read-only compatibility reference", () => {
  assert.ok(
    fs.existsSync(path.join(app, "reference", "EIM_5.15.0_stable.html")),
  );
});

test("the application is not embedded in an iframe", () => {
  const page = fs.readFileSync(path.join(root, "app", "page.tsx"), "utf8");
  assert.doesNotMatch(page, /<iframe\b/i);
  assert.match(page, /redirect\(["']\/eim\/index\.html["']\)/);
});

test("boot cannot leave the navigation empty on a route-less URL or failed migration", () => {
  const runtime = fs.readFileSync(path.join(app, "js", manifest.javascript[1]), "utf8");
  assert.match(runtime, /history\.replaceState\(null,'','#\/'\+current\)/);
  assert.match(runtime, /function safeBootTask\(/);
  assert.match(runtime, /render\(\);\s*safeBootTask\('unified-registry'/);
});

test("browser runtime filename is content-versioned to prevent stale caches", () => {
  assert.match(manifest.javascript[1], /^app\.bundle\.[a-f0-9]{12}\.js$/);
  assert.match(manifest.runtimeCss, /^app\.styles\.[a-f0-9]{12}\.css$/);
});

test("PostgreSQL service-case runtime completes approvals and leases outbox work", () => {
  const migration = fs.readFileSync(
    path.join(
      root,
      "database",
      "postgresql",
      "migrations",
      "0270_v79_approval_resume_outbox_dispatch.sql",
    ),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE integration\.outbox_dispatch_leases/);
  assert.match(migration, /FOR UPDATE SKIP LOCKED/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION integration\.claim_outbox_events/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION integration\.complete_outbox_dispatch/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION delivery\.resume_approved_service_case_transition/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION governance\.decide_service_case_transition_approval/);
  assert.match(migration, /PLATFORM_OPERATOR/);
  assert.match(migration, /Separation|separation|فصل المهام|requested_by_party_id/);
  assert.match(migration, /SERVICE_CASE_TRANSITION_APPROVED_AND_EXECUTED/);
  assert.match(migration, /DEAD_LETTER/);
});

test("PostgreSQL enforcement readiness is measured but never self-activated", () => {
  const migration = fs.readFileSync(
    path.join(
      root,
      "database",
      "postgresql",
      "migrations",
      "0280_v80_workflow_enforcement_readiness.sql",
    ),
    "utf8",
  );
  const runner = fs.readFileSync(
    path.join(
      root,
      "database",
      "postgresql",
      "scripts",
      "run-integration-tests.sh",
    ),
    "utf8",
  );
  const concurrency = fs.readFileSync(
    path.join(
      root,
      "database",
      "postgresql",
      "tests",
      "003_outbox_concurrency.sh",
    ),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE delivery\.service_workflow_readiness_assessments/);
  assert.match(migration, /READY_FOR_REVIEW/);
  assert.match(migration, /INSUFFICIENT_DATA/);
  assert.doesNotMatch(migration, /SET\s+enforcement_mode_code\s*=\s*'ENFORCING'/i);
  assert.match(runner, /ON_ERROR_STOP=1/);
  assert.match(runner, /migrations\/\*\.sql/);
  assert.match(concurrency, /claim_outbox_events/);
  assert.match(concurrency, /claimed_total/);
});

test("PostgreSQL enforcement rollout is approved, canaried, and emergency-stoppable", () => {
  const migration = fs.readFileSync(
    path.join(
      root,
      "database",
      "postgresql",
      "migrations",
      "0290_v81_workflow_rollout_control.sql",
    ),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE delivery\.service_workflow_rollout_plans/);
  assert.match(migration, /CREATE TABLE delivery\.service_workflow_rollout_windows/);
  assert.match(migration, /CREATE TABLE delivery\.service_workflow_rollout_events/);
  assert.match(migration, /minimum_approvals, expires_at/);
  assert.match(migration, /'CRITICAL', 2/);
  assert.match(migration, /READY_FOR_REVIEW_ASSESSMENT_REQUIRED/);
  assert.match(migration, /START_CANARY/);
  assert.match(migration, /PASSED_CANARY_WINDOW_REQUIRED/);
  assert.match(migration, /KILL_SWITCH_TRIGGERED/);
  assert.match(migration, /resolve_service_case_enforcement_mode/);
  assert.match(migration, /executor_integration', 'NOT_YET_ENABLED/);
  assert.doesNotMatch(migration, /UPDATE\s+delivery\.service_case_workflow_versions[\s\S]{0,200}ENFORCING/i);
});

test("PostgreSQL command executor applies canary policy with a V78 rollback path", () => {
  const migration = fs.readFileSync(
    path.join(
      root,
      "database",
      "postgresql",
      "migrations",
      "0300_v82_rollout_aware_command_executor.sql",
    ),
    "utf8",
  );
  const rollback = fs.readFileSync(
    path.join(
      root,
      "database",
      "postgresql",
      "rollback",
      "0300_v82_rollout_aware_command_executor.rollback.sql",
    ),
    "utf8",
  );
  assert.match(migration, /RENAME TO execute_service_case_command_v78/);
  assert.match(migration, /v_effective_enforcement_mode/);
  assert.match(migration, /resolve_service_case_enforcement_mode/);
  assert.match(migration, /ELSIF v_effective_enforcement_mode = 'MONITOR_ONLY'/);
  assert.match(migration, /CREATE VIEW delivery\.v_service_case_enforcement_operations/);
  assert.match(rollback, /DROP FUNCTION IF EXISTS delivery\.execute_service_case_command/);
  assert.match(rollback, /RENAME TO execute_service_case_command/);
});

test("PostgreSQL Canary evaluator recommends promotion but automates only safety pause", () => {
  const migration = fs.readFileSync(
    path.join(
      root,
      "database",
      "postgresql",
      "migrations",
      "0310_v83_canary_metrics_recommendations.sql",
    ),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE delivery\.service_workflow_rollout_recommendations/);
  assert.match(migration, /percentile_cont\(0\.95\)/);
  assert.match(migration, /CONTINUE_MONITORING/);
  assert.match(migration, /PROMOTE_REVIEW/);
  assert.match(migration, /ROLLBACK_REVIEW/);
  assert.match(migration, /safety_pause_applied/);
  assert.match(migration, /emergency_stop_active = true/);
  assert.match(migration, /current_percentage = 0/);
  assert.match(migration, /'is_binding', false/);
  assert.doesNotMatch(
    migration,
    /SET[\s\S]{0,100}rollout_status_code\s*=\s*'FULL_ACTIVE'/i,
  );
});

test("workflow operations console is admin-gated and never fabricates live PostgreSQL metrics", () => {
  const api = fs.readFileSync(
    path.join(root, "app", "api", "workflow-operations", "route.ts"),
    "utf8",
  );
  const page = fs.readFileSync(
    path.join(root, "app", "operations", "workflow", "workflow-operations.tsx"),
    "utf8",
  );
  assert.match(api, /PLATFORM_ADMIN_REQUIRED/);
  assert.match(api, /POSTGRES_OPERATIONS_API_URL/);
  assert.match(api, /status: "NOT_CONFIGURED"/);
  assert.match(api, /actions: false/);
  assert.match(page, /لا تستخدم اللوحة أرقامًا تجريبية/);
  assert.match(page, /مراجعة الترقية/);
  assert.match(page, /تفعيل الإيقاف الطارئ/);
  assert.match(page, /disabled=\{!actionsReady\}/);
  assert.match(page, /جاهزية الإنفاذ/);
});

test("public home avoids placeholder statistics and preserves CTA order", () => {
  const home = fs.readFileSync(path.join(app, "js", "90-directories-public.js"), "utf8");
  assert.doesNotMatch(home, /7777\+|777\+|77\+/);
  assert.ok(home.indexOf("انضم إلى الشبكة") < home.indexOf("تصفح دليل الخبراء"));
  assert.match(home, /49','تخصصًا تطبيقيًا/);
});

test("design quality layer provides accessible navigation landmarks", () => {
  const html = fs.readFileSync(path.join(app, "index.html"), "utf8");
  assert.match(html, /class="skip-link"/);
  assert.match(html, /<main class="view" id="main-content" tabindex="-1">/);
  assert.match(html, /id="toast" role="status" aria-live="polite"/);
  assert.ok(manifest.css.includes("design-quality.v1.css"));
  assert.match(html, /design-quality\.v1\.js/);
});

test("public entry separates login from new account registration", () => {
  const shell = fs.readFileSync(path.join(app, "js", "120-render-bootstrap.js"), "utf8");
  const login = fs.readFileSync(path.join(app, "js", "40-dashboards-search.js"), "utf8");
  const account = fs.readFileSync(
    path.join(root, "app", "account", "account-setup.tsx"),
    "utf8",
  );
  assert.match(shell, /\[65,'الدخول والتسجيل'\]/);
  assert.match(shell, /65:rEntry/);
  assert.match(shell, /67:rRegister/);
  assert.match(login, /location\.href='\/account'/);
  assert.match(login, /الدخول الآمن أو فتح حساب/);
  assert.match(account, /يمكنك اختيار أكثر من عضوية/);
  assert.match(account, /يتطلب تعيينًا إداريًا/);
  assert.match(account, /localStorage\.setItem\("eim5"/);
});

test("membership forms persist drafts and revisions through the account API", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(app, "module-manifest.json"), "utf8"),
  );
  const sync = fs.readFileSync(
    path.join(app, "js", "15-membership-server-sync.js"),
    "utf8",
  );
  const api = fs.readFileSync(
    path.join(root, "app", "api", "membership-profiles", "route.ts"),
    "utf8",
  );
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  assert.ok(manifest.sourceModules.includes("15-membership-server-sync.js"));
  assert.match(sync, /membershipServerRestore/);
  assert.match(sync, /queueMembershipServerSync/);
  assert.match(sync, /\/api\/membership-profiles/);
  assert.match(api, /membership_profile_versions/);
  assert.match(api, /MEMBERSHIP_PROFILE_SAVED/);
  assert.match(schema, /membershipProfiles/);
  assert.match(schema, /membershipProfileVersions/);
});

test("membership review lifecycle is server-authorized and fully audited", () => {
  const api = fs.readFileSync(
    path.join(root, "app", "api", "membership-lifecycle", "route.ts"),
    "utf8",
  );
  const review = fs.readFileSync(
    path.join(root, "app", "reviews", "review-queue.tsx"),
    "utf8",
  );
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  assert.match(api, /REVIEWER_ROLE_REQUIRED/);
  assert.match(api, /REQUEST_CHANGES/);
  assert.match(api, /REASON_REQUIRED/);
  assert.match(api, /membership_transitions/);
  assert.match(api, /request_id/);
  assert.match(review, /بدء المراجعة/);
  assert.match(review, /طلب استكمال/);
  assert.match(schema, /accountRoles/);
  assert.match(schema, /membershipReviews/);
  assert.match(schema, /membershipTransitions/);
});

test("account center exposes membership status, review history, and durable notifications", () => {
  const dashboardApi = fs.readFileSync(
    path.join(root, "app", "api", "account-dashboard", "route.ts"),
    "utf8",
  );
  const lifecycleApi = fs.readFileSync(
    path.join(root, "app", "api", "membership-lifecycle", "route.ts"),
    "utf8",
  );
  const account = fs.readFileSync(
    path.join(root, "app", "account", "account-setup.tsx"),
    "utf8",
  );
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");

  assert.match(dashboardApi, /account_notifications/);
  assert.match(dashboardApi, /unreadCount/);
  assert.match(dashboardApi, /export async function PATCH/);
  assert.match(lifecycleApi, /INSERT INTO account_notifications/);
  assert.match(account, /عضوياتي وحالاتها/);
  assert.match(account, /\/api\/account-dashboard/);
  assert.match(account, /markNotificationsRead/);
  assert.match(schema, /accountNotifications/);
});

test("unified party registry separates login accounts from people, organizations, and memberships", () => {
  const partyApi = fs.readFileSync(
    path.join(root, "app", "api", "party-profile", "route.ts"),
    "utf8",
  );
  const account = fs.readFileSync(
    path.join(root, "app", "account", "account-setup.tsx"),
    "utf8",
  );
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  assert.match(schema, /export const parties/);
  assert.match(schema, /export const persons/);
  assert.match(schema, /export const organizations/);
  assert.match(schema, /export const accountPartyLinks/);
  assert.match(schema, /export const partyMembershipLinks/);
  assert.match(schema, /export const partyPrivacyRules/);
  assert.match(partyApi, /PARTY_TYPE_IMMUTABLE/);
  assert.match(partyApi, /party_membership_links/);
  assert.match(partyApi, /PARTY_PROFILE_SAVED/);
  assert.match(account, /السجل الموحد للهوية/);
  assert.match(account, /الحساب وسيلة الدخول/);
  assert.match(account, /\/api\/party-profile/);
  assert.match(account, /ظهور: \{label\}/);
});

test("organization access is invitation-based, role-governed, and protects the last owner", () => {
  const accessApi = fs.readFileSync(
    path.join(root, "app", "api", "organization-access", "route.ts"),
    "utf8",
  );
  const account = fs.readFileSync(
    path.join(root, "app", "account", "account-setup.tsx"),
    "utf8",
  );
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  assert.match(schema, /export const organizationInvitations/);
  assert.match(accessApi, /CREATE_INVITATION/);
  assert.match(accessApi, /ACCEPT_INVITATION/);
  assert.match(accessApi, /INVITATION_EMAIL_MISMATCH/);
  assert.match(accessApi, /ORGANIZATION_ADMIN_REQUIRED/);
  assert.match(accessApi, /ORGANIZATION_OWNER_REQUIRED/);
  assert.match(accessApi, /LAST_OWNER_PROTECTED/);
  assert.match(accessApi, /ORGANIZATION_INVITATION_CREATED/);
  assert.match(account, /الممثلون والصلاحيات/);
  assert.match(account, /إنشاء دعوة/);
  assert.match(account, /قبول الدعوة/);
});

test("one account can switch between independently owned party membership profiles", () => {
  const partyApi = fs.readFileSync(
    path.join(root, "app", "api", "party-profile", "route.ts"),
    "utf8",
  );
  const profileApi = fs.readFileSync(
    path.join(root, "app", "api", "membership-profiles", "route.ts"),
    "utf8",
  );
  const sync = fs.readFileSync(
    path.join(app, "js", "15-membership-server-sync.js"),
    "utf8",
  );
  const account = fs.readFileSync(
    path.join(root, "app", "account", "account-setup.tsx"),
    "utf8",
  );
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  assert.match(schema, /export const partyMemberships/);
  assert.match(schema, /membership_profiles_party_code_uq/);
  assert.match(partyApi, /ACTIVE_PARTY_CHANGED/);
  assert.match(partyApi, /PARTY_ACCESS_REQUIRED/);
  assert.match(profileApi, /primaryPartyForAccount/);
  assert.match(profileApi, /ON CONFLICT\(party_id, membership_code\)/);
  assert.match(profileApi, /activePartyId/);
  assert.match(sync, /partySwitchPending/);
  assert.match(account, /السجلات التي تديرها/);
  assert.match(account, /إضافة فرد/);
  assert.match(account, /إضافة منظمة/);
});

test("professional evidence uses private object storage, metadata, deduplication, and verification", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, ".openai", "hosting.json"), "utf8"),
  );
  const documentsApi = fs.readFileSync(
    path.join(root, "app", "api", "documents", "route.ts"),
    "utf8",
  );
  const downloadApi = fs.readFileSync(
    path.join(root, "app", "api", "documents", "[id]", "route.ts"),
    "utf8",
  );
  const verificationApi = fs.readFileSync(
    path.join(root, "app", "api", "document-verifications", "route.ts"),
    "utf8",
  );
  const account = fs.readFileSync(
    path.join(root, "app", "account", "account-setup.tsx"),
    "utf8",
  );
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  assert.equal(manifest.r2, "BUCKET");
  assert.match(schema, /export const professionalDocuments/);
  assert.match(schema, /export const professionalDocumentVersions/);
  assert.match(schema, /export const documentVerifications/);
  assert.match(documentsApi, /maxFileSize = 10 \* 1024 \* 1024/);
  assert.match(documentsApi, /DUPLICATE_DOCUMENT/);
  assert.match(documentsApi, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(documentsApi, /SUBMIT_VERIFICATION/);
  assert.match(documentsApi, /UPDATE_CONFIDENTIALITY/);
  assert.match(downloadApi, /account_party_links/);
  assert.match(downloadApi, /EVIDENCE_REVIEWER/);
  assert.match(downloadApi, /X-Content-Type-Options/);
  assert.match(verificationApi, /EVIDENCE_REVIEWER_REQUIRED/);
  assert.match(verificationApi, /CONFIDENCE_SCORE_REQUIRED/);
  assert.match(verificationApi, /DOCUMENT_VERIFICATION_DECIDED/);
  assert.match(account, /مستودع الأدلة الآمن/);
  assert.match(account, /multiple/);
  assert.match(account, /رفع وحفظ الملفات/);
});

test("public profile projects only approved and verified public evidence", () => {
  const route = fs.readFileSync(
    path.join(root, "app", "api", "public-profiles", "[partyId]", "route.ts"),
    "utf8",
  );
  const page = fs.readFileSync(
    path.join(root, "app", "public-profile", "[partyId]", "public-profile-client.tsx"),
    "utf8",
  );
  assert.match(route, /d\.confidentiality = 'PUBLIC'/);
  assert.match(route, /d\.verification_status = 'VERIFIED'/);
  assert.match(route, /approvedStates/);
  assert.doesNotMatch(route, /storage_object_key/);
  assert.doesNotMatch(route, /original_file_name/);
  assert.match(page, /لا تُعرض الملفات الأصلية للعامة/);
  assert.match(page, /درجة اليقين/);
});

test("client needs, fingerprints, and service requests persist with versions and audit", () => {
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  const api = fs.readFileSync(
    path.join(root, "app", "api", "client-workspace", "route.ts"),
    "utf8",
  );
  const sync = fs.readFileSync(
    path.join(app, "js", "16-client-workspace-server-sync.js"),
    "utf8",
  );
  assert.match(schema, /export const clientNeeds/);
  assert.match(schema, /export const clientNeedVersions/);
  assert.match(schema, /export const serviceRequests/);
  assert.match(schema, /export const serviceRequestTransitions/);
  assert.match(schema, /service_requests_need_candidate_active_uq/);
  assert.match(api, /PAYLOAD_TOO_LARGE/);
  assert.match(api, /CLIENT_WORKSPACE_SYNCED/);
  assert.match(api, /INSERT OR IGNORE INTO service_request_transitions/);
  assert.match(sync, /needFingerprints/);
  assert.match(sync, /clientWorkspaceServerRestore/);
});

test("weighted matching runs are server-recalculated, ranked, and decision-audited", () => {
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  const api = fs.readFileSync(
    path.join(root, "app", "api", "matching-runs", "route.ts"),
    "utf8",
  );
  const client = fs.readFileSync(
    path.join(app, "js", "70-client-workflows.js"),
    "utf8",
  );
  assert.match(schema, /export const matchingRuns/);
  assert.match(schema, /export const matchingResults/);
  assert.match(schema, /export const selectionDecisions/);
  assert.match(api, /weightTotal !== 100/);
  assert.match(api, /MATCHING_RUN_COMPLETED/);
  assert.match(api, /scores\[key\] \* weights\[key\]/);
  assert.match(api, /failed\.length === 0/);
  assert.match(client, /serverValidated/);
  assert.match(client, /fetch\('\/api\/matching-runs'/);
});

test("approved memberships feed the canonical professional directory and matching pool", () => {
  const api = fs.readFileSync(
    path.join(root, "app", "api", "professional-directory", "route.ts"),
    "utf8",
  );
  const sync = fs.readFileSync(
    path.join(app, "js", "17-professional-directory-server.js"),
    "utf8",
  );
  const workflow = fs.readFileSync(
    path.join(app, "js", "70-client-workflows.js"),
    "utf8",
  );
  assert.match(api, /mp\.lifecycle_status = 'approved'/);
  assert.match(api, /d\.confidentiality = 'PUBLIC'/);
  assert.match(api, /d\.verification_status = 'VERIFIED'/);
  assert.match(sync, /serverDirectoryCandidates/);
  assert.match(workflow, /partyId:x\.partyId/);
  assert.match(workflow, /x\.ref\|\|`dir:/);
});

test("service request commands enforce ownership, deduplication, revisions, and transitions", () => {
  const api = fs.readFileSync(
    path.join(root, "app", "api", "service-requests", "route.ts"),
    "utf8",
  );
  const client = fs.readFileSync(
    path.join(app, "js", "70-client-workflows.js"),
    "utf8",
  );
  assert.match(api, /APPROVED_PROVIDER_NOT_FOUND/);
  assert.match(api, /SERVICE_REQUEST_CREATED/);
  assert.match(api, /REVISION_CONFLICT/);
  assert.match(api, /INVALID_SERVICE_REQUEST_TRANSITION/);
  assert.match(api, /SERVICE_REQUEST_TRANSITIONED/);
  assert.match(api, /provider_party_id/);
  assert.match(client, /fetch\('\/api\/service-requests'/);
  assert.match(client, /serverRevision/);
  assert.match(client, /serverValidated/);
});

test("provider inbox discloses only allowed need fields and enforces actor-side actions", () => {
  const api = fs.readFileSync(
    path.join(root, "app", "api", "service-requests", "route.ts"),
    "utf8",
  );
  const inbox = fs.readFileSync(
    path.join(app, "js", "18-provider-request-inbox.js"),
    "utf8",
  );
  const router = fs.readFileSync(
    path.join(app, "js", "20-router-navigation.js"),
    "utf8",
  );
  assert.match(api, /shared\.filter/);
  assert.match(api, /ACTION_NOT_ALLOWED_FOR_ACTOR_ROLE/);
  assert.match(api, /providerActions/);
  assert.match(api, /provider_party_id IN/);
  assert.match(inbox, /طلبات الخدمة الواردة/);
  assert.match(inbox, /providerRequestAction/);
  assert.match(router, /\[109,'طلبات الخدمة الواردة'\]/);
});

test("provider response is structured, validated, versioned, and reviewable by the client", () => {
  const api = fs.readFileSync(
    path.join(root, "app", "api", "service-requests", "route.ts"),
    "utf8",
  );
  const inbox = fs.readFileSync(
    path.join(app, "js", "18-provider-request-inbox.js"),
    "utf8",
  );
  const client = fs.readFileSync(
    path.join(app, "js", "70-client-workflows.js"),
    "utf8",
  );
  assert.match(api, /STRUCTURED_PROVIDER_RESPONSE_INCOMPLETE/);
  assert.match(api, /STRUCTURED_PROVIDER_RESPONSE_REQUIRED/);
  assert.match(api, /PROVIDER_RESPONSE_EXPIRED/);
  assert.match(api, /acceptedResponseRevision/);
  assert.match(inbox, /providerMethodology/);
  assert.match(inbox, /providerValidUntil/);
  assert.match(client, /رد مقدم الخدمة/);
});

test("accepted provider response becomes an immutable, versioned service proposal", () => {
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  const api = fs.readFileSync(
    path.join(root, "app", "api", "service-proposals", "route.ts"),
    "utf8",
  );
  const client = fs.readFileSync(
    path.join(app, "js", "70-client-workflows.js"),
    "utf8",
  );
  assert.match(schema, /export const serviceProposals/);
  assert.match(schema, /export const serviceProposalVersions/);
  assert.match(schema, /service_proposals_request_uq/);
  assert.match(api, /ACCEPTED_RESPONSE_SNAPSHOT_REQUIRED/);
  assert.match(api, /immutableSource: true/);
  assert.match(api, /SERVICE_PROPOSAL_CREATED/);
  assert.match(api, /service_request_transitions/);
  assert.match(client, /fetch\('\/api\/service-proposals'/);
});

test("service proposal negotiation is role-governed with immutable revision history", () => {
  const api = fs.readFileSync(
    path.join(root, "app", "api", "service-proposals", "route.ts"),
    "utf8",
  );
  const workflow = fs.readFileSync(
    path.join(app, "js", "19-service-proposals.js"),
    "utf8",
  );
  assert.match(api, /proposalTransitions/);
  assert.match(api, /PROPOSAL_ACTION_NOT_ALLOWED_FOR_ROLE/);
  assert.match(api, /PROPOSAL_COMMERCIAL_TERMS_INVALID/);
  assert.match(api, /SERVICE_PROPOSAL_TRANSITIONED/);
  assert.match(api, /INSERT INTO service_proposal_versions/);
  assert.match(workflow, /CHANGES_REQUESTED/);
  assert.match(workflow, /proposalAction/);
});

test("accepted proposal creates a governed dual-signature service contract", () => {
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  const api = fs.readFileSync(
    path.join(root, "app", "api", "service-contracts", "route.ts"),
    "utf8",
  );
  const workflow = fs.readFileSync(
    path.join(app, "js", "20-service-contracts.js"),
    "utf8",
  );
  assert.match(schema, /export const serviceContracts/);
  assert.match(schema, /export const serviceContractSignatures/);
  assert.match(schema, /export const serviceContractTransitions/);
  assert.match(api, /PROPOSAL_MUST_BE_ACCEPTED/);
  assert.match(api, /CONTRACT_ACTION_NOT_ALLOWED_FOR_ROLE/);
  assert.match(api, /signatures\.client && signatures\.provider/);
  assert.match(api, /SERVICE_CONTRACT_ACTION/);
  assert.match(workflow, /SIGN_CLIENT/);
  assert.match(workflow, /SIGN_PROVIDER/);
});

test("active contract creates an auditable project with milestones, deliverables, and changes", () => {
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  const api = fs.readFileSync(
    path.join(root, "app", "api", "service-projects", "route.ts"),
    "utf8",
  );
  const workflow = fs.readFileSync(
    path.join(app, "js", "21-service-projects.js"),
    "utf8",
  );
  assert.match(schema, /export const serviceProjects/);
  assert.match(schema, /export const projectMilestones/);
  assert.match(schema, /export const projectDeliverables/);
  assert.match(schema, /export const projectChangeOrders/);
  assert.match(api, /CONTRACT_MUST_BE_ACTIVE/);
  assert.match(api, /SUBMIT_DELIVERABLE/);
  assert.match(api, /ACCEPT_DELIVERABLE/);
  assert.match(api, /REQUEST_CHANGE/);
  assert.match(api, /SERVICE_PROJECT_ACTION/);
  assert.match(workflow, /createProjectFromContract/);
});

test("accepted milestones unlock governed invoices and auditable project payments", () => {
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  const projects = fs.readFileSync(
    path.join(root, "app", "api", "service-projects", "route.ts"),
    "utf8",
  );
  const finance = fs.readFileSync(
    path.join(root, "app", "api", "project-finance", "route.ts"),
    "utf8",
  );
  const ui = fs.readFileSync(
    path.join(app, "js", "21-service-projects.js"),
    "utf8",
  );
  assert.match(schema, /projectPaymentSchedules/);
  assert.match(schema, /projectInvoices/);
  assert.match(schema, /projectPayments/);
  assert.match(projects, /status = 'ELIGIBLE'/);
  assert.match(finance, /PAYMENT_SCHEDULE_NOT_ELIGIBLE/);
  assert.match(finance, /PROJECT_INVOICE_ISSUED/);
  assert.match(finance, /PROJECT_FINANCE_ACTION/);
  assert.match(finance, /BANK_TRANSFER/);
  assert.match(finance, /PAYMENT_GATEWAY/);
  assert.match(ui, /المستحقات والفواتير/);
  assert.match(ui, /لا يصبح الاستحقاق قابلًا للفوترة إلا بعد قبول تسليم مرحلته/);
});

test("paid completed projects close with certificates and bilateral governed reviews", () => {
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  const closure = fs.readFileSync(
    path.join(root, "app", "api", "project-closure", "route.ts"),
    "utf8",
  );
  const ui = fs.readFileSync(
    path.join(app, "js", "22-project-closure.js"),
    "utf8",
  );
  assert.match(schema, /projectClosures/);
  assert.match(schema, /projectCompletionCertificates/);
  assert.match(schema, /projectReviews/);
  assert.match(closure, /PROJECT_CLOSURE_BLOCKED/);
  assert.match(closure, /status <> 'PAID'/);
  assert.match(closure, /CLOSURE_PENDING/);
  assert.match(closure, /project_completion_certificates/);
  assert.match(closure, /REVIEW_SCORES_INVALID/);
  assert.match(schema, /project_reviews_project_role_uq/);
  assert.match(ui, /إغلاق محكوم بعد اكتمال التسليمات وسداد المستحقات/);
  assert.match(ui, /التقييم المتبادل/);
});

test("reputation is confidence-adjusted, recent, disputable, and admin-governed", () => {
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  const api = fs.readFileSync(
    path.join(root, "app", "api", "reputation", "route.ts"),
    "utf8",
  );
  const ui = fs.readFileSync(
    path.join(app, "js", "23-reputation-quality.js"),
    "utf8",
  );
  assert.match(schema, /reputationSnapshots/);
  assert.match(schema, /reviewDisputes/);
  assert.match(api, /priorWeight = 5/);
  assert.match(api, /recencyWeight/);
  assert.match(api, /confidenceScore/);
  assert.match(api, /REVIEW_DISPUTED/);
  assert.match(api, /PLATFORM_ADMIN_REQUIRED/);
  assert.match(api, /REVIEW_DISPUTE_RESOLVED/);
  assert.match(ui, /درجة بايزية تراعي حداثة التقييم وحجم العينة/);
  assert.match(ui, /فُتحت منازعة التقييم وأُوقف احتسابه مؤقتًا/);
});

test("quality complaints have governed transitions, appeals, and corrective actions", () => {
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  const api = fs.readFileSync(
    path.join(root, "app", "api", "quality-complaints", "route.ts"),
    "utf8",
  );
  const ui = fs.readFileSync(
    path.join(app, "js", "71-quality-complaints-server.js"),
    "utf8",
  );
  assert.match(schema, /qualityComplaints/);
  assert.match(schema, /complaintTransitions/);
  assert.match(schema, /correctiveActions/);
  assert.match(api, /COMPLAINT_PROJECT_ACCESS_DENIED/);
  assert.match(api, /COMPLAINT_TRANSITION_NOT_ALLOWED/);
  assert.match(api, /RESPONSE_RECEIVED/);
  assert.match(api, /APPEALED/);
  assert.match(api, /QUALITY_COMPLAINT_ACTION/);
  assert.match(ui, /سجل رسمي مرتبط بمشروع/);
  assert.match(ui, /إجراء تصحيحي/);
  assert.match(ui, /استئناف/);
});

test("reputation projects into public discovery and is confidence-adjusted in matching", () => {
  const directory = fs.readFileSync(
    path.join(root, "app", "api", "professional-directory", "route.ts"),
    "utf8",
  );
  const publicProfile = fs.readFileSync(
    path.join(root, "app", "api", "public-profiles", "[partyId]", "route.ts"),
    "utf8",
  );
  const matching = fs.readFileSync(
    path.join(root, "app", "api", "matching-runs", "route.ts"),
    "utf8",
  );
  const profileUi = fs.readFileSync(
    path.join(root, "app", "public-profile", "[partyId]", "public-profile-client.tsx"),
    "utf8",
  );
  assert.match(directory, /LEFT JOIN reputation_snapshots/);
  assert.match(directory, /reputationConfidence/);
  assert.match(publicProfile, /methodologyVersion/);
  assert.match(profileUi, /نتائج أعمال موثقة وليست ادعاءً ذاتيًا/);
  assert.match(profileUi, /العينة قيد التكوين/);
  assert.match(matching, /reputationByParty/);
  assert.match(matching, /80 \+ \(reputation\.composite_score - 80\)/);
  assert.match(matching, /adjustedMatchingScore/);
  assert.match(matching, /candidatePartyId/);
});

test("change orders require counterparty decisions and amend the project baseline", () => {
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  const api = fs.readFileSync(
    path.join(root, "app", "api", "service-projects", "route.ts"),
    "utf8",
  );
  const ui = fs.readFileSync(
    path.join(app, "js", "21-service-projects.js"),
    "utf8",
  );
  assert.match(schema, /projectChangeOrderTransitions/);
  assert.match(api, /COUNTERPARTY_DECISION_REQUIRED/);
  assert.match(api, /WITHDRAW_CHANGE/);
  assert.match(api, /approvedChanges/);
  assert.match(api, /authorizedChangeAmount/);
  assert.match(api, /currentPlannedEndDate/);
  assert.match(ui, /اعتماد التغيير/);
  assert.match(ui, /رفض التغيير/);
  assert.match(ui, /سحب الطلب/);
  assert.match(ui, /سجل انتقالات أمر التغيير/);
});

test("project risks, issues, and decisions are governed and block unsafe closure", () => {
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  const projectApi = fs.readFileSync(
    path.join(root, "app", "api", "service-projects", "route.ts"),
    "utf8",
  );
  const closureApi = fs.readFileSync(
    path.join(root, "app", "api", "project-closure", "route.ts"),
    "utf8",
  );
  const ui = fs.readFileSync(
    path.join(app, "js", "21-service-projects.js"),
    "utf8",
  );
  assert.match(schema, /projectRegisterItems/);
  assert.match(schema, /projectRegisterTransitions/);
  assert.match(projectApi, /CREATE_REGISTER_ITEM/);
  assert.match(projectApi, /TRANSITION_REGISTER_ITEM/);
  assert.match(projectApi, /REGISTER_TRANSITION_NOT_ALLOWED/);
  assert.match(projectApi, /CLIENT_CLOSURE_DECISION_REQUIRED/);
  assert.match(closureApi, /critical_issues/);
  assert.match(closureApi, /high_risks/);
  assert.match(ui, /سجل المخاطر والقضايا والقرارات/);
  assert.match(ui, /إضافة إلى سجل المشروع/);
  assert.match(ui, /سجل انتقالات البند/);
});

test("periodic progress reports are versioned, client-reviewed, and closure-aware", () => {
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  const projectApi = fs.readFileSync(
    path.join(root, "app", "api", "service-projects", "route.ts"),
    "utf8",
  );
  const closureApi = fs.readFileSync(
    path.join(root, "app", "api", "project-closure", "route.ts"),
    "utf8",
  );
  const ui = fs.readFileSync(
    path.join(app, "js", "21-service-projects.js"),
    "utf8",
  );
  assert.match(schema, /projectProgressReports/);
  assert.match(schema, /projectProgressReportVersions/);
  assert.match(schema, /projectProgressReportTransitions/);
  assert.match(projectApi, /SUBMIT_PROGRESS_REPORT/);
  assert.match(projectApi, /ACCEPT_PROGRESS_REPORT/);
  assert.match(projectApi, /REQUEST_PROGRESS_REPORT_REVISION/);
  assert.match(projectApi, /PROGRESS_REPORT_REVISION_NOT_ALLOWED/);
  assert.match(closureApi, /open_reports/);
  assert.match(ui, /تقارير تقدم المشروع/);
  assert.match(ui, /لا يستبدل نسبة الإنجاز الرسمية/);
  assert.match(ui, /الإصدارات وسجل المراجعة/);
});

test("deliverables require secure multi-file evidence shared only with project parties", () => {
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  const documentsApi = fs.readFileSync(
    path.join(root, "app", "api", "documents", "route.ts"),
    "utf8",
  );
  const downloadApi = fs.readFileSync(
    path.join(root, "app", "api", "documents", "[id]", "route.ts"),
    "utf8",
  );
  const projectApi = fs.readFileSync(
    path.join(root, "app", "api", "service-projects", "route.ts"),
    "utf8",
  );
  const ui = fs.readFileSync(
    path.join(app, "js", "21-service-projects.js"),
    "utf8",
  );
  assert.match(schema, /projectDeliverableDocuments/);
  assert.match(documentsApi, /PROJECT_DELIVERABLE/);
  assert.match(documentsApi, /DELIVERABLE_UPLOAD_NOT_ALLOWED/);
  assert.match(documentsApi, /form\s*\.getAll\("files"\)/);
  assert.match(downloadApi, /project_deliverable_documents/);
  assert.match(downloadApi, /sp\.client_party_id, sp\.provider_party_id/);
  assert.match(projectApi, /DELIVERABLE_ATTACHMENT_REQUIRED/);
  assert.match(projectApi, /attachments: deliverableDocuments/);
  assert.match(ui, /رفع وربط الملفات/);
  assert.match(ui, /مرفقات التسليم/);
});

test("project actions create durable role-targeted notifications with direct navigation", () => {
  const schema = fs.readFileSync(path.join(root, "db", "schema.ts"), "utf8");
  const dashboardApi = fs.readFileSync(
    path.join(root, "app", "api", "account-dashboard", "route.ts"),
    "utf8",
  );
  const projectApi = fs.readFileSync(
    path.join(root, "app", "api", "service-projects", "route.ts"),
    "utf8",
  );
  const sync = fs.readFileSync(
    path.join(app, "js", "15-membership-server-sync.js"),
    "utf8",
  );
  const workspace = fs.readFileSync(
    path.join(app, "js", "40-dashboards-search.js"),
    "utf8",
  );
  const financeApi = fs.readFileSync(
    path.join(root, "app", "api", "project-finance", "route.ts"),
    "utf8",
  );
  const closureApi = fs.readFileSync(
    path.join(root, "app", "api", "project-closure", "route.ts"),
    "utf8",
  );
  const complaintsApi = fs.readFileSync(
    path.join(root, "app", "api", "quality-complaints", "route.ts"),
    "utf8",
  );
  assert.match(schema, /actionRoute: text\("action_route"\)/);
  assert.match(schema, /priority: text\("priority"\)/);
  assert.match(dashboardApi, /entity_type, entity_id, action_route/);
  assert.match(projectApi, /INSERT INTO account_notifications/);
  assert.match(projectApi, /DELIVERABLE_SUBMITTED/);
  assert.match(projectApi, /PROGRESS_REPORT_SUBMITTED/);
  assert.match(projectApi, /l\.account_id <> \?9/);
  assert.match(sync, /accountDashboardRestore/);
  assert.match(sync, /openAccountNotification/);
  assert.match(workspace, /صندوق الأعمال والإشعارات/);
  assert.match(workspace, /تعليم الكل كمقروء/);
  assert.match(financeApi, /PROJECT_INVOICE_ISSUED/);
  assert.match(financeApi, /PROJECT_FINANCE_/);
  assert.match(closureApi, /PROJECT_CLOSURE_SUBMITTED/);
  assert.match(closureApi, /PROJECT_CLOSURE_/);
  assert.match(complaintsApi, /QUALITY_COMPLAINT_RECEIVED/);
  assert.match(complaintsApi, /notifyComplaintAdmins/);
  assert.match(workspace, /صندوق الأعمال والإشعارات/);
  assert.match(workspace, /متأخر عن الاستحقاق/);
});

test("directory result tables preserve aligned headers on narrow screens", () => {
  const css = fs.readFileSync(path.join(app, "css", "30-product-enhancements.css"), "utf8");
  assert.match(css, /\.dirtable-wrap \.dirtable\.responsive thead\{display:table-header-group\}/);
  assert.match(css, /\.dirtable th\{top:0!important/);
});

test("sidebar is role-aware and does not duplicate specialized search", () => {
  const router = fs.readFileSync(path.join(app, "js", "20-router-navigation.js"), "utf8");
  const boot = fs.readFileSync(path.join(app, "js", "120-render-bootstrap.js"), "utf8");
  assert.match(router, /function navGroupsForContext\(\)/);
  assert.match(router, /إدارة العميل والمطابقة/);
  assert.match(router, /إدارة مركز التدريب/);
  assert.match(router, /مساحة المدرب/);
  assert.match(router, /إدارة المنصة/);
  assert.doesNotMatch(boot, /groups\.push\(\{name:'البحث المتخصص'/);
});

test("database ERD is an admin-only interactive architecture view", () => {
  const router = fs.readFileSync(path.join(app, "js", "20-router-navigation.js"), "utf8");
  const erd = fs.readFileSync(path.join(app, "js", "115-database-erd.js"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(app, "module-manifest.json"), "utf8"));
  assert.match(router, /\[79,'هيكل قاعدة البيانات'\]/);
  assert.match(router, /n===79&&\(!G\.user\|\|G\.ctx!=='مدير \/ مشغل المنصة'\)/);
  assert.match(erd, /function rDatabaseERD\(\)/);
  assert.match(erd, /const DB_RELATIONSHIPS=/);
  assert.ok(manifest.sourceModules.includes("115-database-erd.js"));
  assert.ok(manifest.css.includes("40-database-erd.css"));
});

test("conceptual glossary fixes canonical terms and domain boundaries", () => {
  const glossary = fs.readFileSync(
    path.join(root, "docs", "EIM-CONCEPTUAL-GLOSSARY-AR.md"),
    "utf8",
  );
  assert.match(glossary, /الحساب ليس عضوًا/);
  assert.match(glossary, /الدور المهني ليس دورًا أمنيًا/);
  assert.match(glossary, /الدورة ليست طرحًا تدريبيًا/);
  assert.match(glossary, /الاحتياج ليس طلب خدمة/);
  assert.match(glossary, /محفظة البصمات/);
  assert.match(glossary, /حدود المجالات المؤسسية/);
  assert.match(glossary, /مصطلحات واجهة ممنوعة أو مقيدة/);
});

test("dynamic professional fingerprint specification is contextual, versioned, and governed", () => {
  const spec = fs.readFileSync(
    path.join(root, "docs", "EIM-DYNAMIC-PROFESSIONAL-FINGERPRINT-SPEC-AR.md"),
    "utf8",
  );
  assert.match(spec, /أصول الخبرة السبعة/);
  assert.match(spec, /محولات الخبرة السبعة/);
  assert.match(spec, /خبير متمرن/);
  assert.match(spec, /خبير ممارس/);
  assert.match(spec, /خبير استشاري/);
  assert.match(spec, /دورة حياة البصمة/);
  assert.match(spec, /الدمج والتقسيم/);
  assert.match(spec, /ضوابط منع التضخيم والتحايل/);
  assert.match(spec, /PF-BR-020/);
  assert.match(spec, /القرارات المؤجلة إلى الحزمة التالية/);
});

test("evidence and confidence specification prevents double counting and explains uncertainty", () => {
  const spec = fs.readFileSync(
    path.join(root, "docs", "EIM-EVIDENCE-VERIFICATION-CONFIDENCE-SPEC-AR.md"),
    "utf8",
  );
  assert.match(spec, /الأصالة لا تساوي الملاءمة/);
  assert.match(spec, /EV-18/);
  assert.match(spec, /V0/);
  assert.match(spec, /V5/);
  assert.match(spec, /بوابات عدم التعويض/);
  assert.match(spec, /منع العد المزدوج/);
  assert.match(spec, /Confidence = 100/);
  assert.match(spec, /ثلاث عائلات مستقلة/);
  assert.match(spec, /مستويات المخاطر والمراجعة البشرية/);
  assert.match(spec, /EV-BR-025/);
});

test("ontology specification separates schemes and governs explainable semantic mappings", () => {
  const spec = fs.readFileSync(
    path.join(root, "docs", "EIM-ONTOLOGY-SEMANTIC-MAPPING-SPEC-AR.md"),
    "utf8",
  );
  assert.match(spec, /CS-PRO/);
  assert.match(spec, /CS-TRN/);
  assert.match(spec, /CS-CAP/);
  assert.match(spec, /CS-NEED/);
  assert.match(spec, /MAP-EXACT/);
  assert.match(spec, /MAP-INCOMPATIBLE/);
  assert.match(spec, /ثقة الربط لا تساوي وزن استخدامه/);
  assert.match(spec, /منع ازدواجية الدورات والخدمات/);
  assert.match(spec, /عدد القفزات/);
  assert.match(spec, /ONT-BR-025/);
});

test("capabilities services and offers specification preserves governed commercial boundaries", () => {
  const spec = fs.readFileSync(
    path.join(root, "docs", "EIM-CAPABILITIES-SERVICES-OFFERS-SPEC-AR.md"),
    "utf8",
  );
  assert.match(spec, /القدرة لا تساوي الخدمة/);
  assert.match(spec, /C5 — مرجعي/);
  assert.match(spec, /قدرة المنظمة ليست مجموع قدرات أعضائها تلقائيًا/);
  assert.match(spec, /القدرات الأساسية غير القابلة للتعويض/);
  assert.match(spec, /الدورة كيان مستقل عن الطرح التدريبي/);
  assert.match(spec, /لا يعوض السعر المنخفض قدرة أساسية مفقودة/);
  assert.match(spec, /بصمة قالب الخدمة/);
  assert.match(spec, /CSO-BR-030/);
  assert.match(spec, /احتياج العميل وبصمة المهمة/);
});

test("client need and task fingerprint specification preserves client intent and decision rights", () => {
  const spec = fs.readFileSync(
    path.join(root, "docs", "EIM-CLIENT-NEED-TASK-FINGERPRINT-SPEC-AR.md"),
    "utf8",
  );
  assert.match(spec, /الاحتياج ليس طلب خدمة/);
  assert.match(spec, /بصمة المهمة ليست حلًا مسبقًا/);
  assert.match(spec, /تسعة محاور مستقلة/);
  assert.match(spec, /بوابات الاكتمال/);
  assert.match(spec, /مجموع 100%/);
  assert.match(spec, /P0 — خاص/);
  assert.match(spec, /عدم المعرفة يظهر كفجوة ولا يحول إلى صفر/);
  assert.match(spec, /لا يعلن خيار «الأفضل مطلقًا»/);
  assert.match(spec, /NTF-BR-035/);
  assert.match(spec, /المطابقة والتوصية وتكوين فرق الخبراء/);
});

test("matching recommendation and teaming specification separates eligibility ranking and decision", () => {
  const spec = fs.readFileSync(
    path.join(root, "docs", "EIM-MATCHING-RECOMMENDATION-TEAMING-SPEC-AR.md"),
    "utf8",
  );
  assert.match(spec, /الأهلية تسبق الترتيب/);
  assert.match(spec, /M0 — سلامة الطلب/);
  assert.match(spec, /M7 — قرار العميل/);
  assert.match(spec, /FinalScore/);
  assert.match(spec, /±5 و±10/);
  assert.match(spec, /لا يستخدم وصف «الأفضل مطلقًا»/);
  assert.match(spec, /لا تجمع درجات أعضاء متعددين/);
  assert.match(spec, /لا تستخدم الخصائص المحمية/);
  assert.match(spec, /MAT-BR-040/);
  assert.match(spec, /التعلم والتدريب والمحتوى والفعاليات/);
});

test("learning training content and events specification separates content course offering and credential", () => {
  const spec = fs.readFileSync(
    path.join(root, "docs", "EIM-LEARNING-TRAINING-CONTENT-EVENTS-SPEC-AR.md"),
    "utf8",
  );
  assert.match(spec, /الدورة ليست طرحًا تدريبيًا/);
  assert.match(spec, /ملكية المحتوى مستقلة عن حق تقديمه/);
  assert.match(spec, /L4 — النتيجة/);
  assert.match(spec, /تشابه الاسم وحده لا يمنع الإنشاء/);
  assert.match(spec, /الطاقة الاستيعابية رقمًا/);
  assert.match(spec, /شهادة الحضور لا تعامل كاعتماد مهني/);
  assert.match(spec, /لا تغلق فجوة قدرة دون دليل تطبيق/);
  assert.match(spec, /تقييم المدرب مستقل عن تقييم الدورة والمركز/);
  assert.match(spec, /LTE-BR-036/);
  assert.match(spec, /الاستشارات والمشاريع والتسليمات/);
});

test("consulting projects and deliverables specification preserves contractual and acceptance boundaries", () => {
  const spec = fs.readFileSync(
    path.join(root, "docs", "EIM-CONSULTING-PROJECTS-DELIVERABLES-SPEC-AR.md"),
    "utf8",
  );
  assert.match(spec, /المقترح ليس عقدًا/);
  assert.match(spec, /التسليم لا يساوي القبول/);
  assert.match(spec, /التوقيع المزدوج/);
  assert.match(spec, /خط الأساس/);
  assert.match(spec, /طلب التغيير لا يغير خط الأساس/);
  assert.match(spec, /القضايا الحرجة غير المغلقة تمنع الإغلاق/);
  assert.match(spec, /لا يعد فتح الملف أو تنزيله قبولًا/);
  assert.match(spec, /CPD-BR-040/);
  assert.match(spec, /البحث والنشر وإدارة المعرفة/);
});

test("research publication and knowledge specification preserves provenance rights and integrity", () => {
  const spec = fs.readFileSync(
    path.join(root, "docs", "EIM-RESEARCH-PUBLICATION-KNOWLEDGE-SPEC-AR.md"),
    "utf8",
  );
  assert.match(spec, /المشروع البحثي ليس منشورًا/);
  assert.match(spec, /المنشور ليس دليلًا تلقائيًا/);
  assert.match(spec, /إتاحة المعرفة لا تعني التنازل عن الحقوق/);
  assert.match(spec, /المستودع ليس أرشيف ملفات/);
  assert.match(spec, /لا تنقل تسليمات العميل مباشرة إلى المستودع/);
  assert.match(spec, /إتاحة الملف للقراءة لا تمنح حق إعادة نشره/);
  assert.match(spec, /المنشور المسحوب لا يدعم البصمة/);
  assert.match(spec, /RPK-BR-040/);
  assert.match(spec, /العقود والمدفوعات والاشتراكات/);
});

test("contracts payments and subscriptions specification preserves legal financial and ledger boundaries", () => {
  const spec = fs.readFileSync(
    path.join(root, "docs", "EIM-CONTRACTS-PAYMENTS-SUBSCRIPTIONS-SPEC-AR.md"),
    "utf8",
  );
  assert.match(spec, /العقد ليس فاتورة/);
  assert.match(spec, /الفاتورة ليست دفعة/);
  assert.match(spec, /نجاح بوابة الدفع لا يساوي تسوية مالية نهائية/);
  assert.match(spec, /الخطة × فئة المشترك × الفترة × عدد العضويات/);
  assert.match(spec, /لا تمنح الخطة صلاحية إدارية/);
  assert.match(spec, /عودة المتصفح لا تثبت نجاح الدفع/);
  assert.match(spec, /الاسترداد لا يحذف الدفعة الأصلية/);
  assert.match(spec, /CFS-BR-040/);
  assert.match(spec, /السمعة والتقييم والجودة والشكاوى/);
});

test("reputation quality and complaints specification preserves evaluation context and due process", () => {
  const spec = fs.readFileSync(
    path.join(root, "docs", "EIM-REPUTATION-QUALITY-COMPLAINTS-SPEC-AR.md"),
    "utf8",
  );
  assert.match(spec, /التقييم ليس سمعة/);
  assert.match(spec, /الشكوى ليست إدانة/);
  assert.match(spec, /لا ينقل تقييم المركز إلى جميع مدربيه/);
  assert.match(spec, /AdjustedRating/);
  assert.match(spec, /ارتفاع التقييم مع ثقة منخفضة لا يعادل سجلًا مستقرًا/);
  assert.match(spec, /التصحيح والإجراء التصحيحي كيانان مختلفان/);
  assert.match(spec, /الشكوى غير المحسومة لا تغير البصمة تلقائيًا/);
  assert.match(spec, /RQC-BR-040/);
  assert.match(spec, /الحقوق والملكية الفكرية والسرية/);
});

test("rights intellectual property and confidentiality specification preserves ownership licensing and disclosure boundaries", () => {
  const spec = fs.readFileSync(
    path.join(root, "docs", "EIM-RIGHTS-IP-CONFIDENTIALITY-SPEC-AR.md"),
    "utf8",
  );
  assert.match(spec, /الملكية ليست التأليف/);
  assert.match(spec, /الوصول إلى الملف لا يعني ترخيص استخدامه/);
  assert.match(spec, /التسليم لا ينقل الملكية تلقائيًا/);
  assert.match(spec, /الترخيص غير المحدد لا يفسر تلقائيًا بأوسع حق ممكن/);
  assert.match(spec, /هل يسمح بتقديمها من أكثر من مدرب/);
  assert.match(spec, /ربط الدورة بمدرب أو مركز منحًا تلقائيًا/);
  assert.match(spec, /السرية تطبق على الحقل والملف/);
  assert.match(spec, /RIC-BR-040/);
  assert.match(spec, /الحوكمة والخصوصية والأمن والتدقيق/);
});

test("governance privacy security audit and integrations specification enforces accountable control", () => {
  const spec = fs.readFileSync(
    path.join(root, "docs", "EIM-GOVERNANCE-PRIVACY-SECURITY-AUDIT-INTEGRATIONS-SPEC-AR.md"),
    "utf8",
  );
  assert.match(spec, /الدور ليس صلاحية مطلقة/);
  assert.match(spec, /الموافقة ليست الأساس القانوني الوحيد/);
  assert.match(spec, /RBAC/);
  assert.match(spec, /الحظر الصريح يغلب السماح العام/);
  assert.match(spec, /استعادة الحساب تبطل الجلسات السابقة/);
  assert.match(spec, /سجل التدقيق يثبت الحدث ولا يمنح حق الاطلاع/);
  assert.match(spec, /القرار الآلي المؤثر قابل للتفسير والاعتراض/);
  assert.match(spec, /GPSAI-BR-045/);
  assert.match(spec, /مصفوفة التتبع وسجل القرارات المفاهيمية/);
});

test("conceptual baseline freezes a complete traceable and non-duplicated domain model", () => {
  const specFiles = [
    "EIM-CAPABILITIES-SERVICES-OFFERS-SPEC-AR.md",
    "EIM-CLIENT-NEED-TASK-FINGERPRINT-SPEC-AR.md",
    "EIM-CONSULTING-PROJECTS-DELIVERABLES-SPEC-AR.md",
    "EIM-CONTRACTS-PAYMENTS-SUBSCRIPTIONS-SPEC-AR.md",
    "EIM-DYNAMIC-PROFESSIONAL-FINGERPRINT-SPEC-AR.md",
    "EIM-EVIDENCE-VERIFICATION-CONFIDENCE-SPEC-AR.md",
    "EIM-GOVERNANCE-PRIVACY-SECURITY-AUDIT-INTEGRATIONS-SPEC-AR.md",
    "EIM-LEARNING-TRAINING-CONTENT-EVENTS-SPEC-AR.md",
    "EIM-MATCHING-RECOMMENDATION-TEAMING-SPEC-AR.md",
    "EIM-ONTOLOGY-SEMANTIC-MAPPING-SPEC-AR.md",
    "EIM-REPUTATION-QUALITY-COMPLAINTS-SPEC-AR.md",
    "EIM-RESEARCH-PUBLICATION-KNOWLEDGE-SPEC-AR.md",
    "EIM-RIGHTS-IP-CONFIDENTIALITY-SPEC-AR.md",
  ];
  const ruleCount = specFiles
    .map((file) => fs.readFileSync(path.join(root, "docs", file), "utf8"))
    .flatMap((content) => content.match(/[A-Z]{2,8}-BR-\d{3}/g) ?? [])
    .filter((value, index, values) => values.indexOf(value) === index).length;
  assert.equal(ruleCount, 456);

  const baseline = fs.readFileSync(
    path.join(root, "docs", "EIM-CONCEPTUAL-BASELINE-TRACEABILITY-AR.md"),
    "utf8",
  );
  assert.match(baseline, /456 قاعدة أعمال مرقمة/);
  assert.match(baseline, /Account → Party\(Person\|Organization\) → Membership/);
  assert.match(baseline, /لا يوجد تعارض مفاهيمي مفتوح بدرجة حرجة/);
  assert.match(baseline, /ADR-C-025/);
  assert.match(baseline, /Entity → Table → API → Screen → Permission → Test/);
  assert.match(baseline, /مكتملة بنسبة \*\*100% من حيث نطاق التصميم المفاهيمي المعتمد\*\*/);
});

test("V70 logical model establishes bounded ownership and non-destructive reconciliation", () => {
  const logical = fs.readFileSync(
    path.join(root, "database", "postgresql", "docs", "09_LOGICAL_MODEL_V70_AR.md"),
    "utf8",
  );
  assert.match(logical, /جداول الهوية الثابتة/);
  assert.match(logical, /لا يوجد `expert`, `trainer`, `consultant`, `researcher`, `client` كنوع Party/);
  assert.match(logical, /منع تكرار العميل/);
  assert.match(logical, /عقد واحد مشترك/);
  assert.match(logical, /المخطط المستهدف `rights`/);
  assert.match(logical, /Transactional Outbox/);
  for (const action of ["KEEP", "RENAME", "MOVE", "SPLIT", "MERGE", "ADD", "RETIRE"]) {
    assert.match(logical, new RegExp(action));
  }
});

test("V70 central dictionary standardizes identifiers reference codes money and quality", () => {
  const dictionary = fs.readFileSync(
    path.join(root, "database", "postgresql", "docs", "10_CENTRAL_DATA_DICTIONARY_V70_AR.md"),
    "utf8",
  );
  assert.match(dictionary, /ISO 3166-1 alpha-2/);
  assert.match(dictionary, /ISO 4217/);
  assert.match(dictionary, /BCP 47/);
  assert.match(dictionary, /`amount_minor bigint`/);
  assert.match(dictionary, /التقييم والسمعة/);
  assert.match(dictionary, /لا يخزن بريد وهاتف في عمود واحد/);
  assert.match(dictionary, /KEEP\/RENAME\/MOVE\/SPLIT\/MERGE\/ADD\/RETIRE/);
});

test("V71 reconciliation classifies every current PostgreSQL table and protects non-destructive migration", () => {
  const decisions = fs.readFileSync(
    path.join(root, "database", "postgresql", "docs", "11_RECONCILIATION_DECISIONS_V71_AR.md"),
    "utf8",
  );
  const inventory = fs.readFileSync(
    path.join(root, "database", "postgresql", "docs", "11_CURRENT_TARGET_RECONCILIATION_V71.csv"),
    "utf8",
  );
  assert.match(decisions, /294 جدولًا حاليًا/);
  assert.match(decisions, /crm\.client_organizations/);
  assert.match(decisions, /professional\.experience_records/);
  assert.match(decisions, /training\.course_contents/);
  assert.match(decisions, /Views توافقية/);
  assert.match(decisions, /حزمة A التأسيسية غير الهادمة/);
  for (const table of [
    "core.parties",
    "finance.contracts",
    "finance.ip_assets",
    "evidence.complaints",
    "integration.outbox_events",
  ]) {
    assert.match(inventory, new RegExp(table.replace(".", "\\.")));
  }
  assert.equal(inventory.trim().split("\n").length, 311);
});

test("V72 package A adds target foundations without moving or deleting current data", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "postgresql", "migrations", "0200_v71_foundation_non_destructive.sql"),
    "utf8",
  );
  const rollback = fs.readFileSync(
    path.join(root, "database", "postgresql", "rollback", "0200_v71_foundation_non_destructive.rollback.sql"),
    "utf8",
  );
  const guide = fs.readFileSync(
    path.join(root, "database", "postgresql", "docs", "12_PACKAGE_A_FOUNDATION_V72_AR.md"),
    "utf8",
  );
  for (const schema of ["contract", "rights", "quality"]) {
    assert.match(migration, new RegExp(`CREATE SCHEMA IF NOT EXISTS ${schema}`));
  }
  for (const table of [
    "professional.experience_records",
    "delivery.project_baselines",
    "finance.ledger_entries",
    "governance.access_decisions",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table.replace(".", "\\.")}`));
  }
  const executableSql = migration.replace(/--.*$/gm, "");
  assert.doesNotMatch(
    executableSql,
    /^\s*(?:DROP\b|TRUNCATE\b|DELETE\s+FROM\b|UPDATE\s+[a-z_]+\.[a-z_]+\s+SET\b)/im,
  );
  assert.match(rollback, /Rollback refused/);
  assert.match(guide, /لا تزال العقود الحالية في `finance`/);
  assert.match(guide, /الحزمة B توحد هوية العميل/);
});

test("V73 package B resolves client identity with human-reviewed non-destructive deduplication", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "postgresql", "migrations", "0210_v73_client_identity_resolution.sql"),
    "utf8",
  );
  const rollback = fs.readFileSync(
    path.join(root, "database", "postgresql", "rollback", "0210_v73_client_identity_resolution.rollback.sql"),
    "utf8",
  );
  const guide = fs.readFileSync(
    path.join(root, "database", "postgresql", "docs", "13_PACKAGE_B_CLIENT_IDENTITY_V73_AR.md"),
    "utf8",
  );
  for (const table of [
    "core.party_match_keys",
    "core.party_duplicate_candidates",
    "core.party_merge_reviews",
    "core.party_merge_field_decisions",
    "core.party_merge_plans",
    "crm.client_identity_links",
    "crm.client_contact_roles",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table.replace(".", "\\.")}`));
  }
  assert.match(migration, /digest\(core\.normalize_match_text/);
  assert.match(migration, /ON CONFLICT \(client_account_id\) DO NOTHING/);
  assert.match(migration, /لا يسمح بالدمج الآلي/);
  assert.doesNotMatch(migration.replace(/--.*$/gm, ""), /^\s*(?:DROP|TRUNCATE|DELETE\s+FROM)\b/im);
  assert.match(rollback, /Package B contains human decisions or merge plans/);
  assert.match(guide, /التطابق لا يعني الدمج/);
  assert.match(guide, /الحزمة C ستوحد الخبرات المهنية/);
});

test("V74 package C unifies professional experience and course content without collapsing offerings or rights", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "postgresql", "migrations", "0220_v74_professional_training_unification.sql"),
    "utf8",
  );
  const rollback = fs.readFileSync(
    path.join(root, "database", "postgresql", "rollback", "0220_v74_professional_training_unification.rollback.sql"),
    "utf8",
  );
  const guide = fs.readFileSync(
    path.join(root, "database", "postgresql", "docs", "14_PACKAGE_C_PROFESSIONAL_TRAINING_V74_AR.md"),
    "utf8",
  );
  for (const source of [
    "professional.employment_experiences",
    "professional.project_experiences",
    "professional.training_experiences",
    "professional.consulting_experiences",
    "professional.research_experiences",
  ]) {
    assert.match(migration, new RegExp(source.replace(".", "\\.")));
  }
  for (const table of [
    "training.course_contents",
    "training.course_content_versions",
    "training.course_content_version_names",
    "training.course_offering_content_links",
    "training.course_content_fingerprints",
    "integration.data_reconciliation_runs",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table.replace(".", "\\.")}`));
  }
  assert.match(migration, /record_type_code/);
  assert.match(migration, /source_snapshot/);
  assert.match(migration, /ON CONFLICT \(legacy_source_table, legacy_source_id\) DO NOTHING/);
  assert.match(rollback, /Package C contains native content/);
  assert.match(guide, /الدورة لا تساوي الطرح/);
  assert.match(guide, /لا يحدث دمج آلي/);
  assert.match(guide, /الحزمة D ستنشئ النسخ المتوافقة للعقود/);
});

test("V75 package D preserves legal identities and delays write cutover", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "postgresql", "migrations", "0230_v75_contract_rights_quality_unification.sql"),
    "utf8",
  );
  const rollback = fs.readFileSync(
    path.join(root, "database", "postgresql", "rollback", "0230_v75_contract_rights_quality_unification.rollback.sql"),
    "utf8",
  );
  const guide = fs.readFileSync(
    path.join(root, "database", "postgresql", "docs", "15_PACKAGE_D_CONTRACT_RIGHTS_QUALITY_V75_AR.md"),
    "utf8",
  );
  for (const table of [
    "contract.contract_records",
    "rights.intellectual_assets",
    "quality.evaluations",
    "quality.complaint_cases",
    "quality.reputation_profiles",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table.replace(".", "\\.")}`));
  }
  assert.match(migration, /contract_id = legacy_source_id/);
  assert.match(migration, /intellectual_asset_id = legacy_source_id/);
  assert.match(migration, /evaluation_id = legacy_source_id/);
  assert.match(migration, /"write_cutover":false/);
  assert.match(rollback, /Package D rollback refused/);
  assert.match(guide, /نسخ، ثم مصالحة، ثم تحويل لاحق/);
});

test("V76 package E creates one traceable service-case spine without replacing domain aggregates", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "postgresql", "migrations", "0240_v76_service_lifecycle_unification.sql"),
    "utf8",
  );
  const rollback = fs.readFileSync(
    path.join(root, "database", "postgresql", "rollback", "0240_v76_service_lifecycle_unification.rollback.sql"),
    "utf8",
  );
  const guide = fs.readFileSync(
    path.join(root, "database", "postgresql", "docs", "16_PACKAGE_E_SERVICE_LIFECYCLE_V76_AR.md"),
    "utf8",
  );
  for (const table of [
    "delivery.service_cases",
    "delivery.service_case_links",
    "delivery.service_case_stage_events",
    "delivery.service_case_gates",
    "delivery.service_case_exceptions",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table.replace(".", "\\.")}`));
  }
  for (const stage of [
    "NEED", "REQUEST", "MATCHING", "COMPARISON", "PROPOSAL",
    "SELECTION", "CONTRACTING", "DELIVERY", "ACCEPTANCE", "CLOSURE",
  ]) {
    assert.match(migration, new RegExp(`'${stage}'`));
  }
  assert.match(migration, /service_request_id uuid NOT NULL UNIQUE/);
  assert.match(migration, /"write_cutover":false/);
  assert.match(rollback, /Package E rollback refused/);
  assert.match(guide, /قضية الخدمة ليست بديلًا/);
  assert.match(guide, /لا تختار مقدم الخدمة بدل العميل/);
});

test("V77 package F governs transitions in non-blocking monitor mode", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "postgresql", "migrations", "0250_v77_service_workflow_governance.sql"),
    "utf8",
  );
  const rollback = fs.readFileSync(
    path.join(root, "database", "postgresql", "rollback", "0250_v77_service_workflow_governance.rollback.sql"),
    "utf8",
  );
  const guide = fs.readFileSync(
    path.join(root, "database", "postgresql", "docs", "17_PACKAGE_F_WORKFLOW_GOVERNANCE_V77_AR.md"),
    "utf8",
  );
  for (const table of [
    "delivery.service_case_workflow_versions",
    "delivery.service_case_transition_rules",
    "delivery.service_case_transition_roles",
    "delivery.service_case_transition_gate_requirements",
    "delivery.service_case_command_receipts",
    "delivery.service_case_transition_attempts",
    "delivery.service_case_transition_approvals",
    "delivery.service_case_transition_outbox_links",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table.replace(".", "\\.")}`));
  }
  assert.match(migration, /'MONITOR_ONLY', 'DRAFT'/);
  assert.match(migration, /UNIQUE \(service_case_id, idempotency_key\)/);
  assert.match(migration, /REFERENCES governance\.approval_requests/);
  assert.match(migration, /REFERENCES integration\.outbox_events/);
  assert.match(rollback, /workflow was approved, activated, or enforced/);
  assert.match(guide, /لا توقف العمليات القائمة/);
  assert.match(guide, /لا يجوز تحويل الوضع إلى `ENFORCING`/);
});

test("V78 package G executes idempotent optimistic-locked commands transactionally", () => {
  const migration = fs.readFileSync(
    path.join(root, "database", "postgresql", "migrations", "0260_v78_service_case_command_executor.sql"),
    "utf8",
  );
  const rollback = fs.readFileSync(
    path.join(root, "database", "postgresql", "rollback", "0260_v78_service_case_command_executor.rollback.sql"),
    "utf8",
  );
  const guide = fs.readFileSync(
    path.join(root, "database", "postgresql", "docs", "18_PACKAGE_G_COMMAND_EXECUTOR_V78_AR.md"),
    "utf8",
  );
  assert.match(migration, /FUNCTION delivery\.execute_service_case_command/);
  assert.match(migration, /FROM iam\.user_accounts/);
  assert.match(migration, /governance\.user_role_assignments/);
  assert.doesNotMatch(migration, /p_actor_role_code/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /ROW_VERSION_CONFLICT/);
  assert.match(migration, /Idempotency key was already used with a different request/);
  assert.match(migration, /INSERT INTO integration\.outbox_events/);
  assert.match(migration, /ALLOW_WITH_WARNING/);
  assert.match(migration, /SECURITY INVOKER/);
  assert.match(rollback, /command executor has processed runtime commands/);
  assert.match(guide, /لا تستقبل اسم الدور من الواجهة ولا تثق به/);
  assert.match(guide, /إذا فشل أي جزء تفشل المعاملة كلها/);
});

test("V85 package N exposes an idempotent governed operations adapter contract", () => {
  const migration = fs.readFileSync(path.join(root, "database", "postgresql", "migrations", "0320_v85_operations_adapter_contract.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(root, "database", "postgresql", "rollback", "0320_v85_operations_adapter_contract.rollback.sql"), "utf8");
  const guide = fs.readFileSync(path.join(root, "database", "postgresql", "docs", "25_PACKAGE_N_OPERATIONS_ADAPTER_V85_AR.md"), "utf8");
  assert.match(migration, /CREATE TABLE delivery\.workflow_operations_command_receipts/);
  assert.match(migration, /FUNCTION delivery\.get_workflow_operations_summary/);
  assert.match(migration, /FUNCTION delivery\.execute_workflow_operations_command/);
  assert.match(migration, /Idempotency key was reused with a different request/);
  assert.match(migration, /PLATFORM_ADMIN/);
  assert.match(migration, /HUMAN_APPROVAL_REQUIRED/);
  assert.match(rollback, /rollback refused/);
  assert.match(guide, /المتصفح لا يقرر نجاح التحقق الإضافي/);
});

test("V86 package O enables operations only behind trusted adapter readiness", () => {
  const api = fs.readFileSync(path.join(root, "app", "api", "workflow-operations", "route.ts"), "utf8");
  const page = fs.readFileSync(path.join(root, "app", "operations", "workflow", "workflow-operations.tsx"), "utf8");
  const guide = fs.readFileSync(path.join(root, "database", "postgresql", "docs", "26_PACKAGE_O_LIVE_OPERATIONS_BRIDGE_V86_AR.md"), "utf8");
  assert.match(api, /POSTGRES_OPERATIONS_ACTIONS_ENABLED/);
  assert.match(api, /POSTGRES_OPERATIONS_STEP_UP_READY/);
  assert.match(api, /GOVERNED_ACTIONS_NOT_READY/);
  assert.match(page, /crypto\.randomUUID\(\)/);
  assert.match(page, /سبب الإجراء/);
  assert.match(page, /REQUEST_PROMOTION/);
  assert.match(page, /actionsReady/);
  assert.match(guide, /لا يمكن للمتصفح تجاوز ذلك/);
});

test("V87 package P enforces expiring second-person operations approval", () => {
  const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0330_v87_operations_approval_sod.sql"),"utf8");
  const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0330_v87_operations_approval_sod.rollback.sql"),"utf8");
  const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","27_PACKAGE_P_OPERATION_APPROVAL_SOD_V87_AR.md"),"utf8");
  assert.match(migration,/CREATE TABLE delivery\.workflow_operations_approval_links/);
  assert.match(migration,/interval '30 minutes'/);
  assert.match(migration,/FUNCTION delivery\.decide_workflow_operations_approval/);
  assert.match(migration,/governance\.approval_decisions/);
  assert.match(migration,/APPROVAL_NOT_PENDING/);
  assert.match(rollback,/rollback refused/);
  assert.match(guide,/العينين الأربع/);
});

test("V88 package Q deduplicates and escalates governed operations incidents", () => {
  const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0340_v88_operations_incident_response.sql"),"utf8");
  const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0340_v88_operations_incident_response.rollback.sql"),"utf8");
  const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","28_PACKAGE_Q_INCIDENT_RESPONSE_V88_AR.md"),"utf8");
  assert.match(migration,/CREATE TABLE delivery\.workflow_operations_incidents/);
  assert.match(migration,/CREATE TABLE delivery\.workflow_operations_incident_events/);
  assert.match(migration,/uq_open_workflow_operations_incident/);
  assert.match(migration,/FUNCTION delivery\.raise_workflow_operations_incident/);
  assert.match(migration,/FUNCTION delivery\.escalate_overdue_workflow_operations_incidents/);
  assert.match(migration,/interval '15 minutes'/);
  assert.match(rollback,/rollback refused/);
  assert.match(guide,/لا تغلق الحوادث آليًا/);
});

test("V89 package R requires reviewed causes and verified actions before incident closure", () => {
  const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0350_v89_incident_resolution_learning.sql"),"utf8");
  const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0350_v89_incident_resolution_learning.rollback.sql"),"utf8");
  const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","29_PACKAGE_R_INCIDENT_RESOLUTION_LEARNING_V89_AR.md"),"utf8");
  assert.match(migration,/CREATE TABLE delivery\.workflow_incident_root_cause_analyses/);
  assert.match(migration,/CREATE TABLE delivery\.workflow_incident_corrective_actions/);
  assert.match(migration,/CREATE TABLE delivery\.workflow_incident_lessons/);
  assert.match(migration,/CLOSURE_EVIDENCE_INCOMPLETE/);
  assert.match(migration,/effectiveness_code/);
  assert.match(rollback,/rollback refused/);
  assert.match(guide,/لا يسمح PostgreSQL بإغلاق الحادث/);
});

test("V90 package S versions reliability objectives and auditable error budgets", () => {
  const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0360_v90_reliability_slo_error_budgets.sql"),"utf8");
  const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0360_v90_reliability_slo_error_budgets.rollback.sql"),"utf8");
  const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","30_PACKAGE_S_RELIABILITY_SLO_V90_AR.md"),"utf8");
  assert.match(migration,/CREATE TABLE delivery\.workflow_reliability_objectives/);
  assert.match(migration,/CREATE TABLE delivery\.workflow_reliability_measurements/);
  assert.match(migration,/CREATE TABLE delivery\.workflow_reliability_budget_events/);
  assert.match(migration,/mtta_minutes/);
  assert.match(migration,/mttr_hours/);
  assert.match(rollback,/rollback refused/);
  assert.match(guide,/لا يغير الإنتاج تلقائيًا/);
});

test("V91 package T blocks unsafe production releases and preserves rollback plans", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0370_v91_change_release_deployment.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0370_v91_change_release_deployment.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","31_PACKAGE_T_CHANGE_RELEASE_V91_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE delivery\.platform_change_requests/);
 assert.match(migration,/CREATE TABLE delivery\.platform_releases/);
 assert.match(migration,/CREATE TABLE delivery\.platform_deployments/);
 assert.match(migration,/CRITICAL_INCIDENT_OPEN/);
 assert.match(migration,/SLO_BREACHED/);
 assert.match(migration,/rollback_plan text NOT NULL/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا يستبدل تاريخ المحاولات/);
});

test("V92 package U requires proven restore evidence before failover readiness", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0380_v92_backup_disaster_recovery.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0380_v92_backup_disaster_recovery.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","32_PACKAGE_U_BACKUP_DR_V92_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE delivery\.platform_continuity_plans/);
 assert.match(migration,/CREATE TABLE delivery\.platform_backup_runs/);
 assert.match(migration,/CREATE TABLE delivery\.platform_recovery_exercises/);
 assert.match(migration,/data_integrity_verified/);
 assert.match(migration,/achieved_rpo_minutes<=p\.rpo_minutes/);
 assert.match(migration,/evaluate_platform_failover_gate/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا تعتبر الخطة جاهزة/);
});

test("V93 package V requires passed load tests and capacity headroom", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0390_v93_capacity_performance_scaling.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0390_v93_capacity_performance_scaling.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","33_PACKAGE_V_CAPACITY_PERFORMANCE_V93_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE delivery\.platform_capacity_plans/);
 assert.match(migration,/CREATE TABLE delivery\.platform_capacity_metrics/);
 assert.match(migration,/CREATE TABLE delivery\.platform_load_tests/);
 assert.match(migration,/CREATE TABLE delivery\.platform_scaling_policies/);
 assert.match(migration,/INSUFFICIENT_HEADROOM/);
 assert.match(migration,/LOAD_TEST_REQUIRED/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا توسع الموارد أو تنشر إصدارًا تلقائيًا/);
});

test("V94 package W governs cost without sacrificing SLO or capacity", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0400_v94_finops_cost_governance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0400_v94_finops_cost_governance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","34_PACKAGE_W_FINOPS_V94_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE finance\.platform_cost_centers/);
 assert.match(migration,/CREATE TABLE finance\.platform_cost_budgets/);
 assert.match(migration,/CREATE TABLE finance\.platform_cost_observations/);
 assert.match(migration,/CREATE TABLE finance\.platform_unit_economics/);
 assert.match(migration,/SLO_PROTECTION_REQUIRED/);
 assert.match(migration,/CAPACITY_PROTECTION_REQUIRED/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا تنفذ البوابة أي خفض تلقائي/);
});

test("V95 package X governs vendors, dependencies, SLAs, and exit readiness", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0410_v95_vendor_third_party_governance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0410_v95_vendor_third_party_governance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","35_PACKAGE_X_VENDOR_GOVERNANCE_V95_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE integration\.platform_vendors/);
 assert.match(migration,/CREATE TABLE integration\.platform_vendor_dependencies/);
 assert.match(migration,/CREATE TABLE integration\.platform_vendor_slas/);
 assert.match(migration,/CREATE TABLE integration\.platform_vendor_assessments/);
 assert.match(migration,/EXIT_COVERAGE_REQUIRED/);
 assert.match(migration,/data_portability_verified/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا يُستبدل المورد دون قرار محكوم/);
});

test("V96 package Y governs retention, legal holds, and evidenced disposition", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0420_v96_data_retention_disposition_governance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0420_v96_data_retention_disposition_governance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","36_PACKAGE_Y_DATA_RETENTION_V96_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE governance\.data_retention_targets/);
 assert.match(migration,/CREATE TABLE governance\.data_disposition_assessments/);
 assert.match(migration,/CREATE TABLE governance\.data_disposition_batches/);
 assert.match(migration,/CREATE TABLE governance\.data_disposition_items/);
 assert.match(migration,/LEGAL_HOLD_BLOCKED/);
 assert.match(migration,/execution_receipt_hash/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا تنفذ المنصة إتلافًا تلقائيًا/);
});

test("V97 package Z maps obligations to independently tested controls", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0430_v97_compliance_controls_assurance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0430_v97_compliance_controls_assurance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","37_PACKAGE_Z_COMPLIANCE_ASSURANCE_V97_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE governance\.compliance_frameworks/);
 assert.match(migration,/CREATE TABLE governance\.compliance_obligations/);
 assert.match(migration,/CREATE TABLE governance\.compliance_controls/);
 assert.match(migration,/CREATE TABLE governance\.compliance_control_mappings/);
 assert.match(migration,/CREATE TABLE governance\.compliance_control_tests/);
 assert.match(migration,/INDEPENDENT_REVIEW_REQUIRED/);
 assert.match(migration,/corrective_action_due_at/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا تمنح المنصة شهادة امتثال تلقائية/);
});

test("V98 package AA governs enterprise risks, controls, treatments, and indicators", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0440_v98_enterprise_risk_governance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0440_v98_enterprise_risk_governance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","38_PACKAGE_AA_ENTERPRISE_RISK_V98_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE governance\.enterprise_risks/);
 assert.match(migration,/CREATE TABLE governance\.enterprise_risk_assessments/);
 assert.match(migration,/CREATE TABLE governance\.enterprise_risk_control_links/);
 assert.match(migration,/CREATE TABLE governance\.enterprise_risk_treatment_plans/);
 assert.match(migration,/CREATE TABLE governance\.enterprise_risk_indicators/);
 assert.match(migration,/CONTROL_COVERAGE_REQUIRED/);
 assert.match(migration,/effectiveness_verified_at/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا يُغلق الخطر لمجرد اكتمال النشاط/);
});

test("V99 package AB governs security assets, vulnerabilities, remediation, and verification", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0450_v99_security_assets_vulnerability_governance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0450_v99_security_assets_vulnerability_governance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","39_PACKAGE_AB_SECURITY_ASSETS_V99_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE governance\.security_assets/);
 assert.match(migration,/CREATE TABLE governance\.security_asset_dependencies/);
 assert.match(migration,/CREATE TABLE governance\.security_vulnerabilities/);
 assert.match(migration,/CREATE TABLE governance\.security_remediation_plans/);
 assert.match(migration,/CREATE TABLE governance\.security_verification_runs/);
 assert.match(migration,/VERIFICATION_REQUIRED/);
 assert.match(migration,/RISK_LINK_REQUIRED/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا تعتبر الثغرة مغلقة لمجرد تطبيق تعديل/);
});

test("V100 package AC governs just-in-time privileged access and session attestation", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0460_v100_privileged_access_governance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0460_v100_privileged_access_governance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","40_PACKAGE_AC_PRIVILEGED_ACCESS_V100_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE governance\.privileged_access_requests/);
 assert.match(migration,/CREATE TABLE governance\.privileged_access_grants/);
 assert.match(migration,/CREATE TABLE governance\.privileged_access_sessions/);
 assert.match(migration,/CREATE TABLE governance\.privileged_access_session_events/);
 assert.match(migration,/CREATE TABLE governance\.privileged_access_attestations/);
 assert.match(migration,/SESSION_TERMINATION_REQUIRED/);
 assert.match(migration,/ATTESTATION_REQUIRED/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا يُمنح الوصول المميز لمجرد امتلاك دور إداري/);
});

test("V101 package AD governs secret metadata, rotations, bindings, and certificates", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0470_v101_secrets_keys_certificates_governance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0470_v101_secrets_keys_certificates_governance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","41_PACKAGE_AD_SECRETS_KEYS_CERTIFICATES_V101_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE governance\.security_secret_policies/);
 assert.match(migration,/CREATE TABLE governance\.security_secret_records/);
 assert.match(migration,/CREATE TABLE governance\.security_secret_bindings/);
 assert.match(migration,/CREATE TABLE governance\.security_secret_rotation_events/);
 assert.match(migration,/CREATE TABLE governance\.security_certificate_inventory/);
 assert.match(migration,/EMERGENCY_ROTATION_REQUIRED/);
 assert.match(migration,/BINDING_REVIEW_REQUIRED/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا تخزن قاعدة البيانات كلمة مرور أو رمزًا أو مفتاحًا خاصًا/);
});

test("V102 package AE governs data products, quality rules, results, and remediation", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0480_v102_data_quality_governance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0480_v102_data_quality_governance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","42_PACKAGE_AE_DATA_QUALITY_V102_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE quality\.data_products/);
 assert.match(migration,/CREATE TABLE quality\.data_quality_rules/);
 assert.match(migration,/CREATE TABLE quality\.data_quality_runs/);
 assert.match(migration,/CREATE TABLE quality\.data_quality_results/);
 assert.match(migration,/CREATE TABLE quality\.data_quality_issues/);
 assert.match(migration,/CRITICAL_QUALITY_GATE_FAILED/);
 assert.match(migration,/BLOCK_MATCHING/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا تصحح قاعدة البيانات القيم تلقائيًا/);
});

test("V103 package AF governs data catalog, lineage, and impact assessment", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0490_v103_data_catalog_lineage_governance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0490_v103_data_catalog_lineage_governance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","43_PACKAGE_AF_DATA_CATALOG_LINEAGE_V103_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE quality\.data_catalog_terms/);
 assert.match(migration,/CREATE TABLE quality\.data_catalog_fields/);
 assert.match(migration,/CREATE TABLE quality\.data_lineage_nodes/);
 assert.match(migration,/CREATE TABLE quality\.data_lineage_edges/);
 assert.match(migration,/CREATE TABLE quality\.data_lineage_impact_assessments/);
 assert.match(migration,/UPSTREAM_LINEAGE_REQUIRED/);
 assert.match(migration,/IMPACT_ASSESSMENT_REQUIRED/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا تنشئ نسبًا تقديريًا غير مثبت/);
});

test("V104 package AG governs AI models, evaluations, drift, and human oversight", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0500_v104_ai_model_governance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0500_v104_ai_model_governance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","44_PACKAGE_AG_AI_MODEL_GOVERNANCE_V104_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE governance\.ai_systems/);
 assert.match(migration,/CREATE TABLE governance\.ai_model_versions/);
 assert.match(migration,/CREATE TABLE governance\.ai_model_evaluations/);
 assert.match(migration,/CREATE TABLE governance\.ai_model_monitoring_observations/);
 assert.match(migration,/CREATE TABLE governance\.ai_governance_decisions/);
 assert.match(migration,/EVALUATION_COVERAGE_REQUIRED/);
 assert.match(migration,/READY_WITH_HUMAN_OVERSIGHT/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/القرار النهائي للعميل/);
});

test("V105 package AH governs AI explanations, notices, overrides, contests, and incidents", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0510_v105_ai_transparency_contestability.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0510_v105_ai_transparency_contestability.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","45_PACKAGE_AH_AI_TRANSPARENCY_CONTESTABILITY_V105_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE governance\.ai_decision_explanations/);
 assert.match(migration,/CREATE TABLE governance\.ai_decision_notices/);
 assert.match(migration,/CREATE TABLE governance\.ai_human_override_records/);
 assert.match(migration,/CREATE TABLE governance\.ai_decision_contests/);
 assert.match(migration,/CREATE TABLE governance\.ai_decision_incidents/);
 assert.match(migration,/NOTICE_AND_CONTEST_RIGHT_REQUIRED/);
 assert.match(migration,/DUE_PROCESS_COMPLETE/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/يحتفظ العميل بحق القرار النهائي/);
});

test("V106 package AI governs metric definitions, observations, and report publication", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0520_v106_analytics_reporting_governance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0520_v106_analytics_reporting_governance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","46_PACKAGE_AI_ANALYTICS_REPORTING_V106_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE analytics\.metric_definitions/);
 assert.match(migration,/CREATE TABLE analytics\.metric_definition_versions/);
 assert.match(migration,/CREATE TABLE analytics\.metric_dimensions/);
 assert.match(migration,/CREATE TABLE analytics\.metric_observations/);
 assert.match(migration,/CREATE TABLE analytics\.report_definitions/);
 assert.match(migration,/CREATE TABLE analytics\.report_runs/);
 assert.match(migration,/PUBLIC_SENSITIVITY_VIOLATION/);
 assert.match(migration,/SYNTHETIC_DATA_DISCLOSURE_REQUIRED/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا تستخدم الواجهة إحصاءات مقنعة شكليًا/);
});

test("V107 package AJ governs notification preferences, messages, suppressions, and delivery", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0530_v107_communications_notification_governance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0530_v107_communications_notification_governance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","47_PACKAGE_AJ_COMMUNICATIONS_NOTIFICATIONS_V107_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE communication\.notification_topics/);
 assert.match(migration,/CREATE TABLE communication\.notification_preferences/);
 assert.match(migration,/CREATE TABLE communication\.message_templates/);
 assert.match(migration,/CREATE TABLE communication\.outbound_messages/);
 assert.match(migration,/CREATE TABLE communication\.delivery_attempts/);
 assert.match(migration,/CREATE TABLE communication\.contact_suppressions/);
 assert.match(migration,/OPTIONAL_CONSENT_REQUIRED/);
 assert.match(migration,/READY_TO_DISPATCH/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا تعني حالة «أُرسلت» أنها «وصلت»/);
});

test("V108 package AK governs localization, translations, and accessibility evidence", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0540_v108_localization_accessibility_governance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0540_v108_localization_accessibility_governance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","48_PACKAGE_AK_LOCALIZATION_ACCESSIBILITY_V108_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE localization\.locales/);
 assert.match(migration,/CREATE TABLE localization\.resource_keys/);
 assert.match(migration,/CREATE TABLE localization\.translation_versions/);
 assert.match(migration,/CREATE TABLE localization\.content_localizations/);
 assert.match(migration,/CREATE TABLE localization\.accessibility_requirements/);
 assert.match(migration,/CREATE TABLE localization\.accessibility_assessments/);
 assert.match(migration,/REQUIRED_TRANSLATION_MISSING/);
 assert.match(migration,/ACCESSIBILITY_REMEDIATION_REQUIRED/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا يعد الاختبار الآلي وحده إثباتًا كاملًا/);
});

test("V109 package AL governs configuration, feature flags, and controlled experiments", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0550_v109_configuration_feature_experiment_governance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0550_v109_configuration_feature_experiment_governance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","49_PACKAGE_AL_CONFIGURATION_FEATURE_EXPERIMENT_V109_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE governance\.configuration_definitions/);
 assert.match(migration,/CREATE TABLE governance\.configuration_versions/);
 assert.match(migration,/CREATE TABLE governance\.feature_flags/);
 assert.match(migration,/CREATE TABLE governance\.feature_flag_rules/);
 assert.match(migration,/CREATE TABLE governance\.controlled_experiments/);
 assert.match(migration,/CREATE TABLE governance\.experiment_assignments/);
 assert.match(migration,/APPROVED_PRODUCTION_RULE_REQUIRED/);
 assert.match(migration,/READY_FOR_GOVERNED_ROLLOUT/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/لا تستخدم لتغيير أوزان العميل خفية/);
});

test("V110 package AM governs API products, subscriptions, quotas, usage, and deprecation", () => {
 const migration=fs.readFileSync(path.join(root,"database","postgresql","migrations","0560_v110_api_product_lifecycle_governance.sql"),"utf8");
 const rollback=fs.readFileSync(path.join(root,"database","postgresql","rollback","0560_v110_api_product_lifecycle_governance.rollback.sql"),"utf8");
 const guide=fs.readFileSync(path.join(root,"database","postgresql","docs","50_PACKAGE_AM_API_PRODUCT_LIFECYCLE_V110_AR.md"),"utf8");
 assert.match(migration,/CREATE TABLE integration\.api_products/);
 assert.match(migration,/CREATE TABLE integration\.api_product_versions/);
 assert.match(migration,/CREATE TABLE integration\.api_subscriptions/);
 assert.match(migration,/CREATE TABLE integration\.api_quota_policies/);
 assert.match(migration,/CREATE TABLE integration\.api_usage_windows/);
 assert.match(migration,/CREATE TABLE integration\.api_deprecation_notices/);
 assert.match(migration,/QUOTA_POLICY_REQUIRED/);
 assert.match(migration,/DEPRECATION_NOTICE_REQUIRED/);
 assert.match(rollback,/rollback refused/);
 assert.match(guide,/الإهمال لا يعني الإيقاف الفوري/);
});
