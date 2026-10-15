import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function database() {
  const runtime = await import("cloudflare:workers");
  return runtime.env.DB;
}

async function currentAccount(db: D1Database) {
  const user = await getChatGPTUser();
  if (!user) return null;
  return db
    .prepare(
      `SELECT account_id, email, display_name, client_type, status,
              created_at, updated_at
         FROM accounts WHERE email = ?1`,
    )
    .bind(user.email.trim().toLowerCase())
    .first<{
      account_id: string;
      email: string;
      display_name: string | null;
      client_type: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>();
}

export async function GET() {
  const db = await database();
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const account = await currentAccount(db);
  if (!account) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);

  const [profiles, transitions, notifications] = await Promise.all([
    db
      .prepare(
        `SELECT profile_id, membership_code, current_step,
                lifecycle_status, revision, updated_at
           FROM membership_profiles
          WHERE account_id = ?1
            AND party_id = (
              SELECT party_id FROM account_party_links
               WHERE account_id = ?1 AND status = 'ACTIVE'
               ORDER BY is_primary DESC, created_at
               LIMIT 1
            )
          ORDER BY updated_at DESC`,
      )
      .bind(account.account_id)
      .all(),
    db
      .prepare(
        `SELECT t.transition_id, t.profile_id, p.membership_code,
                t.from_status, t.to_status, t.action_code,
                t.actor_role, t.reason, t.occurred_at
           FROM membership_transitions t
           JOIN membership_profiles p ON p.profile_id = t.profile_id
          WHERE p.account_id = ?1
            AND p.party_id = (
              SELECT party_id FROM account_party_links
               WHERE account_id = ?1 AND status = 'ACTIVE'
               ORDER BY is_primary DESC, created_at
               LIMIT 1
            )
          ORDER BY t.occurred_at DESC
          LIMIT 50`,
      )
      .bind(account.account_id)
      .all(),
    db
      .prepare(
        `SELECT notification_id, profile_id, notification_type,
                title, message, entity_type, entity_id, action_route,
                priority, due_at, is_read, created_at, read_at
           FROM account_notifications
          WHERE account_id = ?1
          ORDER BY created_at DESC
          LIMIT 50`,
      )
      .bind(account.account_id)
      .all(),
  ]);

  return json({
    account: {
      id: account.account_id,
      email: account.email,
      displayName: account.display_name,
      clientType: account.client_type,
      status: account.status,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
    },
    profiles: profiles.results,
    transitions: transitions.results,
    notifications: notifications.results,
    unreadCount: notifications.results.filter(
      (notification) => !notification.is_read,
    ).length,
  });
}

export async function PATCH(request: Request) {
  const db = await database();
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const account = await currentAccount(db);
  if (!account) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);

  let body: { notificationId?: unknown; markAll?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const now = new Date().toISOString();
  if (body.markAll === true) {
    const result = await db
      .prepare(
        `UPDATE account_notifications
            SET is_read = 1, read_at = ?2
          WHERE account_id = ?1 AND is_read = 0`,
      )
      .bind(account.account_id, now)
      .run();
    return json({ updated: result.meta.changes, readAt: now });
  }

  if (
    typeof body.notificationId !== "string" ||
    !body.notificationId.trim()
  ) {
    return json({ error: "NOTIFICATION_ID_REQUIRED" }, 422);
  }
  const result = await db
    .prepare(
      `UPDATE account_notifications
          SET is_read = 1, read_at = ?3
        WHERE notification_id = ?1 AND account_id = ?2`,
    )
    .bind(body.notificationId, account.account_id, now)
    .run();
  if (!result.meta.changes) return json({ error: "NOT_FOUND" }, 404);
  return json({ updated: 1, readAt: now });
}
