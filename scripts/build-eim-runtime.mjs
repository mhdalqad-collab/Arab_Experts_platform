import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const app = path.join(process.cwd(), "public", "eim");
const jsDir = path.join(app, "js");
const cssDir = path.join(app, "css");
const manifestPath = path.join(app, "module-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const hash = (value) =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);

const runtime = manifest.sourceModules
  .map((file) => fs.readFileSync(path.join(jsDir, file), "utf8").trim())
  .join("\n") + "\n";
const runtimeFile = `app.bundle.${hash(runtime)}.js`;

const styles = manifest.css
  .map((file) => fs.readFileSync(path.join(cssDir, file), "utf8").trim())
  .join("\n") + "\n";
const styleFile = `app.styles.${hash(styles)}.css`;

for (const file of fs.readdirSync(jsDir)) {
  if (/^app\.bundle\.[a-f0-9]+\.js$/.test(file) && file !== runtimeFile) {
    fs.unlinkSync(path.join(jsDir, file));
  }
}
for (const file of fs.readdirSync(cssDir)) {
  if (/^app\.styles\.[a-f0-9]+\.css$/.test(file) && file !== styleFile) {
    fs.unlinkSync(path.join(cssDir, file));
  }
}
fs.writeFileSync(path.join(jsDir, runtimeFile), runtime);
fs.writeFileSync(path.join(cssDir, styleFile), styles);

let html = fs.readFileSync(path.join(app, manifest.entry), "utf8");
html = html.replace(
  /(?:\s*<link rel="stylesheet" href="\.\/css\/[^"]+">)+/,
  `\n  <link rel="stylesheet" href="./css/${styleFile}">`,
);
html = html.replace(
  /<script src="\.\/js\/app\.bundle\.[a-f0-9]+\.js"><\/script>/,
  `<script src="./js/${runtimeFile}"></script>`,
);
fs.writeFileSync(path.join(app, manifest.entry), html);

manifest.javascript = ["theme-init.js", "hosting-status.js", runtimeFile];
manifest.runtimeCss = styleFile;
manifest.generatedAt = new Date().toISOString();
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Built ${runtimeFile} and ${styleFile}`);
