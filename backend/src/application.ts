import { loadConfig } from "./config.js";
import { createDatabase } from "./database.js";
import { createRequestHandler } from "./http.js";
import { createOidcVerifier, unavailableIdentityVerifier } from "./auth.js";
import { createIdentityRepository } from "./identity.js";
import { createOnboardingRepository } from "./onboarding.js";
import { createMembershipRepository } from "./membership.js";
import { createFileRepository } from "./files.js";
import { createEvidenceRepository } from "./evidence.js";
import { createPrivacyRepository } from "./privacy.js";
import { createSearchRepository } from "./search.js";
import { createProfessionalRepository } from "./professional.js";
import { createExperienceRepository } from "./experiences.js";
import { createProjectConsultingRepository } from "./project-consulting.js";
import { createTrainingResearchRepository } from "./training-research.js";
import { createEvidenceLinkRepository } from "./evidence-links.js";
import { createEvidenceStrengthRepository } from "./evidence-strength.js";
import { createFingerprintStrengthRepository } from "./fingerprint-strength.js";
import { createNotificationRepository } from "./notifications.js";


export function createBackendApplication(config = loadConfig()) {
  const version = "0.1.0";
  const database = createDatabase(config);
  const identityRepository = createIdentityRepository(database);
  const onboardingRepository = createOnboardingRepository(database);
  const membershipRepository = createMembershipRepository(database);
  const fileRepository = createFileRepository(database, config.objectStorage);
  const evidenceRepository = createEvidenceRepository(database);
  const privacyRepository = createPrivacyRepository(database);
  const searchRepository = createSearchRepository(database);
  const professionalRepository = createProfessionalRepository(database);
  const experienceRepository = createExperienceRepository(database);
  const projectConsultingRepository = createProjectConsultingRepository(database);
  const trainingResearchRepository = createTrainingResearchRepository(database);
  const evidenceLinkRepository = createEvidenceLinkRepository(database);
  const evidenceStrengthRepository = createEvidenceStrengthRepository(database);
  const fingerprintStrengthRepository = createFingerprintStrengthRepository(database);
  const notificationRepository = createNotificationRepository(database);
  const authenticate = config.identity ? createOidcVerifier(config.identity) : unavailableIdentityVerifier();
  const handler = createRequestHandler({
    version,
    environment: config.environment,
    readiness: database.readiness,
    authenticate,
    resolvePrincipal: identityRepository.resolvePrincipal,
    registerIdentity: onboardingRepository.register,
    membership: membershipRepository,
    files: fileRepository,
    evidence: evidenceRepository,
    privacy: privacyRepository,
    search: searchRepository,
    professional: professionalRepository,
    experiences: experienceRepository,
    projectConsulting: projectConsultingRepository,
    trainingResearch: trainingResearchRepository,
    evidenceLinks: evidenceLinkRepository,
    evidenceStrength: evidenceStrengthRepository,
    fingerprintStrength: fingerprintStrengthRepository,
    notifications: notificationRepository,
    internalTokens: config.internalTokens,
  });
  return {handler, readiness: database.readiness, close: database.close};
}
