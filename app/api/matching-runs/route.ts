import { getRuntime, type SqlDatabase } from "@/app/lib/runtime";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

const criteria = [
  "specialty", "practice", "sector", "evidence", "experience",
  "language", "country", "availability", "price", "rating",
];

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
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
function object(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function scoreMap(value: unknown) {
  const input = object(value);
  return Object.fromEntries(criteria.map((key) => [
    key,
    Math.max(0, Math.min(100, Math.round(Number(input[key]) || 0))),
  ]));
}

export async function GET(request: Request) {
  const workers = getRuntime();
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const actor = await actorContext(db);
  if (!actor) return json({ error: "CLIENT_CONTEXT_REQUIRED" }, 401);
  const needId = new URL(request.url).searchParams.get("needId") ?? "";
  const runs = await db.prepare(
    `SELECT run_id, need_id, fingerprint_version, weights_json,
            mandatory_json, status, created_at
       FROM matching_runs
      WHERE client_party_id = ?1 AND (?2 = '' OR need_id = ?2)
      ORDER BY created_at DESC LIMIT 25`,
  ).bind(actor.party_id, needId).all();
  return json({ runs: runs.results });
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
  const runId = typeof body.runId === "string" ? body.runId.slice(0, 80) : "";
  const needId = typeof body.needId === "string" ? body.needId.slice(0, 80) : "";
  const results = Array.isArray(body.results) ? body.results.slice(0, 100) : [];
  const weights = scoreMap(body.weights);
  const weightTotal = criteria.reduce((sum, key) => sum + weights[key], 0);
  const mandatory = Array.isArray(body.mandatory)
    ? body.mandatory.filter((item): item is string =>
        typeof item === "string" && criteria.includes(item))
    : [];
  if (!runId || !needId || weightTotal !== 100 || !results.length) {
    return json({ error: "INVALID_MATCHING_RUN" }, 422);
  }
  const need = await db.prepare(
    `SELECT fingerprint_json FROM client_needs
      WHERE need_id = ?1 AND client_party_id = ?2`,
  ).bind(needId, actor.party_id).first<{ fingerprint_json: string }>();
  if (!need) return json({ error: "NEED_NOT_FOUND" }, 404);
  const existing = await db.prepare(
    "SELECT run_id FROM matching_runs WHERE run_id = ?1 AND client_party_id = ?2",
  ).bind(runId, actor.party_id).first();
  if (existing) return json({ error: "MATCHING_RUN_ALREADY_EXISTS" }, 409);
  const fingerprint = object(body.fingerprintSnapshot);
  const version = Number.isInteger(fingerprint.version)
    ? Number(fingerprint.version) : 1;
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO matching_runs (
       run_id, need_id, client_party_id, fingerprint_version,
       fingerprint_snapshot_json, weights_json, mandatory_json,
       status, created_by_account_id, created_at
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'COMPLETED', ?8, ?9)`,
  ).bind(
    runId, needId, actor.party_id, version, JSON.stringify(fingerprint),
    JSON.stringify(weights), JSON.stringify(mandatory), actor.account_id, now,
  ).run();

  const partyIds = [...new Set(results.map((raw) => {
    const item = object(raw);
    const direct = typeof item.partyId === "string" ? item.partyId : "";
    const ref = String(item.ref ?? "");
    return (direct || (ref.startsWith("party:") ? ref.split(":")[1] : "")).slice(0, 80);
  }).filter(Boolean))];
  const reputationRows = partyIds.length
    ? await db.prepare(
      `SELECT party_id, composite_score, confidence_score, sample_count
         FROM reputation_snapshots
        WHERE party_id IN (${partyIds.map(() => "?").join(",")})`,
    ).bind(...partyIds).all<{
      party_id: string; composite_score: number;
      confidence_score: number; sample_count: number;
    }>()
    : { results: [] };
  const reputationByParty = new Map(
    reputationRows.results.map((row) => [row.party_id, row]),
  );
  const normalized = results.map((raw) => {
    const item = object(raw);
    const scores = scoreMap(item.scores);
    const ref = String(item.ref ?? "").slice(0, 160);
    const candidatePartyId = String(
      item.partyId ?? (ref.startsWith("party:") ? ref.split(":")[1] : ""),
    ).slice(0, 80);
    const reputation = reputationByParty.get(candidatePartyId);
    if (reputation) {
      scores.rating = Math.round(
        80 + (reputation.composite_score - 80) * reputation.confidence_score / 100,
      );
    } else scores.rating = 80;
    const failed = mandatory.filter((key) => scores[key] < 60);
    const contributions = Object.fromEntries(criteria.map((key) => [
      key, Math.round(scores[key] * weights[key] / 100),
    ]));
    const total = criteria.reduce(
      (sum, key) => sum + scores[key] * weights[key] / 100, 0,
    );
    return {
      candidateRef: ref, candidatePartyId,
      scores, failed, contributions,
      score: Math.round(total),
      eligible: failed.length === 0,
      snapshot: {
        name: item.name, kind: item.kind, role: item.role,
        country: item.country, verified: item.verified,
        reputation: reputation ? {
          score: reputation.composite_score,
          confidence: reputation.confidence_score,
          sampleCount: reputation.sample_count,
          adjustedMatchingScore: scores.rating,
        } : { score: null, confidence: 0, sampleCount: 0, adjustedMatchingScore: 80 },
      },
    };
  }).filter((item) => item.candidateRef)
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);

  await db.batch(normalized.map((item, index) => db.prepare(
    `INSERT INTO matching_results (
       result_id, run_id, candidate_ref, candidate_party_id, total_score,
       eligible, component_scores_json, contributions_json,
       failed_mandatory_json, candidate_snapshot_json, rank, created_at
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
  ).bind(
    crypto.randomUUID(), runId, item.candidateRef, item.candidatePartyId || null, item.score,
    item.eligible ? 1 : 0, JSON.stringify(item.scores),
    JSON.stringify(item.contributions), JSON.stringify(item.failed),
    JSON.stringify(item.snapshot), index + 1, now,
  )));
  await db.prepare(
    `INSERT INTO account_audit_events (
       event_id, account_id, event_type, actor_email, payload_json, occurred_at
     ) VALUES (?1, ?2, 'MATCHING_RUN_COMPLETED', ?3, ?4, ?5)`,
  ).bind(
    crypto.randomUUID(), actor.account_id, actor.email,
    JSON.stringify({ runId, needId, resultCount: normalized.length, weights }),
    now,
  ).run();
  return json({ runId, results: normalized }, 201);
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
  const runId = String(body.runId ?? "").slice(0, 80);
  const candidateRef = String(body.candidateRef ?? "").slice(0, 160);
  const reason = String(body.reason ?? "").trim().slice(0, 2000);
  const result = await db.prepare(
    `SELECT r.run_id, r.need_id FROM matching_runs r
       JOIN matching_results mr ON mr.run_id = r.run_id
      WHERE r.run_id = ?1 AND r.client_party_id = ?2
        AND mr.candidate_ref = ?3`,
  ).bind(runId, actor.party_id, candidateRef)
    .first<{ run_id: string; need_id: string }>();
  if (!result) return json({ error: "MATCH_RESULT_NOT_FOUND" }, 404);
  const decisionId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO selection_decisions (
       decision_id, run_id, need_id, client_party_id, candidate_ref,
       reason, status, decided_by_account_id, decided_at
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'SELECTED', ?7, ?8)`,
  ).bind(
    decisionId, runId, result.need_id, actor.party_id,
    candidateRef, reason || null, actor.account_id, now,
  ).run();
  return json({ decisionId, status: "SELECTED", decidedAt: now }, 201);
}
