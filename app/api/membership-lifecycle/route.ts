import { getRuntime, type SqlDatabase } from "@/app/lib/runtime";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

const allowedMemberships = new Set([
  "expert",
  "trainer",
  "consultant",
  "researcher",
  "center",
  "client",
]);

const rules = {
  SUBMIT: {
    from: new Set(["data_complete", "needs_changes"]),
    to: "submitted",
    actor: "OWNER",
  },
  START_REVIEW: {
    from: new Set(["submitted"]),
    to: "under_review",
    actor: "REVIEWER",
  },
  REQUEST_CHANGES: {
    from: new Set(["under_review"]),
    to: "needs_changes",
    actor: "REVIEWER",
    reason: true,
  },
  APPROVE: {
    from: new Set(["under_review"]),
    to: "approved",
    actor: "REVIEWER",
  },
  REJECT: {
    from: new Set(["under_review"]),
    to: "rejected",
    actor: "REVIEWER",
    reason: true,
  },
  SUSPEND: {
    from: new Set(["approved"]),
    to: "suspended",
    actor: "ADMIN",
    reason: true,
  },
} as const;

type ActionCode = keyof typeof rules;
type Account = { account_id: string; email: string; display_name: string | null };
type Profile = {
  profile_id: string;
  account_id: string;
  membership_code: string;
  lifecycle_status: string;
  revision: number;
};

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

async function authenticatedAccount(db: SqlDatabase) {
  const user = await getChatGPTUser();
  if (!user) return null;
  const email = user.email.trim().toLowerCase();
  const account = await db
    .prepare(
      "SELECT account_id, email, display_name FROM accounts WHERE email = ?1",
    )
    .bind(email)
    .first<Account>();
  return account ? { user, account } : null;
}

