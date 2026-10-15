import { getRuntime, type SqlDatabase } from "@/app/lib/runtime";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

const transitions: Record<string, string[]> = {
  draft: ["ready", "withdrawn"],
  ready: ["draft", "sent", "withdrawn"],
  sent: ["delivered", "viewed", "withdrawn", "expired"],
  delivered: ["viewed", "withdrawn", "expired"],
  viewed: ["clarification_requested", "responded", "declined", "withdrawn", "expired"],
  clarification_requested: ["sent", "responded", "declined", "withdrawn", "expired"],
  responded: ["accepted", "clarification_requested", "declined", "withdrawn"],
  accepted: ["proposal_created", "closed"],
  declined: ["closed"],
  withdrawn: ["draft"],
  expired: ["draft", "closed"],
  proposal_created: ["closed"],
  closed: [],
};
const clientActions = new Set([
  "draft", "ready", "sent", "withdrawn", "accepted",
  "clarification_requested", "proposal_created", "closed",
]);
const providerActions = new Set([
  "viewed", "clarification_requested", "responded", "declined",
]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function object(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
async function actorContext(db: SqlDatabase) {
  const user = await getChatGPTUser();
  if (!user) return null;
  const email = user.email.trim().toLowerCase();
  return db.prepare(
    `SELECT a.account_id, a.email, l.party_id
       FROM accounts a JOIN account_party_links l ON l.account_id = a.account_id
      WHERE a.email = ?1 AND l.status = 'ACTIVE'
      ORDER BY l.is_primary DESC, l.created_at LIMIT 1`,
  ).bind(email).first<{ account_id: string; email: string; party_id: string }>();
}
async function linkedPartyIds(db: SqlDatabase, accountId: string) {
  const rows = await db.prepare(
    `SELECT party_id FROM account_party_links
      WHERE account_id = ?1 AND status = 'ACTIVE'`,
  ).bind(accountId).all<{ party_id: string }>();
  return rows.results.map((row) => row.party_id);
}
function candidatePartyId(candidateRef: string) {
  const match = /^party:([^:]{1,80}):(expert|trainer|consultant|researcher|center)$/
    .exec(candidateRef);
  return match?.[1] ?? null;
}

export async function GET(request: Request) {
  const workers = getRuntime();
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor) return json({ error: "ACCOUNT_CONTEXT_REQUIRED" }, 401);
  const view = new URL(request.url).searchParams.get("view");
  if (view !== "provider") return json({ error: "UNSUPPORTED_VIEW" }, 400);
  const parties = await linkedPartyIds(db, actor.account_id);
  if (!parties.length) return json({ requests: [] });
  const placeholders = parties.map((_, index) => `?${index + 1}`).join(",");
  const rows = await db.prepare(
    `SELECT request_id, public_code, status, payload_json, revision, updated_at
       FROM service_requests
      WHERE provider_party_id IN (${placeholders})
        AND status NOT IN ('draft','ready','withdrawn','closed')
      ORDER BY updated_at DESC LIMIT 100`,
  ).bind(...parties).all<{
    request_id: string; public_code: string; status: string;
    payload_json: string; revision: number; updated_at: string;
  }>();
  const requests = rows.results.map((row) => {
    const payload = object(JSON.parse(row.payload_json));
    const snapshot = object(payload.needSnapshot);
    const shared = Array.isArray(payload.sharedFields)
      ? payload.sharedFields.filter((key): key is string => typeof key === "string")
      : [];
    const disclosed = Object.fromEntries(
      shared.filter((key) => Object.hasOwn(snapshot, key))
        .map((key) => [key, snapshot[key]]),
    );
    return {
      requestId: row.request_id,
      publicCode: row.public_code,
      status: row.status,
      revision: row.revision,
      updatedAt: row.updated_at,
      subject: payload.subject,
      outputType: payload.outputType,
      service: payload.service,
      message: payload.message,
      scope: payload.scope,
      deliverables: payload.deliverables,
      responseDeadline: payload.responseDeadline,
      serviceStart: payload.serviceStart,
      completionDate: payload.completionDate,
      mode: payload.mode,
      confidentiality: payload.confidentiality,
      disclosedNeed: disclosed,
      providerResponse: object(payload.providerResponse),
      messages: Array.isArray(payload.messages) ? payload.messages : [],
    };
  });
  return json({ requests });
}

export async function POST(request: Request) {
  const workers = getRuntime();
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor) return json({ error: "CLIENT_CONTEXT_REQUIRED" }, 401);
  let body: Record<string, unknown>;
  try { body = object(await request.json()); }
  catch { return json({ error: "INVALID_JSON" }, 400); }
  const requestId = String(body.requestId ?? "").slice(0, 80);
  const needId = String(body.needId ?? "").slice(0, 80);
  const candidateRef = String(body.candidateRef ?? "").slice(0, 160);
  const publicCode = String(body.publicCode ?? requestId).slice(0, 80);
  if (!requestId || !needId || !candidateRef) {
    return json({ error: "REQUEST_ID_NEED_AND_CANDIDATE_REQUIRED" }, 422);
  }
  const need = await db.prepare(
    "SELECT need_id FROM client_needs WHERE need_id = ?1 AND client_party_id = ?2",
  ).bind(needId, actor.party_id).first();
  if (!need) return json({ error: "NEED_NOT_FOUND" }, 404);
  const duplicate = await db.prepare(
    `SELECT request_id, public_code, status, revision
       FROM service_requests
      WHERE need_id = ?1 AND candidate_ref = ?2 AND client_party_id = ?3
      LIMIT 1`,
  ).bind(needId, candidateRef, actor.party_id).first<{
    request_id: string; public_code: string; status: string; revision: number;
  }>();
  if (duplicate) {
    return json({
      duplicate: true,
      requestId: duplicate.request_id,
      publicCode: duplicate.public_code,
      status: duplicate.status,
      revision: duplicate.revision,
    });
  }
  const providerPartyId = candidatePartyId(candidateRef);
  if (providerPartyId) {
    const provider = await db.prepare(
      `SELECT p.party_id FROM parties p
        JOIN membership_profiles mp ON mp.party_id = p.party_id
       WHERE p.party_id = ?1 AND p.status = 'ACTIVE'
         AND mp.lifecycle_status = 'approved' LIMIT 1`,
    ).bind(providerPartyId).first();
    if (!provider) return json({ error: "APPROVED_PROVIDER_NOT_FOUND" }, 404);
  }
  const payload: Record<string, unknown> = { ...body, status: "draft" };
  delete payload.serverRevision;
  delete payload.serverUpdatedAt;
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(
      `INSERT INTO service_requests (
         request_id, need_id, client_party_id, provider_party_id,
         candidate_ref, public_code, status, payload_json, revision,
         created_by_account_id, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'draft', ?7, 1, ?8, ?9, ?9)`,
    ).bind(
      requestId, needId, actor.party_id, providerPartyId, candidateRef,
      publicCode, JSON.stringify(payload), actor.account_id, now,
    ),
    db.prepare(
      `INSERT INTO service_request_transitions (
         transition_id, request_id, request_key, from_status, to_status,
         actor_account_id, note, occurred_at
       ) VALUES (?1, ?2, '1:draft', 'NONE', 'draft', ?3, ?4, ?5)`,
    ).bind(
      crypto.randomUUID(), requestId, actor.account_id,
      "SERVICE_REQUEST_CREATED", now,
    ),
    db.prepare(
      `INSERT INTO account_audit_events (
         event_id, account_id, event_type, actor_email, payload_json, occurred_at
       ) VALUES (?1, ?2, 'SERVICE_REQUEST_CREATED', ?3, ?4, ?5)`,
    ).bind(
      crypto.randomUUID(), actor.account_id, actor.email,
      JSON.stringify({ requestId, needId, candidateRef, providerPartyId }), now,
    ),
  ]);
  return json({
    requestId, publicCode, status: "draft", revision: 1,
    providerPartyId, createdAt: now,
  }, 201);
}

