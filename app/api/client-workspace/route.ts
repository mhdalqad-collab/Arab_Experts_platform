import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

const needStates = new Set([
  "مسودة", "جاهز للمراجعة", "قيد المطابقة",
  "تم اختيار مرشح وبدء طلب الخدمة", "مغلق",
]);
const requestStates = new Set([
  "draft", "ready", "sent", "delivered", "viewed",
  "clarification_requested", "responded", "accepted", "declined",
  "withdrawn", "expired", "proposal_created", "closed",
]);

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function safeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function context(db: D1Database) {
  const user = await getChatGPTUser();
  if (!user) return null;
  const email = user.email.trim().toLowerCase();
  return db.prepare(
    `SELECT a.account_id, a.email, l.party_id
       FROM accounts a
       JOIN account_party_links l ON l.account_id = a.account_id
      WHERE a.email = ?1 AND l.status = 'ACTIVE'
      ORDER BY l.is_primary DESC, l.created_at
      LIMIT 1`,
  ).bind(email).first<{
    account_id: string;
    email: string;
    party_id: string;
  }>();
}

export async function GET() {
  const workers = await import("cloudflare:workers");
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await context(db);
  if (!actor) return json({ error: "CLIENT_CONTEXT_REQUIRED" }, 401);
  const [needs, requests] = await Promise.all([
    db.prepare(
      `SELECT need_id, public_code, status, payload_json,
              fingerprint_json, revision, updated_at
         FROM client_needs
        WHERE client_party_id = ?1
        ORDER BY updated_at DESC`,
    ).bind(actor.party_id).all<{
      need_id: string; public_code: string; status: string;
      payload_json: string; fingerprint_json: string;
      revision: number; updated_at: string;
    }>(),
    db.prepare(
      `SELECT request_id, need_id, public_code, candidate_ref, status,
              payload_json, revision, updated_at
         FROM service_requests
        WHERE client_party_id = ?1
        ORDER BY updated_at DESC`,
    ).bind(actor.party_id).all<{
      request_id: string; need_id: string; public_code: string;
      candidate_ref: string; status: string; payload_json: string;
      revision: number; updated_at: string;
    }>(),
  ]);
  return json({
    partyId: actor.party_id,
    needs: needs.results.map((row) => ({
      ...JSON.parse(row.payload_json),
      needId: row.need_id,
      publicCode: row.public_code,
      status: row.status,
      fingerprint: JSON.parse(row.fingerprint_json),
      serverRevision: row.revision,
      serverUpdatedAt: row.updated_at,
    })),
    requests: requests.results.map((row) => ({
      ...JSON.parse(row.payload_json),
      requestId: row.request_id,
      needId: row.need_id,
      publicCode: row.public_code,
      candidateRef: row.candidate_ref,
      status: row.status,
      serverRevision: row.revision,
      serverUpdatedAt: row.updated_at,
    })),
  });
}

