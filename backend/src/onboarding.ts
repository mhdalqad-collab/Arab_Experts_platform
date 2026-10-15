import type { Database } from "./database.js";
import { HttpError } from "./errors.js";
import type { VerifiedIdentity } from "./auth.js";

export type RegistrationInput = {
  firstNameAr: string;
  lastNameAr: string;
  displayNameAr: string;
  displayNameEn?: string | null;
};

type RegistrationRow = { user_account_id: string; party_id: string };

function text(value: unknown, field: string, maximum: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new HttpError(422, "VALIDATION_FAILED", `${field} is required and must not exceed ${maximum} characters`);
  }
  return value.trim();
}

export function parseRegistrationInput(value: unknown): RegistrationInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(422, "VALIDATION_FAILED", "Registration body must be an object");
  }
  const body = value as Record<string, unknown>;
  const displayNameEn = body.displayNameEn;
  if (displayNameEn !== undefined && displayNameEn !== null && (typeof displayNameEn !== "string" || displayNameEn.trim().length > 240)) {
    throw new HttpError(422, "VALIDATION_FAILED", "displayNameEn must not exceed 240 characters");
  }
  return {
    firstNameAr: text(body.firstNameAr, "firstNameAr", 100),
    lastNameAr: text(body.lastNameAr, "lastNameAr", 100),
    displayNameAr: text(body.displayNameAr, "displayNameAr", 240),
    displayNameEn: typeof displayNameEn === "string" ? displayNameEn.trim() || null : null,
  };
}

export function createOnboardingRepository(database: Database) {
  async function register(identity: VerifiedIdentity, input: RegistrationInput, correlationId: string) {
    if (!identity.email || !identity.emailVerified) {
      throw new HttpError(403, "VERIFIED_EMAIL_REQUIRED", "OIDC provider must supply a verified email");
    }
    try {
      const result = await database.query<RegistrationRow>(
        `SELECT user_account_id, party_id
         FROM iam.register_external_person($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          identity.providerCode, identity.subject, identity.email, identity.emailVerified,
          input.firstNameAr, input.lastNameAr, input.displayNameAr,
          input.displayNameEn ?? null, correlationId,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Registration function returned no account");
      return { userAccountId: row.user_account_id, partyId: row.party_id, status: "ACTIVE" };
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (code === "23505") throw new HttpError(409, "IDENTITY_OR_EMAIL_ALREADY_REGISTERED", "Identity or email is already registered");
      if (code === "22023") throw new HttpError(422, "VALIDATION_FAILED", "Registration data failed database validation");
      if (code === "42501") throw new HttpError(403, "VERIFIED_EMAIL_REQUIRED", "Verified email is required");
      throw error;
    }
  }
  return { register };
}
