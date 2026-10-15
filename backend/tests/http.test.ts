import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createRequestHandler } from "../src/http.js";

async function withServer(readiness: () => Promise<Record<string, unknown>>, work: (baseUrl: string) => Promise<void>) {
  const server = createServer(createRequestHandler({ version: "test", environment: "test", readiness }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  try {
    await work(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("liveness and metadata expose stable envelopes and correlation", async () => {
  await withServer(async () => ({ database: "eim" }), async (baseUrl) => {
    const live = await fetch(`${baseUrl}/health/live`, { headers: { "x-correlation-id": "test-correlation" } });
    assert.equal(live.status, 200);
    assert.equal(live.headers.get("x-correlation-id"), "test-correlation");
    assert.equal(live.headers.get("x-content-type-options"), "nosniff");
    const meta = await fetch(`${baseUrl}/v1/meta`);
    assert.equal((await meta.json() as { data: { systemOfRecord: string } }).data.systemOfRecord, "PostgreSQL 16");
  });
});

test("readiness fails closed and unknown routes are normalized", async () => {
  await withServer(async () => { throw new Error("database unavailable"); }, async (baseUrl) => {
    const ready = await fetch(`${baseUrl}/health/ready`);
    assert.equal(ready.status, 503);
    assert.equal((await ready.json() as { error: string }).error, "SERVICE_UNAVAILABLE");
    const missing = await fetch(`${baseUrl}/unknown`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json() as { error: string }).error, "NOT_FOUND");
  });
});

test("current principal endpoint requires authentication and returns server-resolved authorization", async () => {
  const server = createServer(createRequestHandler({
    version: "test",
    environment: "test",
    readiness: async () => ({ database: "eim" }),
    authenticate: async (headers) => {
      if (!headers.authorization) throw new (await import("../src/errors.js")).AuthenticationError();
      return { providerCode: "TEST", subject: "subject-1", email: null, emailVerified: false, assuranceLevel: "mfa", authenticationMethods: ["otp"], issuedAt: null };
    },
    resolvePrincipal: async () => ({
      userAccountId: "10000000-0000-0000-0000-000000000001",
      partyId: "20000000-0000-0000-0000-000000000001",
      primaryEmail: "member@example.com",
      displayNameAr: "عضو اختبار",
      displayNameEn: "Test member",
      roles: ["MEMBER_SELF"],
      permissions: ["account.self.manage"],
      organizationPartyIds: [],
      authentication: { providerCode: "TEST", assuranceLevel: "mfa", methods: ["otp"] },
    }),
  }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(`${baseUrl}/v1/me`)).status, 401);
    const response = await fetch(`${baseUrl}/v1/me`, { headers: { authorization: "Bearer test" } });
    assert.equal(response.status, 200);
    const body = await response.json() as { data: { roles: string[]; permissions: string[] } };
    assert.deepEqual(body.data.roles, ["MEMBER_SELF"]);
    assert.deepEqual(body.data.permissions, ["account.self.manage"]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("registration requires JSON, validates names and uses verified server identity", async () => {
  let capturedSubject = "";
  const server = createServer(createRequestHandler({
    version: "test",
    environment: "test",
    readiness: async () => ({}),
    authenticate: async () => ({ providerCode: "TEST", subject: "subject-verified", email: "new@example.com", emailVerified: true, assuranceLevel: null, authenticationMethods: ["pwd"], issuedAt: null }),
    registerIdentity: async (identity) => {
      capturedSubject = identity.subject;
      return { userAccountId: "10000000-0000-0000-0000-000000000001", partyId: "20000000-0000-0000-0000-000000000001", status: "ACTIVE" };
    },
  }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/v1/identity/register`;
  try {
    assert.equal((await fetch(url, { method: "POST", body: "{}" })).status, 415);
    const invalid = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(invalid.status, 422);
    const valid = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer test" },
      body: JSON.stringify({ firstNameAr: "أحمد", lastNameAr: "علي", displayNameAr: "أحمد علي" }),
    });
    assert.equal(valid.status, 201);
    assert.equal(capturedSubject, "subject-verified");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
