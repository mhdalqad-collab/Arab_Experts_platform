import { getRuntime, type SqlDatabase, type SqlStatement } from "@/app/lib/runtime";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

const roleCodes = new Set([
  "OWNER",
  "ORG_ADMIN",
  "MEMBERSHIP_MANAGER",
  "BILLING_MANAGER",
  "VIEWER",
]);
const invitationManagers = new Set(["OWNER", "ORG_ADMIN"]);

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function database() {
  const runtime = getRuntime();
  return runtime.env.DB;
}

async function currentAccount(db: SqlDatabase) {
  const user = await getChatGPTUser();
  if (!user) return null;
  const email = user.email.trim().toLowerCase();
  const account = await db
    .prepare(
      "SELECT account_id, display_name, status FROM accounts WHERE email = ?1",
    )
    .bind(email)
    .first<{
      account_id: string;
      display_name: string | null;
      status: string;
    }>();
  return account ? { ...account, email } : null;
}

async function organizationRole(
  db: SqlDatabase,
  accountId: string,
  partyId: string,
) {
  return db
    .prepare(
      `SELECT l.relationship_code
         FROM account_party_links l
         JOIN organizations o ON o.party_id = l.party_id
        WHERE l.account_id = ?1 AND l.party_id = ?2
          AND l.status = 'ACTIVE'`,
    )
    .bind(accountId, partyId)
    .first<{ relationship_code: string }>();
}