async function reviewerRole(db: SqlDatabase, account: Account) {
  const runtime = getRuntime();
  const bootstrapAdmins = String(runtime.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (bootstrapAdmins.includes(account.email)) {
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO account_roles (
           account_role_id, account_id, role_code, granted_by, granted_at, is_active
         ) VALUES (?1, ?2, 'PLATFORM_ADMIN', 'SYSTEM_BOOTSTRAP', ?3, 1)
         ON CONFLICT(account_id, role_code) DO UPDATE SET is_active = 1`,
      )
      .bind(`${account.account_id}:PLATFORM_ADMIN`, account.account_id, now)
      .run();
  }

  const role = await db
    .prepare(
      `SELECT role_code FROM account_roles
        WHERE account_id = ?1 AND is_active = 1
          AND role_code IN ('MEMBERSHIP_REVIEWER', 'PLATFORM_ADMIN')
        ORDER BY CASE role_code WHEN 'PLATFORM_ADMIN' THEN 1 ELSE 2 END
        LIMIT 1`,
    )
    .bind(account.account_id)
    .first<{ role_code: string }>();
  return role?.role_code ?? null;
}

export async function GET() {
  const db = await database();
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const auth = await authenticatedAccount(db);
  if (!auth) return json({ error: "AUTHENTICATION_REQUIRED" }, 401);
  const role = await reviewerRole(db, auth.account);
  if (!role) return json({ error: "REVIEWER_ROLE_REQUIRED" }, 403);

  const queue = await db
    .prepare(
      `SELECT p.profile_id, p.membership_code, p.lifecycle_status,
              p.revision, p.updated_at, a.display_name, a.email,
              r.review_id, r.status AS review_status, r.opened_at
         FROM membership_profiles p
         JOIN accounts a ON a.account_id = p.account_id
         LEFT JOIN membership_reviews r
           ON r.profile_id = p.profile_id AND r.status = 'OPEN'
        WHERE p.lifecycle_status IN ('submitted', 'under_review')
        ORDER BY CASE p.lifecycle_status WHEN 'submitted' THEN 1 ELSE 2 END,
                 p.updated_at`,
    )
    .all();
  return json({ role, queue: queue.results });
}

export async function POST(request: Request) {
  const db = await database();
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const auth = await authenticatedAccount(db);
  if (!auth) return json({ error: "AUTHENTICATION_REQUIRED" }, 401);

  let body: {
    requestId?: unknown;
    membershipCode?: unknown;
    profileId?: unknown;
    action?: unknown;
    reason?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const action =
    typeof body.action === "string" && body.action in rules
      ? (body.action as ActionCode)
      : null;
  const requestId =
    typeof body.requestId === "string" && body.requestId.length >= 8
      ? body.requestId.slice(0, 100)
      : null;
  if (!action || !requestId) return json({ error: "INVALID_ACTION" }, 422);

  const duplicate = await db
    .prepare(
      `SELECT transition_id, to_status FROM membership_transitions
        WHERE request_id = ?1`,
    )
    .bind(requestId)
    .first<{ transition_id: string; to_status: string }>();
  if (duplicate) {
    return json({
      transitionId: duplicate.transition_id,
      status: duplicate.to_status,
      duplicate: true,
    });
  }

  let profile: Profile | null = null;
  if (
    typeof body.profileId === "string" &&
    body.profileId.length > 0
  ) {
    profile = await db
      .prepare(
        `SELECT profile_id, account_id, membership_code,
                lifecycle_status, revision
           FROM membership_profiles WHERE profile_id = ?1`,
      )
      .bind(body.profileId)
      .first<Profile>();
  } else if (
    typeof body.membershipCode === "string" &&
    allowedMemberships.has(body.membershipCode)
  ) {
    profile = await db
      .prepare(
        `SELECT profile_id, account_id, membership_code,
                lifecycle_status, revision
           FROM membership_profiles
          WHERE account_id = ?1 AND membership_code = ?2`,
      )
      .bind(auth.account.account_id, body.membershipCode)
      .first<Profile>();
  }
  if (!profile) return json({ error: "PROFILE_NOT_FOUND" }, 404);

  const rule = rules[action];
  const reviewer = await reviewerRole(db, auth.account);
  const isOwner = profile.account_id === auth.account.account_id;
  const authorized =
    (rule.actor === "OWNER" && isOwner) ||
    (rule.actor === "REVIEWER" && Boolean(reviewer)) ||
    (rule.actor === "ADMIN" && reviewer === "PLATFORM_ADMIN");
  if (!authorized) return json({ error: "FORBIDDEN" }, 403);
  if (!rule.from.has(profile.lifecycle_status as never)) {
    return json(
      {
        error: "INVALID_TRANSITION",
        currentStatus: profile.lifecycle_status,
      },
      409,
    );
  }

  const reason =
    typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  if ("reason" in rule && rule.reason && !reason) {
    return json({ error: "REASON_REQUIRED" }, 422);
  }

  const now = new Date().toISOString();
  const transitionId = crypto.randomUUID();
  const actorRole = isOwner && rule.actor === "OWNER" ? "OWNER" : reviewer!;
  const statements = [
    db
      .prepare(
        `UPDATE membership_profiles
            SET lifecycle_status = ?2, updated_at = ?3
          WHERE profile_id = ?1 AND lifecycle_status = ?4`,
      )
      .bind(
        profile.profile_id,
        rule.to,
        now,
        profile.lifecycle_status,
      ),
    db
      .prepare(
        `UPDATE account_memberships
            SET status = ?2, updated_at = ?3
          WHERE account_id = ?1 AND membership_code = ?4`,
      )
      .bind(profile.account_id, rule.to.toUpperCase(), now, profile.membership_code),
    db
      .prepare(
        `INSERT INTO membership_transitions (
           transition_id, request_id, profile_id, from_status, to_status,
           action_code, actor_account_id, actor_role, reason, occurred_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      )
      .bind(
        transitionId,
        requestId,
        profile.profile_id,
        profile.lifecycle_status,
        rule.to,
        action,
        auth.account.account_id,
        actorRole,
        reason || null,
        now,
      ),
  ];

  if (action === "START_REVIEW") {
    statements.push(
      db
        .prepare(
          `INSERT INTO membership_reviews (
             review_id, profile_id, reviewer_account_id, status, opened_at
           ) VALUES (?1, ?2, ?3, 'OPEN', ?4)`,
        )
        .bind(crypto.randomUUID(), profile.profile_id, auth.account.account_id, now),
    );
  }
  if (["REQUEST_CHANGES", "APPROVE", "REJECT"].includes(action)) {
    statements.push(
      db
        .prepare(
          `UPDATE membership_reviews
              SET status = 'CLOSED', decision_code = ?2,
                  decision_reason = ?3, decided_at = ?4
            WHERE profile_id = ?1 AND status = 'OPEN'`,
        )
        .bind(profile.profile_id, action, reason || null, now),
    );
  }
  if (rule.actor !== "OWNER") {
    const notificationCopy: Record<string, [string, string]> = {
      START_REVIEW: [
        "بدأت مراجعة العضوية",
        "بدأ فريق الشبكة مراجعة بيانات عضويتك.",
      ],
      REQUEST_CHANGES: [
        "مطلوب استكمال بيانات العضوية",
        reason || "يرجى مراجعة الملاحظات واستكمال البيانات.",
      ],
      APPROVE: [
        "تم اعتماد العضوية",
        "اكتملت مراجعة عضويتك وتم اعتمادها.",
      ],
      REJECT: [
        "تعذر اعتماد العضوية",
        reason || "راجع سبب القرار قبل إعادة التقديم.",
      ],
      SUSPEND: [
        "تم تعليق العضوية",
        reason || "تواصل مع إدارة الشبكة لمراجعة الحالة.",
      ],
    };
    const copy = notificationCopy[action];
    if (copy) {
      statements.push(
        db
          .prepare(
            `INSERT INTO account_notifications (
               notification_id, account_id, profile_id, notification_type,
               title, message, is_read, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)`,
          )
          .bind(
            crypto.randomUUID(),
            profile.account_id,
            profile.profile_id,
            action,
            copy[0],
            copy[1],
            now,
          ),
      );
    }
  }
  await db.batch(statements);

  return json({
    transitionId,
    membershipCode: profile.membership_code,
    fromStatus: profile.lifecycle_status,
    status: rule.to,
    action,
    occurredAt: now,
  });
}
