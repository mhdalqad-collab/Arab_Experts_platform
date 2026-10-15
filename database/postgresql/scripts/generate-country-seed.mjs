import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourcePath = "/usr/share/zoneinfo/iso3166.tab";
const outputPath = resolve(
  import.meta.dirname,
  "../seeds/000_countries_seed.sql",
);

const displayAr = new Intl.DisplayNames(["ar"], { type: "region" });
const displayEn = new Intl.DisplayNames(["en"], { type: "region" });

const rows = readFileSync(sourcePath, "utf8")
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => line.split("\t")[0])
  .filter((code) => /^[A-Z]{2}$/.test(code))
  .map((code, index) => ({
    code,
    nameAr: displayAr.of(code),
    nameEn: displayEn.of(code),
    order: index + 1,
  }));

const sqlEscape = (value) => value.replaceAll("'", "''");
const values = rows
  .map(
    ({ code, nameAr, nameEn, order }) =>
      `  ('${code}', '${sqlEscape(nameAr)}', '${sqlEscape(nameEn)}', ${order})`,
  )
  .join(",\n");

const sql = `-- Generated from the public-domain ISO 3166 alpha-2 table and ICU names.
-- Alpha-3 and numeric codes are intentionally nullable until loaded from a licensed
-- or officially supplied ISO dataset; alpha-2 remains the canonical primary key.
BEGIN;

INSERT INTO reference.countries
  (country_code, name_ar, name_en, display_order)
VALUES
${values}
ON CONFLICT (country_code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  display_order = EXCLUDED.display_order,
  is_active = true;

COMMIT;
`;

writeFileSync(outputPath, sql, "utf8");
console.log(`Generated ${rows.length} country rows at ${outputPath}`);
