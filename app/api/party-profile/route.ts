import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

const partyTypes = new Set(["PERSON", "ORGANIZATION"]);
const visibilityLevels = new Set([
  "PUBLIC",
  "MEMBERS_ONLY",
  "PLATFORM_ONLY",
  "PRIVATE",
]);
const legalEntityTypes = new Set([
  "شركة ذات مسؤولية محدودة (ذ.م.م)",
  "مؤسسة فردية",
  "شركة شخص واحد",
  "شركة مساهمة خاصة",
  "مؤسسة غير ربحية / جمعية نفع عام",
  "فرع لشركة أو مؤسسة أجنبية",
  "وحدة أو مركز تابع لجهة رسمية قائمة",
]);

type PartyInput = {
  partyId?: unknown;
  partyType?: unknown;
  displayNameAr?: unknown;
  displayNameEn?: unknown;
  nationalityCountryCode?: unknown;
  residenceCountryCode?: unknown;
  registrationCountryCode?: unknown;
  legalEntityType?: unknown;
  registrationNumber?: unknown;
  websiteUrl?: unknown;
  privacy?: unknown;
};

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

function textValue(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function countryCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function website(value: unknown) {
  const candidate = textValue(value, 500);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

async function accountForIdentity(db: D1Database) {
  const user = await getChatGPTUser();
  if (!user) return null;
  const email = user.email.trim().toLowerCase();
  const account = await db
    .prepare("SELECT account_id FROM accounts WHERE email = ?1")
    .bind(email)
    .first<{ account_id: string }>();
  return account ? { ...account, email } : null;
}

export async function GET() {
  const db = await database();
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const account = await accountForIdentity(db);
  if (!account) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);

  const parties = await db
    .prepare(
      `SELECT p.party_id, p.party_type, p.display_name_ar, p.display_name_en,
              p.status, p.row_version, l.relationship_code, l.is_primary,
              pe.nationality_country_code, pe.residence_country_code,
              o.legal_entity_type, o.registration_number,
              o.registration_country_code, o.website_url
         FROM account_party_links l
         JOIN parties p ON p.party_id = l.party_id
         LEFT JOIN persons pe ON pe.party_id = p.party_id
         LEFT JOIN organizations o ON o.party_id = p.party_id
        WHERE l.account_id = ?1 AND l.status = 'ACTIVE'
        ORDER BY l.is_primary DESC, p.created_at`,
    )
    .bind(account.account_id)
    .all();

  const partyIds = parties.results.map((party) => String(party.party_id));
  const [privacy, memberships] = partyIds.length
    ? await Promise.all([
        db
        .prepare(
          `SELECT party_id, field_key, visibility, consent_granted
             FROM party_privacy_rules
            WHERE party_id IN (${partyIds.map(() => "?").join(",")})`,
        )
        .bind(...partyIds)
        .all(),
        db
          .prepare(
            `SELECT party_id, membership_code, lifecycle_status, is_active
               FROM party_memberships
              WHERE party_id IN (${partyIds.map(() => "?").join(",")})
              ORDER BY created_at`,
          )
          .bind(...partyIds)
          .all(),
      ])
    : [{ results: [] }, { results: [] }];

  return json({
    parties: parties.results,
    privacy: privacy.results,
    memberships: memberships.results,
  });
}

export async function PATCH(request: Request) {
  const db = await database();
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const account = await accountForIdentity(db);
  if (!account) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);
  let body: { partyId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  const partyId = textValue(body.partyId, 80);
  if (!partyId) return json({ error: "PARTY_ID_REQUIRED" }, 422);
  const access = await db
    .prepare(
      `SELECT relationship_code FROM account_party_links
        WHERE account_id = ?1 AND party_id = ?2 AND status = 'ACTIVE'`,
    )
    .bind(account.account_id, partyId)
    .first();
  if (!access) return json({ error: "PARTY_ACCESS_REQUIRED" }, 403);
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `UPDATE account_party_links
            SET is_primary = CASE WHEN party_id = ?2 THEN 1 ELSE 0 END,
                updated_at = ?3
          WHERE account_id = ?1 AND status = 'ACTIVE'`,
      )
      .bind(account.account_id, partyId, now),
    db
      .prepare(
        `INSERT INTO account_audit_events (
           event_id, account_id, event_type, actor_email, payload_json, occurred_at
         ) VALUES (?1, ?2, 'ACTIVE_PARTY_CHANGED', ?3, ?4, ?5)`,
      )
      .bind(
        crypto.randomUUID(),
        account.account_id,
        account.email,
        JSON.stringify({ partyId }),
        now,
      ),
  ]);
  return json({ partyId, active: true, changedAt: now });
}

