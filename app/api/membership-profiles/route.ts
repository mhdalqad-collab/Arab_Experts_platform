import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

const allowedCodes = new Set([
  "expert",
  "trainer",
  "consultant",
  "researcher",
  "center",
  "client",
]);

const allowedStates = new Set([
  "not_started",
  "draft",
  "data_complete",
  "submitted",
  "under_review",
  "needs_changes",
  "approved",
  "rejected",
  "suspended",
  "renewal_due",
  "expired",
]);

type ProfileInput = {
  membershipCode?: unknown;
  data?: unknown;
  privacy?: unknown;
  records?: unknown;
  currentStep?: unknown;
  lifecycleStatus?: unknown;
};

type ExistingProfile = {
  profile_id: string;
  party_id: string | null;
  payload_json: string;
  privacy_json: string;
  records_json: string;
  current_step: number;
  lifecycle_status: string;
  revision: number;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function getDatabase() {
  const runtime = await import("cloudflare:workers");
  return runtime.env.DB;
}

async function identity() {
  const user = await getChatGPTUser();
  if (!user) return null;
  return {
    email: user.email.trim().toLowerCase(),
    displayName: user.fullName ?? user.displayName,
  };
}

async function accountIdForEmail(
  database: D1Database,
  email: string,
  displayName: string,
) {
  const existing = await database
    .prepare("SELECT account_id FROM accounts WHERE email = ?1")
    .bind(email)
    .first<{ account_id: string }>();
  if (existing) return existing.account_id;

  const accountId = crypto.randomUUID();
  const now = new Date().toISOString();
  await database
    .prepare(
      `INSERT INTO accounts (
         account_id, email, display_name, status, created_at, updated_at
       ) VALUES (?1, ?2, ?3, 'ACTIVE', ?4, ?4)`,
    )
    .bind(accountId, email, displayName, now)
    .run();
  return accountId;
}

async function primaryPartyForAccount(
  database: D1Database,
  accountId: string,
  displayName: string,
) {
  const existing = await database
    .prepare(
      `SELECT p.party_id
         FROM account_party_links l
         JOIN parties p ON p.party_id = l.party_id
        WHERE l.account_id = ?1 AND l.status = 'ACTIVE'
        ORDER BY l.is_primary DESC, l.created_at
        LIMIT 1`,
    )
    .bind(accountId)
    .first<{ party_id: string }>();
  if (existing) return existing.party_id;

  const partyId = crypto.randomUUID();
  const now = new Date().toISOString();
  await database.batch([
    database
      .prepare(
        `INSERT INTO parties (
           party_id, party_type, display_name_ar, status,
           row_version, created_at, updated_at
         ) VALUES (?1, 'PERSON', ?2, 'ACTIVE', 1, ?3, ?3)`,
      )
      .bind(partyId, displayName, now),
    database
      .prepare(
        `INSERT INTO persons (
           party_id, full_name_ar, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?3)`,
      )
      .bind(partyId, displayName, now),
    database
      .prepare(
        `INSERT INTO account_party_links (
           account_party_link_id, account_id, party_id, relationship_code,
           is_primary, status, created_at, updated_at
         ) VALUES (?1, ?2, ?3, 'OWNER', 1, 'ACTIVE', ?4, ?4)`,
      )
      .bind(`${accountId}:${partyId}`, accountId, partyId, now),
  ]);
  return partyId;
}

function safeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizedProfile(input: ProfileInput) {
  const membershipCode =
    typeof input.membershipCode === "string" &&
    allowedCodes.has(input.membershipCode)
      ? input.membershipCode
      : null;
  if (!membershipCode) return null;

  const currentStep =
    Number.isInteger(input.currentStep) &&
    Number(input.currentStep) >= 0 &&
    Number(input.currentStep) <= 20
      ? Number(input.currentStep)
      : 0;
  const lifecycleStatus =
    typeof input.lifecycleStatus === "string" &&
    allowedStates.has(input.lifecycleStatus)
      ? input.lifecycleStatus
      : "draft";

  const normalized = {
    membershipCode,
    data: safeObject(input.data),
    privacy: safeObject(input.privacy),
    records: safeObject(input.records),
    currentStep,
    lifecycleStatus,
  };
  const size = JSON.stringify(normalized).length;
  return size <= 1_000_000 ? normalized : null;
}

export async function GET() {
  const user = await identity();
  if (!user) return json({ error: "AUTHENTICATION_REQUIRED" }, 401);
  const database = await getDatabase();
  if (!database) return json({ error: "DATABASE_UNAVAILABLE" }, 503);

  const account = await database
    .prepare("SELECT account_id FROM accounts WHERE email = ?1")
    .bind(user.email)
    .first<{ account_id: string }>();
  if (!account) return json({ profiles: [] });
  const partyId = await primaryPartyForAccount(
    database,
    account.account_id,
    user.displayName,
  );

  const profiles = await database
    .prepare(
      `SELECT membership_code, payload_json, privacy_json, records_json,
              current_step, lifecycle_status, revision, updated_at
         FROM membership_profiles
        WHERE account_id = ?1 AND (party_id = ?2 OR party_id IS NULL)
        ORDER BY membership_code`,
    )
    .bind(account.account_id, partyId)
    .all<{
      membership_code: string;
      payload_json: string;
      privacy_json: string;
      records_json: string;
      current_step: number;
      lifecycle_status: string;
      revision: number;
      updated_at: string;
    }>();

  return json({
    activePartyId: partyId,
    profiles: profiles.results.map((profile) => ({
      membershipCode: profile.membership_code,
      data: JSON.parse(profile.payload_json),
      privacy: JSON.parse(profile.privacy_json),
      records: JSON.parse(profile.records_json),
      currentStep: profile.current_step,
      lifecycleStatus: profile.lifecycle_status,
      revision: profile.revision,
      updatedAt: profile.updated_at,
    })),
  });
}

export async function PUT(request: Request) {
  const user = await identity();
  if (!user) return json({ error: "AUTHENTICATION_REQUIRED" }, 401);
  const database = await getDatabase();
  if (!database) return json({ error: "DATABASE_UNAVAILABLE" }, 503);

  let body: { profiles?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const profiles = (Array.isArray(body.profiles) ? body.profiles : [])
    .slice(0, 6)
    .map((profile) => normalizedProfile(profile as ProfileInput))
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));
  if (!profiles.length) return json({ error: "PROFILE_REQUIRED" }, 422);

  const accountId = await accountIdForEmail(
    database,
    user.email,
    user.displayName,
  );
  const partyId = await primaryPartyForAccount(
    database,
    accountId,
    user.displayName,
  );
  const now = new Date().toISOString();
  const saved: Array<{ membershipCode: string; revision: number }> = [];

  for (const profile of profiles) {
    const profileId = `${partyId}:${profile.membershipCode}`;
    const payloadJson = JSON.stringify(profile.data);
    const privacyJson = JSON.stringify(profile.privacy);
    const recordsJson = JSON.stringify(profile.records);
    const existing = await database
      .prepare(
        `SELECT profile_id, payload_json, privacy_json, records_json,
                party_id, current_step, lifecycle_status, revision
           FROM membership_profiles
          WHERE party_id = ?1 AND membership_code = ?2`,
      )
      .bind(partyId, profile.membershipCode)
      .first<ExistingProfile>();

    const changed =
      !existing ||
      existing.payload_json !== payloadJson ||
      existing.privacy_json !== privacyJson ||
      existing.records_json !== recordsJson ||
      existing.current_step !== profile.currentStep ||
      existing.lifecycle_status !== profile.lifecycleStatus;
    if (!changed) {
      saved.push({
        membershipCode: profile.membershipCode,
        revision: existing.revision,
      });
      continue;
    }

    const revision = (existing?.revision ?? 0) + 1;
    const snapshotJson = JSON.stringify({
      data: profile.data,
      privacy: profile.privacy,
      records: profile.records,
      currentStep: profile.currentStep,
      lifecycleStatus: profile.lifecycleStatus,
    });

    await database.batch([
      database
        .prepare(
          `INSERT INTO membership_profiles (
             profile_id, account_id, party_id, membership_code, payload_json,
             privacy_json, records_json, current_step, lifecycle_status,
             revision, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
           ON CONFLICT(party_id, membership_code) DO UPDATE SET
             payload_json = excluded.payload_json,
             privacy_json = excluded.privacy_json,
             records_json = excluded.records_json,
             current_step = excluded.current_step,
             lifecycle_status = excluded.lifecycle_status,
             revision = excluded.revision,
             updated_at = excluded.updated_at`,
        )
        .bind(
          profileId,
          accountId,
          partyId,
          profile.membershipCode,
          payloadJson,
          privacyJson,
          recordsJson,
          profile.currentStep,
          profile.lifecycleStatus,
          revision,
          now,
        ),
      database
        .prepare(
          `INSERT INTO membership_profile_versions (
             version_id, profile_id, revision, snapshot_json,
             actor_email, reason, created_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, 'AUTOSAVE', ?6)`,
        )
        .bind(
          crypto.randomUUID(),
          profileId,
          revision,
          snapshotJson,
          user.email,
          now,
        ),
      database
        .prepare(
          `INSERT INTO account_audit_events (
             event_id, account_id, event_type, actor_email,
             payload_json, occurred_at
           ) VALUES (?1, ?2, 'MEMBERSHIP_PROFILE_SAVED', ?3, ?4, ?5)`,
        )
        .bind(
          crypto.randomUUID(),
          accountId,
          user.email,
          JSON.stringify({
            membershipCode: profile.membershipCode,
            partyId,
            revision,
            lifecycleStatus: profile.lifecycleStatus,
          }),
          now,
        ),
    ]);
    saved.push({ membershipCode: profile.membershipCode, revision });
  }

  return json({ saved, savedAt: now });
}
