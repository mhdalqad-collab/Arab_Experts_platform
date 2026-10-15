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
  return db.prepare(
    "SELECT account_id, email FROM accounts WHERE email = ?1",
  ).bind(user.email.trim().toLowerCase())
    .first<{ account_id: string; email: string }>();
}
function addDays(source: string, days: number) {
  const date = source ? new Date(`${source}T00:00:00Z`) : new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function projectCode(sequence: number) {
  return `NAE-PRJ-${new Date().getUTCFullYear()}-${String(sequence).padStart(6, "0")}`;
}

async function projectRows(db: D1Database, accountId: string) {
  const projects = await db.prepare(
    `SELECT sp.project_id, sp.contract_id, sp.public_code, sp.title,
            sp.status, sp.progress, sp.payload_json, sp.revision, sp.updated_at
       FROM service_projects sp
      WHERE EXISTS (
        SELECT 1 FROM account_party_links l
         WHERE l.account_id = ?1 AND l.status = 'ACTIVE'
           AND l.party_id IN (sp.client_party_id, sp.provider_party_id)
      ) ORDER BY sp.updated_at DESC LIMIT 100`,
  ).bind(accountId).all<{
    project_id: string; contract_id: string; public_code: string; title: string;
    status: string; progress: number; payload_json: string; revision: number;
    updated_at: string;
  }>();
  const output = [];
  for (const row of projects.results) {
    const [
      milestones, deliverables, changes, changeTransitions,
      registerItems, registerTransitions, progressReports,
      progressReportVersions, progressReportTransitions, deliverableDocuments,
    ] = await Promise.all([
      db.prepare(
        `SELECT milestone_id, sequence, title, weight, due_date, status, completed_at
           FROM project_milestones WHERE project_id = ?1 ORDER BY sequence`,
      ).bind(row.project_id).all(),
      db.prepare(
        `SELECT deliverable_id, milestone_id, title, status, submission_json,
                review_json, revision, submitted_at, reviewed_at
           FROM project_deliverables WHERE project_id = ?1 ORDER BY updated_at`,
      ).bind(row.project_id).all(),
      db.prepare(
        `SELECT change_order_id, public_code, status, payload_json, created_at, updated_at
           FROM project_change_orders WHERE project_id = ?1 ORDER BY created_at DESC`,
      ).bind(row.project_id).all(),
      db.prepare(
        `SELECT pct.change_order_id, pct.sequence, pct.from_status, pct.to_status,
                pct.action_code, pct.actor_role, pct.note, pct.occurred_at
           FROM project_change_order_transitions pct
           JOIN project_change_orders pco ON pco.change_order_id = pct.change_order_id
          WHERE pco.project_id = ?1 ORDER BY pct.change_order_id, pct.sequence`,
      ).bind(row.project_id).all(),
      db.prepare(
        `SELECT register_item_id, public_code, item_type, title, description,
                priority, status, owner_role, due_date, payload_json,
                created_at, updated_at, closed_at
           FROM project_register_items WHERE project_id = ?1
          ORDER BY CASE item_type WHEN 'ISSUE' THEN 1 WHEN 'RISK' THEN 2 ELSE 3 END,
                   created_at DESC`,
      ).bind(row.project_id).all(),
      db.prepare(
        `SELECT prt.register_item_id, prt.sequence, prt.from_status,
                prt.to_status, prt.actor_role, prt.note, prt.occurred_at
           FROM project_register_transitions prt
           JOIN project_register_items pri
             ON pri.register_item_id = prt.register_item_id
          WHERE pri.project_id = ?1
          ORDER BY prt.register_item_id, prt.sequence`,
      ).bind(row.project_id).all(),
      db.prepare(
        `SELECT progress_report_id, public_code, period_start, period_end,
                declared_progress, status, current_revision, submitted_at,
                reviewed_at, updated_at
           FROM project_progress_reports WHERE project_id = ?1
          ORDER BY period_end DESC, created_at DESC`,
      ).bind(row.project_id).all(),
      db.prepare(
        `SELECT prv.progress_report_id, prv.revision, prv.payload_json, prv.created_at
           FROM project_progress_report_versions prv
           JOIN project_progress_reports pr
             ON pr.progress_report_id = prv.progress_report_id
          WHERE pr.project_id = ?1
          ORDER BY prv.progress_report_id, prv.revision DESC`,
      ).bind(row.project_id).all(),
      db.prepare(
        `SELECT prt.progress_report_id, prt.sequence, prt.from_status,
                prt.to_status, prt.actor_role, prt.note, prt.occurred_at
           FROM project_progress_report_transitions prt
           JOIN project_progress_reports pr
             ON pr.progress_report_id = prt.progress_report_id
          WHERE pr.project_id = ?1
          ORDER BY prt.progress_report_id, prt.sequence`,
      ).bind(row.project_id).all(),
      db.prepare(
        `SELECT pdd.deliverable_id, pdd.submission_revision, pdd.linked_at,
                d.document_id, d.title, d.confidentiality,
                d.verification_status, d.current_version,
                v.original_file_name, v.media_type, v.size_bytes,
                v.sha256_hash, v.scan_status
           FROM project_deliverable_documents pdd
           JOIN professional_documents d ON d.document_id = pdd.document_id
           JOIN professional_document_versions v
             ON v.document_id = d.document_id
            AND v.version_number = d.current_version
          WHERE pdd.project_id = ?1 AND d.status = 'ACTIVE'
          ORDER BY pdd.linked_at`,
      ).bind(row.project_id).all(),
    ]);
    output.push({
      ...JSON.parse(row.payload_json),
      projectId: row.project_id, contractId: row.contract_id,
      publicCode: row.public_code, title: row.title, status: row.status,
      progress: row.progress, revision: row.revision, updatedAt: row.updated_at,
      milestones: milestones.results,
      deliverables: deliverables.results.map((item: Record<string, unknown>) => ({
        ...item,
        submission: JSON.parse(String(item.submission_json ?? "{}")),
        review: JSON.parse(String(item.review_json ?? "{}")),
        attachments: deliverableDocuments.results.filter(
          (attachment: Record<string, unknown>) =>
            attachment.deliverable_id === item.deliverable_id,
        ),
      })),
      changeOrders: changes.results.map((item: Record<string, unknown>) => ({
        ...item, details: JSON.parse(String(item.payload_json ?? "{}")),
        transitions: changeTransitions.results.filter(
          (transition: Record<string, unknown>) =>
            transition.change_order_id === item.change_order_id,
          ),
      })),
      registerItems: registerItems.results.map((item: Record<string, unknown>) => ({
        ...item,
        details: JSON.parse(String(item.payload_json ?? "{}")),
        transitions: registerTransitions.results.filter(
          (transition: Record<string, unknown>) =>
            transition.register_item_id === item.register_item_id,
          ),
      })),
      progressReports: progressReports.results.map((item: Record<string, unknown>) => {
        const versions = progressReportVersions.results
          .filter((version: Record<string, unknown>) =>
            version.progress_report_id === item.progress_report_id)
          .map((version: Record<string, unknown>) => ({
            ...version,
            details: JSON.parse(String(version.payload_json ?? "{}")),
          }));
        return {
          ...item,
          details: versions[0]?.details ?? {},
          versions,
          transitions: progressReportTransitions.results.filter(
            (transition: Record<string, unknown>) =>
              transition.progress_report_id === item.progress_report_id,
          ),
        };
      }),
    });
  }
  return output;
}

export async function GET() {
  const workers = await import("cloudflare:workers");
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor) return json({ error: "ACCOUNT_CONTEXT_REQUIRED" }, 401);
  return json({ projects: await projectRows(db, actor.account_id) });
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
  const contractId = String(body.contractId ?? "").slice(0, 80);
  const contract = await db.prepare(
    `SELECT sc.contract_id, sc.client_party_id, sc.provider_party_id,
            sc.public_code, sc.status, sc.payload_json
       FROM service_contracts sc WHERE sc.contract_id = ?1
        AND EXISTS (
          SELECT 1 FROM account_party_links l WHERE l.account_id = ?2
            AND l.party_id = sc.client_party_id AND l.status = 'ACTIVE'
        )`,
  ).bind(contractId, actor.account_id).first<{
    contract_id: string; client_party_id: string; provider_party_id: string | null;
    public_code: string; status: string; payload_json: string;
  }>();
  if (!contract) return json({ error: "ACTIVE_CONTRACT_NOT_FOUND" }, 404);
  const duplicate = await db.prepare(
    "SELECT project_id, public_code FROM service_projects WHERE contract_id = ?1",
  ).bind(contractId).first<{ project_id: string; public_code: string }>();
  if (duplicate) return json({ duplicate: true, projectId: duplicate.project_id, publicCode: duplicate.public_code });
  if (contract.status !== "ACTIVE") {
    return json({ error: "CONTRACT_MUST_BE_ACTIVE", status: contract.status }, 422);
  }
  const contractPayload = object(JSON.parse(contract.payload_json));
  const terms = object(contractPayload.terms);
  const scope = object(contractPayload.scope);
  const duration = Math.max(1, Math.floor(Number(terms.durationDays) || 1));
  const contractAmountMinor = Math.max(0, Math.round((Number(terms.amount) || 0) * 100));
  const currency = String(terms.currency ?? "USD").slice(0, 8);
  const start = String(terms.availableFrom ?? new Date().toISOString().slice(0, 10));
  const templates = [
    ["بدء المشروع واعتماد خطة العمل", 10, Math.max(1, Math.round(duration * .1))],
    ["التسليم المرحلي الأول", 35, Math.max(2, Math.round(duration * .4))],
    ["المراجعة والتحسين", 25, Math.max(3, Math.round(duration * .75))],
    ["التسليم النهائي والإغلاق", 30, duration],
  ] as const;
  const projectId = crypto.randomUUID();
  const count = await db.prepare("SELECT COUNT(*) AS count FROM service_projects")
    .first<{ count: number }>();
  const publicCode = projectCode((count?.count ?? 0) + 1);
  const now = new Date().toISOString();
  const payload = {
    contractPublicCode: contract.public_code,
    startDate: start,
    plannedEndDate: addDays(start, duration),
    scope, terms,
    workOrderIssuedAt: now,
    immutableContractSnapshot: contractPayload,
  };
  const milestones = templates.map(([title, weight, offset], index) => ({
    id: crypto.randomUUID(), title, weight, due: addDays(start, offset),
    sequence: index + 1,
  }));
  await db.batch([
    db.prepare(
      `INSERT INTO service_projects (
         project_id, contract_id, client_party_id, provider_party_id,
         public_code, title, status, progress, payload_json, revision,
         created_by_account_id, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'PLANNED', 0, ?7, 1, ?8, ?9, ?9)`,
    ).bind(
      projectId, contractId, contract.client_party_id, contract.provider_party_id,
      publicCode, String(contractPayload.title ?? "مشروع خدمة"),
      JSON.stringify(payload), actor.account_id, now,
    ),
    ...milestones.map((item) => db.prepare(
      `INSERT INTO project_milestones (
         milestone_id, project_id, sequence, title, weight,
         due_date, status, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'PLANNED', ?7)`,
    ).bind(item.id, projectId, item.sequence, item.title, item.weight, item.due, now)),
    ...milestones.map((item) => db.prepare(
      `INSERT INTO project_deliverables (
         deliverable_id, project_id, milestone_id, title, status,
         submission_json, review_json, revision, updated_at
       ) VALUES (?1, ?2, ?3, ?4, 'PLANNED', '{}', '{}', 1, ?5)`,
    ).bind(crypto.randomUUID(), projectId, item.id, item.title, now)),
    ...milestones.map((item, index) => {
      const prior = milestones.slice(0, index).reduce(
        (sum, milestone) => sum + Math.round(contractAmountMinor * milestone.weight / 100),
        0,
      );
      const amountMinor = index === milestones.length - 1
        ? contractAmountMinor - prior
        : Math.round(contractAmountMinor * item.weight / 100);
      return db.prepare(
        `INSERT INTO project_payment_schedules (
           schedule_id, project_id, milestone_id, sequence, percentage,
           amount_minor, currency, status, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'LOCKED', ?8)`,
      ).bind(
        crypto.randomUUID(), projectId, item.id, item.sequence, item.weight,
        amountMinor, currency, now,
      );
    }),
    db.prepare(
      `INSERT INTO account_audit_events (
         event_id, account_id, event_type, actor_email, payload_json, occurred_at
       ) VALUES (?1, ?2, 'SERVICE_PROJECT_CREATED', ?3, ?4, ?5)`,
    ).bind(
      crypto.randomUUID(), actor.account_id, actor.email,
      JSON.stringify({ projectId, contractId, publicCode }), now,
    ),
  ]);
  return json({ projectId, publicCode, status: "PLANNED" }, 201);
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
  const action = String(body.action ?? "").slice(0, 40);
  const targetId = String(body.targetId ?? "").slice(0, 80);
  const note = String(body.note ?? "").trim().slice(0, 4000);
  const project = await db.prepare(
    `SELECT sp.status, sp.revision, sp.payload_json, sp.public_code, sp.title,
            sp.client_party_id, sp.provider_party_id,
            EXISTS(SELECT 1 FROM account_party_links l WHERE l.account_id = ?2
              AND l.party_id = sp.client_party_id AND l.status = 'ACTIVE') AS is_client,
            EXISTS(SELECT 1 FROM account_party_links l WHERE l.account_id = ?2
              AND l.party_id = sp.provider_party_id AND l.status = 'ACTIVE') AS is_provider
       FROM service_projects sp WHERE sp.project_id = ?1`,
  ).bind(projectId, actor.account_id).first<{
    status: string; revision: number; payload_json: string;
    public_code: string; title: string; client_party_id: string;
    provider_party_id: string | null;
    is_client: number; is_provider: number;
  }>();
  if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
  const role = project.is_provider ? "provider" : project.is_client ? "client" : "";
  if (!role) return json({ error: "PROJECT_ACCESS_DENIED" }, 403);
  const now = new Date().toISOString();
  let notification: null | {
    partyId: string | null; type: string; title: string;
    message: string; priority: string; dueAt?: string | null;
  } = null;
  const notify = (
    targetRole: "client" | "provider",
    type: string,
    title: string,
    message: string,
    priority = "NORMAL",
    dueAt: string | null = null,
  ) => {
    notification = {
      partyId: targetRole === "client" ? project.client_party_id : project.provider_party_id,
      type, title, message, priority, dueAt,
    };
  };
  if (action === "START") {
    if (role !== "client" || project.status !== "PLANNED") return json({ error: "PROJECT_START_NOT_ALLOWED" }, 403);
    await db.prepare(
      "UPDATE service_projects SET status = 'ACTIVE', revision = revision + 1, updated_at = ?1 WHERE project_id = ?2",
    ).bind(now, projectId).run();
    notify("provider", "PROJECT_STARTED", "صدر أمر بدء المشروع",
      `${project.public_code} — ${project.title}`, "HIGH");
  } else if (action === "SUBMIT_DELIVERABLE") {
    if (role !== "provider" || !note) return json({ error: "DELIVERABLE_SUBMISSION_INVALID" }, 422);
    const attachments = await db.prepare(
      `SELECT COUNT(*) AS count
         FROM project_deliverable_documents pdd
         JOIN professional_documents d ON d.document_id = pdd.document_id
        WHERE pdd.deliverable_id = ?1 AND pdd.project_id = ?2
          AND d.status = 'ACTIVE'`,
    ).bind(targetId, projectId).first<{ count: number }>();
    if ((attachments?.count ?? 0) < 1) {
      return json({ error: "DELIVERABLE_ATTACHMENT_REQUIRED" }, 422);
    }
    await db.prepare(
      `UPDATE project_deliverables SET status = 'SUBMITTED',
              submission_json = ?1, revision = revision + 1,
              submitted_at = ?2, updated_at = ?2
        WHERE deliverable_id = ?3 AND project_id = ?4 AND status IN ('PLANNED','REJECTED')`,
    ).bind(JSON.stringify({ note, submittedBy: actor.account_id }), now, targetId, projectId).run();
    notify("client", "DELIVERABLE_SUBMITTED", "تسليم بانتظار المراجعة",
      `${project.public_code} — راجع الملفات والملاحظات ثم اتخذ القرار.`, "HIGH");
  } else if (["ACCEPT_DELIVERABLE", "REJECT_DELIVERABLE"].includes(action)) {
    if (role !== "client" || !note) return json({ error: "DELIVERABLE_REVIEW_INVALID" }, 422);
    const status = action === "ACCEPT_DELIVERABLE" ? "ACCEPTED" : "REJECTED";
    await db.prepare(
      `UPDATE project_deliverables SET status = ?1, review_json = ?2,
              revision = revision + 1, reviewed_at = ?3, updated_at = ?3
        WHERE deliverable_id = ?4 AND project_id = ?5 AND status = 'SUBMITTED'`,
    ).bind(status, JSON.stringify({ note, reviewedBy: actor.account_id }), now, targetId, projectId).run();
    if (status === "ACCEPTED") {
      const milestone = await db.prepare(
        "SELECT milestone_id FROM project_deliverables WHERE deliverable_id = ?1 AND project_id = ?2",
      ).bind(targetId, projectId).first<{ milestone_id: string }>();
      if (milestone) {
        await db.batch([
          db.prepare(
            `UPDATE project_milestones SET status = 'COMPLETED', completed_at = ?1, updated_at = ?1
              WHERE milestone_id = ?2`,
          ).bind(now, milestone.milestone_id),
          db.prepare(
            `UPDATE project_payment_schedules SET status = 'ELIGIBLE',
                    eligible_at = ?1, updated_at = ?1
              WHERE milestone_id = ?2 AND status = 'LOCKED'`,
          ).bind(now, milestone.milestone_id),
        ]);
      }
    }
    notify("provider", action, status === "ACCEPTED" ? "اعتُمد التسليم" : "أُعيد التسليم للتصحيح",
      `${project.public_code} — ${note}`, status === "ACCEPTED" ? "NORMAL" : "HIGH");
  } else if (action === "REQUEST_CHANGE") {
    if (!note || project.status !== "ACTIVE") return json({ error: "CHANGE_ORDER_DETAILS_REQUIRED" }, 422);
    const details = object(body.change);
    const count = await db.prepare(
      "SELECT COUNT(*) AS count FROM project_change_orders WHERE project_id = ?1",
    ).bind(projectId).first<{ count: number }>();
    const changeOrderId = crypto.randomUUID();
    const payload = {
      note, requestedByRole: role,
      impactDays: Math.max(0, Math.round(Number(details.impactDays) || 0)),
      impactAmount: Math.max(0, Number(details.impactAmount) || 0),
    };
    await db.batch([
      db.prepare(
        `INSERT INTO project_change_orders (
           change_order_id, project_id, public_code, status, payload_json,
           requested_by_account_id, created_at, updated_at
         ) VALUES (?1, ?2, ?3, 'REQUESTED', ?4, ?5, ?6, ?6)`,
      ).bind(
        changeOrderId, projectId,
        `CO-${String((count?.count ?? 0) + 1).padStart(3, "0")}`,
        JSON.stringify(payload), actor.account_id, now,
      ),
      db.prepare(
        `INSERT INTO project_change_order_transitions (
           transition_id, change_order_id, sequence, from_status, to_status,
           action_code, actor_role, actor_account_id, note, occurred_at
         ) VALUES (?1, ?2, 1, 'NONE', 'REQUESTED', 'REQUEST_CHANGE', ?3, ?4, ?5, ?6)`,
      ).bind(crypto.randomUUID(), changeOrderId, role, actor.account_id, note, now),
    ]);
    notify(role === "client" ? "provider" : "client", "CHANGE_ORDER_REQUESTED",
      "أمر تغيير ينتظر قرارك", `${project.public_code} — ${note}`, "HIGH");
  } else if (["APPROVE_CHANGE", "REJECT_CHANGE", "WITHDRAW_CHANGE"].includes(action)) {
    if (!targetId || !note) return json({ error: "CHANGE_ORDER_DECISION_REQUIRED" }, 422);
    const changeOrder = await db.prepare(
      `SELECT change_order_id, status, payload_json, requested_by_account_id
         FROM project_change_orders
        WHERE change_order_id = ?1 AND project_id = ?2`,
    ).bind(targetId, projectId).first<{
      change_order_id: string; status: string; payload_json: string;
      requested_by_account_id: string;
    }>();
    if (!changeOrder || changeOrder.status !== "REQUESTED") {
      return json({ error: "OPEN_CHANGE_ORDER_NOT_FOUND" }, 404);
    }
    const change = object(JSON.parse(changeOrder.payload_json));
    const requesterRole = String(change.requestedByRole ?? "");
    const isRequester = changeOrder.requested_by_account_id === actor.account_id;
    if (action === "WITHDRAW_CHANGE" && !isRequester) {
      return json({ error: "CHANGE_ORDER_WITHDRAWAL_NOT_ALLOWED" }, 403);
    }
    if (action !== "WITHDRAW_CHANGE" && (isRequester || requesterRole === role)) {
      return json({ error: "COUNTERPARTY_DECISION_REQUIRED" }, 403);
    }
    const toStatus = action === "APPROVE_CHANGE" ? "APPROVED"
      : action === "REJECT_CHANGE" ? "REJECTED" : "WITHDRAWN";
    const transitionCount = await db.prepare(
      "SELECT COUNT(*) AS count FROM project_change_order_transitions WHERE change_order_id = ?1",
    ).bind(targetId).first<{ count: number }>();
    const statements = [
      db.prepare(
        `UPDATE project_change_orders SET status = ?1,
                approved_by_account_id = CASE WHEN ?1 = 'APPROVED' THEN ?2 ELSE approved_by_account_id END,
                updated_at = ?3 WHERE change_order_id = ?4 AND status = 'REQUESTED'`,
      ).bind(toStatus, actor.account_id, now, targetId),
      db.prepare(
        `INSERT INTO project_change_order_transitions (
           transition_id, change_order_id, sequence, from_status, to_status,
           action_code, actor_role, actor_account_id, note, occurred_at
         ) VALUES (?1, ?2, ?3, 'REQUESTED', ?4, ?5, ?6, ?7, ?8, ?9)`,
      ).bind(
        crypto.randomUUID(), targetId, (transitionCount?.count ?? 0) + 1,
        toStatus, action, role, actor.account_id, note, now,
      ),
    ];
    if (toStatus === "APPROVED") {
      const payload = object(JSON.parse(project.payload_json));
      const approvedChanges = Array.isArray(payload.approvedChanges) ? payload.approvedChanges : [];
      payload.approvedChanges = [...approvedChanges, {
        changeOrderId: targetId, approvedAt: now,
        impactDays: Number(change.impactDays) || 0,
        impactAmount: Number(change.impactAmount) || 0,
      }];
      payload.authorizedChangeAmount = (Number(payload.authorizedChangeAmount) || 0) + (Number(change.impactAmount) || 0);
      payload.currentPlannedEndDate = addDays(
        String(payload.currentPlannedEndDate ?? payload.plannedEndDate ?? ""),
        Number(change.impactDays) || 0,
      );
      statements.push(db.prepare(
        "UPDATE service_projects SET payload_json = ?1 WHERE project_id = ?2",
      ).bind(JSON.stringify(payload), projectId));
    }
    await db.batch(statements);
    notify(role === "client" ? "provider" : "client", action,
      action === "APPROVE_CHANGE" ? "اعتُمد أمر التغيير"
        : action === "REJECT_CHANGE" ? "رُفض أمر التغيير" : "سُحب أمر التغيير",
      `${project.public_code} — ${note}`, action === "REJECT_CHANGE" ? "HIGH" : "NORMAL");
  } else if (action === "CREATE_REGISTER_ITEM") {
    if (project.status !== "ACTIVE") return json({ error: "ACTIVE_PROJECT_REQUIRED" }, 422);
    const item = object(body.register);
    const itemType = String(item.itemType ?? "").toUpperCase();
    const title = String(item.title ?? "").trim().slice(0, 300);
    const description = String(item.description ?? "").trim().slice(0, 4000);
    const priority = String(item.priority ?? "MEDIUM").toUpperCase();
    const ownerRole = String(item.ownerRole ?? role).toLowerCase();
    const dueDate = String(item.dueDate ?? "").slice(0, 10);
    if (!["RISK", "ISSUE", "DECISION"].includes(itemType) || !title) {
      return json({ error: "REGISTER_ITEM_REQUIRED_FIELDS" }, 422);
    }
    if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(priority)
      || !["client", "provider"].includes(ownerRole)) {
      return json({ error: "REGISTER_ITEM_ENUM_INVALID" }, 422);
    }
    const count = await db.prepare(
      "SELECT COUNT(*) AS count FROM project_register_items WHERE project_id = ?1 AND item_type = ?2",
    ).bind(projectId, itemType).first<{ count: number }>();
    const registerItemId = crypto.randomUUID();
    const prefix = itemType === "RISK" ? "RSK" : itemType === "ISSUE" ? "ISS" : "DEC";
    const publicCode = `${prefix}-${String((count?.count ?? 0) + 1).padStart(3, "0")}`;
    const initialStatus = itemType === "DECISION" ? "RECORDED" : "OPEN";
    await db.batch([
      db.prepare(
        `INSERT INTO project_register_items (
           register_item_id, project_id, public_code, item_type, title,
           description, priority, status, owner_role, due_date, payload_json,
           raised_by_account_id, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, '{}', ?11, ?12, ?12)`,
      ).bind(
        registerItemId, projectId, publicCode, itemType, title, description,
        priority, initialStatus, ownerRole, dueDate || null, actor.account_id, now,
      ),
      db.prepare(
        `INSERT INTO project_register_transitions (
           transition_id, register_item_id, sequence, from_status, to_status,
           actor_role, actor_account_id, note, occurred_at
         ) VALUES (?1, ?2, 1, 'NONE', ?3, ?4, ?5, ?6, ?7)`,
      ).bind(
        crypto.randomUUID(), registerItemId, initialStatus, role,
        actor.account_id, description || title, now,
      ),
    ]);
    notify(ownerRole as "client" | "provider", `PROJECT_${itemType}`,
      itemType === "RISK" ? "خطر مشروع مسند إليك"
        : itemType === "ISSUE" ? "قضية تنفيذية مسندة إليك" : "قرار مشروع جديد",
      `${publicCode} — ${title}`, ["HIGH", "CRITICAL"].includes(priority) ? priority : "NORMAL",
      dueDate || null);
  } else if (action === "TRANSITION_REGISTER_ITEM") {
    if (!targetId || !note) return json({ error: "REGISTER_TRANSITION_NOTE_REQUIRED" }, 422);
    const nextStatus = String(body.nextStatus ?? "").toUpperCase();
    const registerItem = await db.prepare(
      `SELECT register_item_id, item_type, status
         FROM project_register_items
        WHERE register_item_id = ?1 AND project_id = ?2`,
    ).bind(targetId, projectId).first<{
      register_item_id: string; item_type: string; status: string;
    }>();
    if (!registerItem) return json({ error: "REGISTER_ITEM_NOT_FOUND" }, 404);
    const allowed: Record<string, string[]> = {
      "RISK:OPEN": ["MITIGATING", "CLOSED"],
      "RISK:MITIGATING": ["OPEN", "CLOSED"],
      "RISK:CLOSED": ["OPEN"],
      "ISSUE:OPEN": ["IN_PROGRESS", "RESOLVED"],
      "ISSUE:IN_PROGRESS": ["OPEN", "RESOLVED"],
      "ISSUE:RESOLVED": ["IN_PROGRESS", "CLOSED"],
      "ISSUE:CLOSED": ["OPEN"],
      "DECISION:RECORDED": ["SUPERSEDED"],
    };
    if (!(allowed[`${registerItem.item_type}:${registerItem.status}`] ?? []).includes(nextStatus)) {
      return json({ error: "REGISTER_TRANSITION_NOT_ALLOWED" }, 422);
    }
    if (["CLOSED", "SUPERSEDED"].includes(nextStatus) && role !== "client") {
      return json({ error: "CLIENT_CLOSURE_DECISION_REQUIRED" }, 403);
    }
    const transitionCount = await db.prepare(
      "SELECT COUNT(*) AS count FROM project_register_transitions WHERE register_item_id = ?1",
    ).bind(targetId).first<{ count: number }>();
    await db.batch([
      db.prepare(
        `UPDATE project_register_items SET status = ?1,
                closed_by_account_id = CASE WHEN ?1 IN ('CLOSED','SUPERSEDED') THEN ?2 ELSE NULL END,
                closed_at = CASE WHEN ?1 IN ('CLOSED','SUPERSEDED') THEN ?3 ELSE NULL END,
                updated_at = ?3 WHERE register_item_id = ?4`,
      ).bind(nextStatus, actor.account_id, now, targetId),
      db.prepare(
        `INSERT INTO project_register_transitions (
           transition_id, register_item_id, sequence, from_status, to_status,
           actor_role, actor_account_id, note, occurred_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      ).bind(
        crypto.randomUUID(), targetId, (transitionCount?.count ?? 0) + 1,
        registerItem.status, nextStatus, role, actor.account_id, note, now,
      ),
    ]);
    notify(role === "client" ? "provider" : "client", "PROJECT_REGISTER_TRANSITION",
      "تحديث في سجل المشروع", `${project.public_code} — ${registerItem.item_type}: ${nextStatus}`, "NORMAL");
  } else if (action === "SUBMIT_PROGRESS_REPORT") {
    if (role !== "provider" || project.status !== "ACTIVE") {
      return json({ error: "PROGRESS_REPORT_PROVIDER_REQUIRED" }, 403);
    }
    const report = object(body.report);
    const reportId = String(report.progressReportId ?? "").slice(0, 80);
    const periodStart = String(report.periodStart ?? "").slice(0, 10);
    const periodEnd = String(report.periodEnd ?? "").slice(0, 10);
    const declaredProgress = Math.round(Number(report.declaredProgress));
    const health = object(report.health);
    const summary = String(report.summary ?? "").trim().slice(0, 6000);
    const nextSteps = String(report.nextSteps ?? "").trim().slice(0, 6000);
    const blockers = String(report.blockers ?? "").trim().slice(0, 6000);
    const healthValues = ["GREEN", "AMBER", "RED"];
    if (!periodStart || !periodEnd || periodEnd < periodStart || !summary
      || !Number.isInteger(declaredProgress) || declaredProgress < 0 || declaredProgress > 100
      || ["schedule", "cost", "scope", "quality"].some(
        (key) => !healthValues.includes(String(health[key] ?? "")),
      )) return json({ error: "PROGRESS_REPORT_INVALID" }, 422);
    const payload = { health, summary, nextSteps, blockers };
    if (reportId) {
      const existing = await db.prepare(
        `SELECT progress_report_id, status, current_revision
           FROM project_progress_reports
          WHERE progress_report_id = ?1 AND project_id = ?2`,
      ).bind(reportId, projectId).first<{
        progress_report_id: string; status: string; current_revision: number;
      }>();
      if (!existing || existing.status !== "REVISION_REQUIRED") {
        return json({ error: "PROGRESS_REPORT_REVISION_NOT_ALLOWED" }, 422);
      }
      const revision = existing.current_revision + 1;
      const transitionCount = await db.prepare(
        "SELECT COUNT(*) AS count FROM project_progress_report_transitions WHERE progress_report_id = ?1",
      ).bind(reportId).first<{ count: number }>();
      await db.batch([
        db.prepare(
          `UPDATE project_progress_reports SET period_start = ?1, period_end = ?2,
                  declared_progress = ?3, status = 'SUBMITTED',
                  current_revision = ?4, submitted_by_account_id = ?5,
                  submitted_at = ?6, reviewed_by_account_id = NULL,
                  reviewed_at = NULL, updated_at = ?6
            WHERE progress_report_id = ?7`,
        ).bind(
          periodStart, periodEnd, declaredProgress, revision,
          actor.account_id, now, reportId,
        ),
        db.prepare(
          `INSERT INTO project_progress_report_versions (
             version_id, progress_report_id, revision, payload_json,
             created_by_account_id, created_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
        ).bind(
          crypto.randomUUID(), reportId, revision,
          JSON.stringify(payload), actor.account_id, now,
        ),
        db.prepare(
          `INSERT INTO project_progress_report_transitions (
             transition_id, progress_report_id, sequence, from_status, to_status,
             actor_role, actor_account_id, note, occurred_at
           ) VALUES (?1, ?2, ?3, 'REVISION_REQUIRED', 'SUBMITTED', ?4, ?5, ?6, ?7)`,
        ).bind(
          crypto.randomUUID(), reportId, (transitionCount?.count ?? 0) + 1,
          role, actor.account_id, summary, now,
        ),
      ]);
    } else {
      const count = await db.prepare(
        "SELECT COUNT(*) AS count FROM project_progress_reports WHERE project_id = ?1",
      ).bind(projectId).first<{ count: number }>();
      const progressReportId = crypto.randomUUID();
      const publicCode = `PRG-${String((count?.count ?? 0) + 1).padStart(3, "0")}`;
      await db.batch([
        db.prepare(
          `INSERT INTO project_progress_reports (
             progress_report_id, project_id, public_code, period_start, period_end,
             declared_progress, status, current_revision, submitted_by_account_id,
             created_at, submitted_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'SUBMITTED', 1, ?7, ?8, ?8, ?8)`,
        ).bind(
          progressReportId, projectId, publicCode, periodStart, periodEnd,
          declaredProgress, actor.account_id, now,
        ),
        db.prepare(
          `INSERT INTO project_progress_report_versions (
             version_id, progress_report_id, revision, payload_json,
             created_by_account_id, created_at
           ) VALUES (?1, ?2, 1, ?3, ?4, ?5)`,
        ).bind(
          crypto.randomUUID(), progressReportId, JSON.stringify(payload),
          actor.account_id, now,
        ),
        db.prepare(
          `INSERT INTO project_progress_report_transitions (
             transition_id, progress_report_id, sequence, from_status, to_status,
             actor_role, actor_account_id, note, occurred_at
           ) VALUES (?1, ?2, 1, 'NONE', 'SUBMITTED', ?3, ?4, ?5, ?6)`,
        ).bind(
          crypto.randomUUID(), progressReportId, role,
          actor.account_id, summary, now,
        ),
      ]);
    }
    notify("client", "PROGRESS_REPORT_SUBMITTED", "تقرير تقدم ينتظر مراجعتك",
      `${project.public_code} — الفترة ${periodStart} إلى ${periodEnd}`, "HIGH");
  } else if (["ACCEPT_PROGRESS_REPORT", "REQUEST_PROGRESS_REPORT_REVISION"].includes(action)) {
    if (role !== "client" || !targetId || !note) {
      return json({ error: "PROGRESS_REPORT_REVIEW_REQUIRED" }, 403);
    }
    const report = await db.prepare(
      `SELECT progress_report_id, status
         FROM project_progress_reports
        WHERE progress_report_id = ?1 AND project_id = ?2`,
    ).bind(targetId, projectId).first<{
      progress_report_id: string; status: string;
    }>();
    if (!report || report.status !== "SUBMITTED") {
      return json({ error: "SUBMITTED_PROGRESS_REPORT_NOT_FOUND" }, 404);
    }
    const nextStatus = action === "ACCEPT_PROGRESS_REPORT" ? "ACCEPTED" : "REVISION_REQUIRED";
    const transitionCount = await db.prepare(
      "SELECT COUNT(*) AS count FROM project_progress_report_transitions WHERE progress_report_id = ?1",
    ).bind(targetId).first<{ count: number }>();
    await db.batch([
      db.prepare(
        `UPDATE project_progress_reports SET status = ?1,
                reviewed_by_account_id = ?2, reviewed_at = ?3, updated_at = ?3
          WHERE progress_report_id = ?4`,
      ).bind(nextStatus, actor.account_id, now, targetId),
      db.prepare(
        `INSERT INTO project_progress_report_transitions (
           transition_id, progress_report_id, sequence, from_status, to_status,
           actor_role, actor_account_id, note, occurred_at
         ) VALUES (?1, ?2, ?3, 'SUBMITTED', ?4, ?5, ?6, ?7, ?8)`,
      ).bind(
        crypto.randomUUID(), targetId, (transitionCount?.count ?? 0) + 1,
        nextStatus, role, actor.account_id, note, now,
      ),
    ]);
    notify("provider", action,
      action === "ACCEPT_PROGRESS_REPORT" ? "اعتُمد تقرير التقدم" : "مطلوب تعديل تقرير التقدم",
      `${project.public_code} — ${note}`,
      action === "REQUEST_PROGRESS_REPORT_REVISION" ? "HIGH" : "NORMAL");
  } else return json({ error: "INVALID_PROJECT_ACTION" }, 422);
  const accepted = await db.prepare(
    `SELECT COALESCE(SUM(pm.weight),0) AS progress
       FROM project_milestones pm WHERE pm.project_id = ?1 AND pm.status = 'COMPLETED'`,
  ).bind(projectId).first<{ progress: number }>();
  const progress = Math.min(100, accepted?.progress ?? 0);
  await db.prepare(
    `UPDATE service_projects SET progress = ?1,
       status = CASE WHEN ?1 = 100 THEN 'COMPLETED' ELSE status END,
       revision = revision + 1, updated_at = ?2 WHERE project_id = ?3`,
  ).bind(progress, now, projectId).run();
  await db.prepare(
    `INSERT INTO account_audit_events (
       event_id, account_id, event_type, actor_email, payload_json, occurred_at
     ) VALUES (?1, ?2, 'SERVICE_PROJECT_ACTION', ?3, ?4, ?5)`,
  ).bind(
    crypto.randomUUID(), actor.account_id, actor.email,
    JSON.stringify({ projectId, action, targetId, role, progress }), now,
  ).run();
  const pendingNotification = notification as null | {
    partyId: string | null; type: string; title: string;
    message: string; priority: string; dueAt?: string | null;
  };
  if (pendingNotification?.partyId) {
    await db.prepare(
      `INSERT INTO account_notifications (
         notification_id, account_id, profile_id, notification_type,
         title, message, entity_type, entity_id, action_route,
         priority, due_at, is_read, created_at
       )
       SELECT lower(hex(randomblob(16))), l.account_id, NULL, ?1,
              ?2, ?3, 'PROJECT', ?4, '#/111', ?5, ?6, 0, ?7
         FROM account_party_links l
        WHERE l.party_id = ?8 AND l.status = 'ACTIVE'
          AND l.account_id <> ?9`,
    ).bind(
      pendingNotification.type, pendingNotification.title,
      pendingNotification.message, projectId, pendingNotification.priority,
      pendingNotification.dueAt ?? null, now, pendingNotification.partyId,
      actor.account_id,
    ).run();
  }
  return json({ ok: true, projectId, action, progress, updatedAt: now });
}
