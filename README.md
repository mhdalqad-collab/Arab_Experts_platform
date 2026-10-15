# شبكة الخبراء العرب — EIM 6 / V113 Backend Handoff R5

> **Render free demo:** use the root `render.yaml` Blueprint or follow [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for manual setup and connecting your existing domain. It explicitly selects the Free plan and preview mode; real accounts and uploads require external services.

> **GoDaddy Node.js:** the deployment branch now uses Next.js, PostgreSQL-backed web APIs, OIDC sessions and private S3-compatible storage. See [GODADDY_DEPLOYMENT.md](GODADDY_DEPLOYMENT.md) for preview setup, required services and verification limits. The historical Sites instructions below describe the original archive.

هذه حزمة مرشح V113، مبنية على الأساس التنفيذي V112 مع إغلاق أخطاء
TypeScript وإضافة وثائق متطلبات MVP V113. نجاح الاختبارات المحلية لا يعني
القبول الإنتاجي قبل PostgreSQL integration وE2E والأمن والأداء وUAT.

## Backend Handoff R5

- [الملخص التنفيذي للتسليم](docs/backend-handoff/00_BACKEND_HANDOFF_EXECUTIVE_R5_AR.md)
- [قرار PostgreSQL كمصدر الحقيقة](docs/backend-handoff/01_ADR_POSTGRES_SOURCE_OF_TRUTH_AR.md)
- [مصفوفة البيئة والتكاملات](docs/backend-handoff/02_ENVIRONMENT_INTEGRATION_MATRIX_AR.md)
- [سياسة الترحيل والتراجع](docs/backend-handoff/03_MIGRATION_ROLLBACK_POLICY_AR.md)
- [خطة تنفيذ Backend](docs/backend-handoff/04_BACKEND_DELIVERY_PLAN_AR.md)
- [معيار الإنجاز والقبول](docs/backend-handoff/05_DEFINITION_OF_DONE_ACCEPTANCE_AR.md)
- [سجل P0/P1/P2](docs/backend-handoff/06_BACKLOG_P0_P1_P2_AR.md)
- [عقد OpenAPI](openapi/eim-v113-r5.yaml)
- [خدمة Backend PostgreSQL](backend/README_AR.md)

القرار المعماري المقترح في R5 يجعل PostgreSQL 16 مصدر الحقيقة الإنتاجي، ويقصر
D1 على العرض أو الانتقال المؤقت. يجب توقيع ADR-001 قبل توسيع Backend.

## EIM conceptual baseline

- [قاموس المصطلحات والحدود المفاهيمية](docs/EIM-CONCEPTUAL-GLOSSARY-AR.md)
- [مواصفة محفظة البصمات المهنية الديناميكية](docs/EIM-DYNAMIC-PROFESSIONAL-FINGERPRINT-SPEC-AR.md)
- [مواصفة الأدلة والتحقق ودرجة اليقين](docs/EIM-EVIDENCE-VERIFICATION-CONFIDENCE-SPEC-AR.md)
- [مواصفة الأنطولوجيا وطبقة الربط الدلالي](docs/EIM-ONTOLOGY-SEMANTIC-MAPPING-SPEC-AR.md)
- [النموذج الموحد للقدرات والخدمات والعروض](docs/EIM-CAPABILITIES-SERVICES-OFFERS-SPEC-AR.md)
- [مواصفة احتياج العميل وبصمة المهمة](docs/EIM-CLIENT-NEED-TASK-FINGERPRINT-SPEC-AR.md)
- [مواصفة المطابقة والتوصية وتكوين فرق الخبراء](docs/EIM-MATCHING-RECOMMENDATION-TEAMING-SPEC-AR.md)
- [مواصفة التعلم والتدريب والمحتوى والفعاليات](docs/EIM-LEARNING-TRAINING-CONTENT-EVENTS-SPEC-AR.md)
- [مواصفة الاستشارات والمشاريع والتسليمات](docs/EIM-CONSULTING-PROJECTS-DELIVERABLES-SPEC-AR.md)
- [مواصفة البحث والنشر وإدارة المعرفة](docs/EIM-RESEARCH-PUBLICATION-KNOWLEDGE-SPEC-AR.md)
- [مواصفة العقود والمدفوعات والاشتراكات](docs/EIM-CONTRACTS-PAYMENTS-SUBSCRIPTIONS-SPEC-AR.md)
- [مواصفة السمعة والتقييم والجودة والشكاوى](docs/EIM-REPUTATION-QUALITY-COMPLAINTS-SPEC-AR.md)
- [مواصفة الحقوق والملكية الفكرية والسرية](docs/EIM-RIGHTS-IP-CONFIDENTIALITY-SPEC-AR.md)
- [مواصفة الحوكمة والخصوصية والأمن والتدقيق والتكاملات](docs/EIM-GOVERNANCE-PRIVACY-SECURITY-AUDIT-INTEGRATIONS-SPEC-AR.md)
- [خط الأساس المفاهيمي ومصفوفة التتبع](docs/EIM-CONCEPTUAL-BASELINE-TRACEABILITY-AR.md)
- [النموذج المنطقي الموحد V70](database/postgresql/docs/09_LOGICAL_MODEL_V70_AR.md)
- [قاموس البيانات المركزي V70](database/postgresql/docs/10_CENTRAL_DATA_DICTIONARY_V70_AR.md)
- [قرارات مطابقة PostgreSQL الحالي بالمستهدف V71](database/postgresql/docs/11_RECONCILIATION_DECISIONS_V71_AR.md)
- [جرد وتصنيف جميع الجداول الحالية](database/postgresql/docs/11_CURRENT_TARGET_RECONCILIATION_V71.csv)
- [الحزمة A التأسيسية غير الهادمة V72](database/postgresql/docs/12_PACKAGE_A_FOUNDATION_V72_AR.md)
- [الحزمة B لهوية العميل والعلاقات المؤسسية V73](database/postgresql/docs/13_PACKAGE_B_CLIENT_IDENTITY_V73_AR.md)
- [الحزمة C للخبرات ومحتوى الدورات V74](database/postgresql/docs/14_PACKAGE_C_PROFESSIONAL_TRAINING_V74_AR.md)

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Sites Lifecycle

The Sites lifecycle CLI runs the locked dependency install before returning this checkout. Edit the source under `app/`, then checkpoint when a coherent milestone is ready to inspect or share. The remote Sites builder runs `npm run build` against the pushed commit. Do not repeat install or build as a normal pre-checkpoint step.

This starter does not use `wrangler.jsonc`.

`install:ci` is intentionally a single, non-retrying `npm ci`. It refuses a concurrent install for the same project, consumes a matching image-seeded npm cache with `--prefer-offline` while retaining registry fallback for a missing cache object, otherwise downloads and verifies the complete vinext tarball recorded in `package-lock.json`, limits npm to one socket, and terminates a stalled install. `build` applies a short timeout and then validates the Sites artifact. These helpers target Linux and use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Diagnostic Commands

Database unification guides:

- [Package D: contracts, rights, and quality](database/postgresql/docs/15_PACKAGE_D_CONTRACT_RIGHTS_QUALITY_V75_AR.md)
- [Package E: end-to-end service lifecycle](database/postgresql/docs/16_PACKAGE_E_SERVICE_LIFECYCLE_V76_AR.md)
- [Package F: governed service-case transitions](database/postgresql/docs/17_PACKAGE_F_WORKFLOW_GOVERNANCE_V77_AR.md)
- [Package G: transactional service-case command executor](database/postgresql/docs/18_PACKAGE_G_COMMAND_EXECUTOR_V78_AR.md)
- [Package H: approval resume and reliable outbox dispatch](database/postgresql/docs/19_PACKAGE_H_APPROVAL_OUTBOX_V79_AR.md)
- [Package I: PostgreSQL integration tests and enforcement readiness](database/postgresql/docs/20_PACKAGE_I_INTEGRATION_READINESS_V80_AR.md)
- [Package J: governed canary rollout and emergency rollback](database/postgresql/docs/21_PACKAGE_J_GOVERNED_ROLLOUT_V81_AR.md)
- [Package K: rollout-aware service-case command executor](database/postgresql/docs/22_PACKAGE_K_ROLLOUT_AWARE_EXECUTOR_V82_AR.md)
- [Package L: Canary metrics, recommendations, and safety thresholds](database/postgresql/docs/23_PACKAGE_L_CANARY_METRICS_V83_AR.md)
- [Package M: governed workflow operations console](database/postgresql/docs/24_PACKAGE_M_OPERATIONS_CONSOLE_V84_AR.md)
- [Package N: secure operations adapter contract](database/postgresql/docs/25_PACKAGE_N_OPERATIONS_ADAPTER_V85_AR.md)
- [Package O: live governed operations bridge](database/postgresql/docs/26_PACKAGE_O_LIVE_OPERATIONS_BRIDGE_V86_AR.md)
- [Package P: operational approvals and separation of duties](database/postgresql/docs/27_PACKAGE_P_OPERATION_APPROVAL_SOD_V87_AR.md)
- [Package Q: operations incident response and escalation](database/postgresql/docs/28_PACKAGE_Q_INCIDENT_RESPONSE_V88_AR.md)
- [Package R: incident resolution, effectiveness, and learning](database/postgresql/docs/29_PACKAGE_R_INCIDENT_RESOLUTION_LEARNING_V89_AR.md)
- [Package S: reliability objectives, SLOs, and error budgets](database/postgresql/docs/30_PACKAGE_S_RELIABILITY_SLO_V90_AR.md)
- [Package T: governed change, release, and production deployment](database/postgresql/docs/31_PACKAGE_T_CHANGE_RELEASE_V91_AR.md)
- [Package U: backup, disaster recovery, and continuity](database/postgresql/docs/32_PACKAGE_U_BACKUP_DR_V92_AR.md)
- [Package V: capacity, performance, load testing, and scaling](database/postgresql/docs/33_PACKAGE_V_CAPACITY_PERFORMANCE_V93_AR.md)
- [Package W: FinOps cost governance and unit economics](database/postgresql/docs/34_PACKAGE_W_FINOPS_V94_AR.md)
- [Package X: vendor and third-party service governance](database/postgresql/docs/35_PACKAGE_X_VENDOR_GOVERNANCE_V95_AR.md)
- [Package Y: governed data retention and disposition](database/postgresql/docs/36_PACKAGE_Y_DATA_RETENTION_V96_AR.md)
- [Package Z: compliance controls and assurance evidence](database/postgresql/docs/37_PACKAGE_Z_COMPLIANCE_ASSURANCE_V97_AR.md)
- [Package AA: enterprise risk governance and control linkage](database/postgresql/docs/38_PACKAGE_AA_ENTERPRISE_RISK_V98_AR.md)
- [Package AB: security assets and vulnerability remediation governance](database/postgresql/docs/39_PACKAGE_AB_SECURITY_ASSETS_V99_AR.md)
- [Package AC: just-in-time privileged access and session attestation](database/postgresql/docs/40_PACKAGE_AC_PRIVILEGED_ACCESS_V100_AR.md)
- [Package AD: secrets, keys, and certificate lifecycle governance](database/postgresql/docs/41_PACKAGE_AD_SECRETS_KEYS_CERTIFICATES_V101_AR.md)
- [Package AE: data quality rules, evidence, and stewardship](database/postgresql/docs/42_PACKAGE_AE_DATA_QUALITY_V102_AR.md)
- [Package AF: data catalog, lineage, and governed impact assessment](database/postgresql/docs/43_PACKAGE_AF_DATA_CATALOG_LINEAGE_V103_AR.md)
- [Package AG: AI model, matching algorithm, and human-oversight governance](database/postgresql/docs/44_PACKAGE_AG_AI_MODEL_GOVERNANCE_V104_AR.md)
- [Package AH: AI decision transparency, contestability, and incident governance](database/postgresql/docs/45_PACKAGE_AH_AI_TRANSPARENCY_CONTESTABILITY_V105_AR.md)
- [Package AI: governed metrics, analytics, and report publication](database/postgresql/docs/46_PACKAGE_AI_ANALYTICS_REPORTING_V106_AR.md)
- [Package AJ: governed notifications, preferences, and delivery evidence](database/postgresql/docs/47_PACKAGE_AJ_COMMUNICATIONS_NOTIFICATIONS_V107_AR.md)
- [Package AK: multilingual localization and accessibility governance](database/postgresql/docs/48_PACKAGE_AK_LOCALIZATION_ACCESSIBILITY_V108_AR.md)
- [Package AL: governed configuration, feature flags, and controlled experiments](database/postgresql/docs/49_PACKAGE_AL_CONFIGURATION_FEATURE_EXPERIMENT_V109_AR.md)
- [Package AM: governed API products, subscriptions, quotas, and deprecation](database/postgresql/docs/50_PACKAGE_AM_API_PRODUCT_LIFECYCLE_V110_AR.md)
- [Final acceptance review: preservation release V112](database/postgresql/docs/51_FINAL_ACCEPTANCE_REVIEW_V112_AR.md)

- `npm run install:ci`: perform the one bounded lockfile install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build and validate the deployable Sites artifact
- `npm run start`: start the built Vinext application
- `npm test`: build, validate, and verify the rendered development-preview metadata
- `npm run validate:artifact`: recheck an existing artifact's manifest and ESM `default.fetch` export
- `npm run validate:openapi`: verify that OpenAPI covers every implemented API method
- `npm run db:generate`: generate Drizzle migrations after schema changes

Use build and validation commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
