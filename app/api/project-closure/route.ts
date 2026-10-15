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
async function projectContext(db: D1Database, projectId: string, accountId: string) {
  return db.prepare(
    `SELECT sp.project_id, sp.public_code, sp.title, sp.status, sp.progress,
            sp.client_party_id, sp.provider_party_id, sp.payload_json,
            EXISTS(SELECT 1 FROM account_party_links l WHERE l.account_id = ?2
              AND l.party_id = sp.client_party_id AND l.status = 'ACTIVE') AS is_client,
            EXISTS(SELECT 1 FROM account_party_links l WHERE l.account_id = ?2
              AND l.party_id = sp.provider_party_id AND l.status = 'ACTIVE') AS is_provider
       FROM service_projects sp WHERE sp.project_id = ?1`,
  ).bind(projectId, accountId).first<{
    project_id: string; public_code: string; title: string; status: string;
    progress: number; client_party_id: string; provider_party_id: string | null;
    payload_json: string; is_client: number; is_provider: number;
  }>();
}
async function notifyProjectParty(
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
async function closureState(db: D1Database, projectId: string) {
  const [closure, certificate, reviews] = await Promise.all([
    db.prepare(
      `SELECT closure_id, status, report_json, submitted_at, accepted_at, updated_at
         FROM project_closures WHERE project_id = ?1`,
    ).bind(projectId).first<Record<string, unknown>>(),
    db.prepare(
      `SELECT certificate_id, public_code, snapshot_json, issued_at
         FROM project_completion_certificates WHERE project_id = ?1`,
    ).bind(projectId).first<Record<string, unknown>>(),
    db.prepare(
      `SELECT review_id, reviewer_role, scores_json, comment, status, submitted_at
         FROM project_reviews WHERE project_id = ?1 ORDER BY submitted_at`,
    ).bind(projectId).all<Record<string, unknown>>(),
  ]);
  return {
    closure: closure ? {
      ...closure, report: JSON.parse(String(closure.report_json ?? "{}")),
    } : null,
    certificate: certificate ? {
      ...certificate, snapshot: JSON.parse(String(certificate.snapshot_json ?? "{}")),
    } : null,
    reviews: reviews.results.map((row) => ({
      ...row, scores: JSON.parse(String(row.scores_json ?? "{}")),
    })),
  };
}

export async function GET(request: Request) {
  const workers = await import("cloudflare:workers");
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor) return json({ error: "ACCOUNT_CONTEXT_REQUIRED" }, 401);
  const projectId = new URL(request.url).searchParams.get("projectId")?.slice(0, 80) ?? "";
  const project = await projectContext(db, projectId, actor.account_id);
  if (!project || (!project.is_client && !project.is_provider)) {
    return json({ error: "PROJECT_ACCESS_DENIED" }, 403);
  }
  return json(await closureState(db, projectId));
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
  const summary = String(body.summary ?? "").trim().slice(0, 6000);
  const lessons = String(body.lessons ?? "").trim().slice(0, 6000);
  const project = await projectContext(db, projectId, actor.account_id);
  if (!project?.is_provider) return json({ error: "PROVIDER_REQUIRED" }, 403);
  if (project.status !== "COMPLETED" || project.progress !== 100 || !summary) {
    return json({ error: "PROJECT_NOT_READY_FOR_CLOSURE" }, 422);
  }
  const blockers = await db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM project_payment_schedules
         WHERE project_id = ?1 AND status <> 'PAID') AS unpaid,
       (SELECT COUNT(*) FROM project_change_orders
         WHERE project_id = ?1 AND status IN ('REQUESTED','UNDER_REVIEW')) AS open_changes,
       (SELECT COUNT(*) FROM project_register_items
         WHERE project_id = ?1 AND item_type = 'ISSUE'
           AND priority = 'CRITICAL' AND status <> 'CLOSED') AS critical_issues,
       (SELECT COUNT(*) FROM project_register_items
         WHERE project_id = ?1 AND item_type = 'RISK'
           AND priority IN ('HIGH','CRITICAL') AND status <> 'CLOSED') AS high_risks,
       (SELECT COUNT(*) FROM project_progress_reports
         WHERE project_id = ?1 AND status IN ('SUBMITTED','REVISION_REQUIRED')) AS open_reports`,
  ).bind(projectId).first<{
    unpaid: number; open_changes: number; critical_issues: number;
    high_risks: number; open_reports: number;
  }>();
  if ((blockers?.unpaid ?? 1) > 0 || (blockers?.open_changes ?? 1) > 0
    || (blockers?.critical_issues ?? 1) > 0 || (blockers?.high_risks ?? 1) > 0
    || (blockers?.open_reports ?? 1) > 0) {
    return json({ error: "PROJECT_CLOSURE_BLOCKED", blockers }, 409);
  }
  const existing = await db.prepare(
    "SELECT closure_id, status FROM project_closures WHERE project_id = ?1",
  ).bind(projectId).first<{ closure_id: string; status: string }>();
  const now = new Date().toISOString();
  if (existing?.status === "REVISION_REQUIRED") {
    await db.batch([
      db.prepare(
        `UPDATE project_closures SET status = 'SUBMITTED', report_json = ?1,
                submitted_by_account_id = ?2, submitted_at = ?3, updated_at = ?3
          WHERE closure_id = ?4`,
      ).bind(JSON.stringify({ summary, lessons }), actor.account_id, now, existing.closure_id),
      db.prepare(
        "UPDATE service_projects SET status = 'CLOSURE_PENDING', revision = revision + 1, updated_at = ?1 WHERE project_id = ?2",
      ).bind(now, projectId),
    ]);
    await notifyProjectParty(
      db, project.client_party_id, actor.account_id, "PROJECT_CLOSURE_RESUBMITTED",
      "أعيد تقديم محضر إغلاق المشروع",
      `${project.public_code} — راجع النسخة المعدلة واتخذ القرار.`,
      projectId, "HIGH", now,
    );
    return json({ closureId: existing.closure_id, status: "SUBMITTED", revised: true });
  }
  if (existing) return json({ duplicate: true, closureId: existing.closure_id, status: existing.status });
  const closureId = crypto.randomUUID();
  await db.batch([
    db.prepare(
      `INSERT INTO project_closures (
         closure_id, project_id, status, report_json, submitted_by_account_id,
         submitted_at, updated_at
       ) VALUES (?1, ?2, 'SUBMITTED', ?3, ?4, ?5, ?5)`,
    ).bind(closureId, projectId, JSON.stringify({ summary, lessons }), actor.account_id, now),
    db.prepare(
      "UPDATE service_projects SET status = 'CLOSURE_PENDING', revision = revision + 1, updated_at = ?1 WHERE project_id = ?2",
    ).bind(now, projectId),
    db.prepare(
      `INSERT INTO account_audit_events (
         event_id, account_id, event_type, actor_email, payload_json, occurred_at
       ) VALUES (?1, ?2, 'PROJECT_CLOSURE_SUBMITTED', ?3, ?4, ?5)`,
    ).bind(
      crypto.randomUUID(), actor.account_id, actor.email,
      JSON.stringify({ projectId, closureId }), now,
    ),
  ]);
  await notifyProjectParty(
    db, project.client_party_id, actor.account_id, "PROJECT_CLOSURE_SUBMITTED",
    "محضر إغلاق ينتظر قرارك",
    `${project.public_code} — ${project.title}`, projectId, "HIGH", now,
  );
  return json({ closureId, status: "SUBMITTED" }, 201);
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
  const action = String(body.action ?? "").slice(0, 32);
  const note = String(body.note ?? "").trim().slice(0, 4000);
  const project = await projectContext(db, projectId, actor.account_id);
  if (!project || (!project.is_client && !project.is_provider)) {
    return json({ error: "PROJECT_ACCESS_DENIED" }, 403);
  }
  const now = new Date().toISOString();
  if (action === "ACCEPT_CLOSURE") {
    if (!project.is_client || project.status !== "CLOSURE_PENDING" || !note) {
      return json({ error: "CLOSURE_ACCEPTANCE_NOT_ALLOWED" }, 403);
    }
    const closure = await db.prepare(
      "SELECT closure_id, report_json FROM project_closures WHERE project_id = ?1 AND status = 'SUBMITTED'",
    ).bind(projectId).first<{ closure_id: string; report_json: string }>();
    if (!closure) return json({ error: "CLOSURE_NOT_FOUND" }, 404);
    const count = await db.prepare(
      "SELECT COUNT(*) AS count FROM project_completion_certificates",
    ).first<{ count: number }>();
    const certificateId = crypto.randomUUID();
    const certificateCode = `NAE-CERT-${new Date().getUTCFullYear()}-${String((count?.count ?? 0) + 1).padStart(6, "0")}`;
    const snapshot = {
      projectCode: project.public_code, title: project.title,
      completedAt: now, progress: project.progress,
      acceptanceNote: note, closureReport: JSON.parse(closure.report_json),
      contractSnapshot: JSON.parse(project.payload_json).immutableContractSnapshot ?? {},
    };
    await db.batch([
      db.prepare(
        `UPDATE project_closures SET status = 'ACCEPTED',
                accepted_by_account_id = ?1, accepted_at = ?2, updated_at = ?2
          WHERE closure_id = ?3`,
      ).bind(actor.account_id, now, closure.closure_id),
      db.prepare(
        `INSERT INTO project_completion_certificates (
           certificate_id, project_id, closure_id, public_code, snapshot_json, issued_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      ).bind(
        certificateId, projectId, closure.closure_id,
        certificateCode, JSON.stringify(snapshot), now,
      ),
      db.prepare(
        "UPDATE service_projects SET status = 'CLOSED', revision = revision + 1, updated_at = ?1 WHERE project_id = ?2",
      ).bind(now, projectId),
    ]);
  } else if (action === "REJECT_CLOSURE") {
    if (!project.is_client || project.status !== "CLOSURE_PENDING" || !note) {
      return json({ error: "CLOSURE_REJECTION_NOT_ALLOWED" }, 403);
    }
    await db.batch([
      db.prepare(
        "UPDATE project_closures SET status = 'REVISION_REQUIRED', report_json = ?1, updated_at = ?2 WHERE project_id = ?3",
      ).bind(JSON.stringify({ revisionNote: note }), now, projectId),
      db.prepare(
        "UPDATE service_projects SET status = 'COMPLETED', revision = revision + 1, updated_at = ?1 WHERE project_id = ?2",
      ).bind(now, projectId),
    ]);
  } else if (action === "SUBMIT_REVIEW") {
    if (project.status !== "CLOSED") return json({ error: "PROJECT_MUST_BE_CLOSED" }, 422);
    const role = project.is_client ? "CLIENT" : project.is_provider ? "PROVIDER" : "";
    const scores = object(body.scores);
    const dimensions = ["quality", "timeliness", "communication", "professionalism", "value"];
    if (dimensions.some((key) => {
      const value = Number(scores[key]);
      return !Number.isInteger(value) || value < 1 || value > 5;
    })) return json({ error: "REVIEW_SCORES_INVALID" }, 422);
    const reviewerPartyId = role === "CLIENT" ? project.client_party_id : project.provider_party_id;
    const subjectPartyId = role === "CLIENT" ? project.provider_party_id : project.client_party_id;
    if (!reviewerPartyId || !subjectPartyId) return json({ error: "REVIEW_PARTY_MISSING" }, 422);
    await db.prepare(
      `INSERT INTO project_reviews (
         review_id, project_id, reviewer_party_id, subject_party_id,
         reviewer_role, scores_json, comment, status,
         submitted_by_account_id, submitted_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'SUBMITTED', ?8, ?9)`,
    ).bind(
      crypto.randomUUID(), projectId, reviewerPartyId, subjectPartyId, role,
      JSON.stringify(scores), note, actor.account_id, now,
    ).run();
  } else return json({ error: "INVALID_CLOSURE_ACTION" }, 422);
  await db.prepare(
    `INSERT INTO account_audit_events (
       event_id, account_id, event_type, actor_email, payload_json, occurred_at
     ) VALUES (?1, ?2, 'PROJECT_CLOSURE_ACTION', ?3, ?4, ?5)`,
  ).bind(
    crypto.randomUUID(), actor.account_id, actor.email,
    JSON.stringify({ projectId, action }), now,
  ).run();
  const notificationParty = action === "SUBMIT_REVIEW"
    ? (project.is_client ? project.provider_party_id : project.client_party_id)
    : project.provider_party_id;
  await notifyProjectParty(
    db, notificationParty, actor.account_id, `PROJECT_CLOSURE_${action}`,
    action === "ACCEPT_CLOSURE" ? "اعتُمد إغلاق المشروع وصدرت شهادة الإنجاز"
      : action === "REJECT_CLOSURE" ? "مطلوب استكمال محضر إغلاق المشروع"
      : "وصل تقييم موثق للمشروع",
    `${project.public_code} — ${note || project.title}`,
    projectId, action === "REJECT_CLOSURE" ? "HIGH" : "NORMAL", now,
  );
  return json({ ok: true, projectId, action, updatedAt: now });
}
