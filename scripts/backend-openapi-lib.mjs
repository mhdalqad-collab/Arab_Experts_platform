import { readFile } from "node:fs/promises";

const methods = ["get", "post", "put", "patch", "delete"];

const uuid = { type: "string", format: "uuid" };
const code = (maximum = 60) => ({ type: "string", pattern: "^[A-Z][A-Z0-9_]*$", maxLength: maximum });
const text = (maximum, minimum = 1) => ({ type: "string", minLength: minimum, maxLength: maximum });
const integer = (minimum = 1, maximum) => ({ type: "integer", minimum, ...(maximum ? { maximum } : {}) });
const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });
const object = (required, properties, extra = {}) => ({ type: "object", additionalProperties: false, required, properties, ...extra });

const requestSchemas = {
  parseRegistrationInput: object(["firstNameAr", "lastNameAr", "displayNameAr"], { firstNameAr: text(100), lastNameAr: text(100), displayNameAr: text(240), displayNameEn: nullable(text(240, 0)) }),
  parseCreateApplication: object(["membershipTypeCode"], { membershipTypeCode: code(40) }),
  parseSaveStep: object(["payload", "complete", "expectedRowVersion"], { payload: { type: "object", additionalProperties: true }, complete: { type: "boolean" }, expectedRowVersion: integer() }),
  parseSubmitApplication: object(["expectedRowVersion"], { expectedRowVersion: integer() }),
  parseReview: object(["recommendationCode", "comments"], { recommendationCode: { type: "string", enum: ["APPROVE", "REJECT", "MORE_INFO_REQUIRED"] }, comments: text(2000) }),
  parseDecision: object(["decisionCode", "reasonCode", "comment"], { decisionCode: { type: "string", enum: ["APPROVED", "REJECTED"] }, reasonCode: code(50), comment: text(2000) }),
  parseFileIntent: object(["originalFileName", "mediaType", "sizeBytes", "sha256", "confidentialityLevelCode"], { originalFileName: text(240), mediaType: { type: "string", enum: ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] }, sizeBytes: integer(1, 10485760), sha256: { type: "string", pattern: "^[0-9a-f]{64}$" }, confidentialityLevelCode: { type: "string", enum: ["PUBLIC", "ALLOWED_INFORMATION_ONLY", "AUTHORIZED_CLIENTS", "PLATFORM_ADMIN_ONLY"] } }),
  parseUploadCompletion: object(["sessionId", "uploadToken", "mediaType", "sha256", "sizeBytes"], { sessionId: uuid, uploadToken: text(4096, 20), mediaType: { type: "string", enum: ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] }, sha256: { type: "string", pattern: "^[0-9a-f]{64}$" }, sizeBytes: integer() }),
  parseScanResult: object(["fileId", "resultCode", "scannerReference"], { fileId: uuid, resultCode: { type: "string", enum: ["SAFE", "QUARANTINED", "REJECTED"] }, scannerReference: text(500) }),
  parseEvidenceInput: object(["fileId", "evidenceTypeCode", "titleAr"], { fileId: uuid, evidenceTypeCode: code(60), titleAr: text(300), titleEn: nullable(text(300, 0)), descriptionAr: nullable(text(4000, 0)) }),
  parseAccessGrant: object(["granteePartyId", "purposeCode", "expiresAt"], { granteePartyId: uuid, purposeCode: code(60), expiresAt: { type: "string", format: "date-time", description: "Must be in the future and no more than 90 days ahead." } }),
  parseDownloadConsume: object(["sessionId", "downloadToken"], { sessionId: uuid, downloadToken: text(4096, 20) }),
  parseReviewDocumentAccess: object(["reason"], { reason: text(1000, 20) }),
  parseCheck: object(["checkTypeCode", "resultCode", "notes"], { checkTypeCode: code(50), resultCode: { type: "string", enum: ["PASS", "PARTIAL", "FAIL", "INCONCLUSIVE"] }, notes: text(4000), responseReference: nullable(text(1000, 0)) }),
  parseVerificationDecision: object(["decisionCode", "rationale"], { decisionCode: { type: "string", enum: ["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "REJECTED"] }, rationale: text(4000), validUntil: nullable({ type: "string", format: "date" }) }),
  parsePrivacyPreference: object(["resourceType", "resourceId", "fieldPath", "visibilityCode"], { resourceType: { type: "string", enum: ["PARTY_PROFILE", "EVIDENCE_ITEM", "FILE"] }, resourceId: uuid, fieldPath: { type: "string", pattern: "^[a-z][a-z0-9_.]*$", maxLength: 120 }, visibilityCode: { type: "string", enum: ["PUBLIC", "MEMBERS", "AUTHORIZED", "PLATFORM_ADMIN", "PRIVATE"] }, allowedRoleCodes: { type: "array", uniqueItems: true, items: code(60) }, reason: nullable(text(1000, 0)) }),
  parseRevocation: object(["reason"], { reason: text(1000) }),
  parseProfile: object([], { currentJobTitleAr: nullable(text(220, 0)), currentJobTitleEn: nullable(text(220, 0)), jobLevelCode: nullable(code()), totalExperienceYears: nullable(integer(0, 80)), expectedRowVersion: nullable(integer()) }),
  parseFingerprint: object(["fingerprintCode", "titleAr", "taxonomyNodeCode", "experienceLevelCode", "expertRoleCode"], { fingerprintCode: code(), titleAr: text(300), titleEn: nullable(text(300, 0)), taxonomyNodeCode: code(), experienceLevelCode: code(), expertRoleCode: code(), certaintyScore: nullable({ type: "number", minimum: 0, maximum: 1 }), expectedRowVersion: nullable(integer()), changeSummary: nullable(text(1000, 0)) }),
  parsePublicationSubmit: object(["expectedRowVersion"], { expectedRowVersion: integer() }),
  parsePublicationReview: object(["recommendation", "comment"], { recommendation: { type: "string", enum: ["APPROVE", "REJECT"] }, comment: text(2000) }),
  parsePublicationDecision: object(["decision", "comment"], { decision: { type: "string", enum: ["APPROVED", "REJECTED"] }, comment: text(2000) }),
  parsePublicationFinding: object(["targetType", "categoryCode", "severityCode", "description", "requiredAction"], { targetType: { type: "string", enum: ["PROFILE", "FINGERPRINT", "EVIDENCE", "READINESS"] }, targetId: nullable(uuid), categoryCode: code(), severityCode: { type: "string", enum: ["INFO", "MINOR", "MAJOR", "CRITICAL"] }, description: text(3000), requiredAction: text(2000) }),
  parsePublicationFindingResponse: object(["response"], { response: text(3000) }),
  parsePublicationFindingResolution: object(["action", "comment"], { action: { type: "string", enum: ["RESOLVE", "REOPEN"] }, comment: text(2000) }),
  parsePublicationAmendment: object(["findingId", "summary", "changeSet"], { findingId: uuid, summary: text(2000), changeSet: { type: "object", minProperties: 1, maxProperties: 30, additionalProperties: true } }),
  parsePublicationAmendmentDecision: object(["decision", "comment"], { decision: { type: "string", enum: ["ACCEPT", "REJECT"] }, comment: text(2000) }),
  parsePublicationLifecycle: object(["action", "reason"], { action: { type: "string", enum: ["SUSPEND", "RESTORE", "REVOKE"] }, reason: text(2000, 20) }),
  parseQualification: object(["qualificationTypeCode", "fieldOfStudyAr", "institutionNameAr"], { qualificationTypeCode: code(), fieldOfStudyAr: text(220), fieldOfStudyEn: nullable(text(220, 0)), institutionNameAr: text(260), institutionNameEn: nullable(text(260, 0)), countryCode: nullable(code()), graduationYear: nullable(integer(1900, 2200)), isPublic: { type: "boolean" }, expectedRowVersion: nullable(integer()), changeSummary: nullable(text(1000, 0)) }),
  parseEmployment: object(["employerNameAr", "jobTitleAr", "startedAt"], { employerNameAr: text(260), employerNameEn: nullable(text(260, 0)), jobTitleAr: text(220), jobTitleEn: nullable(text(220, 0)), jobLevelCode: nullable(code()), experienceTypeCode: nullable(code()), countryCode: nullable(code()), startedAt: { type: "string", format: "date" }, endedAt: nullable({ type: "string", format: "date" }), responsibilitiesAr: nullable(text(4000, 0)), outcomesAr: nullable(text(4000, 0)), isCurrent: { type: "boolean" }, isPublic: { type: "boolean" }, expectedRowVersion: nullable(integer()), changeSummary: nullable(text(1000, 0)) }),
  parseProject: object(["projectNameAr", "executionYear"], { projectNameAr: text(300), projectNameEn: nullable(text(300, 0)), clientNameAr: nullable(text(260, 0)), countryCode: nullable(code()), executionYear: integer(1900, 2200), durationDays: nullable(integer()), expertRoleCode: nullable(code()), roleDescriptionAr: nullable(text(4000, 0)), verifiedOutcomeAr: nullable(text(4000, 0)), isPublic: { type: "boolean" }, expectedRowVersion: nullable(integer()), changeSummary: nullable(text(1000, 0)) }),
  parseConsulting: object(["engagementTitleAr", "durationDays"], { engagementTitleAr: text(300), engagementTitleEn: nullable(text(300, 0)), clientTypeCode: nullable(code()), countryCode: nullable(code()), durationDays: integer(), startedAt: nullable({ type: "string", format: "date" }), endedAt: nullable({ type: "string", format: "date" }), deliveryModeCode: nullable(code()), outcomeSummaryAr: nullable(text(4000, 0)), isPublic: { type: "boolean" }, expectedRowVersion: nullable(integer()), changeSummary: nullable(text(1000, 0)) }),
  parseTraining: object(["courseNameAr", "expectedRowVersion"], { courseNameAr: text(300), courseNameEn: nullable(text(300, 0)), deliveryModeCode: nullable(code()), courseLevelCode: nullable(code()), deliveryDate: nullable({ type: "string", format: "date" }), durationHours: nullable({ type: "number", minimum: 0.01, maximum: 10000 }), participantCount: integer(0, 1000000), ratingValue: nullable({ type: "number", minimum: 1, maximum: 5 }), countryCode: nullable(code()), isPublic: { type: "boolean" }, expectedRowVersion: integer(), changeSummary: nullable(text(1000, 0)) }),
  parseResearch: object(["researchTitleAr", "researchRoleCode", "expectedRowVersion"], { researchTitleAr: text(320), researchTitleEn: nullable(text(320, 0)), researchRoleCode: code(), startedAt: nullable({ type: "string", format: "date" }), endedAt: nullable({ type: "string", format: "date" }), outcomeSummaryAr: nullable(text(4000, 0)), isPublic: { type: "boolean" }, expectedRowVersion: integer(), changeSummary: nullable(text(1000, 0)) }),
  parseEvidenceLink: object(["evidenceItemId", "targetEntityType", "targetEntityId", "relationshipCode", "relevanceScore"], { evidenceItemId: uuid, targetEntityType: code(), targetEntityId: uuid, relationshipCode: { type: "string", enum: ["SUPPORTS", "PROVES", "UPDATES", "REPLACES"] }, relevanceScore: { type: "number", minimum: 0, maximum: 1 } }),
  parseStrengthTarget: object(["targetEntityType", "targetEntityId"], { targetEntityType: code(), targetEntityId: uuid }),
  parseFingerprintStrength: object(["professionalFingerprintId"], { professionalFingerprintId: uuid }),
  parseNotificationClaim: object(["providerCode"], { providerCode: code(), batchSize: integer(1, 50) }),
  parseNotificationResult: object(["messageId", "leaseToken", "providerCode", "outcomeCode"], { messageId: uuid, leaseToken: { type: "string", pattern: "^[0-9a-f]{64}$" }, providerCode: code(), outcomeCode: { type: "string", enum: ["ACCEPTED", "DELIVERED", "TEMPORARY_FAILURE", "PERMANENT_FAILURE", "BOUNCED", "REJECTED", "RATE_LIMITED"] }, providerReference: nullable(text(500, 0)), responseCode: nullable(text(100, 0)) }),
  parseDeadLetterResolution: object(["action", "reason"], { action: { type: "string", enum: ["REQUEUE", "DISCARD"] }, reason: text(2000, 20) }),
  parseDeliveryIncidentResolution: object(["action", "reason"], { action: { type: "string", enum: ["ACKNOWLEDGE", "RESOLVE"] }, reason: text(2000, 20) }),
};

function routeTag(path) {
  if (path.startsWith("/health") || path === "/v1/meta") return "Platform";
  if (path.startsWith("/internal")) return "Internal";
  if (path.includes("notification-delivery")) return "Notifications";
  if (path.includes("membership")) return "Membership";
  if (path.includes("evidence")) return "Evidence";
  if (path.includes("files") || path.includes("privacy") || path.includes("access-grants")) return "Files and Privacy";
  if (path.includes("professional") || path.startsWith("/v1/public")) return "Professional Profiles";
  return "Identity";
}

function operationId(method, path) {
  const words = path.split("/").filter(Boolean).filter((word) => word !== "v1").map((word) => {
    if (word.startsWith("{")) return "by " + word.slice(1, -1);
    return word.replaceAll("-", " ");
  }).join(" ").split(/\s+/);
  return method + words.map((word) => word[0].toUpperCase() + word.slice(1)).join("");
}

function normalizePattern(pattern) {
  let index = 0;
  return pattern.replaceAll("\\/", "/").replace(/\(\[\^\/\]\+\)/g, () => `{id${++index === 1 ? "" : index}}`);
}

export async function extractBackendRoutes(sourcePath) {
  const source = await readFile(sourcePath, "utf8");
  const routes = new Map();
  const add = (path, method, handler) => {
    const key = `${method.toLowerCase()} ${path}`;
    routes.set(key, { path, method: method.toLowerCase(), handler });
  };

  for (const match of source.matchAll(/request\.method\s*===\s*"([A-Z]+)"\s*&&\s*url\.pathname\s*===\s*"([^"]+)"/g)) {
    const end = source.indexOf("return;", match.index) + 7;
    add(match[2], match[1], source.slice(match.index, end > 6 ? end : match.index + 1000));
  }

  const declarations = [...source.matchAll(/const\s+(\w+)\s*=\s*url\.pathname\.match\(\/\^(.+?)\$\/\);/g)];
  for (let index = 0; index < declarations.length; index += 1) {
    const match = declarations[index];
    const next = declarations[index + 1]?.index ?? source.length;
    const block = source.slice(match.index + match[0].length, next);
    const variable = match[1];
    const path = normalizePattern(match[2]);
    const expression = new RegExp(`request\\.method\\s*===\\s*"([A-Z]+)"\\s*&&\\s*${variable}\\b`, "g");
    for (const methodMatch of block.matchAll(expression)) {
      const end = block.indexOf("return;", methodMatch.index) + 7;
      add(path, methodMatch[1], block.slice(methodMatch.index, end > 6 ? end : methodMatch.index + 1000));
    }
  }
  return [...routes.values()].filter(({ path }) => /^(\/health|\/v1|\/internal)/.test(path)).sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

function quote(value) {
  return JSON.stringify(value);
}

function schemaExample(schema) {
  if (schema.anyOf) return schemaExample(schema.anyOf.find((item) => item.type !== "null") ?? {});
  if (schema.enum) return schema.enum[0];
  if (schema.format === "uuid") return "00000000-0000-4000-8000-000000000001";
  if (schema.format === "date") return "2026-12-31";
  if (schema.format === "date-time") return "2026-12-31T12:00:00Z";
  if (schema.type === "integer" || schema.type === "number") return schema.minimum ?? 1;
  if (schema.type === "boolean") return true;
  if (schema.type === "array") return [];
  if (schema.type === "object") return Object.fromEntries((schema.required ?? []).map((name) => [name, schemaExample(schema.properties?.[name] ?? {})]));
  return "VALUE";
}

function responseDataSchema(entry) {
  if (entry.path === "/v1/meta") return object(["service", "version", "environment", "systemOfRecord"], { service: { const: "eim-backend" }, version: { type: "string" }, environment: { type: "string" }, systemOfRecord: { const: "PostgreSQL 16" } });
  if (entry.path === "/v1/me") return object(["userAccountId", "partyId", "permissions", "roles"], { userAccountId: uuid, partyId: uuid, permissions: { type: "array", uniqueItems: true, items: { type: "string" } }, roles: { type: "array", uniqueItems: true, items: { type: "string" } }, organizationId: nullable(uuid), assuranceLevel: { type: "integer", minimum: 0 } });
  if (entry.path === "/v1/identity/register") return object(["userAccountId", "partyId", "status"], { userAccountId: uuid, partyId: uuid, status: { const: "ACTIVE" } });
  const listPath = entry.method === "get" && (/\/(membership-types|membership-applications|membership-reviews|files|evidence|evidence-verifications|privacy-preferences|professional-experiences|professional-evidence-links|professional-evidence-strength|professional-fingerprint-strength|professional-publication-reviews|professional-publications)$/.test(entry.path) || /\/(findings|amendments|reverification|professional-reverification-alerts)$/.test(entry.path));
  if (listPath) return { type: "array", items: { $ref: "#/components/schemas/RecordData" } };
  if (entry.path === "/v1/public/professionals") return object(["items", "page", "pageSize"], { items: { type: "array", items: { $ref: "#/components/schemas/RecordData" } }, page: integer(), pageSize: integer(1, 50), total: { type: "integer", minimum: 0 } });
  return { $ref: "#/components/schemas/RecordData" };
}

function successSchema(entry, id) {
  if (entry.path === "/health/live") return object(["status", "service", "version"], { status: { const: "ok" }, service: { const: "eim-backend" }, version: { type: "string" } });
  if (entry.path === "/health/ready") return object(["status", "database"], { status: { const: "ready" }, database: { type: "object", additionalProperties: true } });
  return object(["data", "meta"], { data: { $ref: `#/components/schemas/${id}Data` }, meta: { $ref: "#/components/schemas/ResponseMeta" } });
}

export function renderBackendOpenApi(routes) {
  const grouped = new Map();
  const usedRequestParsers = new Set();
  const operationEntries = [];
  for (const route of routes) {
    if (!grouped.has(route.path)) grouped.set(route.path, []);
    grouped.get(route.path).push(route);
  }
  const lines = [
    "openapi: 3.1.0",
    "info:",
    "  title: EIM V113 Node/PostgreSQL Backend API",
    "  version: 1.0.0-r5.0910b",
    "  description: Generated, drift-checked contract with validator-aligned commands and operation-specific responses for backend/src/http.ts.",
    "servers:",
    "  - url: /",
    "    description: EIM backend service root",
    "tags:",
    ...["Platform", "Identity", "Membership", "Files and Privacy", "Evidence", "Professional Profiles", "Notifications", "Internal"].map((name) => `  - name: ${name}`),
    "paths:",
  ];
  for (const [path, entries] of grouped) {
    lines.push(`  ${path}:`);
    const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
    if (parameters.length) {
      lines.push("    parameters:");
      for (const name of parameters) lines.push(`      - {name: ${name}, in: path, required: true, schema: {type: string, minLength: 1}}`);
    }
    for (const entry of entries) {
      const publicRoute = entry.path.startsWith("/health") || entry.path === "/v1/meta" || entry.path.startsWith("/v1/public/");
      const internalRoute = entry.path.startsWith("/internal/");
      const permission = entry.handler.match(/permission:\s*"([^"]+)"/)?.[1];
      const stepUp = /stepUpRequired:\s*true/.test(entry.handler);
      const requestParser = entry.handler.match(/\b(parse[A-Z][A-Za-z0-9]*)\(await readJson\(request/)?.[1];
      const readsJson = /readJson\(request/.test(entry.handler);
      const id = operationId(entry.method, entry.path);
      operationEntries.push({ ...entry, id });
      if (readsJson && !requestParser) throw new Error(`A JSON command parser could not be resolved for ${entry.method.toUpperCase()} ${entry.path}`);
      if (requestParser && !requestSchemas[requestParser]) throw new Error(`OpenAPI schema is missing for ${requestParser}`);
      lines.push(`    ${entry.method}:`);
      lines.push(`      tags: [${quote(routeTag(entry.path))}]`);
      lines.push(`      operationId: ${id}`);
      lines.push(`      security: ${publicRoute ? "[]" : internalRoute ? "[{internalToken: []}]" : "[{oidc: []}]"}`);
      if (entry.path === "/v1/public/professionals") {
        lines.push("      parameters:");
        lines.push("        - {name: q, in: query, schema: {type: string, maxLength: 120}}");
        lines.push("        - {name: membershipTypeCode, in: query, schema: {type: string, pattern: '^[A-Z][A-Z0-9_]*$', maxLength: 60}}");
        lines.push("        - {name: taxonomyNodeCode, in: query, schema: {type: string, pattern: '^[A-Z][A-Z0-9_]*$', maxLength: 60}}");
        lines.push("        - {name: experienceLevelCode, in: query, schema: {type: string, pattern: '^[A-Z][A-Z0-9_]*$', maxLength: 60}}");
        lines.push("        - {name: expertRoleCode, in: query, schema: {type: string, pattern: '^[A-Z][A-Z0-9_]*$', maxLength: 60}}");
        lines.push("        - {name: page, in: query, schema: {type: integer, minimum: 1, maximum: 1000, default: 1}}");
        lines.push("        - {name: pageSize, in: query, schema: {type: integer, minimum: 1, maximum: 50, default: 20}}");
      }
      if (permission) lines.push(`      x-eim-permission: ${quote(permission)}`);
      if (stepUp) lines.push("      x-eim-step-up-required: true");
      if (requestParser) {
        usedRequestParsers.add(requestParser);
        lines.push(`      requestBody: {$ref: '#/components/requestBodies/${requestParser}'}`);
      }
      lines.push("      responses:");
      lines.push(`        '${entry.method === "post" && /send\(response,201/.test(entry.handler) ? "201" : "200"}': {$ref: '#/components/responses/${id}Success'}`);
      if (readsJson) {
        lines.push("        '400': {$ref: '#/components/responses/BadRequest'}");
        lines.push("        '413': {$ref: '#/components/responses/PayloadTooLarge'}");
        lines.push("        '415': {$ref: '#/components/responses/UnsupportedMediaType'}");
      }
      if (!publicRoute) lines.push("        '401': {$ref: '#/components/responses/Unauthorized'}");
      if (!publicRoute && !internalRoute) lines.push("        '403': {$ref: '#/components/responses/Forbidden'}");
      if (entry.path.includes("{")) lines.push("        '404': {$ref: '#/components/responses/NotFound'}");
      if (["post", "put", "patch"].includes(entry.method)) lines.push("        '409': {$ref: '#/components/responses/Conflict'}");
      if (readsJson) lines.push("        '422': {$ref: '#/components/responses/ValidationError'}");
      lines.push("        '503': {$ref: '#/components/responses/ServiceUnavailable'}");
    }
  }
  lines.push(
    "components:",
    "  securitySchemes:",
    "    oidc: {type: openIdConnect, openIdConnectUrl: '/.well-known/openid-configuration'}",
    "    internalToken: {type: apiKey, in: header, name: X-Internal-Token}",
    "  requestBodies:",
    ...[...usedRequestParsers].sort().flatMap((parser) => [
      `    ${parser}:`,
      "      required: true",
      "      content:",
      "        application/json:",
      `          schema: {$ref: '#/components/schemas/${parser}Command'}`,
      `          example: ${JSON.stringify(schemaExample(requestSchemas[parser]))}`,
    ]),
    "  responses:",
    ...operationEntries.flatMap((entry) => [
      `    ${entry.id}Success:`,
      "      description: Successful operation response",
      "      headers: {X-Correlation-Id: {$ref: '#/components/headers/CorrelationId'}}",
      `      content: {application/json: {schema: {$ref: '#/components/schemas/${entry.id}Response'}}}`,
    ]),
    ...[["BadRequest", "Malformed JSON request"], ["Unauthorized", "Missing or invalid authentication"], ["Forbidden", "Permission or step-up requirement failed"], ["NotFound", "Resource was not found"], ["Conflict", "State, version, or uniqueness conflict"], ["PayloadTooLarge", "Request body exceeds the endpoint limit"], ["UnsupportedMediaType", "Content-Type must be application/json"], ["ValidationError", "Command validation failed"], ["ServiceUnavailable", "A required service is unavailable"]].flatMap(([name, description]) => [
      `    ${name}:`,
      `      description: ${description}`,
      "      headers: {X-Correlation-Id: {$ref: '#/components/headers/CorrelationId'}}",
      "      content: {application/json: {schema: {$ref: '#/components/schemas/ErrorEnvelope'}, example: {error: VALIDATION_FAILED, correlationId: 00000000-0000-4000-8000-000000000001}}}",
    ]),
    "  headers:",
    "    CorrelationId: {description: Request correlation identifier, schema: {type: string, minLength: 1, maxLength: 120}}",
    "  schemas:",
    "    ResponseMeta: {type: object, additionalProperties: false, required: [correlationId], properties: {correlationId: {type: string, minLength: 1, maxLength: 120}}}",
    "    RecordData: {type: object, description: Repository record projected by the selected operation, additionalProperties: true}",
    "    ErrorEnvelope:",
    "      type: object",
    "      required: [error, correlationId]",
    "      properties:",
    "        error: {type: string}",
    "        correlationId: {type: string}",
    ...operationEntries.flatMap((entry) => [
      ...(entry.path.startsWith("/health/") ? [] : [`    ${entry.id}Data: ${JSON.stringify(responseDataSchema(entry))}`]),
      `    ${entry.id}Response: ${JSON.stringify(successSchema(entry, entry.id))}`,
    ]),
    ...[...usedRequestParsers].sort().map((parser) => `    ${parser}Command: ${JSON.stringify(requestSchemas[parser])}`),
    "",
  );
  return lines.join("\n");
}

export function documentedOperations(yaml) {
  const operations = new Set();
  let path = null;
  for (const line of yaml.split(/\r?\n/)) {
    const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
    if (pathMatch) path = pathMatch[1];
    const methodMatch = line.match(/^    (get|post|put|patch|delete):\s*$/);
    if (path && methodMatch) operations.add(`${methodMatch[1]} ${path.replace(/\{[^}]+\}/g, "{}")}`);
  }
  return operations;
}

export { methods };
