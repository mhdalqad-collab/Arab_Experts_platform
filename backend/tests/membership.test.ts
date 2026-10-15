import assert from "node:assert/strict";
import test from "node:test";
import type { Database } from "../src/database.js";
import { createMembershipRepository, parseCreateApplication, parseDecision, parseReview, parseSaveStep } from "../src/membership.js";
import type { Principal } from "../src/identity.js";

const principal: Principal = {
  userAccountId: "10000000-0000-4000-8000-000000000001",
  partyId: "20000000-0000-4000-8000-000000000001",
  primaryEmail: "member@example.com", displayNameAr: "عضو", displayNameEn: "Member",
  roles: ["MEMBER_SELF"], permissions: ["membership.self.apply"], organizationPartyIds: [],
  authentication: { providerCode: "TEST", assuranceLevel: null, methods: ["pwd"] },
};

test("membership inputs enforce bounded codes, object payloads and optimistic versions", () => {
  assert.deepEqual(parseCreateApplication({ membershipTypeCode: "EXPERT" }), { membershipTypeCode: "EXPERT" });
  assert.deepEqual(parseSaveStep({ payload: { accepted: true }, complete: true, expectedRowVersion: 2 }), { payload: { accepted: true }, complete: true, expectedRowVersion: 2 });
  assert.throws(() => parseCreateApplication({ membershipTypeCode: "expert" }));
  assert.throws(() => parseSaveStep({ payload: [], complete: true, expectedRowVersion: 1 }));
  assert.throws(() => parseSaveStep({ payload: {}, complete: true, expectedRowVersion: 0 }));
});

test("review and approval require controlled codes and written reasons", () => {
  assert.deepEqual(parseReview({ recommendationCode: "APPROVE", comments: "Evidence verified" }), { recommendationCode: "APPROVE", comments: "Evidence verified" });
  assert.deepEqual(parseDecision({ decisionCode: "APPROVED", reasonCode: "ELIGIBLE", comment: "Independent approval" }), { decisionCode: "APPROVED", reasonCode: "ELIGIBLE", comment: "Independent approval" });
  assert.throws(() => parseReview({ recommendationCode: "APPROVE", comments: "" }));
  assert.throws(() => parseDecision({ decisionCode: "APPROVED", reasonCode: "", comment: "x" }));
});

test("self-service repository derives party scope exclusively from authenticated principal", async () => {
  const calls: unknown[][] = [];
  const database = {
    query: async (_text: string, values: readonly unknown[] = []) => {
      calls.push([...values]);
      return { rows: [{ membership_application_id: "30000000-0000-4000-8000-000000000001" }] };
    },
  } as unknown as Database;
  const repository = createMembershipRepository(database);
  await repository.create(principal, "EXPERT", "correlation-1");
  await repository.listOwn(principal);
  assert.deepEqual(calls[0], [principal.partyId, principal.userAccountId, "EXPERT", "correlation-1"]);
  assert.deepEqual(calls[1], [principal.partyId]);
});

test("database conflicts are mapped to stable HTTP errors", async () => {
  const database = { query: async () => { throw Object.assign(new Error("conflict"), { code: "40001" }); } } as unknown as Database;
  const repository = createMembershipRepository(database);
  await assert.rejects(
    repository.submit(principal, "30000000-0000-4000-8000-000000000001", 1, "correlation"),
    (error: { status?: number; code?: string }) => error.status === 409 && error.code === "ROW_VERSION_CONFLICT",
  );
});
