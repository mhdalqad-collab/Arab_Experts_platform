import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const migrationsDir = path.join(root, "migrations");
const output = path.join(root, "docs", "11_CURRENT_TARGET_RECONCILIATION_V71.csv");

const rules = new Map([
  ["crm.client_organizations", ["MERGE", "core.organizations + crm.client_accounts", "عالية", "إزالة نسخة هوية المنظمة من CRM مع إبقاء علاقة العميل"]],
  ["crm.client_contacts", ["RENAME", "crm.client_contact_roles", "متوسطة", "السجل يمثل علاقة ودورًا لا نسخة شخص"]],
  ["services.service_catalog_items", ["RENAME", "services.service_definitions", "متوسطة", "توحيد اسم تعريف الخدمة مع النموذج المفاهيمي"]],
  ["professional.employment_experiences", ["MERGE", "professional.experience_records", "عالية", "توحيد الخبرات مع حقل نوع مضبوط"]],
  ["professional.project_experiences", ["MERGE", "professional.experience_records", "عالية", "توحيد الخبرات مع حفظ النوع والمصدر"]],
  ["professional.training_experiences", ["MERGE", "professional.experience_records", "عالية", "توحيد الخبرات مع حفظ بيانات الدورة"]],
  ["professional.consulting_experiences", ["MERGE", "professional.experience_records", "عالية", "توحيد الخبرات مع حفظ بيانات الاستشارة"]],
  ["professional.research_experiences", ["MERGE", "professional.experience_records", "عالية", "توحيد الخبرات مع حفظ بيانات البحث"]],
  ["training.courses", ["RENAME", "training.course_contents", "عالية", "تمييز هوية المحتوى عن الطرح"]],
  ["training.course_names", ["MERGE", "training.course_content_versions", "متوسطة", "الاسم جزء من نسخة المحتوى متعددة اللغة"]],
  ["training.course_versions", ["RENAME", "training.course_content_versions", "عالية", "تثبيت إدارة الإصدارات للمحتوى"]],
  ["training.course_delivery_rights", ["MOVE", "rights.course_delivery_rights", "عالية", "ملكية القرار لنطاق الحقوق"]],
  ["training.course_reviews", ["MOVE", "quality.training_evaluations", "متوسطة", "فصل التقييم عن تشغيل التدريب"]],
  ["delivery.deliverable_acceptances", ["RENAME", "delivery.acceptance_decisions", "متوسطة", "القبول قرار مؤرخ لا خاصية للتسليم"]],
  ["governance.corrective_actions", ["SPLIT", "governance.audit_corrective_actions + quality.corrective_actions", "عالية", "فصل معالجة التدقيق عن معالجة الجودة والشكاوى"]],
  ["governance.corrective_action_evidence", ["SPLIT", "governance.audit_corrective_action_evidence + quality.corrective_action_evidence", "عالية", "توجيه الدليل إلى سياقه الصحيح"]],
]);

for (const name of [
  "contracts", "contract_parties", "contract_versions", "contract_clauses",
  "contract_signatures", "contract_status_history",
]) {
  rules.set(`finance.${name}`, ["MOVE", `contract.${name}`, "عالية", "العقد كيان تجاري مشترك وليس حركة مالية"]);
}

for (const name of [
  "ip_assets", "ip_asset_versions", "ip_owners", "ip_contributors",
  "ip_licenses", "confidentiality_agreements",
]) {
  rules.set(`finance.${name}`, ["MOVE", `rights.${name}`, "عالية", "نقل الملكية الفكرية والسرية إلى نطاق الحقوق"]);
}

const qualityTargets = {
  rating_dimensions: "evaluation_dimensions",
  ratings: "evaluations",
  rating_responses: "evaluation_responses",
  reputation_profiles: "reputation_snapshots",
  complaints: "complaints",
  complaint_evidence: "complaint_evidence",
  complaint_decisions: "complaint_decisions",
  appeals: "complaint_appeals",
};
for (const [source, target] of Object.entries(qualityTargets)) {
  rules.set(`evidence.${source}`, ["MOVE", `quality.${target}`, "عالية", "فصل الجودة والسمعة عن أدلة الادعاءات"]);
}

const rows = [];
for (const filename of fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
  const source = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
  const pattern = /CREATE TABLE(?: IF NOT EXISTS)?\s+([a-z_]+)\.([a-z_]+)\s*\(/gi;
  for (const match of source.matchAll(pattern)) {
    const current = `${match[1]}.${match[2]}`;
    const [action, target, risk, rationale] =
      rules.get(current) ?? ["KEEP", current, "منخفضة", "متوافق مع الحدود المنطقية المستهدفة"];
    rows.push({ source: filename, current, action, target, risk, rationale });
  }
}

const additions = [
  ["professional.experience_records", "سجل خبرة موحد مع نوع ومصدر وفترة"],
  ["taxonomy.concept_status_history", "تاريخ نشر وإيقاف المفاهيم"],
  ["taxonomy.mapping_decisions", "دليل واعتماد قرارات الربط الدلالي"],
  ["contract.contract_amendments", "ملاحق وتعديلات العقد"],
  ["delivery.project_baselines", "خط أساس النطاق والوقت والتكلفة"],
  ["delivery.acceptance_criteria", "معايير قبول قابلة للقياس"],
  ["delivery.progress_reports", "تقارير تقدم مؤرخة ومراجعة"],
  ["delivery.project_contributions", "مساهمة كل عضو ودوره"],
  ["rights.disclosure_records", "سجل الإفصاح المصرح والغرض"],
  ["rights.information_use_restrictions", "قيود استخدام المعلومات"],
  ["finance.ledger_entries", "قيود مالية غير قابلة لإعادة الكتابة"],
  ["finance.revenue_shares", "توزيع الإيراد على المستفيدين"],
  ["quality.corrective_actions", "إجراءات جودة مرتبطة بقرار شكوى أو تقييم"],
  ["quality.reputation_model_versions", "إصدارات نموذج حساب السمعة"],
  ["governance.access_decisions", "قرار الوصول الفعلي مع الغرض والسبب"],
  ["governance.automated_decision_records", "تفسير واعتراض القرارات المؤثرة"],
];
for (const [target, rationale] of additions) {
  rows.push({ source: "NEW", current: "", action: "ADD", target, risk: "متوسطة", rationale });
}

const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
const header = ["source_migration", "current_table", "decision", "target_table", "migration_risk", "rationale"];
const body = rows.map((row) => [
  row.source, row.current, row.action, row.target, row.risk, row.rationale,
].map(quote).join(","));
fs.writeFileSync(output, `\uFEFF${header.map(quote).join(",")}\n${body.join("\n")}\n`);
console.log(`Generated ${path.relative(process.cwd(), output)} with ${rows.length} classified rows.`);
