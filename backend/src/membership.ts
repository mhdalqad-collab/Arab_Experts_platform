import type { Database } from "./database.js";
import { HttpError } from "./errors.js";
import type { Principal } from "./identity.js";

export type SaveMembershipStepInput = {
  payload: Record<string, unknown>;
  complete: boolean;
  expectedRowVersion: number;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateApplicationId(value: string) {
  if (!uuidPattern.test(value)) throw new HttpError(404, "APPLICATION_NOT_FOUND", "Application not found");
  return value;
}

export function parseCreateApplication(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(422, "VALIDATION_FAILED", "Body must be an object");
  const code = (value as Record<string, unknown>).membershipTypeCode;
  if (typeof code !== "string" || !/^[A-Z][A-Z0-9_]{1,39}$/.test(code)) throw new HttpError(422, "VALIDATION_FAILED", "membershipTypeCode is invalid");
  return { membershipTypeCode: code };
}

export function parseSaveStep(value: unknown): SaveMembershipStepInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(422, "VALIDATION_FAILED", "Body must be an object");
  const body = value as Record<string, unknown>;
  if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) throw new HttpError(422, "VALIDATION_FAILED", "payload must be an object");
  if (typeof body.complete !== "boolean") throw new HttpError(422, "VALIDATION_FAILED", "complete must be boolean");
  if (!Number.isSafeInteger(body.expectedRowVersion) || Number(body.expectedRowVersion) < 1) throw new HttpError(422, "VALIDATION_FAILED", "expectedRowVersion must be a positive integer");
  return { payload: body.payload as Record<string, unknown>, complete: body.complete, expectedRowVersion: Number(body.expectedRowVersion) };
}

export function parseSubmitApplication(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(422, "VALIDATION_FAILED", "Body must be an object");
  const version = (value as Record<string, unknown>).expectedRowVersion;
  if (!Number.isSafeInteger(version) || Number(version) < 1) throw new HttpError(422, "VALIDATION_FAILED", "expectedRowVersion must be a positive integer");
  return { expectedRowVersion: Number(version) };
}

function requiredDecisionText(value: unknown, field: string, maximum: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) throw new HttpError(422, "VALIDATION_FAILED", `${field} is required`);
  return value.trim();
}

export function parseReview(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(422, "VALIDATION_FAILED", "Body must be an object");
  const body = value as Record<string, unknown>;
  const recommendationCode = requiredDecisionText(body.recommendationCode, "recommendationCode", 30).toUpperCase();
  if (!(["APPROVE", "REJECT", "MORE_INFO_REQUIRED"] as string[]).includes(recommendationCode)) throw new HttpError(422, "VALIDATION_FAILED", "recommendationCode is invalid");
  return { recommendationCode, comments: requiredDecisionText(body.comments, "comments", 2000) };
}

export function parseDecision(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(422, "VALIDATION_FAILED", "Body must be an object");
  const body = value as Record<string, unknown>;
  const decisionCode = requiredDecisionText(body.decisionCode, "decisionCode", 30).toUpperCase();
  if (!(["APPROVED", "REJECTED"] as string[]).includes(decisionCode)) throw new HttpError(422, "VALIDATION_FAILED", "decisionCode is invalid");
  return { decisionCode, reasonCode: requiredDecisionText(body.reasonCode, "reasonCode", 50).toUpperCase(), comment: requiredDecisionText(body.comment, "comment", 2000) };
}

function translateDatabaseError(error: unknown): never {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (code === "P0002") throw new HttpError(404, "APPLICATION_NOT_FOUND", "Application not found");
  if (code === "23505") throw new HttpError(409, "OPEN_APPLICATION_EXISTS", "An open application already exists");
  if (code === "40001") throw new HttpError(409, "ROW_VERSION_CONFLICT", "Application was modified by another request");
  if (code === "22023") throw new HttpError(422, "VALIDATION_FAILED", "Membership data failed validation");
  if (code === "55000") throw new HttpError(409, "INVALID_APPLICATION_STATE", "Application cannot perform this transition");
  if (code === "42501") throw new HttpError(403, "SEPARATION_OF_DUTIES_REQUIRED", "The actor cannot perform this review or decision");
  throw error;
}

