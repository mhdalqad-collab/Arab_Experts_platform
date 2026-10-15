import type { Database } from "./database.js";
import { AuthorizationError } from "./errors.js";
import type { VerifiedIdentity } from "./auth.js";

export type Principal = {
  userAccountId: string;
  partyId: string;
  primaryEmail: string;
  displayNameAr: string;
  displayNameEn: string | null;
  roles: string[];
  permissions: string[];
  organizationPartyIds: string[];
  authentication: {
    providerCode: string;
    assuranceLevel: string | null;
    methods: string[];
  };
};

type PrincipalRow = {
  user_account_id: string;
  party_id: string;
  primary_email: string;
  account_status: string;
  party_status: string;
  display_name_ar: string;
  display_name_en: string | null;
  roles: string[] | null;
  permissions: string[] | null;
  organization_party_ids: string[] | null;
};

export function createIdentityRepository(database: Database) {
  async function resolvePrincipal(identity: VerifiedIdentity): Promise<Principal> {
    const result = await database.query<PrincipalRow>(
      `SELECT
         a.user_account_id,
         a.party_id,
         a.primary_email::text,
         a.status_code AS account_status,
         p.status_code AS party_status,
         p.display_name_ar,
         p.display_name_en,
         COALESCE(array_agg(DISTINCT r.role_code) FILTER (WHERE r.role_code IS NOT NULL), ARRAY[]::varchar[]) AS roles,
         COALESCE(array_agg(DISTINCT permission.permission_code) FILTER (WHERE permission.permission_code IS NOT NULL), ARRAY[]::varchar[]) AS permissions,
         COALESCE(array_agg(DISTINCT ura.organization_party_id::text) FILTER (WHERE ura.organization_party_id IS NOT NULL), ARRAY[]::text[]) AS organization_party_ids
       FROM iam.account_credentials credential
       JOIN iam.user_accounts a ON a.user_account_id = credential.user_account_id
       JOIN core.parties p ON p.party_id = a.party_id
       LEFT JOIN governance.user_role_assignments ura
         ON ura.user_account_id = a.user_account_id
        AND ura.status_code = 'ACTIVE'
        AND ura.valid_from <= clock_timestamp()
        AND (ura.valid_to IS NULL OR ura.valid_to > clock_timestamp())
       LEFT JOIN governance.roles r ON r.role_id = ura.role_id AND r.status_code = 'ACTIVE'
       LEFT JOIN governance.role_permissions rp
         ON rp.role_id = r.role_id
        AND rp.valid_from <= clock_timestamp()
        AND (rp.valid_to IS NULL OR rp.valid_to > clock_timestamp())
       LEFT JOIN governance.permissions permission
         ON permission.permission_id = rp.permission_id AND permission.is_active
       WHERE credential.credential_type_code = 'EXTERNAL_IDP'
         AND credential.external_provider_code = $1
         AND credential.external_subject = $2
         AND credential.is_active
       GROUP BY a.user_account_id, p.party_id`,
      [identity.providerCode, identity.subject],
    );
    const row = result.rows[0];
    if (!row) throw new AuthorizationError("ACCOUNT_NOT_LINKED", "Identity is valid but not linked to an EIM account");
    if (row.account_status !== "ACTIVE" || row.party_status !== "ACTIVE") {
      throw new AuthorizationError("ACCOUNT_NOT_ACTIVE", "EIM account or party is not active");
    }
    return {
      userAccountId: row.user_account_id,
      partyId: row.party_id,
      primaryEmail: row.primary_email,
      displayNameAr: row.display_name_ar,
      displayNameEn: row.display_name_en,
      roles: row.roles ?? [],
      permissions: row.permissions ?? [],
      organizationPartyIds: row.organization_party_ids ?? [],
      authentication: {
        providerCode: identity.providerCode,
        assuranceLevel: identity.assuranceLevel,
        methods: identity.authenticationMethods,
      },
    };
  }
  return { resolvePrincipal };
}
