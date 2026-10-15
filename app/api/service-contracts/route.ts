import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function object(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
async function actorContext(db: D1Database) {
  const user = await getChatGPTUser();
  if (!user) return null;
  const email = user.email.trim().toLowerCase();
  return db.prepare(
    "SELECT account_id, email FROM accounts WHERE email = ?1",
  ).bind(email).first<{ account_id: string; email: string }>();
}
function contractCode(sequence: number) {
  return `NAE-CTR-${new Date().getUTCFullYear()}-${String(sequence).padStart(6, "0")}`;
}

export async function GET() {
  const workers = await import("cloudflare:workers");
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor) return json({ error: "ACCOUNT_CONTEXT_REQUIRED" }, 401);
  const rows = await db.prepare(
    `SELECT sc.contract_id, sc.proposal_id, sc.public_code, sc.status,
            sc.payload_json, sc.revision, sc.updated_at
       FROM service_contracts sc
      WHERE EXISTS (
        SELECT 1 FROM account_party_links l
         WHERE l.account_id = ?1 AND l.status = 'ACTIVE'
           AND l.party_id IN (sc.client_party_id, sc.provider_party_id)
      )
      ORDER BY sc.updated_at DESC LIMIT 100`,
  ).bind(actor.account_id).all<{
    contract_id: string; proposal_id: string; public_code: string;
    status: string; payload_json: string; revision: number; updated_at: string;
  }>();
  return json({
    contracts: rows.results.map((row) => ({
      ...JSON.parse(row.payload_json),
      contractId: row.contract_id,
      proposalId: row.proposal_id,
      publicCode: row.public_code,
      status: row.status,
      revision: row.revision,
      updatedAt: row.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const workers = await import("cloudflare:workers");
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor) return json({ error: "ACCOUNT_CONTEXT_REQUIRED" }, 401);
  let body: Record<string, unknown>;
  try { body = object(await request.json()); }
  catch { return json({ error: "INVALID_JSON" }, 400); }
  const proposalId = String(body.proposalId ?? "").slice(0, 80);
  const proposal = await db.prepare(
    `SELECT sp.proposal_id, sp.request_id, sp.client_party_id,
            sp.provider_party_id, sp.public_code, sp.status,
            sp.revision, sp.payload_json
       FROM service_proposals sp
      WHERE sp.proposal_id = ?1
        AND EXISTS (
          SELECT 1 FROM account_party_links l
           WHERE l.account_id = ?2 AND l.party_id = sp.client_party_id
             AND l.status = 'ACTIVE'
        )`,
  ).bind(proposalId, actor.account_id).first<{
    proposal_id: string; request_id: string; client_party_id: string;
    provider_party_id: string | null; public_code: string; status: string;
    revision: number; payload_json: string;
  }>();
  if (!proposal) return json({ error: "ACCEPTED_PROPOSAL_NOT_FOUND" }, 404);
  const duplicate = await db.prepare(
    "SELECT contract_id, public_code, status, revision FROM service_contracts WHERE proposal_id = ?1",
  ).bind(proposalId).first<{
    contract_id: string; public_code: string; status: string; revision: number;
  }>();
  if (duplicate) return json({
    duplicate: true, contractId: duplicate.contract_id,
    publicCode: duplicate.public_code, status: duplicate.status,
    revision: duplicate.revision,
  });
  if (proposal.status !== "ACCEPTED") {
    return json({ error: "PROPOSAL_MUST_BE_ACCEPTED", status: proposal.status }, 422);
  }
  const proposalPayload = object(JSON.parse(proposal.payload_json));
  const amendments = object(proposalPayload.amendments);
  const terms = object(proposalPayload.terms);
  const finalTerms = {
    amount: amendments.amount ?? terms.amount,
    currency: amendments.currency ?? terms.currency,
    durationDays: amendments.durationDays ?? terms.durationDays,
    mode: terms.mode,
    availableFrom: terms.availableFrom,
  };
  const contractId = crypto.randomUUID();
  const count = await db.prepare("SELECT COUNT(*) AS count FROM service_contracts")
    .first<{ count: number }>();
  const publicCode = contractCode((count?.count ?? 0) + 1);
  const now = new Date().toISOString();
  const payload = {
    title: proposalPayload.title,
    requestId: proposal.request_id,
    proposalPublicCode: proposal.public_code,
    sourceProposalRevision: proposal.revision,
    clientPartyId: proposal.client_party_id,
    providerPartyId: proposal.provider_party_id,
    scope: {
      methodology: amendments.methodology || object(proposalPayload.providerResponse).methodology,
      deliverables: amendments.deliverables || object(proposalPayload.providerResponse).deliverables,
      assumptions: amendments.assumptions,
      exclusions: amendments.exclusions,
    },
    terms: finalTerms,
    confidentiality: "تسري سرية طلب الخدمة والعرض على العقد ومرفقاته",
    intellectualProperty: "تحدد ملكية كل مخرج وحقوق استخدامه قبل بدء التنفيذ",
    changeControl: "أي تغيير في النطاق أو القيمة أو المدة يتطلب أمر تغيير معتمدًا",
    disputeResolution: "تبدأ المعالجة بالتفاوض الموثق ثم التصعيد وفق الشروط المتفق عليها",
    signatures: { client: null, provider: null },
    history: [{ from: "NONE", to: "DRAFT", at: now, actor: "client" }],
    immutableProposalSnapshot: proposalPayload,
  };
  await db.batch([
    db.prepare(
      `INSERT INTO service_contracts (
         contract_id, proposal_id, request_id, client_party_id, provider_party_id,
         public_code, status, payload_json, revision,
         created_by_account_id, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'DRAFT', ?7, 1, ?8, ?9, ?9)`,
    ).bind(
      contractId, proposalId, proposal.request_id, proposal.client_party_id,
      proposal.provider_party_id, publicCode, JSON.stringify(payload),
      actor.account_id, now,
    ),
    db.prepare(
      `INSERT INTO service_contract_transitions (
         transition_id, contract_id, revision, from_status, to_status,
         actor_account_id, note, occurred_at
       ) VALUES (?1, ?2, 1, 'NONE', 'DRAFT', ?3, 'CONTRACT_CREATED', ?4)`,
    ).bind(crypto.randomUUID(), contractId, actor.account_id, now),
    db.prepare(
      `INSERT INTO account_audit_events (
         event_id, account_id, event_type, actor_email, payload_json, occurred_at
       ) VALUES (?1, ?2, 'SERVICE_CONTRACT_CREATED', ?3, ?4, ?5)`,
    ).bind(
      crypto.randomUUID(), actor.account_id, actor.email,
      JSON.stringify({ contractId, proposalId, publicCode }), now,
    ),
  ]);
  return json({
    ...payload, contractId, proposalId, publicCode,
    status: "DRAFT", revision: 1, createdAt: now,
  }, 201);
}

export async function PATCH(request: Request) {
  const workers = await import("cloudflare:workers");
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor) return json({ error: "ACCOUNT_CONTEXT_REQUIRED" }, 401);
  let body: Record<string, unknown>;
  try { body = object(await request.json()); }
  catch { return json({ error: "INVALID_JSON" }, 400); }
  const contractId = String(body.contractId ?? "").slice(0, 80);
  const action = String(body.action ?? "").slice(0, 40);
  const expectedRevision = Math.max(1, Math.floor(Number(body.expectedRevision) || 1));
  const declaration = String(body.declaration ?? "").trim().slice(0, 2000);
  const row = await db.prepare(
    `SELECT sc.status, sc.revision, sc.payload_json, sc.client_party_id,
            sc.provider_party_id,
            EXISTS(SELECT 1 FROM account_party_links l WHERE l.account_id = ?2
              AND l.party_id = sc.client_party_id AND l.status = 'ACTIVE') AS is_client,
            EXISTS(SELECT 1 FROM account_party_links l WHERE l.account_id = ?2
              AND l.party_id = sc.provider_party_id AND l.status = 'ACTIVE') AS is_provider
       FROM service_contracts sc WHERE sc.contract_id = ?1`,
  ).bind(contractId, actor.account_id).first<{
    status: string; revision: number; payload_json: string;
    client_party_id: string; provider_party_id: string | null;
    is_client: number; is_provider: number;
  }>();
  if (!row) return json({ error: "CONTRACT_NOT_FOUND" }, 404);
  if (row.revision !== expectedRevision) {
    return json({ error: "REVISION_CONFLICT", revision: row.revision, status: row.status }, 409);
  }
  const role = row.is_provider ? "provider" : row.is_client ? "client" : "";
  if (!role) return json({ error: "CONTRACT_ACCESS_DENIED" }, 403);
  if (
    (action === "SIGN_CLIENT" && role !== "client") ||
    (action === "SIGN_PROVIDER" && role !== "provider")
  ) return json({ error: "CONTRACT_ACTION_NOT_ALLOWED_FOR_ROLE", role, action }, 403);
  if (!["SIGN_CLIENT", "SIGN_PROVIDER", "CANCEL"].includes(action)) {
    return json({ error: "INVALID_CONTRACT_ACTION" }, 422);
  }
  if (!declaration) return json({ error: "SIGNATURE_DECLARATION_REQUIRED" }, 422);
  if (["ACTIVE", "CANCELLED"].includes(row.status)) {
    return json({ error: "CONTRACT_IS_FINAL", status: row.status }, 422);
  }
  const payload = object(JSON.parse(row.payload_json));
  const signatures = object(payload.signatures);
  const now = new Date().toISOString();
  let signatureRole = "";
  if (action === "SIGN_CLIENT") signatureRole = "client";
  if (action === "SIGN_PROVIDER") signatureRole = "provider";
  if (signatureRole && signatures[signatureRole]) {
    return json({ error: "PARTY_ALREADY_SIGNED", role: signatureRole }, 409);
  }
  if (signatureRole) signatures[signatureRole] = {
    accountId: actor.account_id, signedAt: now, declaration,
  };
  payload.signatures = signatures;
  const to = action === "CANCEL"
    ? "CANCELLED"
    : signatures.client && signatures.provider
      ? "ACTIVE"
      : signatures.client ? "CLIENT_SIGNED" : "PROVIDER_SIGNED";
  const revision = row.revision + 1;
  const history = Array.isArray(payload.history) ? payload.history : [];
  history.push({ from: row.status, to, action, role, declaration, revision, at: now });
  payload.history = history.slice(-200);
  await db.batch([
    db.prepare(
      `UPDATE service_contracts SET status = ?1, payload_json = ?2,
              revision = ?3, updated_at = ?4
        WHERE contract_id = ?5 AND revision = ?6`,
    ).bind(to, JSON.stringify(payload), revision, now, contractId, row.revision),
    db.prepare(
      `INSERT INTO service_contract_transitions (
         transition_id, contract_id, revision, from_status, to_status,
         actor_account_id, note, occurred_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(
      crypto.randomUUID(), contractId, revision, row.status, to,
      actor.account_id, declaration, now,
    ),
    ...(signatureRole ? [db.prepare(
      `INSERT INTO service_contract_signatures (
         signature_id, contract_id, party_role, party_id,
         account_id, declaration, signed_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    ).bind(
      crypto.randomUUID(), contractId, signatureRole,
      signatureRole === "client" ? row.client_party_id : row.provider_party_id,
      actor.account_id, declaration, now,
    )] : []),
    db.prepare(
      `INSERT INTO account_audit_events (
         event_id, account_id, event_type, actor_email, payload_json, occurred_at
       ) VALUES (?1, ?2, 'SERVICE_CONTRACT_ACTION', ?3, ?4, ?5)`,
    ).bind(
      crypto.randomUUID(), actor.account_id, actor.email,
      JSON.stringify({ contractId, action, from: row.status, to, revision, role }), now,
    ),
  ]);
  return json({
    ...payload, contractId, status: to, revision, updatedAt: now,
  });
}
