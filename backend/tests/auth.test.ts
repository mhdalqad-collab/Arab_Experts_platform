import assert from "node:assert/strict";
import test from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { createOidcVerifier } from "../src/auth.js";

test("OIDC verifies signature issuer audience expiry and assurance claims", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "test-key";
  publicJwk.alg = "RS256";
  const verifier = createOidcVerifier({
    issuerUrl: "https://identity.test",
    jwksUrl: "https://identity.test/jwks",
    audience: "eim-api",
    providerCode: "TEST_OIDC",
  }, createLocalJWKSet({ keys: [publicJwk] }));
  const token = await new SignJWT({ email: "User@Example.COM", email_verified: true, acr: "urn:mfa", amr: ["pwd", "otp"] })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer("https://identity.test")
    .setAudience("eim-api")
    .setSubject("external-user-1")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  const identity = await verifier({ authorization: `Bearer ${token}` });
  assert.equal(identity.subject, "external-user-1");
  assert.equal(identity.email, "user@example.com");
  assert.equal(identity.emailVerified, true);
  assert.deepEqual(identity.authenticationMethods, ["pwd", "otp"]);
});

test("OIDC rejects missing and malformed bearer tokens", async () => {
  const { publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const verifier = createOidcVerifier({
    issuerUrl: "https://identity.test",
    jwksUrl: "https://identity.test/jwks",
    audience: "eim-api",
    providerCode: "TEST_OIDC",
  }, createLocalJWKSet({ keys: [publicJwk] }));
  await assert.rejects(() => verifier({}), (error: { code?: string }) => error.code === "AUTHENTICATION_REQUIRED");
  await assert.rejects(() => verifier({ authorization: "Basic abc" }), (error: { code?: string }) => error.code === "INVALID_AUTHORIZATION_HEADER");
});
