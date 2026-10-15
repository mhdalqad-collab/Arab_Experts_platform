import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
const CATEGORIES = ["QUALITY", "DELAY", "CONDUCT", "PAYMENT", "SCOPE", "CONFIDENTIALITY", "OTHER"];

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
  const account = await db.prepare("SELECT account_id, email FROM accounts WHERE email = ?1")
    .bind(user.email.trim().toLowerCase())
    .first<{ account_id: string; email: string }>();
  if (!account) return null;
  const admin = await db.prepare(
    "SELECT 1 AS ok FROM account_roles WHERE account_id = ?1 AND role_code = 'PLATFORM_ADMIN' AND is_active = 1",
  ).bind(account.account_id).first<{ ok: number }>();
  const parties = await db.prepare(
    "SELECT party_id FROM account_party_links WHERE account_id = ?1 AND status = 'ACTIVE'",
  ).bind(account.account_id).all<{ party_id: string }>();
  return { ...account, isAdmin: Boolean(admin), partyIds: parties.results.map((row) => row.party_id) };
}
async function complaintRows(db: D1Database, actor: { isAdmin: boolean; partyIds: string[] }) {
  const filter = actor.isAdmin
    ? "1 = 1"
    : actor.partyIds.length
      ? `(qc.complainant_party_id IN (${actor.partyIds.map(() => "?").join(",")})
          OR qc.respondent_party_id IN (${actor.partyIds.map(() => "?").join(",")}))`
      : "1 = 0";
  const query = `SELECT qc.complaint_id, qc.public_code, qc.complainant_party_id,
      qc.respondent_party_id, qc.project_id, qc.review_id,
      qc.category, qc.priority, qc.status, qc.subject, qc.statement, qc.resolution,
      qc.revision, qc.created_at, qc.updated_at, cp.display_name_ar AS complainant_name,
      rp.display_name_ar AS respondent_name
    FROM quality_complaints qc
    JOIN parties cp ON cp.party_id = qc.complainant_party_id
    LEFT JOIN parties rp ON rp.party_id = qc.respondent_party_id
    WHERE ${filter} ORDER BY qc.updated_at DESC LIMIT 100`;
  const base = actor.isAdmin
    ? await db.prepare(query).all<Record<string, unknown>>()
    : await db.prepare(query).bind(...actor.partyIds, ...actor.partyIds).all<Record<string, unknown>>();
  const output = [];
  for (const row of base.results) {
    const [transitions, actions] = await Promise.all([
      db.prepare(
        `SELECT sequence, from_status, to_status, action_code, note, occurred_at
          FROM complaint_transitions WHERE complaint_id = ?1 ORDER BY sequence`,
      ).bind(row.complaint_id).all(),
      db.prepare(
        `SELECT corrective_action_id, action_text, due_at, status,
                completion_evidence, created_at, completed_at
          FROM corrective_actions WHERE complaint_id = ?1 ORDER BY created_at`,
      ).bind(row.complaint_id).all(),
    ]);
    output.push({
      ...row,
      isComplainant: actor.isAdmin ? false : actor.partyIds.includes(String(row.complainant_party_id)),
      isRespondent: actor.isAdmin ? false : actor.partyIds.includes(String(row.respondent_party_id)),
      transitions: transitions.results,
      correctiveActions: actions.results,
    });
  }
  return output;
}
async function addTransition(
  db: D1Database, complaintId: string, from: string, to: string,
  action: string, note: string, accountId: string, now: string,
) {
  const count = await db.prepare(
    "SELECT COUNT(*) AS count FROM complaint_transitions WHERE complaint_id = ?1",
  ).bind(complaintId).first<{ count: number }>();
  return db.prepare(
    `INSERT INTO complaint_transitions (
       transition_id, complaint_id, sequence, from_status, to_status,
       action_code, note, actor_account_id, occurred_at
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  ).bind(
    crypto.randomUUID(), complaintId, (count?.count ?? 0) + 1, from, to,
    action, note || null, accountId, now,
  );
}
async function notifyComplaintParty(
  db: D1Database,
  partyId: string | null,
  actorAccountId: string,
  type: string,
  title: string,
  message: string,
  complaintId: string,
  priority: string,
  now: string,
) {
  if (!partyId) return;
  await db.prepare(
    `INSERT INTO account_notifications (
       notification_id, account_id, profile_id, notification_type,
       title, message, entity_type, entity_id, action_route,
       priority, is_read, created_at
     )
     SELECT lower(hex(randomblob(16))), l.account_id, NULL, ?1,
            ?2, ?3, 'COMPLAINT', ?4, '#/32', ?5, 0, ?6
       FROM account_party_links l
      WHERE l.party_id = ?7 AND l.status = 'ACTIVE'
        AND l.account_id <> ?8`,
  ).bind(
    type, title, message, complaintId, priority, now, partyId, actorAccountId,
  ).run();
}
async function notifyComplaintAdmins(
  db: D1Database,
  actorAccountId: string,
  complaintId: string,
  code: string,
  subject: string,
  now: string,
) {
  await db.prepare(
    `INSERT INTO account_notifications (
       notification_id, account_id, profile_id, notification_type,
       title, message, entity_type, entity_id, action_route,
       priority, is_read, created_at
     )
     SELECT lower(hex(randomblob(16))), ar.account_id, NULL,
            'QUALITY_COMPLAINT_SUBMITTED', 'شكوى جودة جديدة تحتاج الفرز',
            ?1, 'COMPLAINT', ?2, '#/32', 'HIGH', 0, ?3
       FROM account_roles ar
      WHERE ar.role_code = 'PLATFORM_ADMIN' AND ar.is_active = 1
        AND ar.account_id <> ?4`,
  ).bind(`${code} — ${subject}`, complaintId, now, actorAccountId).run();
}

export async function GET() {
  const workers = await import("cloudflare:workers");
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor) return json({ error: "ACCOUNT_CONTEXT_REQUIRED" }, 401);
  return json({ admin: actor.isAdmin, complaints: await complaintRows(db, actor) });
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
  const projectId = String(body.projectId ?? "").slice(0, 80);
  const category = String(body.category ?? "");
  const subject = String(body.subject ?? "").trim().slice(0, 240);
  const statement = String(body.statement ?? "").trim().slice(0, 6000);
  if (!CATEGORIES.includes(category) || !subject || !statement) {
    return json({ error: "COMPLAINT_DETAILS_REQUIRED" }, 422);
  }
  const project = await db.prepare(
    `SELECT project_id, client_party_id, provider_party_id
       FROM service_projects WHERE project_id = ?1`,
  ).bind(projectId).first<{
    project_id: string; client_party_id: string; provider_party_id: string | null;
  }>();
  if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
  const complainantPartyId = actor.partyIds.includes(project.client_party_id)
    ? project.client_party_id
    : project.provider_party_id && actor.partyIds.includes(project.provider_party_id)
      ? project.provider_party_id : "";
  if (!complainantPartyId) return json({ error: "COMPLAINT_PROJECT_ACCESS_DENIED" }, 403);
  const respondentPartyId = complainantPartyId === project.client_party_id
    ? project.provider_party_id : project.client_party_id;
  const count = await db.prepare("SELECT COUNT(*) AS count FROM quality_complaints")
    .first<{ count: number }>();
  const complaintId = crypto.randomUUID();
  const code = `NAE-CMP-${new Date().getUTCFullYear()}-${String((count?.count ?? 0) + 1).padStart(6, "0")}`;
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(
      `INSERT INTO quality_complaints (
         complaint_id, public_code, complainant_party_id, respondent_party_id,
         project_id, category, priority, status, subject, statement, revision,
         submitted_by_account_id, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'NORMAL', 'SUBMITTED',
                 ?7, ?8, 1, ?9, ?10, ?10)`,
    ).bind(
      complaintId, code, complainantPartyId, respondentPartyId, projectId,
      category, subject, statement, actor.account_id, now,
    ),
    await addTransition(db, complaintId, "NONE", "SUBMITTED", "SUBMIT", statement, actor.account_id, now),
  ]);
  await Promise.all([
    notifyComplaintParty(
      db, respondentPartyId, actor.account_id, "QUALITY_COMPLAINT_RECEIVED",
      "سُجلت شكوى مرتبطة بمشروع",
      `${code} — ${subject}`, complaintId, "HIGH", now,
    ),
    notifyComplaintAdmins(db, actor.account_id, complaintId, code, subject, now),
  ]);
  return json({ complaintId, publicCode: code, status: "SUBMITTED" }, 201);
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
  const complaintId = String(body.complaintId ?? "").slice(0, 80);
  const action = String(body.action ?? "").slice(0, 32);
  const note = String(body.note ?? "").trim().slice(0, 4000);
  const complaint = await db.prepare(
    `SELECT status, complainant_party_id, respondent_party_id, revision
       FROM quality_complaints WHERE complaint_id = ?1`,
  ).bind(complaintId).first<{
    status: string; complainant_party_id: string;
    respondent_party_id: string | null; revision: number;
  }>();
  if (!complaint) return json({ error: "COMPLAINT_NOT_FOUND" }, 404);
  const isComplainant = actor.partyIds.includes(complaint.complainant_party_id);
  const isRespondent = Boolean(complaint.respondent_party_id && actor.partyIds.includes(complaint.respondent_party_id));
  const now = new Date().toISOString();
  let next = complaint.status;
  if (action === "TRIAGE" && actor.isAdmin && complaint.status === "SUBMITTED") next = "UNDER_REVIEW";
  else if (action === "RESPOND" && isRespondent && complaint.status === "UNDER_REVIEW" && note) next = "RESPONSE_RECEIVED";
  else if (action === "RESOLVE" && actor.isAdmin && ["UNDER_REVIEW", "RESPONSE_RECEIVED", "APPEALED"].includes(complaint.status) && note) next = "RESOLVED";
  else if (action === "CLOSE" && isComplainant && complaint.status === "RESOLVED") next = "CLOSED";
  else if (action === "APPEAL" && isComplainant && ["RESOLVED", "CLOSED"].includes(complaint.status) && note) next = "APPEALED";
  else if (action === "ADD_CORRECTIVE" && actor.isAdmin && note) {
    const dueAt = String(body.dueAt ?? "").slice(0, 10) || null;
    await db.prepare(
      `INSERT INTO corrective_actions (
         corrective_action_id, complaint_id, action_text, owner_account_id,
         due_at, status, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, 'OPEN', ?6, ?6)`,
    ).bind(crypto.randomUUID(), complaintId, note, actor.account_id, dueAt, now).run();
    return json({ ok: true, complaintId, action });
  } else return json({ error: "COMPLAINT_TRANSITION_NOT_ALLOWED" }, 403);
  const priority = action === "TRIAGE" && ["LOW", "NORMAL", "HIGH", "CRITICAL"].includes(String(body.priority))
    ? String(body.priority) : null;
  await db.batch([
    db.prepare(
      `UPDATE quality_complaints SET status = ?1,
              priority = COALESCE(?2, priority),
              resolution = CASE WHEN ?3 = 'RESOLVE' THEN ?4 ELSE resolution END,
              revision = revision + 1, updated_at = ?5,
              closed_at = CASE WHEN ?1 = 'CLOSED' THEN ?5 ELSE closed_at END
        WHERE complaint_id = ?6 AND revision = ?7`,
    ).bind(next, priority, action, note, now, complaintId, complaint.revision),
    await addTransition(db, complaintId, complaint.status, next, action, note, actor.account_id, now),
    db.prepare(
      `INSERT INTO account_audit_events (
         event_id, account_id, event_type, actor_email, payload_json, occurred_at
       ) VALUES (?1, ?2, 'QUALITY_COMPLAINT_ACTION', ?3, ?4, ?5)`,
    ).bind(
      crypto.randomUUID(), actor.account_id, actor.email,
      JSON.stringify({ complaintId, action, from: complaint.status, to: next }), now,
    ),
  ]);
  const targetPartyId = ["TRIAGE", "CLOSE", "APPEAL"].includes(action)
    ? complaint.respondent_party_id : complaint.complainant_party_id;
  await notifyComplaintParty(
    db, targetPartyId, actor.account_id, `QUALITY_COMPLAINT_${action}`,
    action === "TRIAGE" ? "بدأت مراجعة الشكوى"
      : action === "RESPOND" ? "وصل رد على الشكوى"
      : action === "RESOLVE" ? "صدر مقترح حل للشكوى"
      : action === "CLOSE" ? "أُغلقت الشكوى" : "قُدم استئناف على قرار الشكوى",
    `${complaintId} — ${note || next}`, complaintId,
    ["TRIAGE", "APPEAL"].includes(action) ? "HIGH" : "NORMAL", now,
  );
  return json({ ok: true, complaintId, status: next });
}
