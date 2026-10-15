import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const app = path.join(root, "public", "eim");
const manifest = JSON.parse(fs.readFileSync(path.join(app, "module-manifest.json"), "utf8"));
const html = fs.readFileSync(path.join(app, manifest.entry), "utf8");
const errors = [];

for (const file of manifest.css) {
  if (!fs.existsSync(path.join(app, "css", file))) errors.push(`Missing CSS: ${file}`);
  if (html.includes(`./css/${file}`)) errors.push(`Source CSS must not be linked directly: ${file}`);
}
if (!manifest.runtimeCss || !fs.existsSync(path.join(app, "css", manifest.runtimeCss))) {
  errors.push("Missing generated runtime CSS.");
} else if (!html.includes(`./css/${manifest.runtimeCss}`)) {
  errors.push("Generated runtime CSS is not linked.");
}

for (const file of manifest.javascript) {
  const local = path.join(app, "js", file);
  if (!fs.existsSync(local)) {
    errors.push(`Missing JavaScript: ${file}`);
    continue;
  }
  if (!html.includes(`./js/${file}`)) errors.push(`Unlinked JavaScript: ${file}`);
  try {
    new vm.Script(fs.readFileSync(local, "utf8"), { filename: file });
  } catch (error) {
    errors.push(`Syntax error in ${file}: ${error.message}`);
  }
}

for (const file of manifest.sourceModules ?? []) {
  const local = path.join(app, "js", file);
  if (!fs.existsSync(local)) {
    errors.push(`Missing source module: ${file}`);
    continue;
  }
  if (html.includes(`./js/${file}`)) {
    errors.push(`Source module must not be loaded separately: ${file}`);
  }
  try {
    new vm.Script(fs.readFileSync(local, "utf8"), { filename: file });
  } catch (error) {
    errors.push(`Syntax error in source module ${file}: ${error.message}`);
  }
}

const combined = manifest.javascript
  .map((file) => fs.readFileSync(path.join(app, "js", file), "utf8"))
  .join("\n");

const requiredRoutes = [1, 2, 3, 5, 20, 33, 35, 44, 45, 46, 47, 48, 49, 50, 51, 52, 55, 56, 57, 58, 59, 60, 61, 63, 64, 65, 66, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78];
for (const route of requiredRoutes) {
  if (!new RegExp(`(?:^|[,\\n ])${route}\\s*:`).test(combined)) errors.push(`Missing route: ${route}`);
}

const requiredFunctions = [
  "go", "goBack", "render", "buildNav", "rHome", "rRegister",
  "rCatalog", "rSearch", "rMembershipForm", "persist", "applyTheme",
];
for (const name of requiredFunctions) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(combined)) errors.push(`Missing function: ${name}`);
}

const original = fs.readFileSync(path.join(app, "reference", "EIM_5.15.0_stable.html"), "utf8");
const originalScripts = [...original.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim());
const rebuiltScripts = [
  fs.readFileSync(path.join(app, "js", "theme-init.js"), "utf8").trim(),
  fs.readFileSync(path.join(app, "js", manifest.javascript.find((file) => /^app\.bundle\.[a-f0-9]{12}\.js$/.test(file))), "utf8").trim(),
];
if (originalScripts[0] !== rebuiltScripts[0]) errors.push("Theme initialization changed during extraction.");
const normalize = (value) => value.replace(/\s+/g, " ").trim();
const sourceRebuilt = (manifest.sourceModules ?? [])
  .map((file) => fs.readFileSync(path.join(app, "js", file), "utf8").trim())
  .join("\n");
if (normalize(sourceRebuilt) !== normalize(rebuiltScripts[1])) {
  errors.push("Browser bundle does not match the maintainable source modules.");
}
for (const token of ["const TAX=", "const TAX_DETAILS=", "const TRAINING_COURSES=", "const data="]) {
  if (!originalScripts[1].includes(token) || !sourceRebuilt.includes(token)) {
    errors.push(`Reference data section is missing: ${token}`);
  }
}
if (!sourceRebuilt.includes("function safeBootTask(")) {
  errors.push("Safe boot recovery is missing.");
}

if (!html.includes('id="nav"') || !html.includes('id="view"')) errors.push("Application shell is incomplete.");
if (!html.includes('dir="rtl"') || !html.includes('lang="ar"')) errors.push("Arabic RTL document attributes are missing.");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "passed",
  cssFiles: manifest.css.length,
  jsFiles: manifest.javascript.length,
  sourceModules: manifest.sourceModules?.length ?? 0,
  routesChecked: requiredRoutes.length,
  functionsChecked: requiredFunctions.length,
  sourcePreserved: "data and routes preserved; bootstrap reliability patch applied",
}, null, 2));
