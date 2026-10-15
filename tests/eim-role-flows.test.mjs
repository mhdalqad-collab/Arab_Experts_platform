import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = process.cwd();
const jsRoot = path.join(root, "public", "eim", "js");
const modules = JSON.parse(
  fs.readFileSync(path.join(root, "public", "eim", "module-manifest.json"), "utf8"),
).sourceModules;

function runtime() {
  const storage = {
    setItem(key, value) { this[key] = String(value); },
    getItem(key) { return this[key] ?? null; },
    removeItem(key) { delete this[key]; },
  };
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, {
      id, value: "", textContent: "", innerHTML: "", title: "", dataset: {},
      classList: { contains: () => false, add() {}, remove() {}, toggle() {} },
      setAttribute() {}, querySelectorAll: () => [],
    });
    return nodes.get(id);
  };
  const document = {
    documentElement: { dataset: { theme: "light" } },
    activeElement: { tagName: "BODY" },
    getElementById: node,
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const location = { hash: "#/60", reload() {} };
  const sandbox = {
    console, localStorage: storage, document, location,
    history: { replaceState(_a, _b, hash) { location.hash = hash; } },
    navigator: {}, URL, Blob,
    confirm: () => true, prompt: () => "سبب اختباري",
    setTimeout: () => 1, clearTimeout() {},
    window: { addEventListener() {}, scrollTo() {}, document, location },
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.localStorage = storage;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  let source = modules.map((file) => {
    let code = fs.readFileSync(path.join(jsRoot, file), "utf8");
    if (file === "120-render-bootstrap.js") {
      code = code.slice(0, code.indexOf("applyTheme(document.documentElement.dataset.theme,false);"));
    }
    return code;
  }).join("\n");
  source += `
    globalThis.__eim = {
      get G(){return G}, set G(v){G=v},
      get W(){return W}, set W(v){W=v},
      get step(){return step}, set step(v){step=v},
      get review(){return review}, set review(v){review=v},
      get submitted(){return submitted}, set submitted(v){submitted=v},
      MEMBER_SCREENS, MEMBER_FORMS, MEMBERSHIP_UPGRADES, MEMBER_REPEATABLE, RENDER,
      accountRoles, countries, clientTypes, TAX, TAX_DETAILS, courses,
      ensureLife, lifeTransition, markMembershipDirty, currentId,
      membershipForm, membershipCompletion, membershipStepMissing,
      memberRecords, repeatAt, repeatFieldKeys, mstepValid, mnext, mback,
      mrOpen, mrSave, mprivacy, finishMembership, previewMembershipPublic,
      wvalidate, wnext, wback, wsaveRec, wprivacy, wsubmit,
      migrateClientWorkflow, migrateInstitutionalClients, activeClientAccount,
      newClientAccount, saveClientAccount, newNeed, saveNeed, activeNeed,
      weightTotal, readinessIssues, publishNeed, runWeightedMatching,
      clientProfileHealth, clientCompletenessDimensions,
      NEED_OUTPUT_TYPES, NEED_OUTPUT_LABEL, needOutputMissing,
      migrateFinance, financeCompleteSubscriptionPayment, financeInvoice,
      financeRefundStart, financeRefundSubmit, financeRefundReview,
      financeRefundProcess, financeCreateRenewal, financePayRenewal
      ,migrateSecurity, securityPolicy, securityNeedsStepUp, securityScore,
      recoveryStart, recoveryVerify, recoveryResetPassword, securityEnableMfa,
      securityLoginSuccess
      ,migrateClientCRM, crmOpportunityNew, crmOppSet, crmOpportunitySave,
      crmOpportunityStage, crmTaskNew, crmTaskSet, crmTaskSave, crmTaskToggle,
      crmRiskNew, crmRiskSet, crmRiskSave, crmRiskClose, crmSlaEnsure,
      crmPipeline, crmHealth
      ,migrateNeedFingerprints, needFingerprint, needFingerprintCompleteness,
      needFingerprintIssues, needFpSet, needFpToggle, approveNeedFingerprint,
      reviseNeedFingerprint, needFingerprintSnapshot
      ,migratePlatformAdmin, unifiedAuditEvents, auditFiltered,
      platformOperatorConflicts, adminOperatorNew, adminOperatorSet,
      adminOperatorScope, adminOperatorSave, adminApprovalCreate,
      adminApprovalDecision, platformWorkItems, auditCaseNew, auditCaseSet,
      auditCaseSave, auditCaseTransition, platformPolicyNew, platformPolicySet,
      platformPolicySave
      ,migrateKnowledge, knowledgeAll, knowledgeNew, knowledgeDraftSet,
      knowledgeSave, knowledgeRegister, KNOWLEDGE_TYPES, PUBLICATION_TYPES,
      EVENT_TYPES, KNOWLEDGE_ASSET_TYPES
      ,migrateGovernance, roleHas, permissionToggle, privacyStats,
      privacyConsent, integrationToggle, integrationSync, GOV_ROLES,
      GOV_PERMISSIONS
    };
  `;
  vm.runInContext(source, sandbox, { timeout: 20_000 });
  return { e: sandbox.__eim, sandbox, node };
}

function resetState(e) {
  e.G = {
    ctx: "خبير مستقل", user: "اختبار", memberships: [], completed: [],
    activeMembership: null, membershipStatus: {}, membershipLifecycle: {},
    memberData: {}, memberRecords: {}, memberRecordDrafts: {}, memberRecordEdits: {},
    memberPrivacy: {}, memberRecordPrivacy: {}, tab: {}, lastSave: null,
    entities: [], entityRelations: [], memberEntityIds: {}, entityMergeLog: [],
    privacyAudit: [], primaryPersonEntityId: null, completedRoutes: [],
    clientAccounts: [], activeClientAccountId: "", clientAccountDraft: null,
    clientRepresentatives: [], activeClientRepresentativeId: "",
    clientRepresentativeDraft: null, clientUnits: [], clientBillingProfiles: [],
    clientInteractions: [], clientGovernanceLog: [],
    clientPortfolio: { proposals: [], contracts: [], projects: [], invoices: [], reviews: [], complaints: [] },
    clientNeeds: [], activeNeedId: "", need: null, needDraft: null,
    clientRequests: [], requestNotifications: [], candidateCompare: {},
    candidateShortlist: {}, matchingWeights: { specialty:25,practice:15,sector:10,evidence:10,experience:10,language:5,country:5,availability:5,price:5,rating:10 },
    matchingRuns: [], activeMatchRunId: "", selectionDecisions: [], shortlist: [],
    evidences: [], claims: {}, enrollments: [], drafts: {}, checkout: null,
    subscription: null,
    finance: { invoices:[], payments:[], refunds:[], renewals:[], audit:[], activeInvoiceId:"", refundDraft:null },
    security: { mfaEnabled:false, mfaMethod:"", verifiedEmail:false, verifiedPhone:false, recoveryCodes:[], trustedDevices:[], sessions:[], events:[], recovery:null, loginFailures:0, lockedUntil:0, lastPasswordChange:0 },
    clientCRM: { opportunities:[], tasks:[], risks:[], segments:[], sla:[], notes:[], activity:[], activeOpportunityId:"", opportunityDraft:null, taskDraft:null, riskDraft:null, filters:{q:"",stage:"all"} },
    needFingerprints: {},
    platformAdmin: { operators:[], approvals:[], auditCases:[], policies:[], configChanges:[], workItems:[], adminAudit:[], filters:{q:"",domain:"all",risk:"all",actor:"",from:"",to:""}, operatorDraft:null, caseDraft:null, policyDraft:null, activeCaseId:"" },
    knowledge: { researchProjects:[], publications:[], events:[], assets:[], lessons:[], registrations:[], draft:null, filters:{q:"",type:"all",status:"all"}, activeId:"" },
    governance: { roles:[], permissions:[], grants:[], accessReviews:[], privacyPolicies:[], consents:[], integrations:[], syncRuns:[], changes:[], activeRole:"", integrationDraft:null },
    createdCourses: [], courseRelations: [], courseOfferings: [],
    courseVersions: [], courseAliases: [], duplicateCases: [], duplicateCandidates: [],
    courseSemanticLinks: [], taxonomyCrosswalks: [], crosswalkSuggestions: [],
    courseCompare: [], publicProfile: null, savedDirectorySearches: {},
  };
  e.W = { _private: {} };
  e.step = 0; e.review = false; e.submitted = false;
}

function sampleFor(field, e) {
  const [key, , type, , source] = field;
  if (type === "email") return `${key}@example.com`;
  if (type === "url") return "https://example.com";
  if (type === "number") return "3";
  if (type === "date") return "2026-08-01";
  if (type === "file") return [{ name: `${key}.pdf`, type: "application/pdf", size: 100 }];
  if (type === "multi") {
    const options = Array.isArray(source) ? source : (
      source === "countries" ? e.countries :
      source === "clientTypes" ? e.clientTypes : []
    );
    return [options[0] || "قيمة اختبار"];
  }
  if (type === "select") {
    const options = Array.isArray(source) ? source : (
      source === "countries" ? e.countries :
      source === "clientTypes" ? e.clientTypes : []
    );
    return options[0] || "قيمة اختبار";
  }
  return `قيمة ${key}`;
}

function fillMembership(e, type) {
  const form = e.membershipForm(type);
  const repeatKeys = new Set((e.MEMBER_REPEATABLE[type] || []).flatMap((d) => d.fields));
  e.G.memberData[type] = {};
  for (const field of form.fields) {
    if (!repeatKeys.has(field[0]) && field[3]) {
      e.G.memberData[type][field[0]] = sampleFor(field, e);
    }
  }
  e.G.memberRecords[type] = {};
  for (const def of e.MEMBER_REPEATABLE[type] || []) {
    if (!def.required) continue;
    const row = {};
    for (const key of def.fields) {
      const field = form.fields.find((f) => f[0] === key);
      if (field?.[3]) row[key] = sampleFor(field, e);
    }
    e.G.memberRecords[type][def.key] = [row];
  }
  return form;
}

test("العضويات السبعة ومسارات الخبير والمركز والعميل مرتبطة بالشاشات الصحيحة", () => {
  const { e } = runtime();
  assert.equal(e.accountRoles.length, 7);
  assert.equal(e.MEMBER_SCREENS["خبير"], 33);
  assert.equal(e.MEMBER_SCREENS["مركز تدريب"], 45);
  assert.equal(e.MEMBER_SCREENS["العميل"], 49);
  for (const id of [33, 45, 49]) assert.equal(typeof e.RENDER[id], "function");
});

test("البحث والنشر والفعاليات وإدارة المعرفة تعمل كسجل مترابط", () => {
  const { e } = runtime(); resetState(e);
  e.G.ctx = "باحث / أكاديمي";
  e.migrateKnowledge();
  assert.ok(e.G.knowledge.researchProjects.length >= 1);
  assert.ok(e.G.knowledge.publications.some((x) => x.projectId === "RES-2026-001"));
  for (const id of [99,100,101,102,103,104]) assert.equal(typeof e.RENDER[id], "function");
  e.knowledgeNew("publication");
  e.knowledgeDraftSet("title", "منشور اختباري");
  e.knowledgeDraftSet("domain", Object.keys(e.TAX)[0]);
  e.knowledgeDraftSet("publicationType", e.PUBLICATION_TYPES[0]);
  e.knowledgeSave(true);
  assert.ok(e.G.knowledge.publications.some((x) => x.title === "منشور اختباري" && x.status === "منشور"));
  const event = e.G.knowledge.events[0];
  e.knowledgeRegister(event.id);
  assert.equal(e.G.knowledge.registrations.length, 1);
});

test("الحوكمة تطبق RBAC والخصوصية والتكاملات حسب الدور", () => {
  const { e } = runtime(); resetState(e);
  e.G.ctx = "مدير / مشغل المنصة";
  e.migrateGovernance();
  assert.equal(e.G.governance.roles.length, e.GOV_ROLES.length);
  assert.equal(e.roleHas("مدير المنصة", "role.grant"), true);
  const before = e.roleHas("عضو مهني", "research.manage");
  e.permissionToggle(encodeURIComponent("عضو مهني"), "research.manage");
  assert.equal(e.roleHas("عضو مهني", "research.manage"), !before);
  assert.ok(e.G.governance.changes.length >= 1);
  e.privacyConsent("موافق");
  assert.equal(e.G.governance.consents[0].status, "موافق");
  const integration = e.G.governance.integrations.find((x) => x.status === "متصل");
  e.integrationSync(integration.integrationId);
  assert.equal(e.G.governance.syncRuns.length, 1);
  for (const id of [105,106,107,108]) assert.equal(typeof e.RENDER[id], "function");
});

test("مسار الخبير: التحقق والرجوع والسجلات والخصوصية والإرسال", () => {
  const { e } = runtime(); resetState(e);
  e.G.memberships = ["خبير"]; e.G.activeMembership = "خبير";
  const firstRequired = Object.values(e.W).length;
  assert.equal(e.wvalidate(), false);
  assert.ok(Object.keys(e.W._private).length === 0);
  e.W = {
    _private: {}, fullName:"خبير اختباري", englishName:"Test Expert",
    accountEmail:"expert@example.com", email:"expert@example.com",
    password:"Valid@123", confirmPassword:"Valid@123", accountRoles:["خبير"],
    preferredLanguage:"العربية", terms:"نعم", country:"سلطنة عُمان",
  };
  e.step = 0;
  assert.equal(e.wvalidate(), true);
  e.wnext(); assert.equal(e.step, 1);
  e.wback(); assert.equal(e.step, 0);
  assert.equal(e.W.fullName, "خبير اختباري");
  e.wprivacy("fullName"); assert.equal(e.W._private.fullName, true);
  e.W.qualifications = []; e.W.qualifications.push({ degree:"دكتوراه" });
  assert.equal(e.W.qualifications.length, 1);
  assert.equal(firstRequired >= 0, true);
});

test("مسار مركز التدريب: سبع خطوات وتصنيف مترابط وسجلات متعددة وحفظ نهائي", () => {
  const { e } = runtime(); resetState(e);
  e.G.memberships = ["مركز تدريب"]; e.G.activeMembership = "مركز تدريب";
  const form = fillMembership(e, "مركز تدريب");
  assert.equal(form.steps.length, 7);
  assert.ok(form.fields.some((f) => f[0] === "centerDomain"));
  assert.ok(form.fields.some((f) => f[0] === "centerSpecialty"));
  assert.ok(form.fields.some((f) => f[0] === "centerPhase"));
  assert.ok(form.fields.some((f) => f[0] === "centerAppliedAreas"));
  const requiredDefs = (e.MEMBER_REPEATABLE["مركز تدريب"] || []).filter((d) => d.required);
  assert.ok(requiredDefs.some((d) => d.key === "centerCourses"));
  const before = e.memberRecords("مركز تدريب", "centerCourses").length;
  e.mrOpen(encodeURIComponent("مركز تدريب"), "centerCourses", -1);
  const courseDef = (e.MEMBER_REPEATABLE["مركز تدريب"] || []).find((d) => d.key === "centerCourses");
  const courseDraft = {};
  for (const key of courseDef.fields) {
    const field = form.fields.find((f) => f[0] === key);
    if (field?.[3]) courseDraft[key] = sampleFor(field, e);
  }
  courseDraft.centerDomain = Object.keys(e.TAX)[0];
  courseDraft.centerCourseName = "دورة اختبار ثانية";
  e.G.memberRecordDrafts["مركز تدريب::centerCourses"] = courseDraft;
  e.mrSave(encodeURIComponent("مركز تدريب"), "centerCourses");
  assert.equal(e.memberRecords("مركز تدريب", "centerCourses").length, before + 1);
  assert.equal(e.G.memberRecordDrafts["مركز تدريب::centerCourses"], undefined);
  e.finishMembership(encodeURIComponent("مركز تدريب"));
  assert.ok(e.G.completed.includes("مركز تدريب"));
  assert.ok(e.G.memberEntityIds["مركز تدريب"]);
});

test("مسار العميل: التسجيل ثم الحساب المؤسسي والاحتياج والأوزان والمطابقة", () => {
  const { e } = runtime(); resetState(e);
  e.G.memberships = ["العميل"]; e.G.activeMembership = "العميل";
  const form = fillMembership(e, "العميل");
  assert.ok(form.fields.some((f) => f[0] === "cltype"));
  assert.ok(form.fields.some((f) => f[0] === "clpurpose"));
  e.finishMembership(encodeURIComponent("العميل"));
  assert.ok(e.G.completed.includes("العميل"));
  e.migrateInstitutionalClients();
  assert.equal(e.G.clientAccounts.length, 1);
  assert.ok(e.activeClientAccount());
  e.G.needDraft = {
    title:"استشارة تحول رقمي", outputType:"consultation",
    consultationType:"تشخيص وتوصيات", decisionQuestion:"تحديد مسار التحول الأنسب",
    service:"استشارات", current:"وضع قائم",
    target:"نتيجة مستهدفة", main:Object.keys(e.TAX)[0], mandatory:["specialty"],
    preferred:["specialty"], status:"مسودة",
  };
  e.saveNeed(true);
  assert.equal(e.G.clientNeeds.length, 1);
  assert.equal(e.weightTotal(), 100);
  e.G.clientNeeds[0].mandatory = ["specialty"];
  e.G.need = e.G.clientNeeds[0];
  const fp = e.needFingerprint();
  fp.businessOutcome = "نتيجة مستهدفة";
  fp.successMeasures = "اعتماد التوصيات";
  fp.scopeIncluded = "التشخيص والتوصيات";
  fp.scopeExcluded = "التنفيذ";
  fp.main = Object.keys(e.TAX)[0];
  fp.sub = Object.keys(e.TAX[fp.main])[0];
  fp.practice = e.TAX[fp.main][fp.sub][0];
  fp.acceptanceCriteria = ["اعتماد وثيقة"];
  fp.requiredEvidence = ["خبرة موثقة مماثلة"];
  assert.equal(e.readinessIssues().length, 0);
  e.publishNeed();
  assert.ok(e.G.matchingRuns.length >= 1);
});

test("احتياج العميل يدعم الدراسة والاستشارة والمشروع والمنتج بقواعد اكتمال مستقلة", () => {
  const { e } = runtime(); resetState(e);
  assert.deepEqual(
    Array.from(e.NEED_OUTPUT_TYPES, (x) => x[0]),
    ["study", "consultation", "project", "product"],
  );
  assert.equal(e.needOutputMissing({ outputType:"study" }), "نوع الدراسة");
  assert.equal(e.needOutputMissing({
    outputType:"study", studyType:"دراسة سوق", studyQuestions:"ما حجم السوق؟",
  }), "");
  assert.equal(e.needOutputMissing({ outputType:"consultation" }), "نمط الاستشارة");
  assert.equal(e.needOutputMissing({
    outputType:"consultation", consultationType:"جلسة استشارية",
    decisionQuestion:"ما الخيار الأنسب؟",
  }), "");
  assert.equal(e.needOutputMissing({ outputType:"project" }), "مرحلة المشروع");
  assert.equal(e.needOutputMissing({
    outputType:"project", projectPhase:"التنفيذ", projectScope:"تنفيذ النطاق المعتمد",
  }), "");
  assert.equal(e.needOutputMissing({ outputType:"product" }), "فئة المنتج");
  assert.equal(e.needOutputMissing({
    outputType:"product", productCategory:"منتج رقمي أو برمجي",
    productRequirements:"تطبيق يدعم إدارة الطلبات",
  }), "");
});

test("رحلة الاشتراك تنشئ فاتورة ودفعة وتدعم الاسترداد والتجديد دون حذف السجل", () => {
  const { e } = runtime(); resetState(e);
  e.G.user = "عضو اختباري";
  e.G.memberships = ["خبير", "مدرب"];
  const checkout = {
    package:"الفضية", subscriberType:"فرد", period:"year",
    billingName:"عضو اختباري", billingEmail:"member@example.com",
    billingCountry:"سلطنة عُمان", taxNo:"",
    paymentMethod:"بوابة دفع إلكترونية آمنة", accepted:true,
  };
  const result = e.financeCompleteSubscriptionPayment(checkout, {
    unit:120, count:2, total:240, currency:"USD",
  });
  assert.equal(result.activated, true);
  assert.equal(e.G.subscription.status, "نشط");
  assert.equal(e.G.finance.invoices.length, 1);
  assert.equal(e.G.finance.payments.length, 1);
  const invoice = e.financeInvoice(result.invoice.invoiceId);
  assert.equal(invoice.status, "paid");
  assert.equal(invoice.balance, 0);

  e.financeRefundStart(invoice.invoiceId);
  e.G.finance.refundDraft.reason = "إلغاء خلال المدة المسموحة";
  e.financeRefundSubmit();
  assert.equal(e.G.finance.refunds[0].status, "requested");
  e.financeRefundReview(e.G.finance.refunds[0].refundId, "approve");
  e.financeRefundProcess(e.G.finance.refunds[0].refundId);
  assert.equal(e.G.finance.refunds[0].status, "processed");
  assert.equal(invoice.status, "refunded");

  e.G.subscription.status = "نشط";
  e.financeCreateRenewal();
  assert.equal(e.G.finance.renewals.length, 1);
  const renewalInvoice = e.financeInvoice(e.G.finance.renewals[0].invoiceId);
  e.financePayRenewal(renewalInvoice.invoiceId);
  assert.equal(renewalInvoice.status, "paid");
  assert.equal(e.G.finance.renewals[0].status, "مكتمل");
});

test("الحماية تتدرج حسب الدور والاستعادة تغلق الجلسات السابقة", () => {
  const { e, node } = runtime(); resetState(e);
  e.G.user = "عميل مؤسسي";
  e.G.ctx = "عميل";
  e.G.clientType = "مؤسسة أو شركة خاصة";
  e.G.accountEmail = "client@example.com";
  e.migrateSecurity();
  assert.equal(e.securityPolicy().level, "معزز");
  assert.equal(e.securityScore(), 25);

  node("recovery-email").value = "client@example.com";
  node("recovery-method").value = "إيميل";
  e.recoveryStart();
  assert.equal(e.G.security.recovery.status, "code_sent");
  node("recovery-code").value = "123456";
  e.recoveryVerify();
  assert.equal(e.G.security.recovery.verified, true);

  e.G.security.sessions = [{ sessionId:"OLD", device:"قديم", current:false, status:"نشطة" }];
  node("new-password").value = "Secure@2026";
  node("confirm-new-password").value = "Secure@2026";
  e.recoveryResetPassword();
  assert.equal(e.G.security.sessions.length, 0);
  assert.ok(e.G.security.lastPasswordChange > 0);

  e.G.ctx = "متحقق";
  assert.equal(e.securityPolicy().mfa, "إلزامي");
  assert.equal(e.securityNeedsStepUp(), true);
  node("mfa-method").value = "تطبيق مصادقة";
  e.securityEnableMfa();
  assert.equal(e.G.security.mfaEnabled, true);
  assert.equal(e.securityNeedsStepUp(), false);
});

test("إدارة العميل تربط الفرصة بالمتابعة والمخاطر ومستوى الخدمة", () => {
  const { e } = runtime(); resetState(e);
  e.G.ctx = "عميل";
  e.G.clientAccounts = [{
    clientAccountId:"CLI-TEST", legalNameAr:"شركة الاختبار", type:"مؤسسة أو شركة خاصة",
    country:"سلطنة عُمان", verification:"متحقق", status:"نشط",
  }];
  e.G.activeClientAccountId = "CLI-TEST";
  e.migrateClientCRM();

  e.crmOpportunityNew();
  e.crmOppSet("title", "مشروع تحول رقمي");
  e.crmOppSet("service", "استشارات");
  e.crmOppSet("stage", "اكتشاف الاحتياج");
  e.crmOppSet("value", "100000");
  e.crmOppSet("probability", "50");
  e.crmOpportunitySave();
  const opp = e.G.clientCRM.opportunities[0];
  assert.equal(e.crmPipeline().weighted, 50000);
  e.crmOpportunityStage(opp.opportunityId, "إعداد العرض");
  assert.equal(opp.stage, "إعداد العرض");

  e.crmTaskNew(opp.opportunityId);
  e.crmTaskSet("title", "مراجعة العرض مع العميل");
  e.crmTaskSet("due", "2026-08-15");
  e.crmTaskSave();
  assert.equal(e.G.clientCRM.tasks.length, 1);
  e.crmTaskToggle(e.G.clientCRM.tasks[0].taskId);
  assert.equal(e.G.clientCRM.tasks[0].status, "مكتملة");

  e.crmRiskNew();
  e.crmRiskSet("type", "تأخر قرار");
  e.crmRiskSet("mitigation", "تحديد اجتماع قرار مع المفوض");
  e.crmRiskSave();
  assert.equal(e.G.clientCRM.risks[0].status, "مفتوحة");
  assert.equal(e.crmSlaEnsure().firstResponseHours, 24);
  assert.ok(e.G.clientCRM.activity.length >= 3);
});

test("بصمة الاحتياج مستقلة ومحوكمة وتحتفظ بالإصدارات", () => {
  const { e } = runtime(); resetState(e);
  e.G.clientNeeds = [{
    needId:"NEED-001", clientAccountId:"CLI-001", title:"إعداد خارطة تحول",
    outputType:"study", service:"إعداد دراسات", current:"وضع متفرق",
    target:"خارطة معتمدة", main:"التقنيات الرقمية والذكاء الاصطناعي",
    sub:"الحكومة الرقمية والتحول المؤسسي", practice:"التطوير",
  }];
  e.G.activeNeedId = "NEED-001";
  e.G.need = e.G.clientNeeds[0];
  e.migrateNeedFingerprints();
  const fp = e.needFingerprint();
  assert.equal(fp.needId, "NEED-001");
  assert.equal(fp.weights.specialty, 25);
  assert.ok(e.needFingerprintIssues().length > 0);

  e.needFpSet("businessOutcome", "اعتماد خارطة تحول قابلة للتنفيذ");
  e.needFpSet("successMeasures", "اعتماد الخارطة وبدء ثلاث مبادرات");
  e.needFpSet("scopeIncluded", "التشخيص والخارطة");
  e.needFpSet("scopeExcluded", "تنفيذ المبادرات");
  e.needFpSet("main", "التقنيات الرقمية والذكاء الاصطناعي");
  e.needFpSet("sub", "الحكومة الرقمية والتحول المؤسسي");
  e.needFpSet("practice", "التطوير");
  fp.acceptanceCriteria = ["اعتماد وثيقة"];
  fp.requiredEvidence = ["خبرة موثقة مماثلة"];
  assert.equal(e.needFingerprintIssues().length, 0);
  assert.equal(e.approveNeedFingerprint(), true);
  assert.equal(fp.status, "معتمدة");
  assert.equal(fp.versions.length, 1);
  e.reviseNeedFingerprint();
  assert.equal(fp.version, 2);
  assert.equal(fp.versions.length, 1);
  assert.equal(e.needFingerprintSnapshot(fp).versions, undefined);
});

test("إدارة المنصة توحد التدقيق وتطبق فصل الواجبات وقضايا المعالجة", () => {
  const { e } = runtime(); resetState(e);
  e.G.ctx = "مدير / مشغل المنصة";
  e.G.user = "مدير الاختبار";
  e.G.security.events = [{ eventId:"SEC-1", action:"محاولة دخول", status:"فشل", risk:"مرتفع", at:Date.now(), actor:"مستخدم" }];
  e.G.finance.audit = [{ auditId:"FIN-1", action:"إنشاء فاتورة", ref:"INV-1", at:Date.now(), actor:"مسؤول مالي" }];
  e.G.privacyAudit = [{ entityId:"ENT-1", action:"تغيير خصوصية", at:Date.now(), actor:"عضو" }];
  e.migratePlatformAdmin();
  const audit = e.unifiedAuditEvents();
  assert.ok(audit.some(x => x.domain === "الأمن"));
  assert.ok(audit.some(x => x.domain === "المالية"));
  assert.ok(audit.some(x => x.domain === "الخصوصية"));

  const approval = e.adminApprovalCreate("تعليق حساب", "ENT-1", "إدارة المنصة", "مرتفع", "اختبار");
  e.adminApprovalDecision(approval.approvalId, "اعتماد");
  assert.equal(approval.status, "بانتظار الاعتماد", "لا يعتمد مقدم الطلب طلبه");
  e.G.user = "مدقق مستقل";
  e.adminApprovalDecision(approval.approvalId, "اعتماد");
  assert.equal(approval.status, "معتمد");

  e.auditCaseNew("SEC-1");
  e.auditCaseSet("title", "مراجعة محاولة الدخول");
  e.auditCaseSet("finding", "محاولة فاشلة تحتاج مراجعة");
  e.auditCaseSet("correctiveAction", "مراجعة ضوابط الوصول");
  e.auditCaseSet("dueDate", "2026-08-31");
  e.auditCaseSave();
  assert.equal(e.G.platformAdmin.auditCases.length, 1);
  const c = e.G.platformAdmin.auditCases[0];
  e.auditCaseTransition(c.caseId, "مغلقة");
  assert.notEqual(c.status, "مغلقة", "لا تغلق القضية دون دليل معالجة");

  assert.ok(e.platformOperatorConflicts(["تأكيد التحويلات","طلبات الاسترداد"]).length > 0);
  assert.ok(e.platformWorkItems().length >= 1);
});

test("نماذج المركز والعميل لا تحتوي مفاتيح حقول مكررة أو خطوات بلا حقول", () => {
  const { e } = runtime();
  for (const type of ["مركز تدريب", "العميل"]) {
    const form = e.membershipForm(type);
    const keys = form.fields.map((f) => f[0]);
    assert.equal(new Set(keys).size, keys.length, `${type}: مفتاح حقل مكرر`);
    form.stepMap.forEach((stepKeys, i) => assert.ok(stepKeys.length > 0, `${type}: الخطوة ${i+1} فارغة`));
  }
});

test("جميع شاشات الخبير والمركز والعميل قابلة للتصيير دون انهيار", () => {
  const { e } = runtime(); resetState(e);
  e.G.memberships = ["خبير", "مركز تدريب", "العميل"];
  fillMembership(e, "مركز تدريب");
  fillMembership(e, "العميل");
  e.G.memberData["العميل"].clname = "شركة العميل الاختبارية";
  e.G.memberData["العميل"].clemail = "client@example.com";
  e.migrateClientWorkflow();
  e.migrateInstitutionalClients();
  e.W = {
    _private:{}, fullName:"خبير اختباري", englishName:"Test Expert",
    accountEmail:"expert@example.com", email:"expert@example.com",
    password:"Valid@123", confirmPassword:"Valid@123", accountRoles:["خبير"],
    preferredLanguage:"العربية", terms:"نعم",
  };
  const routes = {
    الخبير: [6,7,8,9,10,11,12,13,14,15,16,17,18,19,33,50,57],
    المركز: [35,36,37,40,42,43,45,54,56,68,69,70],
    العميل: [20,21,22,23,24,25,26,27,28,29,30,31,32,49,71,72,73,74,75,76,77,78,88,89,90,91,92],
    الإدارة: [79,86,93,94,95,96,97,98],
  };
  for (const [name, ids] of Object.entries(routes)) {
    for (const id of ids) {
      const html = e.RENDER[id]();
      assert.equal(typeof html, "string", `${name}: الشاشة ${id} لم تُرجع محتوى`);
      assert.ok(html.length > 20, `${name}: الشاشة ${id} أعادت محتوى ناقصًا`);
    }
  }
});
