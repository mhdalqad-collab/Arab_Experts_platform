import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
const DIMENSIONS = ["quality", "timeliness", "communication", "professionalism", "value"] as const;

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
    `SELECT 1 AS ok FROM account_roles
      WHERE account_id = ?1 AND role_code = 'PLATFORM_ADMIN' AND is_active = 1`,
  ).bind(account.account_id).first<{ ok: number }>();
  return { ...account, isAdmin: Boolean(admin) };
}
async function ownedPartyIds(db: D1Database, accountId: string) {
  const rows = await db.prepare(
    "SELECT party_id FROM account_party_links WHERE account_id = ?1 AND status = 'ACTIVE'",
  ).bind(accountId).all<{ party_id: string }>();
  return rows.results.map((row) => row.party_id);
}
function recencyWeight(submittedAt: string) {
  const ageDays = Math.max(0, (Date.now() - new Date(submittedAt).getTime()) / 86_400_000);
  return ageDays <= 180 ? 1 : ageDays <= 365 ? .85 : .7;
}
function calculate(rows: Array<Record<string, unknown>>) {
  const priorScore = 4;
  const priorWeight = 5;
  const totals = Object.fromEntries(DIMENSIONS.map((key) => [key, priorScore * priorWeight]));
  const weights = Object.fromEntries(DIMENSIONS.map((key) => [key, priorWeight]));
  for (const row of rows) {
    const scores = object(JSON.parse(String(row.scores_json ?? "{}")));
    const weight = recencyWeight(String(row.submitted_at));
    for (const key of DIMENSIONS) {
      const score = Number(scores[key]);
      if (score >= 1 && score <= 5) {
        totals[key] += score * weight;
        weights[key] += weight;
      }
    }
  }
  const dimensions = Object.fromEntries(
    DIMENSIONS.map((key) => [key, Math.round((totals[key] / weights[key]) * 20)]),
  );
  const compositeScore = Math.round(
    DIMENSIONS.reduce((sum, key) => sum + dimensions[key], 0) / DIMENSIONS.length,
  );
  const confidenceScore = Math.round((rows.length / (rows.length + priorWeight)) * 100);
  return { compositeScore, confidenceScore, sampleCount: rows.length, dimensions };
}
async function reputationForParty(db: D1Database, partyId: string) {
  const reviews = await db.prepare(
    `SELECT pr.review_id, pr.project_id, pr.reviewer_role, pr.scores_json,
            pr.comment, pr.status, pr.submitted_at, sp.public_code AS project_code
       FROM project_reviews pr
       JOIN service_projects sp ON sp.project_id = pr.project_id
      WHERE pr.subject_party_id = ?1 AND pr.status = 'SUBMITTED'
      ORDER BY pr.submitted_at DESC`,
  ).bind(partyId).all<Record<string, unknown>>();
  const score = calculate(reviews.results);
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO reputation_snapshots (
       snapshot_id, party_id, composite_score, confidence_score, sample_count,
       dimensions_json, methodology_version, generated_at
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'EIM-REP-1.0', ?7)
     ON CONFLICT(party_id) DO UPDATE SET
       composite_score = excluded.composite_score,
       confidence_score = excluded.confidence_score,
       sample_count = excluded.sample_count,
       dimensions_json = excluded.dimensions_json,
       methodology_version = excluded.methodology_version,
       generated_at = excluded.generated_at`,
  ).bind(
    crypto.randomUUID(), partyId, score.compositeScore, score.confidenceScore,
    score.sampleCount, JSON.stringify(score.dimensions), now,
  ).run();
  return { ...score, methodologyVersion: "EIM-REP-1.0", generatedAt: now, reviews: reviews.results };
}

export async function GET(request: Request) {
  const workers = await import("cloudflare:workers");
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor) return json({ error: "ACCOUNT_CONTEXT_REQUIRED" }, 401);
  const requestedPartyId = new URL(request.url).searchParams.get("partyId")?.slice(0, 80) ?? "";
  const owned = await ownedPartyIds(db, actor.account_id);
  if (actor.isAdmin && !requestedPartyId) {
    const disputes = await db.prepare(
      `SELECT rd.dispute_id, rd.review_id, rd.status, rd.reason_code, rd.statement,
              rd.raised_at, p.display_name_ar AS raised_by_name
         FROM review_disputes rd JOIN parties p ON p.party_id = rd.raised_by_party_id
        WHERE rd.status = 'OPEN' ORDER BY rd.raised_at`,
    ).all();
    return json({ admin: true, disputes: disputes.results });
  }
  const partyId = requestedPartyId || owned[0] || "";
  if (!partyId || (!actor.isAdmin && !owned.includes(partyId))) {
    return json({ error: "REPUTATION_ACCESS_DENIED" }, 403);
  }
  const party = await db.prepare(
    "SELECT party_id, display_name_ar FROM parties WHERE party_id = ?1",
  ).bind(partyId).first<{ party_id: string; display_name_ar: string }>();
  return json({ party, reputation: await reputationForParty(db, partyId) });
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
  const reviewId = String(body.reviewId ?? "").slice(0, 80);
  const reasonCode = String(body.reasonCode ?? "").slice(0, 40);
  const statement = String(body.statement ?? "").trim().slice(0, 4000);
  if (!["FACTUAL_ERROR", "ABUSE", "CONFLICT_OF_INTEREST", "OTHER"].includes(reasonCode) || !statement) {
    return json({ error: "DISPUTE_DETAILS_REQUIRED" }, 422);
  }
  const owned = await ownedPartyIds(db, actor.account_id);
  const review = await db.prepare(
    "SELECT subject_party_id, status FROM project_reviews WHERE review_id = ?1",
  ).bind(reviewId).first<{ subject_party_id: string; status: string }>();
  if (!review || !owned.includes(review.subject_party_id) || review.status !== "SUBMITTED") {
    return json({ error: "REVIEW_DISPUTE_NOT_ALLOWED" }, 403);
  }
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(
      `INSERT INTO review_disputes (
         dispute_id, review_id, raised_by_party_id, status, reason_code,
         statement, raised_at, updated_at
       ) VALUES (?1, ?2, ?3, 'OPEN', ?4, ?5, ?6, ?6)`,
    ).bind(crypto.randomUUID(), reviewId, review.subject_party_id, reasonCode, statement, now),
    db.prepare("UPDATE project_reviews SET status = 'DISPUTED' WHERE review_id = ?1").bind(reviewId),
    db.prepare(
      `INSERT INTO account_audit_events (
         event_id, account_id, event_type, actor_email, payload_json, occurred_at
       ) VALUES (?1, ?2, 'REVIEW_DISPUTED', ?3, ?4, ?5)`,
    ).bind(crypto.randomUUID(), actor.account_id, actor.email, JSON.stringify({ reviewId, reasonCode }), now),
  ]);
  return json({ ok: true, status: "OPEN" }, 201);
}

export async function PATCH(request: Request) {
  const workers = await import("cloudflare:workers");
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor?.isAdmin) return json({ error: "PLATFORM_ADMIN_REQUIRED" }, 403);
  let body: Record<string, unknown>;
  try { body = object(await request.json()); }
  catch { return json({ error: "INVALID_JSON" }, 400); }
  const disputeId = String(body.disputeId ?? "").slice(0, 80);
  const decision = String(body.decision ?? "").slice(0, 20);
  const resolution = String(body.resolution ?? "").trim().slice(0, 4000);
  if (!["RESTORE", "EXCLUDE"].includes(decision) || !resolution) {
    return json({ error: "DISPUTE_DECISION_REQUIRED" }, 422);
  }
  const dispute = await db.prepare(
    "SELECT review_id FROM review_disputes WHERE dispute_id = ?1 AND status = 'OPEN'",
  ).bind(disputeId).first<{ review_id: string }>();
  if (!dispute) return json({ error: "OPEN_DISPUTE_NOT_FOUND" }, 404);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(
      `UPDATE review_disputes SET status = 'RESOLVED', resolution = ?1,
              resolved_by_account_id = ?2, resolved_at = ?3, updated_at = ?3
        WHERE dispute_id = ?4`,
    ).bind(resolution, actor.account_id, now, disputeId),
    db.prepare("UPDATE project_reviews SET status = ?1 WHERE review_id = ?2")
      .bind(decision === "RESTORE" ? "SUBMITTED" : "EXCLUDED", dispute.review_id),
    db.prepare(
      `INSERT INTO account_audit_events (
         event_id, account_id, event_type, actor_email, payload_json, occurred_at
       ) VALUES (?1, ?2, 'REVIEW_DISPUTE_RESOLVED', ?3, ?4, ?5)`,
    ).bind(
      crypto.randomUUID(), actor.account_id, actor.email,
      JSON.stringify({ disputeId, decision }), now,
    ),
  ]);
  return json({ ok: true, disputeId, decision });
}
