import { randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { IdentityVerifier } from "./auth.js";
import type { Principal } from "./identity.js";
import { HttpError } from "./errors.js";
import { parseRegistrationInput, type RegistrationInput } from "./onboarding.js";
import { authorize } from "./authorization.js";
import { parseCreateApplication, parseDecision, parseReview, parseSaveStep, parseSubmitApplication, validateApplicationId, type createMembershipRepository } from "./membership.js";
import { parseAccessGrant, parseDownloadConsume, parseEvidenceInput, parseFileIntent, parseReviewDocumentAccess, parseScanResult, parseUploadCompletion, type createFileRepository } from "./files.js";
import { createEvidenceRepository, evidenceId, parseCheck, parseVerificationDecision } from "./evidence.js";
import { createPrivacyRepository, parsePrivacyPreference, parseRevocation, privacyResourceId } from "./privacy.js";
import { createSearchRepository, parsePublicSearch } from "./search.js";
import { createProfessionalRepository, parseFingerprint, parseProfile, parsePublicationAmendment, parsePublicationAmendmentDecision, parsePublicationDecision, parsePublicationFinding, parsePublicationFindingResolution, parsePublicationFindingResponse, parsePublicationLifecycle, parsePublicationReview, parsePublicationSubmit, professionalId, publicationFindingId, publicationRequestId } from "./professional.js";
import { createExperienceRepository, parseEmployment, parseQualification, recordId } from "./experiences.js";
import { createProjectConsultingRepository, parseConsulting, parseProject } from "./project-consulting.js";
import { createTrainingResearchRepository, parseResearch, parseTraining } from "./training-research.js";
import { createEvidenceLinkRepository, parseEvidenceLink } from "./evidence-links.js";
import { createEvidenceStrengthRepository, parseStrengthTarget } from "./evidence-strength.js";
import { createFingerprintStrengthRepository, parseFingerprintStrength } from "./fingerprint-strength.js";
import { createNotificationRepository, notificationId, parseDeadLetterResolution, parseDeliveryIncidentResolution, parseNotificationClaim, parseNotificationResult } from "./notifications.js";

export type ReadinessProbe = () => Promise<Record<string, unknown>>;

type HandlerDependencies = {
  version: string;
  environment: string;
  readiness: ReadinessProbe;
  authenticate?: IdentityVerifier;
  resolvePrincipal?: (identity: Awaited<ReturnType<IdentityVerifier>>) => Promise<Principal>;
  registerIdentity?: (identity: Awaited<ReturnType<IdentityVerifier>>, input: RegistrationInput, correlationId: string) => Promise<Record<string, unknown>>;
  membership?: ReturnType<typeof createMembershipRepository>;
  files?: ReturnType<typeof createFileRepository>;
  evidence?: ReturnType<typeof createEvidenceRepository>;
  privacy?: ReturnType<typeof createPrivacyRepository>;
  search?: ReturnType<typeof createSearchRepository>;
  professional?: ReturnType<typeof createProfessionalRepository>;
  experiences?: ReturnType<typeof createExperienceRepository>;
  projectConsulting?: ReturnType<typeof createProjectConsultingRepository>;
  trainingResearch?: ReturnType<typeof createTrainingResearchRepository>;
  evidenceLinks?: ReturnType<typeof createEvidenceLinkRepository>;
  evidenceStrength?: ReturnType<typeof createEvidenceStrengthRepository>;
  fingerprintStrength?: ReturnType<typeof createFingerprintStrengthRepository>;
  notifications?: ReturnType<typeof createNotificationRepository>;
  internalTokens?: { storageCallback: string | null; malwareScanner: string | null; notificationDispatcher?: string | null };
};

function requireInternalToken(supplied: string | string[] | undefined, expected: string | null | undefined) {
  if (!expected || expected.length < 32 || typeof supplied !== "string") throw new HttpError(401, "INTERNAL_AUTHENTICATION_REQUIRED", "Valid internal service authentication is required");
  const a=Buffer.from(supplied),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))throw new HttpError(401,"INTERNAL_AUTHENTICATION_REQUIRED","Valid internal service authentication is required");
}

async function readJson(request: IncomingMessage, maximumBytes = 16384) {
  if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "JSON_CONTENT_TYPE_REQUIRED", "Content-Type must be application/json");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maximumBytes) throw new HttpError(413, "REQUEST_TOO_LARGE", "Request body is too large");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must contain valid JSON");
  }
}

function correlationId(request: IncomingMessage) {
  const supplied = request.headers["x-correlation-id"];
  if (typeof supplied === "string" && /^[A-Za-z0-9._:-]{1,120}$/.test(supplied)) return supplied;
  return randomUUID();
}

function send(response: ServerResponse, status: number, correlation: string, body: unknown) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "x-correlation-id": correlation,
  });
  response.end(payload);
}

