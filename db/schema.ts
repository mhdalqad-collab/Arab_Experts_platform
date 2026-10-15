import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable(
  "accounts",
  {
    accountId: text("account_id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    clientType: text("client_type"),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("accounts_email_uq").on(table.email)],
);

export const accountMemberships = sqliteTable(
  "account_memberships",
  {
    membershipId: text("membership_id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.accountId),
    membershipCode: text("membership_code").notNull(),
    status: text("status").notNull().default("DRAFT"),
    isActive: integer("is_active", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("account_memberships_account_code_uq").on(
      table.accountId,
      table.membershipCode,
    ),
  ],
);

export const accountAuditEvents = sqliteTable("account_audit_events", {
  eventId: text("event_id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.accountId),
  eventType: text("event_type").notNull(),
  actorEmail: text("actor_email").notNull(),
  payloadJson: text("payload_json").notNull().default("{}"),
  occurredAt: text("occurred_at").notNull(),
});

export const membershipProfiles = sqliteTable(
  "membership_profiles",
  {
    profileId: text("profile_id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.accountId),
    partyId: text("party_id").references(() => parties.partyId),
    membershipCode: text("membership_code").notNull(),
    payloadJson: text("payload_json").notNull().default("{}"),
    privacyJson: text("privacy_json").notNull().default("{}"),
    recordsJson: text("records_json").notNull().default("{}"),
    currentStep: integer("current_step").notNull().default(0),
    lifecycleStatus: text("lifecycle_status").notNull().default("draft"),
    revision: integer("revision").notNull().default(1),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("membership_profiles_party_code_uq").on(
      table.partyId,
      table.membershipCode,
    ),
  ],
);

export const membershipProfileVersions = sqliteTable(
  "membership_profile_versions",
  {
    versionId: text("version_id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => membershipProfiles.profileId),
    revision: integer("revision").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    actorEmail: text("actor_email").notNull(),
    reason: text("reason").notNull().default("AUTOSAVE"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("membership_profile_versions_profile_revision_uq").on(
      table.profileId,
      table.revision,
    ),
  ],
);

export const accountRoles = sqliteTable(
  "account_roles",
  {
    accountRoleId: text("account_role_id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.accountId),
    roleCode: text("role_code").notNull(),
    grantedBy: text("granted_by").notNull(),
    grantedAt: text("granted_at").notNull(),
    isActive: integer("is_active", { mode: "boolean" })
      .notNull()
      .default(true),
  },
  (table) => [
    uniqueIndex("account_roles_account_role_uq").on(
      table.accountId,
      table.roleCode,
    ),
  ],
);

export const membershipReviews = sqliteTable("membership_reviews", {
  reviewId: text("review_id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .references(() => membershipProfiles.profileId),
  reviewerAccountId: text("reviewer_account_id")
    .notNull()
    .references(() => accounts.accountId),
  status: text("status").notNull().default("OPEN"),
  decisionCode: text("decision_code"),
  decisionReason: text("decision_reason"),
  openedAt: text("opened_at").notNull(),
  decidedAt: text("decided_at"),
});

export const membershipTransitions = sqliteTable(
  "membership_transitions",
  {
    transitionId: text("transition_id").primaryKey(),
    requestId: text("request_id").notNull(),
    profileId: text("profile_id")
      .notNull()
      .references(() => membershipProfiles.profileId),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actionCode: text("action_code").notNull(),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => accounts.accountId),
    actorRole: text("actor_role").notNull(),
    reason: text("reason"),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => [
    uniqueIndex("membership_transitions_request_uq").on(table.requestId),
  ],
);

export const accountNotifications = sqliteTable("account_notifications", {
  notificationId: text("notification_id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.accountId),
  profileId: text("profile_id").references(() => membershipProfiles.profileId),
  notificationType: text("notification_type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  actionRoute: text("action_route"),
  priority: text("priority").notNull().default("NORMAL"),
  dueAt: text("due_at"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  readAt: text("read_at"),
});

export const parties = sqliteTable("parties", {
  partyId: text("party_id").primaryKey(),
  partyType: text("party_type").notNull(),
  displayNameAr: text("display_name_ar").notNull(),
  displayNameEn: text("display_name_en"),
  status: text("status").notNull().default("ACTIVE"),
  rowVersion: integer("row_version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const persons = sqliteTable("persons", {
  partyId: text("party_id")
    .primaryKey()
    .references(() => parties.partyId),
  fullNameAr: text("full_name_ar").notNull(),
  fullNameEn: text("full_name_en"),
  nationalityCountryCode: text("nationality_country_code"),
  residenceCountryCode: text("residence_country_code"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const organizations = sqliteTable(
  "organizations",
  {
    partyId: text("party_id")
      .primaryKey()
      .references(() => parties.partyId),
    legalNameAr: text("legal_name_ar").notNull(),
    legalNameEn: text("legal_name_en"),
    legalEntityType: text("legal_entity_type"),
    registrationNumber: text("registration_number"),
    registrationCountryCode: text("registration_country_code"),
    websiteUrl: text("website_url"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("organizations_registration_uq").on(
      table.registrationCountryCode,
      table.registrationNumber,
    ),
  ],
);

export const accountPartyLinks = sqliteTable(
  "account_party_links",
  {
    accountPartyLinkId: text("account_party_link_id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.accountId),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.partyId),
    relationshipCode: text("relationship_code").notNull().default("OWNER"),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("account_party_links_account_party_uq").on(
      table.accountId,
      table.partyId,
    ),
  ],
);

export const partyContacts = sqliteTable(
  "party_contacts",
  {
    partyContactId: text("party_contact_id").primaryKey(),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.partyId),
    contactType: text("contact_type").notNull(),
    contactValue: text("contact_value").notNull(),
    normalizedValue: text("normalized_value").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    isVerified: integer("is_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    visibility: text("visibility").notNull().default("PRIVATE"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("party_contacts_party_type_value_uq").on(
      table.partyId,
      table.contactType,
      table.normalizedValue,
    ),
  ],
);

export const partyPrivacyRules = sqliteTable(
  "party_privacy_rules",
  {
    partyPrivacyRuleId: text("party_privacy_rule_id").primaryKey(),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.partyId),
    fieldKey: text("field_key").notNull(),
    visibility: text("visibility").notNull().default("PRIVATE"),
    consentGranted: integer("consent_granted", { mode: "boolean" })
      .notNull()
      .default(false),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("party_privacy_rules_party_field_uq").on(
      table.partyId,
      table.fieldKey,
    ),
  ],
);

export const partyMembershipLinks = sqliteTable(
  "party_membership_links",
  {
    partyMembershipLinkId: text("party_membership_link_id").primaryKey(),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.partyId),
    accountMembershipId: text("account_membership_id")
      .notNull()
      .references(() => accountMemberships.membershipId),
    relationshipCode: text("relationship_code").notNull().default("OWNER"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("party_membership_links_party_membership_uq").on(
      table.partyId,
      table.accountMembershipId,
    ),
  ],
);

export const partyMemberships = sqliteTable(
  "party_memberships",
  {
    partyMembershipId: text("party_membership_id").primaryKey(),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.partyId),
    membershipCode: text("membership_code").notNull(),
    lifecycleStatus: text("lifecycle_status").notNull().default("DRAFT"),
    isActive: integer("is_active", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("party_memberships_party_code_uq").on(
      table.partyId,
      table.membershipCode,
    ),
  ],
);

export const organizationInvitations = sqliteTable("organization_invitations", {
  invitationId: text("invitation_id").primaryKey(),
  organizationPartyId: text("organization_party_id")
    .notNull()
    .references(() => organizations.partyId),
  invitedEmail: text("invited_email").notNull(),
  roleCode: text("role_code").notNull(),
  status: text("status").notNull().default("PENDING"),
  invitedByAccountId: text("invited_by_account_id")
    .notNull()
    .references(() => accounts.accountId),
  acceptedByAccountId: text("accepted_by_account_id").references(
    () => accounts.accountId,
  ),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  respondedAt: text("responded_at"),
  cancelledAt: text("cancelled_at"),
});

export const professionalDocuments = sqliteTable(
  "professional_documents",
  {
    documentId: text("document_id").primaryKey(),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.partyId),
    membershipCode: text("membership_code"),
    categoryCode: text("category_code").notNull(),
    title: text("title").notNull(),
    confidentiality: text("confidentiality").notNull().default("PRIVATE"),
    verificationStatus: text("verification_status")
      .notNull()
      .default("NOT_SUBMITTED"),
    currentVersion: integer("current_version").notNull().default(1),
    status: text("status").notNull().default("ACTIVE"),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => accounts.accountId),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [
    uniqueIndex("professional_documents_party_hash_uq").on(
      table.partyId,
      table.documentId,
    ),
  ],
);

export const professionalDocumentVersions = sqliteTable(
  "professional_document_versions",
  {
    documentVersionId: text("document_version_id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => professionalDocuments.documentId),
    versionNumber: integer("version_number").notNull(),
    storageObjectKey: text("storage_object_key").notNull(),
    originalFileName: text("original_file_name").notNull(),
    mediaType: text("media_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256Hash: text("sha256_hash").notNull(),
    scanStatus: text("scan_status").notNull().default("PENDING"),
    uploadedByAccountId: text("uploaded_by_account_id")
      .notNull()
      .references(() => accounts.accountId),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("professional_document_versions_document_version_uq").on(
      table.documentId,
      table.versionNumber,
    ),
    uniqueIndex("professional_document_versions_party_hash_guard_uq").on(
      table.documentId,
      table.sha256Hash,
    ),
  ],
);

export const documentVerifications = sqliteTable("document_verifications", {
  verificationId: text("verification_id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => professionalDocuments.documentId),
  status: text("status").notNull().default("PENDING"),
  submittedByAccountId: text("submitted_by_account_id")
    .notNull()
    .references(() => accounts.accountId),
  reviewerAccountId: text("reviewer_account_id").references(
    () => accounts.accountId,
  ),
  confidenceScore: integer("confidence_score"),
  decisionReason: text("decision_reason"),
  submittedAt: text("submitted_at").notNull(),
  decidedAt: text("decided_at"),
});

export const clientNeeds = sqliteTable("client_needs", {
  needId: text("need_id").primaryKey(),
  clientPartyId: text("client_party_id")
    .notNull()
    .references(() => parties.partyId),
  publicCode: text("public_code").notNull(),
  title: text("title").notNull(),
  outputType: text("output_type"),
  serviceType: text("service_type"),
  status: text("status").notNull().default("DRAFT"),
  payloadJson: text("payload_json").notNull().default("{}"),
  fingerprintJson: text("fingerprint_json").notNull().default("{}"),
  revision: integer("revision").notNull().default(1),
  createdByAccountId: text("created_by_account_id")
    .notNull()
    .references(() => accounts.accountId),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const clientNeedVersions = sqliteTable(
  "client_need_versions",
  {
    versionId: text("version_id").primaryKey(),
    needId: text("need_id")
      .notNull()
      .references(() => clientNeeds.needId),
    revision: integer("revision").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => accounts.accountId),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("client_need_versions_need_revision_uq").on(
      table.needId,
      table.revision,
    ),
  ],
);

export const serviceRequests = sqliteTable(
  "service_requests",
  {
    requestId: text("request_id").primaryKey(),
    needId: text("need_id")
      .notNull()
      .references(() => clientNeeds.needId),
    clientPartyId: text("client_party_id")
      .notNull()
      .references(() => parties.partyId),
    providerPartyId: text("provider_party_id").references(() => parties.partyId),
    candidateRef: text("candidate_ref").notNull(),
    publicCode: text("public_code").notNull(),
    status: text("status").notNull().default("DRAFT"),
    payloadJson: text("payload_json").notNull().default("{}"),
    revision: integer("revision").notNull().default(1),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => accounts.accountId),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("service_requests_need_candidate_active_uq").on(
      table.needId,
      table.candidateRef,
    ),
  ],
);

export const serviceRequestTransitions = sqliteTable(
  "service_request_transitions",
  {
    transitionId: text("transition_id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => serviceRequests.requestId),
    requestKey: text("request_key").notNull(),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => accounts.accountId),
    note: text("note"),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => [
    uniqueIndex("service_request_transitions_request_key_uq").on(
      table.requestId,
      table.requestKey,
    ),
  ],
);

export const serviceProposals = sqliteTable(
  "service_proposals",
  {
    proposalId: text("proposal_id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => serviceRequests.requestId),
    needId: text("need_id")
      .notNull()
      .references(() => clientNeeds.needId),
    clientPartyId: text("client_party_id")
      .notNull()
      .references(() => parties.partyId),
    providerPartyId: text("provider_party_id").references(() => parties.partyId),
    publicCode: text("public_code").notNull(),
    status: text("status").notNull().default("DRAFT"),
    responseRevision: integer("response_revision").notNull(),
    payloadJson: text("payload_json").notNull(),
    revision: integer("revision").notNull().default(1),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => accounts.accountId),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("service_proposals_request_uq").on(table.requestId),
    uniqueIndex("service_proposals_public_code_uq").on(table.publicCode),
  ],
);

export const serviceProposalVersions = sqliteTable(
  "service_proposal_versions",
  {
    versionId: text("version_id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => serviceProposals.proposalId),
    revision: integer("revision").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => accounts.accountId),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("service_proposal_versions_proposal_revision_uq").on(
      table.proposalId,
      table.revision,
    ),
  ],
);

export const serviceContracts = sqliteTable(
  "service_contracts",
  {
    contractId: text("contract_id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => serviceProposals.proposalId),
    requestId: text("request_id")
      .notNull()
      .references(() => serviceRequests.requestId),
    clientPartyId: text("client_party_id")
      .notNull()
      .references(() => parties.partyId),
    providerPartyId: text("provider_party_id").references(() => parties.partyId),
    publicCode: text("public_code").notNull(),
    status: text("status").notNull().default("DRAFT"),
    payloadJson: text("payload_json").notNull(),
    revision: integer("revision").notNull().default(1),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => accounts.accountId),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("service_contracts_proposal_uq").on(table.proposalId),
    uniqueIndex("service_contracts_public_code_uq").on(table.publicCode),
  ],
);

export const serviceContractSignatures = sqliteTable(
  "service_contract_signatures",
  {
    signatureId: text("signature_id").primaryKey(),
    contractId: text("contract_id")
      .notNull()
      .references(() => serviceContracts.contractId),
    partyRole: text("party_role").notNull(),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.partyId),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.accountId),
    declaration: text("declaration").notNull(),
    signedAt: text("signed_at").notNull(),
  },
  (table) => [
    uniqueIndex("service_contract_signatures_contract_role_uq").on(
      table.contractId,
      table.partyRole,
    ),
  ],
);

export const serviceContractTransitions = sqliteTable(
  "service_contract_transitions",
  {
    transitionId: text("transition_id").primaryKey(),
    contractId: text("contract_id")
      .notNull()
      .references(() => serviceContracts.contractId),
    revision: integer("revision").notNull(),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => accounts.accountId),
    note: text("note"),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => [
    uniqueIndex("service_contract_transitions_contract_revision_uq").on(
      table.contractId,
      table.revision,
    ),
  ],
);

export const serviceProjects = sqliteTable(
  "service_projects",
  {
    projectId: text("project_id").primaryKey(),
    contractId: text("contract_id")
      .notNull()
      .references(() => serviceContracts.contractId),
    clientPartyId: text("client_party_id")
      .notNull()
      .references(() => parties.partyId),
    providerPartyId: text("provider_party_id").references(() => parties.partyId),
    publicCode: text("public_code").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().default("PLANNED"),
    progress: integer("progress").notNull().default(0),
    payloadJson: text("payload_json").notNull(),
    revision: integer("revision").notNull().default(1),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => accounts.accountId),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("service_projects_contract_uq").on(table.contractId),
    uniqueIndex("service_projects_public_code_uq").on(table.publicCode),
  ],
);

export const projectMilestones = sqliteTable("project_milestones", {
  milestoneId: text("milestone_id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => serviceProjects.projectId),
  sequence: integer("sequence").notNull(),
  title: text("title").notNull(),
  weight: integer("weight").notNull(),
  dueDate: text("due_date"),
  status: text("status").notNull().default("PLANNED"),
  completedAt: text("completed_at"),
  updatedAt: text("updated_at").notNull(),
});

export const projectDeliverables = sqliteTable("project_deliverables", {
  deliverableId: text("deliverable_id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => serviceProjects.projectId),
  milestoneId: text("milestone_id").references(() => projectMilestones.milestoneId),
  title: text("title").notNull(),
  status: text("status").notNull().default("PLANNED"),
  submissionJson: text("submission_json").notNull().default("{}"),
  reviewJson: text("review_json").notNull().default("{}"),
  revision: integer("revision").notNull().default(1),
  submittedAt: text("submitted_at"),
  reviewedAt: text("reviewed_at"),
  updatedAt: text("updated_at").notNull(),
});

export const projectDeliverableDocuments = sqliteTable(
  "project_deliverable_documents",
  {
    deliverableDocumentId: text("deliverable_document_id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => serviceProjects.projectId),
    deliverableId: text("deliverable_id")
      .notNull()
      .references(() => projectDeliverables.deliverableId),
    documentId: text("document_id")
      .notNull()
      .references(() => professionalDocuments.documentId),
    submissionRevision: integer("submission_revision").notNull(),
    linkedByAccountId: text("linked_by_account_id")
      .notNull()
      .references(() => accounts.accountId),
    linkedAt: text("linked_at").notNull(),
  },
  (table) => [
    uniqueIndex("project_deliverable_documents_document_uq").on(
      table.deliverableId,
      table.documentId,
    ),
  ],
);

export const projectChangeOrders = sqliteTable("project_change_orders", {
  changeOrderId: text("change_order_id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => serviceProjects.projectId),
  publicCode: text("public_code").notNull(),
  status: text("status").notNull().default("REQUESTED"),
  payloadJson: text("payload_json").notNull(),
  requestedByAccountId: text("requested_by_account_id")
    .notNull()
    .references(() => accounts.accountId),
  approvedByAccountId: text("approved_by_account_id").references(() => accounts.accountId),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const projectChangeOrderTransitions = sqliteTable(
  "project_change_order_transitions",
  {
    transitionId: text("transition_id").primaryKey(),
    changeOrderId: text("change_order_id")
      .notNull()
      .references(() => projectChangeOrders.changeOrderId),
    sequence: integer("sequence").notNull(),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actionCode: text("action_code").notNull(),
    actorRole: text("actor_role").notNull(),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => accounts.accountId),
    note: text("note"),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => [
    uniqueIndex("project_change_order_transitions_sequence_uq").on(
      table.changeOrderId,
      table.sequence,
    ),
  ],
);

export const projectRegisterItems = sqliteTable(
  "project_register_items",
  {
    registerItemId: text("register_item_id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => serviceProjects.projectId),
    publicCode: text("public_code").notNull(),
    itemType: text("item_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    priority: text("priority").notNull().default("MEDIUM"),
    status: text("status").notNull(),
    ownerRole: text("owner_role").notNull(),
    dueDate: text("due_date"),
    payloadJson: text("payload_json").notNull().default("{}"),
    raisedByAccountId: text("raised_by_account_id")
      .notNull()
      .references(() => accounts.accountId),
    closedByAccountId: text("closed_by_account_id").references(() => accounts.accountId),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    closedAt: text("closed_at"),
  },
  (table) => [
    uniqueIndex("project_register_items_public_code_uq").on(table.publicCode),
  ],
);

export const projectRegisterTransitions = sqliteTable(
  "project_register_transitions",
  {
    transitionId: text("transition_id").primaryKey(),
    registerItemId: text("register_item_id")
      .notNull()
      .references(() => projectRegisterItems.registerItemId),
    sequence: integer("sequence").notNull(),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actorRole: text("actor_role").notNull(),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => accounts.accountId),
    note: text("note"),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => [
    uniqueIndex("project_register_transitions_sequence_uq").on(
      table.registerItemId,
      table.sequence,
    ),
  ],
);

export const projectProgressReports = sqliteTable(
  "project_progress_reports",
  {
    progressReportId: text("progress_report_id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => serviceProjects.projectId),
    publicCode: text("public_code").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    declaredProgress: integer("declared_progress").notNull(),
    status: text("status").notNull().default("SUBMITTED"),
    currentRevision: integer("current_revision").notNull().default(1),
    submittedByAccountId: text("submitted_by_account_id")
      .notNull()
      .references(() => accounts.accountId),
    reviewedByAccountId: text("reviewed_by_account_id").references(() => accounts.accountId),
    createdAt: text("created_at").notNull(),
    submittedAt: text("submitted_at").notNull(),
    reviewedAt: text("reviewed_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("project_progress_reports_public_code_uq").on(table.publicCode),
    uniqueIndex("project_progress_reports_period_uq").on(
      table.projectId,
      table.periodStart,
      table.periodEnd,
    ),
  ],
);

export const projectProgressReportVersions = sqliteTable(
  "project_progress_report_versions",
  {
    versionId: text("version_id").primaryKey(),
    progressReportId: text("progress_report_id")
      .notNull()
      .references(() => projectProgressReports.progressReportId),
    revision: integer("revision").notNull(),
    payloadJson: text("payload_json").notNull(),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => accounts.accountId),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("project_progress_report_versions_revision_uq").on(
      table.progressReportId,
      table.revision,
    ),
  ],
);

export const projectProgressReportTransitions = sqliteTable(
  "project_progress_report_transitions",
  {
    transitionId: text("transition_id").primaryKey(),
    progressReportId: text("progress_report_id")
      .notNull()
      .references(() => projectProgressReports.progressReportId),
    sequence: integer("sequence").notNull(),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actorRole: text("actor_role").notNull(),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => accounts.accountId),
    note: text("note"),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => [
    uniqueIndex("project_progress_report_transitions_sequence_uq").on(
      table.progressReportId,
      table.sequence,
    ),
  ],
);

export const projectPaymentSchedules = sqliteTable(
  "project_payment_schedules",
  {
    scheduleId: text("schedule_id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => serviceProjects.projectId),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => projectMilestones.milestoneId),
    sequence: integer("sequence").notNull(),
    percentage: integer("percentage").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull().default("LOCKED"),
    eligibleAt: text("eligible_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("project_payment_schedules_milestone_uq").on(table.milestoneId),
  ],
);

export const projectInvoices = sqliteTable(
  "project_invoices",
  {
    invoiceId: text("invoice_id").primaryKey(),
    scheduleId: text("schedule_id")
      .notNull()
      .references(() => projectPaymentSchedules.scheduleId),
    projectId: text("project_id")
      .notNull()
      .references(() => serviceProjects.projectId),
    publicCode: text("public_code").notNull(),
    status: text("status").notNull().default("ISSUED"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    detailsJson: text("details_json").notNull().default("{}"),
    issuedByAccountId: text("issued_by_account_id")
      .notNull()
      .references(() => accounts.accountId),
    approvedByAccountId: text("approved_by_account_id").references(() => accounts.accountId),
    issuedAt: text("issued_at").notNull(),
    approvedAt: text("approved_at"),
    paidAt: text("paid_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("project_invoices_schedule_uq").on(table.scheduleId),
    uniqueIndex("project_invoices_public_code_uq").on(table.publicCode),
  ],
);

export const projectPayments = sqliteTable(
  "project_payments",
  {
    paymentId: text("payment_id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => projectInvoices.invoiceId),
    publicCode: text("public_code").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    method: text("method").notNull(),
    externalReference: text("external_reference"),
    status: text("status").notNull().default("RECORDED"),
    recordedByAccountId: text("recorded_by_account_id")
      .notNull()
      .references(() => accounts.accountId),
    recordedAt: text("recorded_at").notNull(),
  },
  (table) => [
    uniqueIndex("project_payments_public_code_uq").on(table.publicCode),
  ],
);

export const projectClosures = sqliteTable(
  "project_closures",
  {
    closureId: text("closure_id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => serviceProjects.projectId),
    status: text("status").notNull().default("SUBMITTED"),
    reportJson: text("report_json").notNull(),
    submittedByAccountId: text("submitted_by_account_id")
      .notNull()
      .references(() => accounts.accountId),
    acceptedByAccountId: text("accepted_by_account_id").references(() => accounts.accountId),
    submittedAt: text("submitted_at").notNull(),
    acceptedAt: text("accepted_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("project_closures_project_uq").on(table.projectId),
  ],
);

export const projectCompletionCertificates = sqliteTable(
  "project_completion_certificates",
  {
    certificateId: text("certificate_id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => serviceProjects.projectId),
    closureId: text("closure_id")
      .notNull()
      .references(() => projectClosures.closureId),
    publicCode: text("public_code").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    issuedAt: text("issued_at").notNull(),
  },
  (table) => [
    uniqueIndex("project_completion_certificates_project_uq").on(table.projectId),
    uniqueIndex("project_completion_certificates_code_uq").on(table.publicCode),
  ],
);

export const projectReviews = sqliteTable(
  "project_reviews",
  {
    reviewId: text("review_id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => serviceProjects.projectId),
    reviewerPartyId: text("reviewer_party_id")
      .notNull()
      .references(() => parties.partyId),
    subjectPartyId: text("subject_party_id")
      .notNull()
      .references(() => parties.partyId),
    reviewerRole: text("reviewer_role").notNull(),
    scoresJson: text("scores_json").notNull(),
    comment: text("comment"),
    status: text("status").notNull().default("SUBMITTED"),
    submittedByAccountId: text("submitted_by_account_id")
      .notNull()
      .references(() => accounts.accountId),
    submittedAt: text("submitted_at").notNull(),
  },
  (table) => [
    uniqueIndex("project_reviews_project_role_uq").on(
      table.projectId,
      table.reviewerRole,
    ),
  ],
);

export const reputationSnapshots = sqliteTable(
  "reputation_snapshots",
  {
    snapshotId: text("snapshot_id").primaryKey(),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.partyId),
    compositeScore: integer("composite_score").notNull(),
    confidenceScore: integer("confidence_score").notNull(),
    sampleCount: integer("sample_count").notNull(),
    dimensionsJson: text("dimensions_json").notNull(),
    methodologyVersion: text("methodology_version").notNull(),
    generatedAt: text("generated_at").notNull(),
  },
  (table) => [
    uniqueIndex("reputation_snapshots_party_uq").on(table.partyId),
  ],
);

export const reviewDisputes = sqliteTable(
  "review_disputes",
  {
    disputeId: text("dispute_id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => projectReviews.reviewId),
    raisedByPartyId: text("raised_by_party_id")
      .notNull()
      .references(() => parties.partyId),
    status: text("status").notNull().default("OPEN"),
    reasonCode: text("reason_code").notNull(),
    statement: text("statement").notNull(),
    resolution: text("resolution"),
    resolvedByAccountId: text("resolved_by_account_id").references(() => accounts.accountId),
    raisedAt: text("raised_at").notNull(),
    resolvedAt: text("resolved_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("review_disputes_review_open_uq").on(table.reviewId),
  ],
);

export const qualityComplaints = sqliteTable(
  "quality_complaints",
  {
    complaintId: text("complaint_id").primaryKey(),
    publicCode: text("public_code").notNull(),
    complainantPartyId: text("complainant_party_id")
      .notNull()
      .references(() => parties.partyId),
    respondentPartyId: text("respondent_party_id").references(() => parties.partyId),
    projectId: text("project_id").references(() => serviceProjects.projectId),
    reviewId: text("review_id").references(() => projectReviews.reviewId),
    category: text("category").notNull(),
    priority: text("priority").notNull().default("NORMAL"),
    status: text("status").notNull().default("SUBMITTED"),
    subject: text("subject").notNull(),
    statement: text("statement").notNull(),
    resolution: text("resolution"),
    revision: integer("revision").notNull().default(1),
    submittedByAccountId: text("submitted_by_account_id")
      .notNull()
      .references(() => accounts.accountId),
    assignedToAccountId: text("assigned_to_account_id").references(() => accounts.accountId),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    closedAt: text("closed_at"),
  },
  (table) => [
    uniqueIndex("quality_complaints_public_code_uq").on(table.publicCode),
  ],
);

export const complaintTransitions = sqliteTable(
  "complaint_transitions",
  {
    transitionId: text("transition_id").primaryKey(),
    complaintId: text("complaint_id")
      .notNull()
      .references(() => qualityComplaints.complaintId),
    sequence: integer("sequence").notNull(),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actionCode: text("action_code").notNull(),
    note: text("note"),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => accounts.accountId),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => [
    uniqueIndex("complaint_transitions_sequence_uq").on(
      table.complaintId,
      table.sequence,
    ),
  ],
);

export const correctiveActions = sqliteTable("corrective_actions", {
  correctiveActionId: text("corrective_action_id").primaryKey(),
  complaintId: text("complaint_id")
    .notNull()
    .references(() => qualityComplaints.complaintId),
  actionText: text("action_text").notNull(),
  ownerAccountId: text("owner_account_id")
    .notNull()
    .references(() => accounts.accountId),
  dueAt: text("due_at"),
  status: text("status").notNull().default("OPEN"),
  completionEvidence: text("completion_evidence"),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
  updatedAt: text("updated_at").notNull(),
});

export const matchingRuns = sqliteTable("matching_runs", {
  runId: text("run_id").primaryKey(),
  needId: text("need_id")
    .notNull()
    .references(() => clientNeeds.needId),
  clientPartyId: text("client_party_id")
    .notNull()
    .references(() => parties.partyId),
  fingerprintVersion: integer("fingerprint_version").notNull(),
  fingerprintSnapshotJson: text("fingerprint_snapshot_json").notNull(),
  weightsJson: text("weights_json").notNull(),
  mandatoryJson: text("mandatory_json").notNull(),
  status: text("status").notNull().default("COMPLETED"),
  createdByAccountId: text("created_by_account_id")
    .notNull()
    .references(() => accounts.accountId),
  createdAt: text("created_at").notNull(),
});

export const matchingResults = sqliteTable(
  "matching_results",
  {
    resultId: text("result_id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => matchingRuns.runId),
    candidateRef: text("candidate_ref").notNull(),
    candidatePartyId: text("candidate_party_id").references(() => parties.partyId),
    totalScore: integer("total_score").notNull(),
    eligible: integer("eligible", { mode: "boolean" }).notNull(),
    componentScoresJson: text("component_scores_json").notNull(),
    contributionsJson: text("contributions_json").notNull(),
    failedMandatoryJson: text("failed_mandatory_json").notNull(),
    candidateSnapshotJson: text("candidate_snapshot_json").notNull(),
    rank: integer("rank").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("matching_results_run_candidate_uq").on(
      table.runId,
      table.candidateRef,
    ),
  ],
);

export const selectionDecisions = sqliteTable("selection_decisions", {
  decisionId: text("decision_id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => matchingRuns.runId),
  needId: text("need_id")
    .notNull()
    .references(() => clientNeeds.needId),
  clientPartyId: text("client_party_id")
    .notNull()
    .references(() => parties.partyId),
  candidateRef: text("candidate_ref").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("SELECTED"),
  decidedByAccountId: text("decided_by_account_id")
    .notNull()
    .references(() => accounts.accountId),
  decidedAt: text("decided_at").notNull(),
});
