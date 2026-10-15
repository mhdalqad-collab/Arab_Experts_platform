import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { documentedOperations, extractBackendRoutes, renderBackendOpenApi } from "./backend-openapi-lib.mjs";

const root = new URL("..", import.meta.url).pathname;
const apiRoot = join(root, "app", "api");
const specPath = join(root, "openapi", "eim-v113-r5.yaml");
const backendSpecPath = join(root, "openapi", "eim-v113-backend-r5.yaml");
async function routeFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  }));
  return nested.flat();
}

const implemented = new Set();
for (const file of await routeFiles(apiRoot)) {
  const source = await readFile(file, "utf8");
  const route = "/" + relative(apiRoot, file)
    .split(sep).slice(0, -1)
    .map((part) => part.replace(/^\[([^\]]+)\]$/, "{$1}"))
    .join("/");
  for (const match of source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)) {
    implemented.add(`${route}:${match[1].toLowerCase()}`);
  }
}

const yaml = await readFile(specPath, "utf8");
if (!yaml.startsWith("openapi: 3.1.0")) throw new Error("OpenAPI 3.1 header is required");
const documented = new Set();
const operationIds = [];
let currentPath = null;
for (const line of yaml.split(/\r?\n/)) {
  const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
  if (pathMatch) currentPath = pathMatch[1];
  const methodMatch = line.match(/^    (get|post|put|patch|delete):(?:\s|$)/);
  if (currentPath && methodMatch) documented.add(`${currentPath}:${methodMatch[1]}`);
  const operationMatch = line.match(/operationId:\s*([A-Za-z][A-Za-z0-9]*)/);
  if (operationMatch) operationIds.push(operationMatch[1]);
}

const missing = [...implemented].filter((item) => !documented.has(item));
const stale = [...documented].filter((item) => !implemented.has(item));
const duplicateIds = operationIds.filter((id, index) => operationIds.indexOf(id) !== index);
if (missing.length || stale.length || duplicateIds.length || operationIds.length !== documented.size) {
  throw new Error(JSON.stringify({ missing, stale, duplicateIds, operations: operationIds.length, documented: documented.size }));
}
const backendRoutes = await extractBackendRoutes(join(root, "backend", "src", "http.ts"));
const backendYaml = await readFile(backendSpecPath, "utf8");
const expectedBackendYaml = renderBackendOpenApi(backendRoutes);
const implementedBackend = new Set(backendRoutes.map(({ method, path }) => `${method} ${path.replace(/\{[^}]+\}/g, "{}")}`));
const documentedBackend = documentedOperations(backendYaml);
const missingBackend = [...implementedBackend].filter((item) => !documentedBackend.has(item));
const staleBackend = [...documentedBackend].filter((item) => !implementedBackend.has(item));
const backendOperationIds = [...backendYaml.matchAll(/operationId:\s*([A-Za-z][A-Za-z0-9]*)/g)].map((match) => match[1]);
const duplicateBackendIds = backendOperationIds.filter((id, index) => backendOperationIds.indexOf(id) !== index);
const jsonCommandsImplemented = backendRoutes.filter(({ handler }) => /readJson\(request/.test(handler)).length;
const typedRequestBodies = [...backendYaml.matchAll(/requestBody: \{\$ref: '#\/components\/requestBodies\/(parse[A-Z][A-Za-z0-9]*)'\}/g)];
const commandSchemas = [...backendYaml.matchAll(/^    (parse[A-Z][A-Za-z0-9]*Command):/gm)].map((match) => match[1]);
const ambiguousJsonCommand = backendYaml.includes("JsonCommand") || backendYaml.includes("schema: {type: object, additionalProperties: true}");
const operationSuccessReferences = [...backendYaml.matchAll(/'2(?:00|01)': \{\$ref: '#\/components\/responses\/([A-Za-z][A-Za-z0-9]*Success)'\}/g)];
const operationResponseSchemas = [...backendYaml.matchAll(/^    ((?!parse)[A-Za-z][A-Za-z0-9]*Response):/gm)];
const requestExamples = [...backendYaml.matchAll(/^          example: /gm)];
const genericSuccessResponse = backendYaml.includes("#/components/responses/Success'") || backendYaml.includes("    Success:");
const paginationContract = backendYaml.includes("name: pageSize") && backendYaml.includes("maximum: 50, default: 20");
if (missingBackend.length || staleBackend.length || duplicateBackendIds.length || backendYaml !== expectedBackendYaml || typedRequestBodies.length !== jsonCommandsImplemented || ambiguousJsonCommand || operationSuccessReferences.length !== backendRoutes.length || operationResponseSchemas.length !== backendRoutes.length || requestExamples.length !== commandSchemas.length || genericSuccessResponse || !paginationContract) {
  throw new Error(JSON.stringify({
    contract: "backend",
    missingBackend,
    staleBackend,
    duplicateBackendIds,
    generatedContractIsCurrent: backendYaml === expectedBackendYaml,
    jsonCommandsImplemented,
    typedRequestBodies: typedRequestBodies.length,
    commandSchemas: commandSchemas.length,
    ambiguousJsonCommand,
    operationSuccessReferences: operationSuccessReferences.length,
    operationResponseSchemas: operationResponseSchemas.length,
    requestExamples: requestExamples.length,
    genericSuccessResponse,
    paginationContract,
  }));
}

console.log(JSON.stringify({
  status: "passed",
  sameOrigin: { operations: documented.size, paths: new Set([...documented].map((item) => item.split(":")[0])).size },
  backend: { operations: documentedBackend.size, paths: new Set(backendRoutes.map(({ path }) => path)).size, drift: 0, typedRequestBodies: typedRequestBodies.length, commandSchemas: commandSchemas.length, operationResponses: operationResponseSchemas.length, requestExamples: requestExamples.length, paginationContract },
}, null, 2));