function emailValue(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function idValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function audit(
  db: SqlDatabase,
  account: { account_id: string; email: string },
  eventType: string,
  payload: Record<string, unknown>,
  now: string,
) {
  return db
    .prepare(
      `INSERT INTO account_audit_events (
         event_id, account_id, event_type, actor_email, payload_json, occurred_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(
      crypto.randomUUID(),
      account.account_id,
      eventType,
      account.email,
      JSON.stringify(payload),
      now,
    );
}

export async function GET() {
  const db = await database();
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const account = await currentAccount(db);
  if (!account) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);

  const organizations = await db
    .prepare(
      `SELECT p.party_id, p.display_name_ar, p.display_name_en,
              l.relationship_code, l.is_primary
         FROM account_party_links l
         JOIN organizations o ON o.party_id = l.party_id
         JOIN parties p ON p.party_id = l.party_id
        WHERE l.account_id = ?1 AND l.status = 'ACTIVE'
        ORDER BY l.is_primary DESC, p.display_name_ar`,
    )
    .bind(account.account_id)
    .all();

  const invitations = await db
    .prepare(
      `SELECT i.invitation_id, i.organization_party_id, p.display_name_ar,
              i.invited_email, i.role_code, i.status,
              i.expires_at, i.created_at, i.responded_at, i.cancelled_at
         FROM organization_invitations i
         JOIN parties p ON p.party_id = i.organization_party_id
         LEFT JOIN account_party_links l
           ON l.party_id = i.organization_party_id
          AND l.account_id = ?1 AND l.status = 'ACTIVE'
        WHERE l.account_id IS NOT NULL OR i.invited_email = ?2
        ORDER BY i.created_at DESC
        LIMIT 100`,
    )
    .bind(account.account_id, account.email)
    .all();

  const representatives = await db
    .prepare(
      `SELECT l.party_id AS organization_party_id, l.account_id,
              a.email, a.display_name, l.relationship_code,
              l.status, l.created_at
         FROM account_party_links l
         JOIN accounts a ON a.account_id = l.account_id
        WHERE l.party_id IN (
          SELECT party_id FROM account_party_links
           WHERE account_id = ?1 AND status = 'ACTIVE'
        )
          AND l.party_id IN (SELECT party_id FROM organizations)
        ORDER BY l.party_id, l.relationship_code, a.display_name`,
    )
    .bind(account.account_id)
    .all();

  return json({
    organizations: organizations.results,
    invitations: invitations.results,
    representatives: representatives.results,
  });
}

export async function POST(request: Request) {
  const db = await database();
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const account = await currentAccount(db);
  if (!account) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);

  let body: {
    action?: unknown;
    organizationPartyId?: unknown;
    invitationId?: unknown;
    accountId?: unknown;
    email?: unknown;
    roleCode?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const action = idValue(body.action);
  const organizationPartyId = idValue(body.organizationPartyId);
  const now = new Date().toISOString();

  if (action === "ACCEPT_INVITATION") {
    const invitationId = idValue(body.invitationId);
    if (!invitationId) return json({ error: "INVITATION_ID_REQUIRED" }, 422);
    const invitation = await db
      .prepare(
        `SELECT invitation_id, organization_party_id, role_code,
                status, invited_email, expires_at
           FROM organization_invitations
          WHERE invitation_id = ?1`,
      )
      .bind(invitationId)
      .first<{
        invitation_id: string;
        organization_party_id: string;
        role_code: string;
        status: string;
        invited_email: string;
        expires_at: string;
      }>();
    if (!invitation) return json({ error: "INVITATION_NOT_FOUND" }, 404);
    if (invitation.invited_email !== account.email) {
      return json({ error: "INVITATION_EMAIL_MISMATCH" }, 403);
    }
    if (invitation.status !== "PENDING") {
      return json({ error: "INVITATION_NOT_PENDING" }, 409);
    }
    if (Date.parse(invitation.expires_at) <= Date.now()) {
      await db
        .prepare(
          "UPDATE organization_invitations SET status = 'EXPIRED' WHERE invitation_id = ?1",
        )
        .bind(invitationId)
        .run();
      return json({ error: "INVITATION_EXPIRED" }, 410);
    }
    await db.batch([
      db
        .prepare(
          `INSERT INTO account_party_links (
             account_party_link_id, account_id, party_id, relationship_code,
             is_primary, status, created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, 0, 'ACTIVE', ?5, ?5)
           ON CONFLICT(account_id, party_id) DO UPDATE SET
             relationship_code = excluded.relationship_code,
             status = 'ACTIVE', updated_at = excluded.updated_at`,
        )
        .bind(
          `${account.account_id}:${invitation.organization_party_id}`,
          account.account_id,
          invitation.organization_party_id,
          invitation.role_code,
          now,
        ),
      db
        .prepare(
          `UPDATE organization_invitations
              SET status = 'ACCEPTED', accepted_by_account_id = ?2,
                  responded_at = ?3
            WHERE invitation_id = ?1 AND status = 'PENDING'`,
        )
        .bind(invitationId, account.account_id, now),
      await audit(
        db,
        account,
        "ORGANIZATION_INVITATION_ACCEPTED",
        { invitationId, organizationPartyId: invitation.organization_party_id },
        now,
      ),
    ]);
    return json({ accepted: true, organizationPartyId: invitation.organization_party_id });
  }

  if (!organizationPartyId) {
    return json({ error: "ORGANIZATION_PARTY_ID_REQUIRED" }, 422);
  }
  const role = await organizationRole(
    db,
    account.account_id,
    organizationPartyId,
  );
  if (!role) return json({ error: "ORGANIZATION_ACCESS_REQUIRED" }, 403);

  if (action === "CREATE_INVITATION") {
    if (!invitationManagers.has(role.relationship_code)) {
      return json({ error: "ORGANIZATION_ADMIN_REQUIRED" }, 403);
    }
    const email = emailValue(body.email);
    const roleCode =
      typeof body.roleCode === "string" && roleCodes.has(body.roleCode)
        ? body.roleCode
        : null;
    if (!email || !roleCode || roleCode === "OWNER") {
      return json({ error: "VALID_EMAIL_AND_DELEGATED_ROLE_REQUIRED" }, 422);
    }
    const existingLink = await db
      .prepare(
        `SELECT 1
           FROM account_party_links l
           JOIN accounts a ON a.account_id = l.account_id
          WHERE l.party_id = ?1 AND a.email = ?2 AND l.status = 'ACTIVE'`,
      )
      .bind(organizationPartyId, email)
      .first();
    if (existingLink) return json({ error: "REPRESENTATIVE_ALREADY_ACTIVE" }, 409);

    const pending = await db
      .prepare(
        `SELECT invitation_id
           FROM organization_invitations
          WHERE organization_party_id = ?1 AND invited_email = ?2
            AND status = 'PENDING' AND expires_at > ?3`,
      )
      .bind(organizationPartyId, email, now)
      .first();
    if (pending) return json({ error: "INVITATION_ALREADY_PENDING" }, 409);

    const invitationId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const invitedAccount = await db
      .prepare("SELECT account_id FROM accounts WHERE email = ?1")
      .bind(email)
      .first<{ account_id: string }>();
    const statements: SqlStatement[] = [
      db
        .prepare(
          `INSERT INTO organization_invitations (
             invitation_id, organization_party_id, invited_email, role_code,
             status, invited_by_account_id, expires_at, created_at
           ) VALUES (?1, ?2, ?3, ?4, 'PENDING', ?5, ?6, ?7)`,
        )
        .bind(
          invitationId,
          organizationPartyId,
          email,
          roleCode,
          account.account_id,
          expiresAt,
          now,
        ),
      await audit(
        db,
        account,
        "ORGANIZATION_INVITATION_CREATED",
        { invitationId, organizationPartyId, email, roleCode },
        now,
      ),
    ];
    if (invitedAccount) {
      statements.push(
        db
          .prepare(
            `INSERT INTO account_notifications (
               notification_id, account_id, profile_id, notification_type,
               title, message, is_read, created_at
             ) VALUES (?1, ?2, NULL, 'ORGANIZATION_INVITATION',
                       'دعوة للانضمام إلى منظمة',
                       'لديك دعوة جديدة لإدارة منظمة في شبكة الخبراء العرب.',
                       0, ?3)`,
          )
          .bind(crypto.randomUUID(), invitedAccount.account_id, now),
      );
    }
    await db.batch(statements);
    return json({ invitationId, status: "PENDING", expiresAt }, 201);
  }

  if (action === "CANCEL_INVITATION") {
    if (!invitationManagers.has(role.relationship_code)) {
      return json({ error: "ORGANIZATION_ADMIN_REQUIRED" }, 403);
    }
    const invitationId = idValue(body.invitationId);
    if (!invitationId) return json({ error: "INVITATION_ID_REQUIRED" }, 422);
    const result = await db
      .prepare(
        `UPDATE organization_invitations
            SET status = 'CANCELLED', cancelled_at = ?3
          WHERE invitation_id = ?1 AND organization_party_id = ?2
            AND status = 'PENDING'`,
      )
      .bind(invitationId, organizationPartyId, now)
      .run();
    if (!result.meta.changes) return json({ error: "PENDING_INVITATION_NOT_FOUND" }, 404);
    await (await audit(
      db,
      account,
      "ORGANIZATION_INVITATION_CANCELLED",
      { invitationId, organizationPartyId },
      now,
    )).run();
    return json({ cancelled: true });
  }

  if (action === "CHANGE_ROLE" || action === "REVOKE_ACCESS") {
    if (role.relationship_code !== "OWNER") {
      return json({ error: "ORGANIZATION_OWNER_REQUIRED" }, 403);
    }
    const targetAccountId = idValue(body.accountId);
    if (!targetAccountId) return json({ error: "ACCOUNT_ID_REQUIRED" }, 422);
    const target = await db
      .prepare(
        `SELECT relationship_code
           FROM account_party_links
          WHERE account_id = ?1 AND party_id = ?2 AND status = 'ACTIVE'`,
      )
      .bind(targetAccountId, organizationPartyId)
      .first<{ relationship_code: string }>();
    if (!target) return json({ error: "REPRESENTATIVE_NOT_FOUND" }, 404);

    if (target.relationship_code === "OWNER") {
      const owners = await db
        .prepare(
          `SELECT COUNT(*) AS total FROM account_party_links
            WHERE party_id = ?1 AND relationship_code = 'OWNER'
              AND status = 'ACTIVE'`,
        )
        .bind(organizationPartyId)
        .first<{ total: number }>();
      if ((owners?.total ?? 0) <= 1) {
        return json({ error: "LAST_OWNER_PROTECTED" }, 409);
      }
    }

    if (action === "REVOKE_ACCESS") {
      await db
        .prepare(
          `UPDATE account_party_links
              SET status = 'REVOKED', is_primary = 0, updated_at = ?3
            WHERE account_id = ?1 AND party_id = ?2`,
        )
        .bind(targetAccountId, organizationPartyId, now)
        .run();
    } else {
      const roleCode =
        typeof body.roleCode === "string" && roleCodes.has(body.roleCode)
          ? body.roleCode
          : null;
      if (!roleCode) return json({ error: "VALID_ROLE_REQUIRED" }, 422);
      await db
        .prepare(
          `UPDATE account_party_links
              SET relationship_code = ?3, updated_at = ?4
            WHERE account_id = ?1 AND party_id = ?2 AND status = 'ACTIVE'`,
        )
        .bind(targetAccountId, organizationPartyId, roleCode, now)
        .run();
    }
    await (await audit(
      db,
      account,
      action === "REVOKE_ACCESS"
        ? "ORGANIZATION_ACCESS_REVOKED"
        : "ORGANIZATION_ROLE_CHANGED",
      {
        organizationPartyId,
        targetAccountId,
        roleCode: body.roleCode ?? null,
      },
      now,
    )).run();
    return json({ updated: true });
  }

  return json({ error: "UNSUPPORTED_ACTION" }, 422);
}
