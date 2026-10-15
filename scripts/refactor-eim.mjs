import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const source = process.argv[2];
if (!source || !fs.existsSync(source)) {
  throw new Error("Usage: node scripts/refactor-eim.mjs <stable-eim.html>");
}

const root = process.cwd();
const out = path.join(root, "public", "eim");
const cssDir = path.join(out, "css");
const jsDir = path.join(out, "js");
fs.mkdirSync(cssDir, { recursive: true });
fs.mkdirSync(jsDir, { recursive: true });

const html = fs.readFileSync(source, "utf8");
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
const style = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1];
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1];

if (scripts.length !== 2 || !style || !body) {
  throw new Error("The stable source must contain two scripts, one style block, and one body.");
}

function splitAtMarkers(content, units) {
  return units.map((unit, index) => {
    const start = unit.marker ? content.indexOf(unit.marker) : 0;
    if (start < 0) throw new Error(`Missing marker: ${unit.marker}`);
    const next = units[index + 1];
    const end = next ? content.indexOf(next.marker, start + 1) : content.length;
    if (next && end < 0) throw new Error(`Missing marker: ${next.marker}`);
    return { ...unit, content: content.slice(start, end).trim() + "\n" };
  });
}

const cssUnits = splitAtMarkers(style, [
  { file: "00-foundations.css", marker: null },
  { file: "10-shell-components.css", marker: "/* ===== الهيكل ===== */" },
  { file: "20-public-pages.css", marker: "/* ===== الموقع العام (Homepage) ===== */" },
  { file: "30-product-enhancements.css", marker: "/* EIM 5.9 — الملفات العامة الديناميكية */" },
]);

const jsUnits = splitAtMarkers(scripts[1], [
  { file: "00-reference-lists.js", marker: null },
  { file: "01-professional-taxonomy.js", marker: "const TAX=" },
  { file: "02-screen-configuration.js", marker: "const REC=" },
  { file: "03-membership-reference.js", marker: "const accountRoles=" },
  { file: "04-training-catalog.js", marker: "const TRAINING_COURSES=" },
  { file: "05-core-utilities.js", marker: "/* =========================================================\n   EIM 5.0 — النواة" },
  { file: "10-state-core.js", marker: "/* ===== الحالة العامة ===== */" },
  { file: "20-router-navigation.js", marker: "/* ===== التوجيه ===== */" },
  { file: "30-ui-components.js", marker: "/* ===== مكونات عامة ===== */" },
  { file: "40-dashboards-search.js", marker: "/* =========================================================\n   النواة:" },
  { file: "50-member-wizard.js", marker: "/* =========================================================\n   السجل المهني" },
  { file: "60-expertise-evidence.js", marker: "/* =========================================================\n   رحلة الخبير" },
  { file: "70-client-workflows.js", marker: "/* =========================================================\n   رحلة العميل" },
  { file: "80-training-courses.js", marker: "/* التدريب والدورات */" },
  { file: "90-directories-public.js", marker: "/* =========================================================\n   مركز البحث المتخصص" },
  { file: "100-membership-records.js", marker: "/* =========================================================\n   نماذج بيانات العضويات" },
  { file: "120-render-bootstrap.js", marker: "/* =========================================================\n   الموجّه الرئيسي" },
]);

function applyRuntimeSafetyPatches(content) {
  return content
    .replace(
      `function render(){current=currentId();
  if(!location.hash){location.replace('#/'+current);return}
  let hN=parseInt(location.hash.replace('#/',''));
  if(hN!==current){location.replace('#/'+current);return}`,
      `function render(){current=currentId();
  let hN=parseInt(location.hash.replace('#/',''));
  if(!location.hash||hN!==current)history.replaceState(null,'','#/'+current)`,
    )
    .replace(
      `migrateUnifiedRegistry();
migrateCourseGovernance();
migrateClientWorkflow();
migrateInstitutionalClients();
applyTheme(document.documentElement.dataset.theme,false);
render();setTimeout(()=>persist(true),600);`,
      `function safeBootTask(name,task){try{task()}catch(error){console.error('[EIM boot] '+name,error);(window.__EIM_BOOT_ERRORS=window.__EIM_BOOT_ERRORS||[]).push({name,message:error?.message||String(error)})}}
applyTheme(document.documentElement.dataset.theme,false);
render();
safeBootTask('unified-registry',migrateUnifiedRegistry);
safeBootTask('course-governance',migrateCourseGovernance);
safeBootTask('client-workflow',migrateClientWorkflow);
safeBootTask('institutional-clients',migrateInstitutionalClients);
render();setTimeout(()=>persist(true),600);`,
    );
}

const bootstrapUnit = jsUnits.find((unit) => unit.file === "120-render-bootstrap.js");
bootstrapUnit.content = applyRuntimeSafetyPatches(bootstrapUnit.content);

for (const unit of cssUnits) fs.writeFileSync(path.join(cssDir, unit.file), unit.content);
for (const unit of jsUnits) fs.writeFileSync(path.join(jsDir, unit.file), unit.content);
fs.writeFileSync(path.join(jsDir, "theme-init.js"), scripts[0].trim() + "\n");
const runtimeBundle = jsUnits.map((unit) => unit.content.trim()).join("\n") + "\n";
const runtimeHash = crypto.createHash("sha256").update(runtimeBundle).digest("hex").slice(0, 12);
const runtimeFile = `app.bundle.${runtimeHash}.js`;
for (const file of fs.readdirSync(jsDir)) {
  if (/^app\.bundle(?:\.[a-f0-9]+)?\.js$/.test(file) && file !== runtimeFile) {
    fs.unlinkSync(path.join(jsDir, file));
  }
}
fs.writeFileSync(path.join(jsDir, runtimeFile), runtimeBundle);

const cleanBody = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").trim();
const cssLinks = cssUnits.map((u) => `  <link rel="stylesheet" href="./css/${u.file}">`).join("\n");
const jsLinks = `  <script src="./js/${runtimeFile}"></script>`;

const modularHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="شبكة الخبراء العرب — نموذج EIM معياري قابل للصيانة">
  <title>EIM 6.0 | شبكة الخبراء العرب</title>
  <script src="./js/theme-init.js"></script>
${cssLinks}
</head>
<body>
${cleanBody}
${jsLinks}
</body>
</html>
`;

fs.writeFileSync(path.join(out, "index.html"), modularHtml);
fs.copyFileSync(source, path.join(out, "reference", "EIM_5.15.0_stable.html"));

const manifest = {
  source: path.basename(source),
  generatedAt: new Date().toISOString(),
  css: cssUnits.map((u) => u.file),
  javascript: ["theme-init.js", runtimeFile],
  sourceModules: jsUnits.map((u) => u.file),
  entry: "index.html",
  policy: "Edit sourceModules; app.bundle.js is the generated browser runtime.",
};
fs.writeFileSync(path.join(out, "module-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(JSON.stringify({
  status: "ok",
  output: out,
  cssFiles: cssUnits.length,
  jsFiles: jsUnits.length + 1,
}, null, 2));
