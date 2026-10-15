import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function reviewerContext(db: D1Database) {
  const user = await getChatGPTUser();
  if (!user) return null;
  const email = user.email.trim().toLowerCase();
  const account = await db
    .prepare("SELECT account_id, email FROM accounts WHERE email = ?1")
    .bind(email)
    .first<{ account_id: string; email: string }>();
  if (!account) return null;
  const workers = await import("cloudflare:workers");
  const admins = String(workers.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase());
  if (admins.includes(email)) {
    await db
      .prepare(
        `INSERT INTO account_roles (
           account_role_id, account_id, role_code, granted_by, granted_at, is_active
         ) VALUES (?1, ?2, 'PLATFORM_ADMIN', 'SYSTEM_BOOTSTRAP', ?3, 1)
         ON CONFLICT(account_id, role_code) DO UPDATE SET is_active = 1`,
      )
      .bind(`${account.account_id}:PLATFORM_ADMIN`, account.account_id, new Date().toISOString())
      .run();
  }
  const role = await db
    .prepare(
      `SELECT role_code FROM account_roles
        WHERE account_id = ?1 AND is_active = 1
          AND role_code IN ('EVIDENCE_REVIEWER', 'PLATFORM_ADMIN')
        ORDER BY CASE role_code WHEN 'PLATFORM_ADMIN' THEN 1 ELSE 2 END
        LIMIT 1`,
    )
    .bind(account.account_id)
    .first<{ role_code: string }>();
  return role ? { account, role: role.role_code } : null;
}

export async function GET() {
  const workers = await import("cloudflare:workers");
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const reviewer = await reviewerContext(db);
  if (!reviewer) return json({ error: "EVIDENCE_REVIEWER_REQUIRED" }, 403);
  const queue = await db
    .prepare(
      `SELECT v.verification_id, v.document_id, v.status, v.submitted_at,
              d.title, d.category_code, d.membership_code, d.confidentiality,
              p.display_name_ar, dv.original_file_name, dv.media_type,
              dv.size_bytes, dv.sha256_hash, dv.scan_status
         FROM document_verifications v
         JOIN professional_documents d ON d.document_id = v.document_id
         JOIN parties p ON p.party_id = d.party_id
         JOIN professional_document_versions dv
           ON dv.document_id = d.document_id
          AND dv.version_number = d.current_version
        WHERE v.status = 'PENDING'
        ORDER BY v.submitted_at`,
    )
    .all();
  return json({ role: reviewer.role, queue: queue.results });
}

export async function POST(request: Request) {
  const workers = await import("cloudflare:workers");
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const reviewer = await reviewerContext(db);
  if (!reviewer) return json({ error: "EVIDENCE_REVIEWER_REQUIRED" }, 403);
  let body: {
    verificationId?: unknown;
    action?: unknown;
    confidenceScore?: unknown;
    reason?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  const verificationId =
    typeof body.verificationId === "string" ? body.verificationId.trim() : "";
  const action =
    body.action === "VERIFY" || body.action === "REJECT" ? body.action : null;
  const score = Number(body.confidenceScore);
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  if (!verificationId || !action) return json({ error: "INVALID_DECISION" }, 422);
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    return json({ error: "CONFIDENCE_SCORE_REQUIRED" }, 422);
  }
  if (action === "REJECT" && !reason) return json({ error: "REASON_REQUIRED" }, 422);
  const pending = await db
    .prepare(
      `SELECT verification_id, document_id FROM document_verifications
        WHERE verification_id = ?1 AND status = 'PENDING'`,
    )
    .bind(verificationId)
    .first<{ verification_id: string; document_id: string }>();
  if (!pending) return json({ error: "PENDING_VERIFICATION_NOT_FOUND" }, 404);
  const now = new Date().toISOString();
  const decision = action === "VERIFY" ? "VERIFIED" : "REJECTED";
  await db.batch([
    db
      .prepare(
        `UPDATE document_verifications
            SET status = ?2, reviewer_account_id = ?3,
                confidence_score = ?4, decision_reason = ?5, decided_at = ?6
          WHERE verification_id = ?1 AND status = 'PENDING'`,
      )
      .bind(
        verificationId,
        decision,
        reviewer.account.account_id,
        score,
        reason || null,
        now,
      ),
    db
      .prepare(
        `UPDATE professional_documents
            SET verification_status = ?2, updated_at = ?3
          WHERE document_id = ?1`,
      )
      .bind(pending.document_id, decision, now),
    db
      .prepare(
        `INSERT INTO account_audit_events (
           event_id, account_id, event_type, actor_email, payload_json, occurred_at
         ) VALUES (?1, ?2, 'DOCUMENT_VERIFICATION_DECIDED', ?3, ?4, ?5)`,
      )
      .bind(
        crypto.randomUUID(),
        reviewer.account.account_id,
        reviewer.account.email,
        JSON.stringify({
          verificationId,
          documentId: pending.document_id,
          decision,
          confidenceScore: score,
          reason: reason || null,
        }),
        now,
      ),
  ]);
  return json({ verificationId, status: decision, confidenceScore: score });
}