export function createMembershipRepository(database: Database) {
  async function listTypes() {
    const result = await database.query(
      `SELECT membership_type_code AS "membershipTypeCode", name_ar AS "nameAr",
              name_en AS "nameEn", requires_review AS "requiresReview",
              requires_paid_subscription AS "requiresPaidSubscription"
       FROM membership.membership_types
       WHERE is_active AND is_publicly_selectable ORDER BY display_order`,
    );
    return result.rows;
  }

  async function listOwn(principal: Principal) {
    const result = await database.query(
      `SELECT a.membership_application_id AS "membershipApplicationId",
              a.application_no AS "applicationNo", t.membership_type_code AS "membershipTypeCode",
              t.name_ar AS "membershipTypeNameAr", t.name_en AS "membershipTypeNameEn",
              a.status_code AS "statusCode", a.completeness_percentage::float8 AS "completenessPercentage",
              a.row_version::float8 AS "rowVersion", a.submitted_at AS "submittedAt",
              a.created_at AS "createdAt",
              COALESCE(jsonb_agg(jsonb_build_object('stepCode', s.step_code, 'stepOrder', s.step_order,
                'statusCode', s.status_code, 'completenessPercentage', s.completeness_percentage,
                'payload', s.draft_payload) ORDER BY s.step_order) FILTER (WHERE s.membership_application_step_id IS NOT NULL), '[]'::jsonb) AS steps
       FROM membership.membership_applications a
       JOIN membership.membership_types t ON t.membership_type_id = a.membership_type_id
       LEFT JOIN membership.membership_application_steps s ON s.membership_application_id = a.membership_application_id
       WHERE a.party_id = $1
       GROUP BY a.membership_application_id, t.membership_type_id
       ORDER BY a.created_at DESC`,
      [principal.partyId],
    );
    return result.rows;
  }

  async function create(principal: Principal, membershipTypeCode: string, correlationId: string) {
    try {
      const result = await database.query<{ membership_application_id: string }>(
        `SELECT membership.create_self_application($1,$2,$3,$4) AS membership_application_id`,
        [principal.partyId, principal.userAccountId, membershipTypeCode, correlationId],
      );
      return { membershipApplicationId: result.rows[0]?.membership_application_id };
    } catch (error) { return translateDatabaseError(error); }
  }

  async function saveStep(principal: Principal, applicationId: string, stepCode: string, input: SaveMembershipStepInput, correlationId: string) {
    if (!/^[A-Z][A-Z0-9_]{1,59}$/.test(stepCode)) throw new HttpError(422, "VALIDATION_FAILED", "stepCode is invalid");
    try {
      const result = await database.query<{ row_version: string }>(
        `SELECT membership.save_self_application_step($1,$2,$3,$4,$5::jsonb,$6,$7,$8) AS row_version`,
        [applicationId, principal.partyId, principal.userAccountId, stepCode, JSON.stringify(input.payload), input.complete, input.expectedRowVersion, correlationId],
      );
      return { membershipApplicationId: applicationId, rowVersion: Number(result.rows[0]?.row_version) };
    } catch (error) { return translateDatabaseError(error); }
  }

  async function submit(principal: Principal, applicationId: string, expectedRowVersion: number, correlationId: string) {
    try {
      const result = await database.query<{ row_version: string }>(
        `SELECT membership.submit_self_application($1,$2,$3,$4,$5) AS row_version`,
        [applicationId, principal.partyId, principal.userAccountId, expectedRowVersion, correlationId],
      );
      return { membershipApplicationId: applicationId, statusCode: "SUBMITTED", rowVersion: Number(result.rows[0]?.row_version) };
    } catch (error) { return translateDatabaseError(error); }
  }

  async function reviewQueue() {
    const result = await database.query(
      `SELECT a.membership_application_id AS "membershipApplicationId", a.application_no AS "applicationNo",
              a.status_code AS "statusCode", a.submitted_at AS "submittedAt", a.row_version::float8 AS "rowVersion",
              t.membership_type_code AS "membershipTypeCode", p.display_name_ar AS "applicantNameAr",
              r.membership_review_id AS "activeReviewId", r.reviewer_party_id AS "reviewerPartyId"
       FROM membership.membership_applications a
       JOIN membership.membership_types t ON t.membership_type_id=a.membership_type_id
       JOIN core.parties p ON p.party_id=a.party_id
       LEFT JOIN membership.membership_reviews r ON r.membership_application_id=a.membership_application_id AND r.status_code IN ('ASSIGNED','IN_PROGRESS')
       WHERE a.status_code IN ('SUBMITTED','UNDER_REVIEW') ORDER BY a.submitted_at`,
    );
    return result.rows;
  }

  async function claimReview(principal: Principal, applicationId: string, correlationId: string) {
    try {
      const result = await database.query<{ review_id: string }>(`SELECT membership.claim_application_review($1,$2,$3,$4) AS review_id`, [applicationId, principal.partyId, principal.userAccountId, correlationId]);
      return { membershipApplicationId: applicationId, reviewId: result.rows[0]?.review_id, statusCode: "UNDER_REVIEW" };
    } catch (error) { return translateDatabaseError(error); }
  }

  async function completeReview(principal: Principal, applicationId: string, input: ReturnType<typeof parseReview>, correlationId: string) {
    try {
      const result = await database.query<{ review_id: string }>(`SELECT membership.complete_application_review($1,$2,$3,$4,$5,$6) AS review_id`, [applicationId, principal.partyId, principal.userAccountId, input.recommendationCode, input.comments, correlationId]);
      return { membershipApplicationId: applicationId, reviewId: result.rows[0]?.review_id, recommendationCode: input.recommendationCode };
    } catch (error) { return translateDatabaseError(error); }
  }

  async function decide(principal: Principal, applicationId: string, input: ReturnType<typeof parseDecision>, correlationId: string) {
    try {
      const result = await database.query<{ status_code: string; membership_id: string | null }>(`SELECT status_code, membership_id FROM membership.decide_application($1,$2,$3,$4,$5,$6,$7)`, [applicationId, principal.partyId, principal.userAccountId, input.decisionCode, input.reasonCode, input.comment, correlationId]);
      return { membershipApplicationId: applicationId, statusCode: result.rows[0]?.status_code, membershipId: result.rows[0]?.membership_id };
    } catch (error) { return translateDatabaseError(error); }
  }
  return { listTypes, listOwn, create, saveStep, submit, reviewQueue, claimReview, completeReview, decide };
}
