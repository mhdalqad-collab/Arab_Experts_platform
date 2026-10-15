import type { IncomingHttpHeaders } from "node:http";
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
  type JWTPayload,
} from "jose";
import type { BackendConfig } from "./config.js";
import { AuthenticationError } from "./errors.js";

export type VerifiedIdentity = {
  providerCode: string;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  assuranceLevel: string | null;
  authenticationMethods: string[];
  issuedAt: number | null;
};

export type IdentityVerifier = (headers: IncomingHttpHeaders) => Promise<VerifiedIdentity>;

function bearer(headers: IncomingHttpHeaders) {
  const authorization = headers.authorization;
  if (typeof authorization !== "string") throw new AuthenticationError();
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match?.[1]) throw new AuthenticationError("INVALID_AUTHORIZATION_HEADER", "Authorization must use one Bearer token");
  return match[1];
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" ? value.split(" ").filter(Boolean) : [];
}

function toIdentity(payload: JWTPayload, providerCode: string): VerifiedIdentity {
  if (!payload.sub) throw new AuthenticationError("TOKEN_SUBJECT_REQUIRED", "Token subject is required");
  return {
    providerCode,
    subject: payload.sub,
    email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
    emailVerified: payload.email_verified === true,
    assuranceLevel: typeof payload.acr === "string" ? payload.acr : null,
    authenticationMethods: stringArray(payload.amr),
    issuedAt: typeof payload.iat === "number" ? payload.iat : null,
  };
}

export function createOidcVerifier(
  identity: NonNullable<BackendConfig["identity"]>,
  keyResolver: JWTVerifyGetKey = createRemoteJWKSet(new URL(identity.jwksUrl), {
    cooldownDuration: 30000,
    timeoutDuration: 5000,
  }),
): IdentityVerifier {
  return async (headers) => {
    try {
      const { payload } = await jwtVerify(bearer(headers), keyResolver, {
        issuer: identity.issuerUrl,
        audience: identity.audience,
        algorithms: ["RS256", "ES256", "EdDSA"],
        clockTolerance: 5,
      });
      return toIdentity(payload, identity.providerCode);
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError("INVALID_ACCESS_TOKEN", "Access token verification failed");
    }
  };
}

export function unavailableIdentityVerifier(): IdentityVerifier {
  return async () => {
    throw new AuthenticationError("IDENTITY_PROVIDER_NOT_CONFIGURED", "OIDC identity provider is not configured");
  };
}
