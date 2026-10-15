import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const run = (name, command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", shell: false });
  return { name, status: result.status === 0 ? "PASSED" : "FAILED", detail: (result.stdout || result.stderr).trim().split("\n").slice(-1)[0] || `exit ${result.status}` };
};

const backendSpec = await readFile(join(root, "openapi/eim-v113-backend-r5.yaml"), "utf8");
const sameOriginSpec = await readFile(join(root, "openapi/eim-v113-r5.yaml"), "utf8");
const migrations = (await readdir(join(root, "database/postgresql/migrations"))).filter((name) => name.endsWith(".sql"));
const required = [
  "Dockerfile.backend", "Dockerfile.frontend", "deployment/docker-compose.yml",
  "deployment/nginx.conf.template", ".github/workflows/quality-gates.yml",
  "eim-v113-sbom.cdx.json", "docs/backend-handoff/11_PRODUCTION_GO_NO_GO_CHECKLIST_AR.md",
];
const missing = required.filter((path) => !existsSync(join(root, path)));
const localGates = [
  run("OpenAPI drift and schema gates", "node", ["scripts/validate-openapi.mjs"]),
  run("Security baseline", "bash", ["scripts/security-baseline.sh"]),
  run("Deployment scripts syntax", "bash", ["-n", "scripts/deployment-preflight.sh", "scripts/deployment-smoke-test.sh", "database/postgresql/scripts/backup.sh", "database/postgresql/scripts/restore-verify.sh"]),
];
if (missing.length) localGates.push({ name: "Required release artifacts", status: "FAILED", detail: missing.join(", ") });
else localGates.push({ name: "Required release artifacts", status: "PASSED", detail: `${required.length} artifacts present` });

const externalGates = [
  ["CI hosted workflow", "Run the workflow on the immutable release commit."],
  ["Docker image build", "Build both images and record immutable digests."],
  ["PostgreSQL migration rehearsal", "Apply all migrations and tests to PostgreSQL 16."],
  ["Backup and restore rehearsal", "Restore the release backup to a disposable empty database."],
  ["OIDC and step-up", "Validate the real issuer, JWKS rotation, audience, roles, and assurance."],
  ["Object storage and malware scan", "Exercise upload, scan, grants, one-time download, and expiry."],
  ["Notification delivery", "Validate provider callbacks, retries, dead letters, and SLO alerts."],
  ["Smoke, performance, and UAT", "Execute smoke, load, negative authorization, and business acceptance suites."],
  ["DNS, TLS, monitoring", "Validate certificates, external routing, dashboards, alerts, and log redaction."],
].map(([name, detail]) => ({ name, status: "PENDING_EXTERNAL", detail }));

const localPassed = localGates.every((gate) => gate.status === "PASSED");
const report = {
  generatedAt: new Date().toISOString(),
  release: "V113 R5 Production Candidate baseline",
  status: localPassed ? "PREPARED_PENDING_EXTERNAL_VALIDATION" : "LOCAL_GATES_FAILED",
  inventory: {
    postgresqlMigrations: migrations.length,
    backendPaths: (backendSpec.match(/^  \//gm) ?? []).length,
    backendOperations: (backendSpec.match(/^    (get|post|put|patch|delete):/gm) ?? []).length,
    sameOriginPaths: (sameOriginSpec.match(/^  \//gm) ?? []).length,
    sameOriginOperations: (sameOriginSpec.match(/^    (get|post|put|patch|delete):/gm) ?? []).length,
  },
  localGates,
  externalGates,
  decision: "NO-GO until every PENDING_EXTERNAL gate is evidenced and approved.",
};
await writeFile(join(root, "release/RC1_READINESS_REPORT.json"), JSON.stringify(report, null, 2) + "\n");
const markdown = [
  "# تقرير جاهزية RC1", "", `- الحالة: **${report.status}**`, `- تاريخ الإنشاء: ${report.generatedAt}`,
  `- الترحيلات: ${report.inventory.postgresqlMigrations}`, `- Backend: ${report.inventory.backendPaths} مسارًا / ${report.inventory.backendOperations} عملية`,
  `- Same-Origin: ${report.inventory.sameOriginPaths} مسارًا / ${report.inventory.sameOriginOperations} عملية`, "", "## البوابات المحلية", "",
  ...localGates.map((gate) => `- ${gate.status === "PASSED" ? "✅" : "❌"} ${gate.name}: ${gate.detail}`), "", "## البوابات الخارجية", "",
  ...externalGates.map((gate) => `- ⏳ ${gate.name}: ${gate.detail}`), "", `**القرار:** ${report.decision}`, "",
].join("\n");
await writeFile(join(root, "release/RC1_READINESS_REPORT_AR.md"), markdown);
console.log(JSON.stringify(report, null, 2));
if (!localPassed) process.exitCode = 1;
