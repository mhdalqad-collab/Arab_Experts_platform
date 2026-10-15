import { AuthorizationError } from "./errors.js";
import type { Principal } from "./identity.js";

export type AuthorizationRequirement = {
  permission: string;
  organizationPartyId?: string;
  stepUpRequired?: boolean;
};

const strongAuthenticationMethods = new Set(["mfa", "otp", "totp", "hwk", "passkey", "webauthn"]);

function hasStepUp(principal: Principal) {
  if (principal.authentication.assuranceLevel?.toLowerCase().includes("mfa")) return true;
  return principal.authentication.methods.some((method) => strongAuthenticationMethods.has(method.toLowerCase()));
}

export function authorize(principal: Principal, requirement: AuthorizationRequirement) {
  if (!principal.permissions.includes(requirement.permission)) {
    throw new AuthorizationError("PERMISSION_REQUIRED", `Permission ${requirement.permission} is required`);
  }
  if (requirement.organizationPartyId && !principal.organizationPartyIds.includes(requirement.organizationPartyId)) {
    throw new AuthorizationError("ORGANIZATION_SCOPE_REQUIRED", "Permission is not valid for the requested organization");
  }
  if (requirement.stepUpRequired && !hasStepUp(principal)) {
    throw new AuthorizationError("STEP_UP_REQUIRED", "Strong authentication is required for this action");
  }
  return principal;
}

export function requireAnyRole(principal: Principal, roles: readonly string[]) {
  if (!roles.some((role) => principal.roles.includes(role))) {
    throw new AuthorizationError("ROLE_REQUIRED", "An allowed role is required");
  }
  return principal;
}