export function createRequestHandler(dependencies: HandlerDependencies) {
  return async function handle(request: IncomingMessage, response: ServerResponse) {
    const correlation = correlationId(request);
    const url = new URL(request.url || "/", "http://localhost");
    try {
      const principalForRequest = async () => {
        if (!dependencies.authenticate || !dependencies.resolvePrincipal) throw new HttpError(503, "IDENTITY_SERVICE_UNAVAILABLE", "Identity service is unavailable");
        return dependencies.resolvePrincipal(await dependencies.authenticate(request.headers));
      };
      if (request.method === "GET" && url.pathname === "/health/live") {
        send(response, 200, correlation, { status: "ok", service: "eim-backend", version: dependencies.version });
        return;
      }
      if (request.method === "GET" && url.pathname === "/health/ready") {
        const database = await dependencies.readiness();
        send(response, 200, correlation, { status: "ready", database });
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/meta") {
        send(response, 200, correlation, {
          data: { service: "eim-backend", version: dependencies.version, environment: dependencies.environment, systemOfRecord: "PostgreSQL 16" },
          meta: { correlationId: correlation },
        });
        return;
      }
      const publicParty=url.pathname.match(/^\/v1\/public\/parties\/([^/]+)$/);
      if(request.method==="GET"&&publicParty){if(!dependencies.privacy)throw new HttpError(503,"PRIVACY_SERVICE_UNAVAILABLE","Privacy service is unavailable");const id=privacyResourceId(publicParty[1]??"");send(response,200,correlation,{data:await dependencies.privacy.publicParty(id),meta:{correlationId:correlation}});return;}
      if(request.method==="GET"&&url.pathname==="/v1/public/professionals"){if(!dependencies.search)throw new HttpError(503,"SEARCH_SERVICE_UNAVAILABLE","Search service is unavailable");send(response,200,correlation,{data:await dependencies.search.publicProfessionals(parsePublicSearch(url.searchParams)),meta:{correlationId:correlation}});return;}
      if (request.method === "GET" && url.pathname === "/v1/me") {
        const principal = await principalForRequest();
        send(response, 200, correlation, { data: principal, meta: { correlationId: correlation } });
        return;
      }
      if(request.method==="GET"&&url.pathname==="/v1/professional-profile"){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.professional.own(principal),meta:{correlationId:correlation}});return;}
      if(request.method==="GET"&&url.pathname==="/v1/professional-experiences"){if(!dependencies.experiences)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.experiences.list(principal),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&url.pathname==="/v1/professional-experiences/qualifications"){if(!dependencies.experiences)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,201,correlation,{data:await dependencies.experiences.saveQualification(principal,null,parseQualification(await readJson(request))),meta:{correlationId:correlation}});return;}
      const qualification=url.pathname.match(/^\/v1\/professional-experiences\/qualifications\/([^/]+)$/);
      if(request.method==="PUT"&&qualification){if(!dependencies.experiences)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.experiences.saveQualification(principal,recordId(qualification[1]??""),parseQualification(await readJson(request))),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&url.pathname==="/v1/professional-experiences/employments"){if(!dependencies.experiences)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,201,correlation,{data:await dependencies.experiences.saveEmployment(principal,null,parseEmployment(await readJson(request))),meta:{correlationId:correlation}});return;}
      const employment=url.pathname.match(/^\/v1\/professional-experiences\/employments\/([^/]+)$/);
      if(request.method==="PUT"&&employment){if(!dependencies.experiences)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.experiences.saveEmployment(principal,recordId(employment[1]??""),parseEmployment(await readJson(request))),meta:{correlationId:correlation}});return;}
      if(request.method==="GET"&&url.pathname==="/v1/professional-experiences/projects-consulting"){if(!dependencies.projectConsulting)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.projectConsulting.list(principal),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&url.pathname==="/v1/professional-experiences/projects"){if(!dependencies.projectConsulting)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,201,correlation,{data:await dependencies.projectConsulting.saveProject(principal,null,parseProject(await readJson(request))),meta:{correlationId:correlation}});return;}
      const projectExperience=url.pathname.match(/^\/v1\/professional-experiences\/projects\/([^/]+)$/);
      if(request.method==="PUT"&&projectExperience){if(!dependencies.projectConsulting)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.projectConsulting.saveProject(principal,recordId(projectExperience[1]??""),parseProject(await readJson(request))),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&url.pathname==="/v1/professional-experiences/consulting"){if(!dependencies.projectConsulting)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,201,correlation,{data:await dependencies.projectConsulting.saveConsulting(principal,null,parseConsulting(await readJson(request))),meta:{correlationId:correlation}});return;}
      const consultingExperience=url.pathname.match(/^\/v1\/professional-experiences\/consulting\/([^/]+)$/);
      if(request.method==="PUT"&&consultingExperience){if(!dependencies.projectConsulting)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.projectConsulting.saveConsulting(principal,recordId(consultingExperience[1]??""),parseConsulting(await readJson(request))),meta:{correlationId:correlation}});return;}
      if(request.method==="GET"&&url.pathname==="/v1/professional-experiences/training-research"){if(!dependencies.trainingResearch)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.trainingResearch.list(principal),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&url.pathname==="/v1/professional-experiences/training"){if(!dependencies.trainingResearch)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,201,correlation,{data:await dependencies.trainingResearch.saveTraining(principal,null,parseTraining(await readJson(request))),meta:{correlationId:correlation}});return;}
      const trainingExperience=url.pathname.match(/^\/v1\/professional-experiences\/training\/([^/]+)$/);
      if(request.method==="PUT"&&trainingExperience){if(!dependencies.trainingResearch)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.trainingResearch.saveTraining(principal,recordId(trainingExperience[1]??""),parseTraining(await readJson(request))),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&url.pathname==="/v1/professional-experiences/research"){if(!dependencies.trainingResearch)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,201,correlation,{data:await dependencies.trainingResearch.saveResearch(principal,null,parseResearch(await readJson(request))),meta:{correlationId:correlation}});return;}
      const researchExperience=url.pathname.match(/^\/v1\/professional-experiences\/research\/([^/]+)$/);
      if(request.method==="PUT"&&researchExperience){if(!dependencies.trainingResearch)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.trainingResearch.saveResearch(principal,recordId(researchExperience[1]??""),parseResearch(await readJson(request))),meta:{correlationId:correlation}});return;}
      if(request.method==="GET"&&url.pathname==="/v1/professional-evidence-links"){if(!dependencies.evidenceLinks)throw new HttpError(503,"EVIDENCE_SERVICE_UNAVAILABLE","Evidence service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.evidenceLinks.list(principal),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&url.pathname==="/v1/professional-evidence-links"){if(!dependencies.evidenceLinks)throw new HttpError(503,"EVIDENCE_SERVICE_UNAVAILABLE","Evidence service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,201,correlation,{data:await dependencies.evidenceLinks.create(principal,parseEvidenceLink(await readJson(request)),correlation),meta:{correlationId:correlation}});return;}
      if(request.method==="GET"&&url.pathname==="/v1/professional-evidence-strength"){if(!dependencies.evidenceStrength)throw new HttpError(503,"EVIDENCE_SERVICE_UNAVAILABLE","Evidence service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.evidenceStrength.list(principal),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&url.pathname==="/v1/professional-evidence-strength/recalculate"){if(!dependencies.evidenceStrength)throw new HttpError(503,"EVIDENCE_SERVICE_UNAVAILABLE","Evidence service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.evidenceStrength.recalculate(principal,parseStrengthTarget(await readJson(request)),correlation),meta:{correlationId:correlation}});return;}
      if(request.method==="GET"&&url.pathname==="/v1/professional-fingerprint-strength"){if(!dependencies.fingerprintStrength)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.fingerprintStrength.list(principal),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&url.pathname==="/v1/professional-fingerprint-strength/recalculate"){if(!dependencies.fingerprintStrength)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});const input=parseFingerprintStrength(await readJson(request));send(response,200,correlation,{data:await dependencies.fingerprintStrength.recalculate(principal,input.professionalFingerprintId,correlation),meta:{correlationId:correlation}});return;}
      if(request.method==="PUT"&&url.pathname==="/v1/professional-profile"){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.professional.saveProfile(principal,parseProfile(await readJson(request))),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&url.pathname==="/v1/professional-fingerprints"){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,201,correlation,{data:await dependencies.professional.createFingerprint(principal,parseFingerprint(await readJson(request))),meta:{correlationId:correlation}});return;}
      const fingerprint=url.pathname.match(/^\/v1\/professional-fingerprints\/([^/]+)$/);
      if(request.method==="PUT"&&fingerprint){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.professional.updateFingerprint(principal,professionalId(fingerprint[1]??""),parseFingerprint(await readJson(request))),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&url.pathname==="/v1/professional-profile/publication-requests"){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});const input=parsePublicationSubmit(await readJson(request));send(response,201,correlation,{data:await dependencies.professional.submitPublication(principal,input.expectedRowVersion,correlation),meta:{correlationId:correlation}});return;}
      if(request.method==="GET"&&url.pathname==="/v1/professional-profile/publication-readiness"){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.professional.publicationReadiness(principal),meta:{correlationId:correlation}});return;}
      const ownPublicationFindings=url.pathname.match(/^\/v1\/professional-profile\/publication-requests\/([^/]+)\/findings$/);
      if(request.method==="GET"&&ownPublicationFindings){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.professional.publicationFindings(principal,publicationRequestId(ownPublicationFindings[1]??""),false),meta:{correlationId:correlation}});return;}
      const findingResponse=url.pathname.match(/^\/v1\/professional-profile\/publication-requests\/([^/]+)\/findings\/([^/]+)\/responses$/);
      if(request.method==="POST"&&findingResponse){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});const input=parsePublicationFindingResponse(await readJson(request));send(response,200,correlation,{data:await dependencies.professional.respondPublicationFinding(principal,publicationRequestId(findingResponse[1]??""),publicationFindingId(findingResponse[2]??""),input.response,correlation),meta:{correlationId:correlation}});return;}
      const ownAmendments=url.pathname.match(/^\/v1\/professional-profile\/publication-requests\/([^/]+)\/amendments$/);
      if(request.method==="GET"&&ownAmendments){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.professional.publicationAmendments(principal,publicationRequestId(ownAmendments[1]??""),false),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&ownAmendments){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,201,correlation,{data:await dependencies.professional.submitPublicationAmendment(principal,publicationRequestId(ownAmendments[1]??""),parsePublicationAmendment(await readJson(request,65536)),correlation),meta:{correlationId:correlation}});return;}
      const ownConsolidation=url.pathname.match(/^\/v1\/professional-profile\/publication-requests\/([^/]+)\/consolidation$/);
      if(request.method==="GET"&&ownConsolidation){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.professional.publicationConsolidation(principal,publicationRequestId(ownConsolidation[1]??""),false),meta:{correlationId:correlation}});return;}
      if(request.method==="GET"&&url.pathname==="/v1/professional-publication-reviews"){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.review",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.professional.publicationQueue(),meta:{correlationId:correlation}});return;}
      const reviewFindings=url.pathname.match(/^\/v1\/professional-publication-reviews\/([^/]+)\/findings$/);
      if(request.method==="GET"&&reviewFindings){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.review",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.professional.publicationFindings(principal,publicationRequestId(reviewFindings[1]??""),true),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&reviewFindings){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.review",stepUpRequired:true});send(response,201,correlation,{data:await dependencies.professional.createPublicationFinding(principal,publicationRequestId(reviewFindings[1]??""),parsePublicationFinding(await readJson(request)),correlation),meta:{correlationId:correlation}});return;}
      const findingResolution=url.pathname.match(/^\/v1\/professional-publication-reviews\/([^/]+)\/findings\/([^/]+)\/resolution$/);
      if(request.method==="POST"&&findingResolution){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.review",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.professional.resolvePublicationFinding(principal,publicationRequestId(findingResolution[1]??""),publicationFindingId(findingResolution[2]??""),parsePublicationFindingResolution(await readJson(request)),correlation),meta:{correlationId:correlation}});return;}
      const reviewAmendments=url.pathname.match(/^\/v1\/professional-publication-reviews\/([^/]+)\/amendments$/);
      if(request.method==="GET"&&reviewAmendments){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.review",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.professional.publicationAmendments(principal,publicationRequestId(reviewAmendments[1]??""),true),meta:{correlationId:correlation}});return;}
      const amendmentDecision=url.pathname.match(/^\/v1\/professional-publication-reviews\/([^/]+)\/amendments\/([^/]+)\/decision$/);
      if(request.method==="POST"&&amendmentDecision){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.review",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.professional.decidePublicationAmendment(principal,publicationRequestId(amendmentDecision[1]??""),publicationFindingId(amendmentDecision[2]??""),parsePublicationAmendmentDecision(await readJson(request)),correlation),meta:{correlationId:correlation}});return;}
      const reviewConsolidation=url.pathname.match(/^\/v1\/professional-publication-reviews\/([^/]+)\/consolidation$/);
      if(request.method==="GET"&&reviewConsolidation){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.review",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.professional.publicationConsolidation(principal,publicationRequestId(reviewConsolidation[1]??""),true),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&reviewConsolidation){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.review",stepUpRequired:true});send(response,201,correlation,{data:await dependencies.professional.consolidatePublication(principal,publicationRequestId(reviewConsolidation[1]??""),correlation),meta:{correlationId:correlation}});return;}
      const publicationDetail=url.pathname.match(/^\/v1\/professional-publication-reviews\/([^/]+)$/);
      if(request.method==="GET"&&publicationDetail){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest(),canPublish=principal.permissions.includes("professional.publish");authorize(principal,{permission:canPublish?"professional.publish":"professional.review",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.professional.publicationReviewDetail(principal,publicationRequestId(publicationDetail[1]??""),canPublish),meta:{correlationId:correlation}});return;}
      const reviewDocument=url.pathname.match(/^\/v1\/professional-publication-reviews\/([^/]+)\/evidence\/([^/]+)\/files\/([^/]+)\/download-intents$/);
      if(request.method==="POST"&&reviewDocument){if(!dependencies.files)throw new HttpError(503,"FILE_SERVICE_UNAVAILABLE","File service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.review.document",stepUpRequired:true});const requestId=publicationRequestId(reviewDocument[1]??""),evidenceItemId=evidenceId(reviewDocument[2]??""),fileId=evidenceId(reviewDocument[3]??""),input=parseReviewDocumentAccess(await readJson(request));send(response,201,correlation,{data:await dependencies.files.createReviewDocumentDownloadIntent(principal,requestId,evidenceItemId,fileId,input.reason,correlation),meta:{correlationId:correlation}});return;}
      const publicationClaim=url.pathname.match(/^\/v1\/professional-publication-reviews\/([^/]+)\/claim$/);
      if(request.method==="POST"&&publicationClaim){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.review",stepUpRequired:true});const id=professionalId(publicationClaim[1]??"");send(response,200,correlation,{data:await dependencies.professional.claimPublication(principal,id,correlation),meta:{correlationId:correlation}});return;}
      const publicationRecommendation=url.pathname.match(/^\/v1\/professional-publication-reviews\/([^/]+)\/recommendation$/);
      if(request.method==="POST"&&publicationRecommendation){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.review",stepUpRequired:true});const id=professionalId(publicationRecommendation[1]??"");send(response,200,correlation,{data:await dependencies.professional.recommendPublication(principal,id,parsePublicationReview(await readJson(request)),correlation),meta:{correlationId:correlation}});return;}
      const publicationDecision=url.pathname.match(/^\/v1\/professional-publication-decisions\/([^/]+)$/);
      if(request.method==="POST"&&publicationDecision){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.publish",stepUpRequired:true});const id=professionalId(publicationDecision[1]??"");send(response,200,correlation,{data:await dependencies.professional.decidePublication(principal,id,parsePublicationDecision(await readJson(request)),correlation),meta:{correlationId:correlation}});return;}
      if(request.method==="GET"&&url.pathname==="/v1/professional-publications"){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.publish.lifecycle",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.professional.publicationMaterializations(),meta:{correlationId:correlation}});return;}
      if(request.method==="GET"&&url.pathname==="/v1/professional-publications/reverification"){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.publish.lifecycle",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.professional.publicationReverification(),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&url.pathname==="/v1/professional-publications/reverification/run"){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.publish.lifecycle",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.professional.runPublicationReverification(principal,correlation),meta:{correlationId:correlation}});return;}
      if(request.method==="GET"&&url.pathname==="/v1/me/professional-reverification-alerts"){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.professional.ownReverificationAlerts(principal),meta:{correlationId:correlation}});return;}
      const reverificationAcknowledgement=url.pathname.match(/^\/v1\/me\/professional-reverification-alerts\/([^/]+)\/acknowledge$/);
      if(request.method==="POST"&&reverificationAcknowledgement){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});send(response,200,correlation,{data:await dependencies.professional.acknowledgeReverificationAlert(principal,publicationFindingId(reverificationAcknowledgement[1]??""),correlation),meta:{correlationId:correlation}});return;}
      const publicationLifecycle=url.pathname.match(/^\/v1\/professional-publications\/([^/]+)\/lifecycle$/);
      if(request.method==="POST"&&publicationLifecycle){if(!dependencies.professional)throw new HttpError(503,"PROFESSIONAL_SERVICE_UNAVAILABLE","Professional service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"professional.publish.lifecycle",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.professional.transitionPublicationLifecycle(principal,publicationFindingId(publicationLifecycle[1]??""),parsePublicationLifecycle(await readJson(request)),correlation),meta:{correlationId:correlation}});return;}
      if (request.method === "GET" && url.pathname === "/v1/membership-types") {
        if (!dependencies.membership) throw new HttpError(503, "MEMBERSHIP_SERVICE_UNAVAILABLE", "Membership service is unavailable");
        const principal = await principalForRequest();
        authorize(principal, { permission: "membership.self.apply" });
        send(response, 200, correlation, { data: await dependencies.membership.listTypes(), meta: { correlationId: correlation } });
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/files") {
        if (!dependencies.files) throw new HttpError(503, "FILE_SERVICE_UNAVAILABLE", "File service is unavailable");
        const principal = await principalForRequest();
        authorize(principal, { permission: "account.self.manage" });
        send(response, 200, correlation, { data: await dependencies.files.listOwn(principal), meta: { correlationId: correlation } });
        return;
      }
      if(request.method==="GET"&&url.pathname==="/v1/privacy-preferences"){if(!dependencies.privacy)throw new HttpError(503,"PRIVACY_SERVICE_UNAVAILABLE","Privacy service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"privacy.self.manage",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.privacy.listOwn(principal),meta:{correlationId:correlation}});return;}
      if(request.method==="PUT"&&url.pathname==="/v1/privacy-preferences"){if(!dependencies.privacy)throw new HttpError(503,"PRIVACY_SERVICE_UNAVAILABLE","Privacy service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"privacy.self.manage",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.privacy.set(principal,parsePrivacyPreference(await readJson(request)),correlation),meta:{correlationId:correlation}});return;}
      const revokeGrant=url.pathname.match(/^\/v1\/file-access-grants\/([^/]+)\/revoke$/);
      if(request.method==="POST"&&revokeGrant){if(!dependencies.privacy)throw new HttpError(503,"PRIVACY_SERVICE_UNAVAILABLE","Privacy service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"privacy.self.manage",stepUpRequired:true});const id=privacyResourceId(revokeGrant[1]??"");send(response,200,correlation,{data:await dependencies.privacy.revokeGrant(principal,id,parseRevocation(await readJson(request)).reason,correlation),meta:{correlationId:correlation}});return;}
      if (request.method === "POST" && url.pathname === "/v1/files/upload-intents") {
        if (!dependencies.files) throw new HttpError(503, "FILE_SERVICE_UNAVAILABLE", "File service is unavailable");
        const principal = await principalForRequest();
        authorize(principal, { permission: "account.self.manage" });
        const intent = await dependencies.files.createUploadIntent(principal, parseFileIntent(await readJson(request)), correlation);
        send(response, 201, correlation, { data: intent, meta: { correlationId: correlation } });
        return;
      }
      if (request.method === "POST" && url.pathname === "/internal/files/upload-completed") {
        if (!dependencies.files) throw new HttpError(503,"FILE_SERVICE_UNAVAILABLE","File service is unavailable");
        requireInternalToken(request.headers["x-internal-token"],dependencies.internalTokens?.storageCallback);
        send(response,200,correlation,{data:await dependencies.files.confirmUpload(parseUploadCompletion(await readJson(request)),correlation),meta:{correlationId:correlation}});
        return;
      }
      if (request.method === "POST" && url.pathname === "/internal/files/scan-results") {
        if (!dependencies.files) throw new HttpError(503,"FILE_SERVICE_UNAVAILABLE","File service is unavailable");
        requireInternalToken(request.headers["x-internal-token"],dependencies.internalTokens?.malwareScanner);
        send(response,200,correlation,{data:await dependencies.files.recordScan(parseScanResult(await readJson(request)),correlation),meta:{correlationId:correlation}});
        return;
      }
      if(request.method==="POST"&&url.pathname==="/internal/files/download-consume"){
        if(!dependencies.files)throw new HttpError(503,"FILE_SERVICE_UNAVAILABLE","File service is unavailable");
        requireInternalToken(request.headers["x-internal-token"],dependencies.internalTokens?.storageCallback);
        send(response,200,correlation,{data:await dependencies.files.consumeDownload(parseDownloadConsume(await readJson(request))),meta:{correlationId:correlation}});return;
      }
      if(request.method==="POST"&&url.pathname==="/internal/notifications/claim"){if(!dependencies.notifications)throw new HttpError(503,"NOTIFICATION_SERVICE_UNAVAILABLE","Notification service is unavailable");requireInternalToken(request.headers["x-internal-token"],dependencies.internalTokens?.notificationDispatcher);send(response,200,correlation,{data:await dependencies.notifications.claim(parseNotificationClaim(await readJson(request))),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&url.pathname==="/internal/notifications/results"){if(!dependencies.notifications)throw new HttpError(503,"NOTIFICATION_SERVICE_UNAVAILABLE","Notification service is unavailable");requireInternalToken(request.headers["x-internal-token"],dependencies.internalTokens?.notificationDispatcher);send(response,200,correlation,{data:await dependencies.notifications.record(parseNotificationResult(await readJson(request)),correlation),meta:{correlationId:correlation}});return;}
      if(request.method==="GET"&&url.pathname==="/v1/notification-delivery-operations"){if(!dependencies.notifications)throw new HttpError(503,"NOTIFICATION_SERVICE_UNAVAILABLE","Notification service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"communication.delivery.operations",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.notifications.operations(),meta:{correlationId:correlation}});return;}
      if(request.method==="POST"&&url.pathname==="/v1/notification-delivery-operations/slo/evaluate"){if(!dependencies.notifications)throw new HttpError(503,"NOTIFICATION_SERVICE_UNAVAILABLE","Notification service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"communication.delivery.operations",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.notifications.evaluateSlos(principal,correlation),meta:{correlationId:correlation}});return;}
      const deadLetterResolution=url.pathname.match(/^\/v1\/notification-delivery-dead-letters\/([^/]+)\/resolution$/);
      if(request.method==="POST"&&deadLetterResolution){if(!dependencies.notifications)throw new HttpError(503,"NOTIFICATION_SERVICE_UNAVAILABLE","Notification service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"communication.delivery.operations",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.notifications.resolveDeadLetter(principal,notificationId(deadLetterResolution[1]??""),parseDeadLetterResolution(await readJson(request)),correlation),meta:{correlationId:correlation}});return;}
      const deliveryIncidentResolution=url.pathname.match(/^\/v1\/notification-delivery-incidents\/([^/]+)\/resolution$/);
      if(request.method==="POST"&&deliveryIncidentResolution){if(!dependencies.notifications)throw new HttpError(503,"NOTIFICATION_SERVICE_UNAVAILABLE","Notification service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"communication.delivery.operations",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.notifications.resolveIncident(principal,notificationId(deliveryIncidentResolution[1]??""),parseDeliveryIncidentResolution(await readJson(request)),correlation),meta:{correlationId:correlation}});return;}
      const fileGrant=url.pathname.match(/^\/v1\/files\/([^/]+)\/access-grants$/);
      if(request.method==="POST"&&fileGrant){if(!dependencies.files)throw new HttpError(503,"FILE_SERVICE_UNAVAILABLE","File service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});const id=evidenceId(fileGrant[1]??"");send(response,201,correlation,{data:await dependencies.files.grantAccess(principal,id,parseAccessGrant(await readJson(request)),correlation),meta:{correlationId:correlation}});return;}
      const fileDownload=url.pathname.match(/^\/v1\/files\/([^/]+)\/download-intents$/);
      if(request.method==="POST"&&fileDownload){if(!dependencies.files)throw new HttpError(503,"FILE_SERVICE_UNAVAILABLE","File service is unavailable");const principal=await principalForRequest();const id=evidenceId(fileDownload[1]??"");send(response,201,correlation,{data:await dependencies.files.createDownloadIntent(principal,id,correlation),meta:{correlationId:correlation}});return;}
      if (request.method === "POST" && url.pathname === "/v1/evidence") {
        if (!dependencies.files) throw new HttpError(503,"EVIDENCE_SERVICE_UNAVAILABLE","Evidence service is unavailable");
        const principal=await principalForRequest();
        authorize(principal,{permission:"account.self.manage"});
        send(response,201,correlation,{data:await dependencies.files.createEvidence(principal,parseEvidenceInput(await readJson(request)),correlation),meta:{correlationId:correlation}});
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/evidence") {
        if(!dependencies.evidence)throw new HttpError(503,"EVIDENCE_SERVICE_UNAVAILABLE","Evidence service is unavailable");
        const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});
        send(response,200,correlation,{data:await dependencies.evidence.listOwn(principal),meta:{correlationId:correlation}});return;
      }
      const evidenceSubmit=url.pathname.match(/^\/v1\/evidence\/([^/]+)\/submit-verification$/);
      if(request.method==="POST"&&evidenceSubmit){if(!dependencies.evidence)throw new HttpError(503,"EVIDENCE_SERVICE_UNAVAILABLE","Evidence service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"account.self.manage"});const id=evidenceId(evidenceSubmit[1]??"");send(response,200,correlation,{data:await dependencies.evidence.submit(principal,id,correlation),meta:{correlationId:correlation}});return;}
      if(request.method==="GET"&&url.pathname==="/v1/evidence-verifications"){if(!dependencies.evidence)throw new HttpError(503,"EVIDENCE_SERVICE_UNAVAILABLE","Evidence service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"evidence.verify",stepUpRequired:true});send(response,200,correlation,{data:await dependencies.evidence.queue(),meta:{correlationId:correlation}});return;}
      const verificationClaim=url.pathname.match(/^\/v1\/evidence-verifications\/([^/]+)\/claim$/);
      if(request.method==="POST"&&verificationClaim){if(!dependencies.evidence)throw new HttpError(503,"EVIDENCE_SERVICE_UNAVAILABLE","Evidence service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"evidence.verify",stepUpRequired:true});const id=evidenceId(verificationClaim[1]??"");send(response,200,correlation,{data:await dependencies.evidence.claim(principal,id,correlation),meta:{correlationId:correlation}});return;}
      const verificationCheck=url.pathname.match(/^\/v1\/evidence-verifications\/([^/]+)\/checks$/);
      if(request.method==="POST"&&verificationCheck){if(!dependencies.evidence)throw new HttpError(503,"EVIDENCE_SERVICE_UNAVAILABLE","Evidence service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"evidence.verify",stepUpRequired:true});const id=evidenceId(verificationCheck[1]??"");send(response,201,correlation,{data:await dependencies.evidence.addCheck(principal,id,parseCheck(await readJson(request)),correlation),meta:{correlationId:correlation}});return;}
      const verificationDecision=url.pathname.match(/^\/v1\/evidence-verifications\/([^/]+)\/decision$/);
      if(request.method==="POST"&&verificationDecision){if(!dependencies.evidence)throw new HttpError(503,"EVIDENCE_SERVICE_UNAVAILABLE","Evidence service is unavailable");const principal=await principalForRequest();authorize(principal,{permission:"evidence.verify",stepUpRequired:true});const id=evidenceId(verificationDecision[1]??"");send(response,200,correlation,{data:await dependencies.evidence.decide(principal,id,parseVerificationDecision(await readJson(request)),correlation),meta:{correlationId:correlation}});return;}
      if (request.method === "GET" && url.pathname === "/v1/membership-applications") {
        if (!dependencies.membership) throw new HttpError(503, "MEMBERSHIP_SERVICE_UNAVAILABLE", "Membership service is unavailable");
        const principal = await principalForRequest();
        authorize(principal, { permission: "membership.self.apply" });
        send(response, 200, correlation, { data: await dependencies.membership.listOwn(principal), meta: { correlationId: correlation } });
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/membership-applications") {
        if (!dependencies.membership) throw new HttpError(503, "MEMBERSHIP_SERVICE_UNAVAILABLE", "Membership service is unavailable");
        const principal = await principalForRequest();
        authorize(principal, { permission: "membership.self.apply" });
        const input = parseCreateApplication(await readJson(request));
        send(response, 201, correlation, { data: await dependencies.membership.create(principal, input.membershipTypeCode, correlation), meta: { correlationId: correlation } });
        return;
      }
      const stepMatch = url.pathname.match(/^\/v1\/membership-applications\/([^/]+)\/steps\/([^/]+)$/);
      if (request.method === "PUT" && stepMatch) {
        if (!dependencies.membership) throw new HttpError(503, "MEMBERSHIP_SERVICE_UNAVAILABLE", "Membership service is unavailable");
        const principal = await principalForRequest();
        authorize(principal, { permission: "membership.self.apply" });
        const applicationId = validateApplicationId(stepMatch[1] ?? "");
        const input = parseSaveStep(await readJson(request, 32768));
        send(response, 200, correlation, { data: await dependencies.membership.saveStep(principal, applicationId, (stepMatch[2] ?? "").toUpperCase(), input, correlation), meta: { correlationId: correlation } });
        return;
      }
      const submitMatch = url.pathname.match(/^\/v1\/membership-applications\/([^/]+)\/submit$/);
      if (request.method === "POST" && submitMatch) {
        if (!dependencies.membership) throw new HttpError(503, "MEMBERSHIP_SERVICE_UNAVAILABLE", "Membership service is unavailable");
        const principal = await principalForRequest();
        authorize(principal, { permission: "membership.self.apply" });
        const applicationId = validateApplicationId(submitMatch[1] ?? "");
        const input = parseSubmitApplication(await readJson(request));
        send(response, 200, correlation, { data: await dependencies.membership.submit(principal, applicationId, input.expectedRowVersion, correlation), meta: { correlationId: correlation } });
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/membership-reviews") {
        if (!dependencies.membership) throw new HttpError(503, "MEMBERSHIP_SERVICE_UNAVAILABLE", "Membership service is unavailable");
        const principal = await principalForRequest();
        authorize(principal, { permission: "membership.review", stepUpRequired: true });
        send(response, 200, correlation, { data: await dependencies.membership.reviewQueue(), meta: { correlationId: correlation } });
        return;
      }
      const claimMatch = url.pathname.match(/^\/v1\/membership-reviews\/([^/]+)\/claim$/);
      if (request.method === "POST" && claimMatch) {
        if (!dependencies.membership) throw new HttpError(503, "MEMBERSHIP_SERVICE_UNAVAILABLE", "Membership service is unavailable");
        const principal = await principalForRequest();
        authorize(principal, { permission: "membership.review", stepUpRequired: true });
        const applicationId = validateApplicationId(claimMatch[1] ?? "");
        send(response, 200, correlation, { data: await dependencies.membership.claimReview(principal, applicationId, correlation), meta: { correlationId: correlation } });
        return;
      }
      const reviewMatch = url.pathname.match(/^\/v1\/membership-reviews\/([^/]+)\/recommendation$/);
      if (request.method === "POST" && reviewMatch) {
        if (!dependencies.membership) throw new HttpError(503, "MEMBERSHIP_SERVICE_UNAVAILABLE", "Membership service is unavailable");
        const principal = await principalForRequest();
        authorize(principal, { permission: "membership.review", stepUpRequired: true });
        const applicationId = validateApplicationId(reviewMatch[1] ?? "");
        send(response, 200, correlation, { data: await dependencies.membership.completeReview(principal, applicationId, parseReview(await readJson(request)), correlation), meta: { correlationId: correlation } });
        return;
      }
      const decisionMatch = url.pathname.match(/^\/v1\/membership-decisions\/([^/]+)$/);
      if (request.method === "POST" && decisionMatch) {
        if (!dependencies.membership) throw new HttpError(503, "MEMBERSHIP_SERVICE_UNAVAILABLE", "Membership service is unavailable");
        const principal = await principalForRequest();
        authorize(principal, { permission: "membership.approve", stepUpRequired: true });
        const applicationId = validateApplicationId(decisionMatch[1] ?? "");
        send(response, 200, correlation, { data: await dependencies.membership.decide(principal, applicationId, parseDecision(await readJson(request)), correlation), meta: { correlationId: correlation } });
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/identity/register") {
        if (!dependencies.authenticate || !dependencies.registerIdentity) {
          throw new HttpError(503, "IDENTITY_SERVICE_UNAVAILABLE", "Identity service is unavailable");
        }
        const identity = await dependencies.authenticate(request.headers);
        const input = parseRegistrationInput(await readJson(request));
        const registration = await dependencies.registerIdentity(identity, input, correlation);
        send(response, 201, correlation, { data: registration, meta: { correlationId: correlation } });
        return;
      }
      send(response, 404, correlation, { error: "NOT_FOUND", correlationId: correlation });
    } catch (error) {
      if (error instanceof HttpError) {
        send(response, error.status, correlation, { error: error.code, correlationId: correlation });
        return;
      }
      console.error(JSON.stringify({ level: "error", event: "request_failed", correlationId: correlation, message: error instanceof Error ? error.message : "Unknown error" }));
      send(response, 503, correlation, { error: "SERVICE_UNAVAILABLE", correlationId: correlation });
    }
  };
}
