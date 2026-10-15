import { getRuntime, type SqlDatabase } from "@/app/lib/runtime";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

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
    `SELECT a.account_id, a.email FROM accounts a WHERE a.email = ?1`,
  ).bind(email).first<{ account_id: string; email: string }>();
}
function proposalCode(sequence: number) {
  return `NAE-PRP-${new Date().getUTCFullYear()}-${String(sequence).padStart(6, "0")}`;
}
const proposalTransitions: Record<string, string[]> = {
  DRAFT: ["SENT", "WITHDRAWN"],
  SENT: ["CHANGES_REQUESTED", "ACCEPTED", "REJECTED", "WITHDRAWN"],
  CHANGES_REQUESTED: ["SENT", "WITHDRAWN"],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export async function GET() {
  const workers = getRuntime();
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor) return json({ error: "ACCOUNT_CONTEXT_REQUIRED" }, 401);
  const rows = await db.prepare(
    `SELECT sp.proposal_id, sp.request_id, sp.public_code, sp.status,
            sp.response_revision, sp.payload_json, sp.revision, sp.updated_at
       FROM service_proposals sp
      WHERE EXISTS (
        SELECT 1 FROM account_party_links l
         WHERE l.account_id = ?1 AND l.status = 'ACTIVE'
           AND l.party_id IN (sp.client_party_id, sp.provider_party_id)
      )
      ORDER BY sp.updated_at DESC LIMIT 100`,
  ).bind(actor.account_id).all<{
    proposal_id: string; request_id: string; public_code: string; status: string;
    response_revision: number; payload_json: string; revision: number; updated_at: string;
  }>();
  return json({
    proposals: rows.results.map((row) => ({
      ...JSON.parse(row.payload_json),
      proposalId: row.proposal_id,
      requestId: row.request_id,
      publicCode: row.public_code,
      status: row.status,
      responseRevision: row.response_revision,
      revision: row.revision,
      updatedAt: row.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const workers = getRuntime();
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor) return json({ error: "ACCOUNT_CONTEXT_REQUIRED" }, 401);
  let body: Record<string, unknown>;
  try { body = object(await request.json()); }
  catch { return json({ error: "INVALID_JSON" }, 400); }
  const requestId = String(body.requestId ?? "").slice(0, 80);
  const row = await db.prepare(
    `SELECT sr.request_id, sr.need_id, sr.client_party_id, sr.provider_party_id,
            sr.status, sr.revision, sr.payload_json
       FROM service_requests sr
      WHERE sr.request_id = ?1
        AND EXISTS (
          SELECT 1 FROM account_party_links l
           WHERE l.account_id = ?2 AND l.party_id = sr.client_party_id
             AND l.status = 'ACTIVE'
        )`,
  ).bind(requestId, actor.account_id).first<{
    request_id: string; need_id: string; client_party_id: string;
    provider_party_id: string | null; status: string; revision: number;
    payload_json: string;
  }>();
  if (!row) return json({ error: "ACCEPTED_REQUEST_NOT_FOUND" }, 404);
  const existing = await db.prepare(
    `SELECT proposal_id, public_code, status, revision
       FROM service_proposals WHERE request_id = ?1`,
  ).bind(requestId).first<{
    proposal_id: string; public_code: string; status: string; revision: number;
  }>();
  if (existing) return json({
    duplicate: true, proposalId: existing.proposal_id,
    publicCode: existing.public_code, status: existing.status,
    revision: existing.revision,
  });
  if (row.status !== "accepted") {
    return json({ error: "REQUEST_MUST_BE_ACCEPTED", status: row.status }, 422);
  }
  const requestPayload = object(JSON.parse(row.payload_json));
  const providerResponse = object(requestPayload.providerResponse);
  const acceptance = object(requestPayload.clientAcceptance);
  if (!providerResponse.methodology || !providerResponse.validUntil || !acceptance.acceptedAt) {
    return json({ error: "ACCEPTED_RESPONSE_SNAPSHOT_REQUIRED" }, 422);
  }
  if (String(providerResponse.validUntil) < new Date().toISOString().slice(0, 10)) {
    return json({ error: "ACCEPTED_RESPONSE_EXPIRED" }, 422);
  }
  const count = await db.prepare(
    "SELECT COUNT(*) AS count FROM service_proposals",
  ).first<{ count: number }>();
  const proposalId = crypto.randomUUID();
  const publicCode = proposalCode((count?.count ?? 0) + 1);
  const now = new Date().toISOString();
  const snapshot = {
    title: requestPayload.subject,
    needId: row.need_id,
    requestId,
    clientPartyId: row.client_party_id,
    providerPartyId: row.provider_party_id,
    candidateRef: requestPayload.candidateRef,
    requestPublicCode: requestPayload.publicCode,
    providerResponse: { ...providerResponse },
    clientAcceptance: { ...acceptance },
    terms: {
      amount: providerResponse.price,
      currency: providerResponse.currency,
      durationDays: providerResponse.durationDays,
      mode: providerResponse.mode,
      availableFrom: providerResponse.availableFrom,
      validUntil: providerResponse.validUntil,
    },
    sourceRequestRevision: row.revision,
    immutableSource: true,
  };
  await db.batch([
    db.prepare(
      `INSERT INTO service_proposals (
         proposal_id, request_id, need_id, client_party_id, provider_party_id,
         public_code, status, response_revision, payload_json, revision,
         created_by_account_id, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'DRAFT', ?7, ?8, 1, ?9, ?10, ?10)`,
    ).bind(
      proposalId, requestId, row.need_id, row.client_party_id,
      row.provider_party_id, publicCode, row.revision,
      JSON.stringify(snapshot), actor.account_id, now,
    ),
    db.prepare(
      `INSERT INTO service_proposal_versions (
         version_id, proposal_id, revision, snapshot_json, actor_account_id, created_at
       ) VALUES (?1, ?2, 1, ?3, ?4, ?5)`,
    ).bind(crypto.randomUUID(), proposalId, JSON.stringify(snapshot), actor.account_id, now),
    db.prepare(
      `UPDATE service_requests SET status = 'proposal_created',
              revision = revision + 1, updated_at = ?1
        WHERE request_id = ?2 AND status = 'accepted'`,
    ).bind(now, requestId),
    db.prepare(
      `INSERT INTO service_request_transitions (
         transition_id, request_id, request_key, from_status, to_status,
         actor_account_id, note, occurred_at
       ) VALUES (?1, ?2, ?3, 'accepted', 'proposal_created', ?4, ?5, ?6)`,
    ).bind(
      crypto.randomUUID(), requestId, `${row.revision + 1}:proposal_created`,
      actor.account_id, `PROPOSAL_CREATED:${proposalId}`, now,
    ),
    db.prepare(
      `INSERT INTO account_audit_events (
         event_id, account_id, event_type, actor_email, payload_json, occurred_at
       ) VALUES (?1, ?2, 'SERVICE_PROPOSAL_CREATED', ?3, ?4, ?5)`,
    ).bind(
      crypto.randomUUID(), actor.account_id, actor.email,
      JSON.stringify({ proposalId, requestId, publicCode, sourceRevision: row.revision }),
      now,
    ),
  ]);
  return json({
    ...snapshot, proposalId, publicCode, status: "DRAFT",
    revision: 1, createdAt: now,
  }, 201);
}

export async function PATCH(request: Request) {
  const workers = getRuntime();
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor) return json({ error: "ACCOUNT_CONTEXT_REQUIRED" }, 401);
  let body: Record<string, unknown>;
  try { body = object(await request.json()); }
  catch { return json({ error: "INVALID_JSON" }, 400); }
  const proposalId = String(body.proposalId ?? "").slice(0, 80);
  const to = String(body.to ?? "").slice(0, 40);
  const expectedRevision = Math.max(1, Math.floor(Number(body.expectedRevision) || 1));
  const note = String(body.note ?? "").trim().slice(0, 3000);
  const row = await db.prepare(
    `SELECT sp.status, sp.revision, sp.payload_json,
            EXISTS(SELECT 1 FROM account_party_links l
                    WHERE l.account_id = ?2 AND l.party_id = sp.client_party_id
                      AND l.status = 'ACTIVE') AS is_client,
            EXISTS(SELECT 1 FROM account_party_links l
                    WHERE l.account_id = ?2 AND l.party_id = sp.provider_party_id
                      AND l.status = 'ACTIVE') AS is_provider
       FROM service_proposals sp WHERE sp.proposal_id = ?1`,
  ).bind(proposalId, actor.account_id).first<{
    status: string; revision: number; payload_json: string;
    is_client: number; is_provider: number;
  }>();
  if (!row) return json({ error: "PROPOSAL_NOT_FOUND" }, 404);
  const role = row.is_provider ? "provider" : row.is_client ? "client" : "";
  if (!role) return json({ error: "PROPOSAL_ACCESS_DENIED" }, 403);
  if (row.revision !== expectedRevision) {
    return json({ error: "REVISION_CONFLICT", revision: row.revision, status: row.status }, 409);
  }
  if (!(proposalTransitions[row.status] ?? []).includes(to)) {
    return json({
      error: "INVALID_PROPOSAL_TRANSITION",
      from: row.status, to, allowed: proposalTransitions[row.status] ?? [],
    }, 422);
  }
  const providerAction = ["SENT", "WITHDRAWN"].includes(to);
  const clientAction = ["CHANGES_REQUESTED", "ACCEPTED", "REJECTED"].includes(to);
  if ((providerAction && role !== "provider") || (clientAction && role !== "client")) {
    return json({ error: "PROPOSAL_ACTION_NOT_ALLOWED_FOR_ROLE", role, to }, 403);
  }
  if (["CHANGES_REQUESTED", "REJECTED", "WITHDRAWN"].includes(to) && !note) {
    return json({ error: "PROPOSAL_ACTION_NOTE_REQUIRED" }, 422);
  }
  const payload = object(JSON.parse(row.payload_json));
  if (to === "SENT") {
    const amendments = object(body.amendments);
    const terms = object(payload.terms);
    const amount = Number(amendments.amount ?? terms.amount);
    const currency = String(amendments.currency ?? terms.currency ?? "");
    const durationDays = Math.floor(Number(amendments.durationDays ?? terms.durationDays) || 0);
    const validUntil = String(amendments.validUntil ?? terms.validUntil ?? "").slice(0, 10);
    if (
      !Number.isFinite(amount) || amount < 0 ||
      !["USD", "EUR"].includes(currency) || durationDays < 1 ||
      !validUntil || validUntil < new Date().toISOString().slice(0, 10)
    ) {
      return json({ error: "PROPOSAL_COMMERCIAL_TERMS_INVALID" }, 422);
    }
    payload.amendments = {
      methodology: String(amendments.methodology ?? "").trim().slice(0, 6000),
      deliverables: String(amendments.deliverables ?? "").trim().slice(0, 4000),
      amount, currency, durationDays, validUntil,
      assumptions: String(amendments.assumptions ?? "").trim().slice(0, 4000),
      exclusions: String(amendments.exclusions ?? "").trim().slice(0, 4000),
    };
  }
  const revision = row.revision + 1;
  const now = new Date().toISOString();
  const history = Array.isArray(payload.history) ? payload.history : [];
  history.push({ from: row.status, to, role, note, revision, at: now });
  payload.history = history.slice(-200);
  payload.status = to;
  if (to === "ACCEPTED") {
    payload.finalAcceptance = {
      revision, acceptedAt: now, acceptedByAccountId: actor.account_id,
    };
  }
  await db.batch([
    db.prepare(
      `UPDATE service_proposals
          SET status = ?1, payload_json = ?2, revision = ?3, updated_at = ?4
        WHERE proposal_id = ?5 AND revision = ?6`,
    ).bind(to, JSON.stringify(payload), revision, now, proposalId, row.revision),
    db.prepare(
      `INSERT INTO service_proposal_versions (
         version_id, proposal_id, revision, snapshot_json, actor_account_id, created_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    ).bind(
      crypto.randomUUID(), proposalId, revision,
      JSON.stringify(payload), actor.account_id, now,
    ),
    db.prepare(
      `INSERT INTO account_audit_events (
         event_id, account_id, event_type, actor_email, payload_json, occurred_at
       ) VALUES (?1, ?2, 'SERVICE_PROPOSAL_TRANSITIONED', ?3, ?4, ?5)`,
    ).bind(
      crypto.randomUUID(), actor.account_id, actor.email,
      JSON.stringify({ proposalId, from: row.status, to, revision, role }), now,
    ),
  ]);
  return json({
    ...payload, proposalId, status: to, revision, updatedAt: now,
  });
}
