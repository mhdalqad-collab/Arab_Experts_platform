import { getRuntime } from "@/app/lib/runtime";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

const membershipCodes = new Set([
  "expert",
  "trainer",
  "consultant",
  "researcher",
  "center",
  "client",
]);

const clientTypes = new Set([
  "فردي مستقل",
  "مؤسسة أو شركة خاصة",
  "قطاع أكاديمي",
  "قطاع مشترك",
  "منظمات حكومية",
  "منظمات إقليمية",
  "منظمات دولية",
]);

type AccountRow = {
  account_id: string;
  display_name: string | null;
  client_type: string | null;
  status: string;
};

type MembershipRow = {
  membership_code: string;
  status: string;
  is_active: number;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function getDatabase() {
  const runtime = getRuntime();
  return runtime.env.DB;
}

async function requireIdentity() {
  const user = await getChatGPTUser();
  if (!user) return null;
  return {
    email: user.email.trim().toLowerCase(),
    displayName: user.fullName ?? user.displayName,
  };
}

export async function GET() {
  const identity = await requireIdentity();
  if (!identity) return json({ error: "AUTHENTICATION_REQUIRED" }, 401);
  const database = await getDatabase();
  if (!database) return json({ error: "DATABASE_UNAVAILABLE" }, 503);

  const account = await database.prepare(
    `SELECT account_id, display_name, client_type, status
       FROM accounts
      WHERE email = ?1`,
  )
    .bind(identity.email)
    .first<AccountRow>();

  if (!account) {
    return json({
      account: null,
      memberships: [],
      identity,
    });
  }

  const memberships = await database.prepare(
    `SELECT membership_code, status, is_active
       FROM account_memberships
      WHERE account_id = ?1
      ORDER BY created_at`,
  )
    .bind(account.account_id)
    .all<MembershipRow>();

  return json({
    account: {
      id: account.account_id,
      displayName: account.display_name,
      clientType: account.client_type,
      status: account.status,
    },
    memberships: memberships.results,
    identity,
  });
}

export async function PUT(request: Request) {
  const identity = await requireIdentity();
  if (!identity) return json({ error: "AUTHENTICATION_REQUIRED" }, 401);
  const database = await getDatabase();
  if (!database) return json({ error: "DATABASE_UNAVAILABLE" }, 503);

  let body: { memberships?: unknown; clientType?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const selected = Array.from(
    new Set(
      (Array.isArray(body.memberships) ? body.memberships : []).filter(
        (code): code is string =>
          typeof code === "string" && membershipCodes.has(code),
      ),
    ),
  );

  if (!selected.length) {
    return json({ error: "MEMBERSHIP_REQUIRED" }, 422);
  }

  const clientType =
    typeof body.clientType === "string" && clientTypes.has(body.clientType)
      ? body.clientType
      : null;

  if (selected.includes("client") && !clientType) {
    return json({ error: "CLIENT_TYPE_REQUIRED" }, 422);
  }

  const now = new Date().toISOString();
  const existing = await database.prepare(
    "SELECT account_id FROM accounts WHERE email = ?1",
  )
    .bind(identity.email)
    .first<{ account_id: string }>();
  const accountId = existing?.account_id ?? crypto.randomUUID();

  const statements = [
    database.prepare(
      `INSERT INTO accounts (
         account_id, email, display_name, client_type, status, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, 'ACTIVE', ?5, ?5)
       ON CONFLICT(email) DO UPDATE SET
         display_name = excluded.display_name,
         client_type = excluded.client_type,
         updated_at = excluded.updated_at`,
    ).bind(
      accountId,
      identity.email,
      identity.displayName,
      selected.includes("client") ? clientType : null,
      now,
    ),
    database.prepare(
      `UPDATE account_memberships
          SET is_active = 0, updated_at = ?2
        WHERE account_id = ?1`,
    ).bind(accountId, now),
  ];

  for (const code of selected) {
    statements.push(
      database.prepare(
        `INSERT INTO account_memberships (
           membership_id, account_id, membership_code, status,
           is_active, created_at, updated_at
         ) VALUES (?1, ?2, ?3, 'DRAFT', 1, ?4, ?4)
         ON CONFLICT(account_id, membership_code) DO UPDATE SET
           is_active = 1,
           updated_at = excluded.updated_at`,
      ).bind(`${accountId}:${code}`, accountId, code, now),
    );
  }

  statements.push(
    database.prepare(
      `INSERT INTO account_audit_events (
         event_id, account_id, event_type, actor_email, payload_json, occurred_at
       ) VALUES (?1, ?2, 'MEMBERSHIP_SELECTION_UPDATED', ?3, ?4, ?5)`,
    ).bind(
      crypto.randomUUID(),
      accountId,
      identity.email,
      JSON.stringify({ memberships: selected, clientType }),
      now,
    ),
  );

  await database.batch(statements);

  return json({
    accountId,
    memberships: selected,
    clientType,
    savedAt: now,
  });
}