export async function PUT(request: Request) {
  const workers = await import("cloudflare:workers");
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await context(db);
  if (!actor) return json({ error: "CLIENT_CONTEXT_REQUIRED" }, 401);
  let body: { needs?: unknown; requests?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  const needs = Array.isArray(body.needs) ? body.needs.slice(0, 100) : [];
  const serviceRequests = Array.isArray(body.requests)
    ? body.requests.slice(0, 250)
    : [];
  if (JSON.stringify({ needs, serviceRequests }).length > 2_000_000) {
    return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
  }

  const savedNeeds: Array<{ needId: string; revision: number }> = [];
  for (const raw of needs) {
    const item = safeObject(raw);
    const needId = typeof item.needId === "string" ? item.needId.slice(0, 80) : "";
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 300) : "";
    const status = typeof item.status === "string" && needStates.has(item.status)
      ? item.status : "مسودة";
    if (!needId || !title) continue;
    const existing = await db.prepare(
      "SELECT revision, payload_json, fingerprint_json FROM client_needs WHERE need_id = ?1 AND client_party_id = ?2",
    ).bind(needId, actor.party_id).first<{
      revision: number; payload_json: string; fingerprint_json: string;
    }>();
    const fingerprint = safeObject(item.fingerprint);
    const payload = { ...item };
    delete payload.fingerprint;
    delete payload.serverRevision;
    delete payload.serverUpdatedAt;
    const payloadJson = JSON.stringify(payload);
    const fingerprintJson = JSON.stringify(fingerprint);
    const revision = (existing?.revision ?? 0) + 1;
    if (
      existing &&
      existing.payload_json === payloadJson &&
      existing.fingerprint_json === fingerprintJson
    ) {
      savedNeeds.push({ needId, revision: existing.revision });
      continue;
    }
    const now = new Date().toISOString();
    const publicCode = typeof item.publicCode === "string"
      ? item.publicCode.slice(0, 80) : needId;
    await db.batch([
      db.prepare(
        `INSERT INTO client_needs (
           need_id, client_party_id, public_code, title, output_type,
           service_type, status, payload_json, fingerprint_json, revision,
           created_by_account_id, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)
         ON CONFLICT(need_id) DO UPDATE SET
           public_code = excluded.public_code, title = excluded.title,
           output_type = excluded.output_type, service_type = excluded.service_type,
           status = excluded.status, payload_json = excluded.payload_json,
           fingerprint_json = excluded.fingerprint_json,
           revision = excluded.revision, updated_at = excluded.updated_at
         WHERE client_needs.client_party_id = excluded.client_party_id`,
      ).bind(
        needId, actor.party_id, publicCode, title,
        typeof item.outputType === "string" ? item.outputType : null,
        typeof item.service === "string" ? item.service : null,
        status, payloadJson, fingerprintJson, revision,
        actor.account_id, now,
      ),
      db.prepare(
        `INSERT INTO client_need_versions (
           version_id, need_id, revision, snapshot_json, actor_account_id, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      ).bind(
        crypto.randomUUID(), needId, revision,
        JSON.stringify({ payload, fingerprint }), actor.account_id, now,
      ),
    ]);
    savedNeeds.push({ needId, revision });
  }

  const savedRequests: Array<{ requestId: string; revision: number }> = [];
  for (const raw of serviceRequests) {
    const item = safeObject(raw);
    const requestId = typeof item.requestId === "string" ? item.requestId.slice(0, 80) : "";
    const needId = typeof item.needId === "string" ? item.needId.slice(0, 80) : "";
    const candidateRef = typeof item.candidateRef === "string"
      ? item.candidateRef.slice(0, 160) : "";
    const status = typeof item.status === "string" && requestStates.has(item.status)
      ? item.status : "draft";
    if (!requestId || !needId || !candidateRef) continue;
    const ownedNeed = await db.prepare(
      "SELECT 1 FROM client_needs WHERE need_id = ?1 AND client_party_id = ?2",
    ).bind(needId, actor.party_id).first();
    if (!ownedNeed) continue;
    const existing = await db.prepare(
      "SELECT revision, status, payload_json FROM service_requests WHERE request_id = ?1 AND client_party_id = ?2",
    ).bind(requestId, actor.party_id).first<{
      revision: number; status: string; payload_json: string;
    }>();
    const payload = { ...item };
    delete payload.serverRevision;
    delete payload.serverUpdatedAt;
    const payloadJson = JSON.stringify(payload);
    if (existing && existing.payload_json === payloadJson && existing.status === status) {
      savedRequests.push({ requestId, revision: existing.revision });
      continue;
    }
    const revision = (existing?.revision ?? 0) + 1;
    const now = new Date().toISOString();
    const publicCode = typeof item.publicCode === "string"
      ? item.publicCode.slice(0, 80) : requestId;
    await db.prepare(
      `INSERT INTO service_requests (
         request_id, need_id, client_party_id, provider_party_id,
         candidate_ref, public_code, status, payload_json, revision,
         created_by_account_id, created_at, updated_at
       ) VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
       ON CONFLICT(request_id) DO UPDATE SET
         status = excluded.status, payload_json = excluded.payload_json,
         revision = excluded.revision, updated_at = excluded.updated_at
       WHERE service_requests.client_party_id = excluded.client_party_id`,
    ).bind(
      requestId, needId, actor.party_id, candidateRef, publicCode,
      status, payloadJson, revision, actor.account_id, now,
    ).run();
    if (!existing || existing.status !== status) {
      await db.prepare(
        `INSERT OR IGNORE INTO service_request_transitions (
           transition_id, request_id, request_key, from_status, to_status,
           actor_account_id, note, occurred_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      ).bind(
        crypto.randomUUID(), requestId, `${revision}:${status}`,
        existing?.status ?? "NONE", status, actor.account_id,
        "CLIENT_WORKSPACE_SYNC", now,
      ).run();
    }
    savedRequests.push({ requestId, revision });
  }

  await db.prepare(
    `INSERT INTO account_audit_events (
       event_id, account_id, event_type, actor_email, payload_json, occurred_at
     ) VALUES (?1, ?2, 'CLIENT_WORKSPACE_SYNCED', ?3, ?4, ?5)`,
  ).bind(
    crypto.randomUUID(), actor.account_id, actor.email,
    JSON.stringify({ needs: savedNeeds.length, requests: savedRequests.length }),
    new Date().toISOString(),
  ).run();
  return json({
    savedAt: new Date().toISOString(),
    savedNeeds,
    savedRequests,
  });
}