export async function PATCH(request: Request) {
  const workers = getRuntime();
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor) return json({ error: "CLIENT_CONTEXT_REQUIRED" }, 401);
  let body: Record<string, unknown>;
  try { body = object(await request.json()); }
  catch { return json({ error: "INVALID_JSON" }, 400); }
  const requestId = String(body.requestId ?? "").slice(0, 80);
  const to = String(body.to ?? "").slice(0, 40);
  const expectedRevision = Math.max(1, Math.floor(Number(body.expectedRevision) || 1));
  const note = String(body.note ?? "").trim().slice(0, 2000);
  const current = await db.prepare(
    `SELECT sr.status, sr.revision, sr.payload_json,
            EXISTS(SELECT 1 FROM account_party_links l
                    WHERE l.account_id = ?2 AND l.party_id = sr.client_party_id
                      AND l.status = 'ACTIVE') AS is_client,
            EXISTS(SELECT 1 FROM account_party_links l
                    WHERE l.account_id = ?2 AND l.party_id = sr.provider_party_id
                      AND l.status = 'ACTIVE') AS is_provider
       FROM service_requests sr WHERE sr.request_id = ?1`,
  ).bind(requestId, actor.account_id).first<{
    status: string; revision: number; payload_json: string;
    is_client: number; is_provider: number;
  }>();
  if (!current) return json({ error: "SERVICE_REQUEST_NOT_FOUND" }, 404);
  const role = current.is_provider ? "provider" : current.is_client ? "client" : "";
  if (!role) return json({ error: "SERVICE_REQUEST_ACCESS_DENIED" }, 403);
  if (
    (role === "provider" && !providerActions.has(to)) ||
    (role === "client" && !clientActions.has(to))
  ) {
    return json({ error: "ACTION_NOT_ALLOWED_FOR_ACTOR_ROLE", role, to }, 403);
  }
  if (current.revision !== expectedRevision) {
    return json({
      error: "REVISION_CONFLICT",
      status: current.status,
      revision: current.revision,
    }, 409);
  }
  if (!(transitions[current.status] ?? []).includes(to)) {
    return json({
      error: "INVALID_SERVICE_REQUEST_TRANSITION",
      from: current.status,
      to,
      allowed: transitions[current.status] ?? [],
    }, 422);
  }
  const revision = current.revision + 1;
  const now = new Date().toISOString();
  const payload = object(JSON.parse(current.payload_json));
  const message = String(body.message ?? "").trim().slice(0, 4000);
  if (role === "provider" && to === "responded") {
    const raw = object(body.providerResponse);
    const methodology = String(raw.methodology ?? "").trim().slice(0, 6000);
    const deliverables = String(raw.deliverables ?? "").trim().slice(0, 4000);
    const durationDays = Math.floor(Number(raw.durationDays) || 0);
    const price = Number(raw.price);
    const currency = String(raw.currency ?? "");
    const availableFrom = String(raw.availableFrom ?? "").slice(0, 10);
    const validUntil = String(raw.validUntil ?? "").slice(0, 10);
    const mode = String(raw.mode ?? "").slice(0, 20);
    if (
      methodology.length < 20 || !deliverables || durationDays < 1 ||
      !Number.isFinite(price) || price < 0 ||
      !["USD", "EUR"].includes(currency) ||
      !availableFrom || !validUntil ||
      !["حضوري", "عن بعد", "هجين"].includes(mode)
    ) {
      return json({ error: "STRUCTURED_PROVIDER_RESPONSE_INCOMPLETE" }, 422);
    }
    payload.providerResponse = {
      methodology, deliverables, durationDays, price, currency,
      availableFrom, validUntil, mode,
      assumptions: String(raw.assumptions ?? "").trim().slice(0, 4000),
      exclusions: String(raw.exclusions ?? "").trim().slice(0, 4000),
      submittedAt: new Date().toISOString(),
      submittedByAccountId: actor.account_id,
    };
  }
  if (role === "client" && to === "accepted") {
    const response = object(payload.providerResponse);
    if (!response.methodology || !response.deliverables || !response.validUntil) {
      return json({ error: "STRUCTURED_PROVIDER_RESPONSE_REQUIRED" }, 422);
    }
    if (String(response.validUntil) < new Date().toISOString().slice(0, 10)) {
      return json({ error: "PROVIDER_RESPONSE_EXPIRED" }, 422);
    }
    payload.clientAcceptance = {
      acceptedAt: new Date().toISOString(),
      acceptedByAccountId: actor.account_id,
      acceptedResponseRevision: current.revision,
    };
  }
  if (message) {
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    messages.push({
      messageId: crypto.randomUUID(),
      kind: String(body.messageKind ?? "message").slice(0, 40),
      actor: role,
      text: message,
      at: now,
    });
    payload.messages = messages.slice(-200);
  }
  payload.status = to;
  await db.batch([
    db.prepare(
      `UPDATE service_requests
          SET status = ?1, revision = ?2, payload_json = ?3, updated_at = ?4
        WHERE request_id = ?5 AND revision = ?6`,
    ).bind(to, revision, JSON.stringify(payload), now, requestId, current.revision),
    db.prepare(
      `INSERT INTO service_request_transitions (
         transition_id, request_id, request_key, from_status, to_status,
         actor_account_id, note, occurred_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(
      crypto.randomUUID(), requestId, `${revision}:${to}`,
      current.status, to, actor.account_id, note || null, now,
    ),
    db.prepare(
      `INSERT INTO account_audit_events (
         event_id, account_id, event_type, actor_email, payload_json, occurred_at
       ) VALUES (?1, ?2, 'SERVICE_REQUEST_TRANSITIONED', ?3, ?4, ?5)`,
    ).bind(
      crypto.randomUUID(), actor.account_id, actor.email,
      JSON.stringify({ requestId, from: current.status, to, revision, role }), now,
    ),
  ]);
  return json({
    requestId, from: current.status, status: to, revision,
    updatedAt: now, role, messages: payload.messages ?? [],
    providerResponse: payload.providerResponse ?? null,
  });
}
