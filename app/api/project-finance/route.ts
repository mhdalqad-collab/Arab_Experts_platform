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
  return db.prepare("SELECT account_id, email FROM accounts WHERE email = ?1")
    .bind(user.email.trim().toLowerCase())
    .first<{ account_id: string; email: string }>();
}
function publicCode(prefix: string, count: number) {
  return `NAE-${prefix}-${new Date().getUTCFullYear()}-${String(count + 1).padStart(6, "0")}`;
}
async function projectAccess(db: D1Database, projectId: string, accountId: string) {
  return db.prepare(
    `SELECT sp.project_id, sp.public_code, sp.title,
            sp.client_party_id, sp.provider_party_id,
            EXISTS(SELECT 1 FROM account_party_links l WHERE l.account_id = ?2
              AND l.party_id = sp.client_party_id AND l.status = 'ACTIVE') AS is_client,
            EXISTS(SELECT 1 FROM account_party_links l WHERE l.account_id = ?2
              AND l.party_id = sp.provider_party_id AND l.status = 'ACTIVE') AS is_provider
       FROM service_projects sp WHERE sp.project_id = ?1`,
  ).bind(projectId, accountId).first<{
    project_id: string; public_code: string; title: string;
    client_party_id: string; provider_party_id: string | null;
    is_client: number; is_provider: number;
  }>();
}
async function notifyParty(
  db: D1Database,
  partyId: string | null,
  actorAccountId: string,
  type: string,
  title: string,
  message: string,
  projectId: string,
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
            ?2, ?3, 'PROJECT', ?4, '#/111', ?5, 0, ?6
       FROM account_party_links l
      WHERE l.party_id = ?7 AND l.status = 'ACTIVE'
        AND l.account_id <> ?8`,
  ).bind(
    type, title, message, projectId, priority, now, partyId, actorAccountId,
  ).run();
}
async function financeRows(db: D1Database, projectId: string) {
  const [schedules, invoices, payments] = await Promise.all([
    db.prepare(
      `SELECT pps.schedule_id, pps.milestone_id, pps.sequence, pps.percentage,
              pps.amount_minor, pps.currency, pps.status, pps.eligible_at,
              pm.title AS milestone_title
         FROM project_payment_schedules pps
         JOIN project_milestones pm ON pm.milestone_id = pps.milestone_id
        WHERE pps.project_id = ?1 ORDER BY pps.sequence`,
    ).bind(projectId).all(),
    db.prepare(
      `SELECT invoice_id, schedule_id, public_code, status, amount_minor,
              currency, details_json, issued_at, approved_at, paid_at
         FROM project_invoices WHERE project_id = ?1 ORDER BY issued_at DESC`,
    ).bind(projectId).all(),
    db.prepare(
      `SELECT pp.payment_id, pp.invoice_id, pp.public_code, pp.amount_minor,
              pp.currency, pp.method, pp.external_reference, pp.status, pp.recorded_at
         FROM project_payments pp
         JOIN project_invoices pi ON pi.invoice_id = pp.invoice_id
        WHERE pi.project_id = ?1 ORDER BY pp.recorded_at DESC`,
    ).bind(projectId).all(),
  ]);
  return {
    schedules: schedules.results,
    invoices: invoices.results.map((row: Record<string, unknown>) => ({
      ...row, details: JSON.parse(String(row.details_json ?? "{}")),
    })),
    payments: payments.results,
  };
}

export async function GET(request: Request) {
  const workers = await import("cloudflare:workers");
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor) return json({ error: "ACCOUNT_CONTEXT_REQUIRED" }, 401);
  const projectId = new URL(request.url).searchParams.get("projectId")?.slice(0, 80) ?? "";
  const access = await projectAccess(db, projectId, actor.account_id);
  if (!access || (!access.is_client && !access.is_provider)) {
    return json({ error: "PROJECT_ACCESS_DENIED" }, 403);
  }
  return json(await financeRows(db, projectId));
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
  const scheduleId = String(body.scheduleId ?? "").slice(0, 80);
  const note = String(body.note ?? "").trim().slice(0, 2000);
  const access = await projectAccess(db, projectId, actor.account_id);
  if (!access?.is_provider) return json({ error: "PROVIDER_REQUIRED" }, 403);
  const schedule = await db.prepare(
    `SELECT schedule_id, amount_minor, currency FROM project_payment_schedules
      WHERE schedule_id = ?1 AND project_id = ?2 AND status = 'ELIGIBLE'`,
  ).bind(scheduleId, projectId).first<{
    schedule_id: string; amount_minor: number; currency: string;
  }>();
  if (!schedule) return json({ error: "PAYMENT_SCHEDULE_NOT_ELIGIBLE" }, 422);
  const existing = await db.prepare(
    "SELECT invoice_id, public_code FROM project_invoices WHERE schedule_id = ?1",
  ).bind(scheduleId).first<{ invoice_id: string; public_code: string }>();
  if (existing) return json({ duplicate: true, ...existing });
  const count = await db.prepare("SELECT COUNT(*) AS count FROM project_invoices")
    .first<{ count: number }>();
  const invoiceId = crypto.randomUUID();
  const code = publicCode("INV", count?.count ?? 0);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(
      `INSERT INTO project_invoices (
         invoice_id, schedule_id, project_id, public_code, status,
         amount_minor, currency, details_json, issued_by_account_id,
         issued_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, 'ISSUED', ?5, ?6, ?7, ?8, ?9, ?9)`,
    ).bind(
      invoiceId, scheduleId, projectId, code, schedule.amount_minor,
      schedule.currency, JSON.stringify({ note }), actor.account_id, now,
    ),
    db.prepare(
      "UPDATE project_payment_schedules SET status = 'INVOICED', updated_at = ?1 WHERE schedule_id = ?2",
    ).bind(now, scheduleId),
    db.prepare(
      `INSERT INTO account_audit_events (
         event_id, account_id, event_type, actor_email, payload_json, occurred_at
       ) VALUES (?1, ?2, 'PROJECT_INVOICE_ISSUED', ?3, ?4, ?5)`,
    ).bind(
      crypto.randomUUID(), actor.account_id, actor.email,
      JSON.stringify({ projectId, scheduleId, invoiceId, code }), now,
    ),
  ]);
  await notifyParty(
    db, access.client_party_id, actor.account_id, "PROJECT_INVOICE_ISSUED",
    "فاتورة مشروع تنتظر المراجعة",
    `${access.public_code} — ${code} بقيمة ${(schedule.amount_minor / 100).toFixed(2)} ${schedule.currency}`,
    projectId, "HIGH", now,
  );
  return json({ invoiceId, publicCode: code, status: "ISSUED" }, 201);
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
  const projectId = String(body.projectId ?? "").slice(0, 80);
  const invoiceId = String(body.invoiceId ?? "").slice(0, 80);
  const action = String(body.action ?? "").slice(0, 32);
  const note = String(body.note ?? "").trim().slice(0, 2000);
  const access = await projectAccess(db, projectId, actor.account_id);
  if (!access) return json({ error: "PROJECT_NOT_FOUND" }, 404);
  const invoice = await db.prepare(
    `SELECT invoice_id, schedule_id, status, amount_minor, currency
       FROM project_invoices WHERE invoice_id = ?1 AND project_id = ?2`,
  ).bind(invoiceId, projectId).first<{
    invoice_id: string; schedule_id: string; status: string;
    amount_minor: number; currency: string;
  }>();
  if (!invoice) return json({ error: "INVOICE_NOT_FOUND" }, 404);
  const now = new Date().toISOString();
  if (action === "APPROVE") {
    if (!access.is_client || invoice.status !== "ISSUED") return json({ error: "INVOICE_APPROVAL_NOT_ALLOWED" }, 403);
    await db.prepare(
      `UPDATE project_invoices SET status = 'APPROVED', approved_by_account_id = ?1,
              approved_at = ?2, updated_at = ?2 WHERE invoice_id = ?3`,
    ).bind(actor.account_id, now, invoiceId).run();
  } else if (action === "RECORD_PAYMENT") {
    if (!access.is_client || invoice.status !== "APPROVED") return json({ error: "PAYMENT_NOT_ALLOWED" }, 403);
    const method = String(body.method ?? "").slice(0, 80);
    const reference = String(body.reference ?? "").trim().slice(0, 160);
    if (!["BANK_TRANSFER", "PAYMENT_GATEWAY"].includes(method) || !reference) {
      return json({ error: "PAYMENT_DETAILS_REQUIRED" }, 422);
    }
    const count = await db.prepare("SELECT COUNT(*) AS count FROM project_payments")
      .first<{ count: number }>();
    const paymentId = crypto.randomUUID();
    const code = publicCode("PAY", count?.count ?? 0);
    await db.batch([
      db.prepare(
        `INSERT INTO project_payments (
           payment_id, invoice_id, public_code, amount_minor, currency,
           method, external_reference, status, recorded_by_account_id, recorded_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'RECORDED', ?8, ?9)`,
      ).bind(
        paymentId, invoiceId, code, invoice.amount_minor, invoice.currency,
        method, reference, actor.account_id, now,
      ),
      db.prepare(
        "UPDATE project_invoices SET status = 'PAID', paid_at = ?1, updated_at = ?1 WHERE invoice_id = ?2",
      ).bind(now, invoiceId),
      db.prepare(
        "UPDATE project_payment_schedules SET status = 'PAID', updated_at = ?1 WHERE schedule_id = ?2",
      ).bind(now, invoice.schedule_id),
    ]);
  } else if (action === "DISPUTE") {
    if (!access.is_client || invoice.status !== "ISSUED" || !note) {
      return json({ error: "INVOICE_DISPUTE_NOT_ALLOWED" }, 403);
    }
    await db.prepare(
      "UPDATE project_invoices SET status = 'DISPUTED', details_json = ?1, updated_at = ?2 WHERE invoice_id = ?3",
    ).bind(JSON.stringify({ disputeNote: note }), now, invoiceId).run();
  } else return json({ error: "INVALID_FINANCE_ACTION" }, 422);
  await db.prepare(
    `INSERT INTO account_audit_events (
       event_id, account_id, event_type, actor_email, payload_json, occurred_at
     ) VALUES (?1, ?2, 'PROJECT_FINANCE_ACTION', ?3, ?4, ?5)`,
  ).bind(
    crypto.randomUUID(), actor.account_id, actor.email,
    JSON.stringify({ projectId, invoiceId, action }), now,
  ).run();
  await notifyParty(
    db, access.provider_party_id, actor.account_id, `PROJECT_FINANCE_${action}`,
    action === "APPROVE" ? "اعتُمدت فاتورة المشروع"
      : action === "RECORD_PAYMENT" ? "سُجل سداد فاتورة المشروع"
      : "سُجل اعتراض على فاتورة المشروع",
    `${access.public_code} — ${note || invoiceId}`,
    projectId, action === "DISPUTE" ? "HIGH" : "NORMAL", now,
  );
  return json({ ok: true, projectId, invoiceId, action, updatedAt: now });
}