export async function PUT(request: Request) {
  const db = await database();
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const account = await accountForIdentity(db);
  if (!account) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);

  let body: PartyInput;
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const partyType =
    typeof body.partyType === "string" && partyTypes.has(body.partyType)
      ? body.partyType
      : null;
  const displayNameAr = textValue(body.displayNameAr, 240);
  const displayNameEn = textValue(body.displayNameEn, 240);
  if (!partyType || !displayNameAr) {
    return json({ error: "PARTY_TYPE_AND_ARABIC_NAME_REQUIRED" }, 422);
  }

  const requestedPartyId = textValue(body.partyId, 80);
  const existing = requestedPartyId
    ? await db
        .prepare(
          `SELECT p.party_id, p.party_type
             FROM parties p
             JOIN account_party_links l ON l.party_id = p.party_id
            WHERE p.party_id = ?1 AND l.account_id = ?2 AND l.status = 'ACTIVE'`,
        )
        .bind(requestedPartyId, account.account_id)
        .first<{ party_id: string; party_type: string }>()
    : null;
  if (requestedPartyId && !existing) return json({ error: "PARTY_NOT_FOUND" }, 404);
  if (existing && existing.party_type !== partyType) {
    return json({ error: "PARTY_TYPE_IMMUTABLE" }, 409);
  }

  const legalEntityType = textValue(body.legalEntityType, 120);
  if (
    partyType === "ORGANIZATION" &&
    legalEntityType &&
    !legalEntityTypes.has(legalEntityType)
  ) {
    return json({ error: "INVALID_LEGAL_ENTITY_TYPE" }, 422);
  }

  const partyId = existing?.party_id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO parties (
           party_id, party_type, display_name_ar, display_name_en,
           status, row_version, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, 'ACTIVE', 1, ?5, ?5)
         ON CONFLICT(party_id) DO UPDATE SET
           display_name_ar = excluded.display_name_ar,
           display_name_en = excluded.display_name_en,
           row_version = parties.row_version + 1,
           updated_at = excluded.updated_at`,
      )
      .bind(partyId, partyType, displayNameAr, displayNameEn, now),
    db
      .prepare(
        `INSERT INTO account_party_links (
           account_party_link_id, account_id, party_id, relationship_code,
           is_primary, status, created_at, updated_at
         ) VALUES (?1, ?2, ?3, 'OWNER', 1, 'ACTIVE', ?4, ?4)
         ON CONFLICT(account_id, party_id) DO UPDATE SET
           status = 'ACTIVE', updated_at = excluded.updated_at`,
      )
      .bind(`${account.account_id}:${partyId}`, account.account_id, partyId, now),
    db
      .prepare(
        `UPDATE account_party_links
            SET is_primary = CASE WHEN party_id = ?2 THEN 1 ELSE 0 END,
                updated_at = ?3
          WHERE account_id = ?1`,
      )
      .bind(account.account_id, partyId, now),
  ];

  if (partyType === "PERSON") {
    statements.push(
      db
        .prepare(
          `INSERT INTO persons (
             party_id, full_name_ar, full_name_en,
             nationality_country_code, residence_country_code,
             created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
           ON CONFLICT(party_id) DO UPDATE SET
             full_name_ar = excluded.full_name_ar,
             full_name_en = excluded.full_name_en,
             nationality_country_code = excluded.nationality_country_code,
             residence_country_code = excluded.residence_country_code,
             updated_at = excluded.updated_at`,
        )
        .bind(
          partyId,
          displayNameAr,
          displayNameEn,
          countryCode(body.nationalityCountryCode),
          countryCode(body.residenceCountryCode),
          now,
        ),
    );
  } else {
    statements.push(
      db
        .prepare(
          `INSERT INTO organizations (
             party_id, legal_name_ar, legal_name_en, legal_entity_type,
             registration_number, registration_country_code, website_url,
             created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
           ON CONFLICT(party_id) DO UPDATE SET
             legal_name_ar = excluded.legal_name_ar,
             legal_name_en = excluded.legal_name_en,
             legal_entity_type = excluded.legal_entity_type,
             registration_number = excluded.registration_number,
             registration_country_code = excluded.registration_country_code,
             website_url = excluded.website_url,
             updated_at = excluded.updated_at`,
        )
        .bind(
          partyId,
          displayNameAr,
          displayNameEn,
          legalEntityType,
          textValue(body.registrationNumber, 100),
          countryCode(body.registrationCountryCode),
          website(body.websiteUrl),
          now,
        ),
    );
  }

  const privacy =
    body.privacy && typeof body.privacy === "object"
      ? (body.privacy as Record<string, unknown>)
      : {};
  for (const [fieldKey, rawVisibility] of Object.entries(privacy)) {
    if (!/^[a-z][a-z0-9_.-]{1,79}$/i.test(fieldKey)) continue;
    if (
      typeof rawVisibility !== "string" ||
      !visibilityLevels.has(rawVisibility)
    )
      continue;
    statements.push(
      db
        .prepare(
          `INSERT INTO party_privacy_rules (
             party_privacy_rule_id, party_id, field_key, visibility,
             consent_granted, updated_at
           ) VALUES (?1, ?2, ?3, ?4, 1, ?5)
           ON CONFLICT(party_id, field_key) DO UPDATE SET
             visibility = excluded.visibility,
             consent_granted = 1,
             updated_at = excluded.updated_at`,
        )
        .bind(`${partyId}:${fieldKey}`, partyId, fieldKey, rawVisibility, now),
    );
  }

  statements.push(
    db
      .prepare(
        `INSERT INTO party_contacts (
           party_contact_id, party_id, contact_type, contact_value,
           normalized_value, is_primary, is_verified, visibility,
           created_at, updated_at
         ) VALUES (?1, ?2, 'EMAIL', ?3, ?3, 1, 1, 'PRIVATE', ?4, ?4)
         ON CONFLICT(party_id, contact_type, normalized_value) DO UPDATE SET
           is_primary = 1, is_verified = 1, updated_at = excluded.updated_at`,
      )
      .bind(`${partyId}:EMAIL:${account.email}`, partyId, account.email, now),
    db
      .prepare(
        `INSERT OR IGNORE INTO party_membership_links (
           party_membership_link_id, party_id, account_membership_id,
           relationship_code, created_at
         )
         SELECT ?1 || ':' || membership_id, ?1, membership_id, 'OWNER', ?2
           FROM account_memberships
          WHERE account_id = ?3 AND is_active = 1`,
      )
      .bind(partyId, now, account.account_id),
    db
      .prepare(
        `INSERT OR IGNORE INTO party_memberships (
           party_membership_id, party_id, membership_code,
           lifecycle_status, is_active, created_at, updated_at
         )
         SELECT ?1 || ':' || membership_code, ?1, membership_code,
                status, 1, ?2, ?2
           FROM account_memberships
          WHERE account_id = ?3 AND is_active = 1`,
      )
      .bind(partyId, now, account.account_id),
    db
      .prepare(
        `INSERT INTO account_audit_events (
           event_id, account_id, event_type, actor_email, payload_json, occurred_at
         ) VALUES (?1, ?2, 'PARTY_PROFILE_SAVED', ?3, ?4, ?5)`,
      )
      .bind(
        crypto.randomUUID(),
        account.account_id,
        account.email,
        JSON.stringify({ partyId, partyType }),
        now,
      ),
  );

  await db.batch(statements);
  return json({ partyId, partyType, rowVersion: (existing ? 2 : 1), savedAt: now });
}
