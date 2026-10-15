import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

test("configuration requires PostgreSQL and applies bounded defaults", () => {
  assert.throws(() => loadConfig({}), /DATABASE_URL/);
  const config = loadConfig({ DATABASE_URL: "postgresql://localhost/eim" });
  assert.equal(config.port, 8788);
  assert.equal(config.databasePoolMax, 10);
  assert.equal(config.databaseSsl, false);
});

test("configuration rejects unsafe numeric bounds", () => {
  assert.throws(() => loadConfig({ DATABASE_URL: "postgresql://localhost/eim", DATABASE_POOL_MAX: "0" }), /between/);
});

test("staging and production fail closed without complete OIDC configuration", () => {
  assert.throws(() => loadConfig({ DATABASE_URL: "postgresql://localhost/eim", APP_ENV: "production" }), /OIDC/);
  assert.throws(() => loadConfig({ DATABASE_URL: "postgresql://localhost/eim", IDENTITY_ISSUER_URL: "https://issuer.test" }), /configured together/);
});
