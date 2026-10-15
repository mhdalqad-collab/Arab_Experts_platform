import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { extractBackendRoutes, renderBackendOpenApi } from "./backend-openapi-lib.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const routes = await extractBackendRoutes(join(root, "backend", "src", "http.ts"));
const output = join(root, "openapi", "eim-v113-backend-r5.yaml");
await writeFile(output, renderBackendOpenApi(routes), "utf8");
console.log(JSON.stringify({ status: "generated", output, paths: new Set(routes.map(({ path }) => path)).size, operations: routes.length }, null, 2));
