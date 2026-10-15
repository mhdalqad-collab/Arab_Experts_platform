import assert from "node:assert/strict";
import test from "node:test";
import { authorize, requireAnyRole } from "../src/authorization.js";
import type { Principal } from "../src/identity.js";

function principal(overrides: Partial<Principal> = {}): Principal {
  return {
    userAccountId: "10000000-0000-0000-0000-000000000001",
    partyId: "20000000-0000-0000-0000-000000000001",
    primaryEmail: "member@example.com",
    displayNameAr: "عضو",
    displayNameEn: "Member",
    roles: ["CLIENT_MEMBER"],
    permissions: ["client.request.manage"],
    organizationPartyIds: ["30000000-0000-0000-0000-000000000001"],
    authentication: { providerCode: "TEST", assuranceLevel: null, methods: ["pwd"] },
    ...overrides,
  };
}

test("authorization allows exact permission and organization scope", () => {
  assert.doesNotThrow(() => authorize(principal(), {
    permission: "client.request.manage",
    organizationPartyId: "30000000-0000-0000-0000-000000000001",
  }));
});

test("authorization denies missing permission, cross-organization access and weak authentication", () => {
  assert.throws(() => authorize(principal(), { permission: "finance.refund.approve" }), (error: { code?: string }) => error.code === "PERMISSION_REQUIRED");
  assert.throws(() => authorize(principal(), { permission: "client.request.manage", organizationPartyId: "40000000-0000-0000-0000-000000000001" }), (error: { code?: string }) => error.code === "ORGANIZATION_SCOPE_REQUIRED");
  assert.throws(() => authorize(principal(), { permission: "client.request.manage", stepUpRequired: true }), (error: { code?: string }) => error.code === "STEP_UP_REQUIRED");
  assert.doesNotThrow(() => authorize(principal({ authentication: { providerCode: "TEST", assuranceLevel: "urn:mfa", methods: ["otp"] } }), { permission: "client.request.manage", stepUpRequired: true }));
});

test("role guard accepts one allowed role and rejects unrelated roles", () => {
  assert.doesNotThrow(() => requireAnyRole(principal(), ["CLIENT_MEMBER", "PLATFORM_ADMIN"]));
  assert.throws(() => requireAnyRole(principal(), ["PLATFORM_ADMIN"]), (error: { code?: string }) => error.code === "ROLE_REQUIRED");
});
