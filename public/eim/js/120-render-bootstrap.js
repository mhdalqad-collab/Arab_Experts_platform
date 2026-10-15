/* =========================================================
   الموجّه الرئيسي
   ========================================================= */
const RENDER={
 1:rLogin,2:rWorkspace,3:rContexts,4:()=>tableView(data[4]),5:rSearch,
 6:rExpertCenter,7:rWizard,8:rRoles,9:rRoleDetails,10:rAddExperience,
 11:rEvidenceCenter,12:rAddEvidence,13:rEvidenceDetails,14:rVerifyCase,15:rVerifier,16:rDecision,
 17:rFingerprints,18:rFingerprintDetails,19:rLegacyExpertPublic,
 20:rClientHub,21:rCreateNeed,22:rNeedDetails,23:rTaskFingerprint,24:rReadiness,25:rMatches,26:rMatchExplain,27:rCompare,28:rShortlist,29:rSelectDecision,
 71:rServiceRequests,72:rServiceRequestComposer,73:rServiceRequestDetail,
 74:rInstitutionalClient,75:rClientRepresentatives,76:rClientPortfolio,77:rClientInteractions,78:rClientBillingGovernance,
  80:rFinanceCenter,81:rFinanceInvoice,82:rFinanceRefunds,83:rFinanceRenewal,
  84:rAccountRecovery,85:rAccountSecurity,86:rSecurityOperations,87:rRecoveryVerification,
  88:rClientRelationship,89:rClientOpportunities,90:rClientTasks,91:rClientRiskSla,92:rClientAnalytics,
  93:rPlatformCommand,94:rPlatformWorkApprovals,95:rPlatformOperators,96:rUnifiedAudit,97:rAuditCases,98:rPlatformPolicies,
  99:rKnowledgePublic,100:rResearchRegistry,101:rPublicationRepository,102:rEventsCalendar,103:rKnowledgeLibrary,104:rKnowledgeEditor,
  105:rGovernanceCenter,106:rRolePermissionMatrix,107:rPrivacyCenter,108:rIntegrationsRegistry,109:rProviderRequests,110:rServiceContracts,111:rServiceProjects,112:rReputationQuality,
 30:rProposal,31:rDelivery,32:rComplaint,
 33:rWizard,34:rTrainingHome,35:rCatalog,36:rCourseDetail,37:rEnrollment,
 38:()=>hub(data[38]),39:rTrainerDashboard,40:rCenterDashboard,
 41:()=>rSearchDir('trainer'),42:()=>rSearchDir('center'),43:rLegacyCenterPublic,
 44:rAccountType,45:()=>rMembershipForm('مركز تدريب'),46:()=>rMembershipForm('مدرب'),47:()=>rMembershipForm('مستشار'),48:()=>rMembershipForm('باحث / أكاديمي'),49:()=>rMembershipForm('العميل'),
 50:()=>rSearchDir('expert'),51:()=>rSearchDir('researcher'),52:()=>rMembershipForm('مدير / مشغل المنصة'),53:rMembershipCases,54:rDocumentCenter,55:rSubscriptionCheckout,56:rCourseCreate,
 57:rUnifiedPublicProfile,58:()=>rSearchDir('consultant'),59:rEntityRegistry,
 60:rHome,61:rWorkFields,63:rAbout,64:rPrograms,65:rEntry,66:rContact,67:rRegister,68:rCourseOfferings,69:rTaxonomyCrosswalk,70:rCourseGovernance,79:rDatabaseERD};
const SITE_GROUP={name:'الموقع العام',items:[[60,'الرئيسية'],[63,'من نحن'],[61,'مجالات العمل'],[64,'البرامج والمبادرات'],[5,'البحث'],[99,'المعرفة والفعاليات'],[65,'الدخول والتسجيل'],[66,'تواصل معنا']]};
function enhanceVisuals(){
  document.querySelectorAll('#view table.tbl').forEach(table=>{
    table.classList.add('responsive');let heads=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(tr=>[...tr.children].forEach((td,i)=>{if(!td.dataset.label)td.dataset.label=heads[i]||''}))
  });
  document.querySelectorAll('#view button:not([aria-label])').forEach(b=>{let t=b.textContent.replace(/\s+/g,' ').trim();if(t)b.setAttribute('aria-label',t)});
  document.querySelectorAll('#view input[required],#view select[required],#view textarea[required]').forEach(x=>x.setAttribute('aria-required','true'));
}
function render(){current=currentId();
  let hN=parseInt(location.hash.replace('#/',''));
  if(!location.hash||hN!==current)history.replaceState(null,'','#/'+current)
  buildNav();refreshChrome();
  let d=data[current];
  const SITE_TITLES={60:'الرئيسية',61:'مجالات العمل',63:'من نحن',64:'البرامج والمبادرات',65:'الدخول والتسجيل',66:'تواصل معنا',67:'التسجيل والاشتراكات',84:'استعادة الحساب',85:'أمان الحساب',86:'مراقبة الحماية',87:'التحقق وإعادة التعيين',99:'المعرفة والفعاليات',100:'المشاريع البحثية',101:'المنشورات',102:'الفعاليات',103:'المكتبة المعرفية',104:'محرر المعرفة',105:'الحوكمة والامتثال',106:'الأدوار والصلاحيات',107:'الخصوصية والموافقات',108:'التكاملات'};
  $('crumb').textContent=d?d.title:(SITE_TITLES[current]||SEARCH_DIRS[{50:'expert',51:'researcher',58:'consultant'}[current]||'']?.title||'');
  try{$('view').innerHTML=(RENDER[current]||(()=>hub(d||{ctx:'',title:'قريبًا',desc:''})))()}
  catch(error){console.error('[EIM render]',error);$('view').innerHTML=`<div class="recovery-state" role="alert"><div class="recovery-icon">!</div><h2>تعذر عرض هذه الصفحة</h2><p>بياناتك محفوظة. يمكنك إعادة المحاولة أو العودة إلى الصفحة الرئيسية.</p><div class="acts"><button class="btn primary" onclick="render()">إعادة المحاولة</button><button class="btn ghost" onclick="go(60)">الصفحة الرئيسية</button></div></div>`}
  enhanceVisuals();
  window.scrollTo({top:0});
  toggleSidebar(false)}
/* ===== بيانات تجريبية ===== */
function seedDemo(){if(!confirm('تعبئة المنظومة ببيانات تجريبية للاستكشاف؟'))return;
  G.user='سارة الحربي';G.completed=['خبير','مدرب'];G.memberships=['خبير','مدرب'];G.ctx='خبير مستقل';
  G.need={needId:'NEED-DEMO-001',title:'قائد تحول رقمي لجهة حكومية',service:'طلب استشارة متخصصة',role:'مستشار',main:'التقنيات الرقمية والذكاء الاصطناعي',sub:'الحكومة الرقمية والتحول المؤسسي',practice:'التطوير',current:'بنية تحتية رقمية متفرقة',target:'خارطة طريق موحدة مع حوكمة',country:'سلطنة عُمان',language:'العربية',duration:'3–6 أشهر',mode:'هجين',budget:'85000',conf:'مقيد — للمرشحين فقط',mandatory:['specialty','evidence'],preferred:MATCH_CRITERIA.map(x=>x[0]),status:'قيد المطابقة',published:true,createdAt:Date.now()};
  G.clientNeeds=[G.need];G.activeNeedId=G.need.needId;G.candidateCompare[G.need.needId]=['dir:consultant:0','dir:consultant:3'];G.candidateShortlist[G.need.needId]=['dir:consultant:0','dir:consultant:3'];
  let dom='الطاقة والتعدين',sp='الطاقة المتجددة والهيدروجين',sub='التصميم';
  W={country:'المملكة العربية السعودية',city:'الرياض',fullName:'د. سارة بنت خالد الحربي',englishName:'Dr. Sarah K. Alharbi',
  accountEmail:'sara.harbi@example.com',email:'sara.harbi@example.com',password:'',confirmPassword:'',
  accountRoles:['خبير','مدرب'],preferredLanguage:'العربية',terms:'نعم',gender:'أنثى',nationality:'المملكة العربية السعودية',
  phoneCode:'+966',phone:'501234567',linkedin:'https://linkedin.com/in/sarah-alharbi',
  domain:dom,specialty:sp,subspecialty:sub,appliedAreas:((TAX_DETAILS[dom]||{})[sp]||{})[sub]?.slice(0,3)||[],
  specialtyYears:'12',isPrimary:'نعم',expertise:'خبير استشاري',
  sectors:['الطاقة والمرافق','الصناعة وسلاسل الإمداد'],professionalRoles:['مدرب','مستشار'],services:['استشارات','تدريب','إعداد دراسات'],
  specializationRecords:[{domain:dom,specialty:sp,subspecialty:sub,appliedAreas:((TAX_DETAILS[dom]||{})[sp]||{})[sub]?.slice(0,3)||[],expertise:'خبير استشاري',specialtyYears:'12',isPrimary:'نعم',sectors:['الطاقة والمرافق'],professionalRoles:['مدرب','مستشار'],services:['استشارات','تدريب']}],
  qualifications:[{degree:'دكتوراه',specialization:'هندسة الطاقة المتجددة',institution:'جامعة الملك فهد للبترول والمعادن',country:'المملكة العربية السعودية',year:'2015-06-01',grade:'امتياز',file:['phd.pdf']},{degree:'ماجستير',specialization:'إدارة الطاقة',institution:'جامعة الملك عبدالعزيز',country:'المملكة العربية السعودية',year:'2011-06-01',grade:'امتياز',file:[]}],
  accreditations:[{name:'PMP',issuer:'PMI',number:'PMP-8842130',issued:'2018-03-01',expires:'2027-03-01',verification:'https://pmi.org/verify',file:['pmp.pdf']}],
  experiences:[{jobLevel:'إدارة عليا',title:'مديرة إدارة الطاقة المتجددة',organization:'أكوا باور',country:'المملكة العربية السعودية',start:'2019-01-01',end:'',current:'نعم',description:'قيادة محفظة مشاريع بقدرة 2.4 جيجاواط.',achievements:'خفض تكلفة الطاقة 18%.'}],
  projects:[{name:'مشروع سكاكا للطاقة الشمسية',sector:'الطاقة والمرافق',country:'المملكة العربية السعودية',year:'2021-11-01',value:'320000000',role:'مسؤولية كاملة',responsibilities:'الإشراف على التصميم والتنفيذ.',achievements:'تشغيل قبل الموعد.',proof:[]}],
  trainerCourses:[{course:'تصميم أنظمة الطاقة الشمسية المتقدمة',language:'العربية',days:'5',hours:'30',level:'متقدم',times:'8',lastDate:'2025-11-10',rating:'★★★★★',bag:[]}],
  skills:[{name:'نمذجة أنظمة الطاقة',level:'خبير'},{name:'إدارة المشاريع',level:'خبير'}],
  languageRecords:[{language:'العربية',reading:'C2',writing:'C2',speaking:'C2'},{language:'الإنجليزية',reading:'C1',writing:'C1',speaking:'C1'}],
  availableFrom:'2026-08-01',availableTo:'2027-06-30',deliveryModes:'هجين',
  pricing:[{service:'استشارة',mode:'عن بعد',hour:'180',day:'1200'}],
  cv:['CV_Sarah.pdf'],identity:[],passport:[],certificates:[],introVideo:'',photos:[],secrecy:'إظهار المعلومات المسموحة فقط',consent:'نعم',declaration:'نعم',
  _private:{phone:true}};
  step=0;review=false;submitted=false;persist(true);go(2);toast('عُبّئت بيانات تجريبية — استكشف المنظومة')}
function resetAll(){if(!confirm('مسح جميع البيانات والبدء من جديد؟'))return;localStorage.removeItem('eim5');localStorage.removeItem('eim5wiz');location.reload()}
/* ===== الإقلاع =====
   أدلة الخبراء والمستشارين والباحثين والمدربين والمراكز والدورات
   تُفتح من «البحث» العام؛ لذلك لا نكررها في مجموعة جانبية مستقلة. */
if(G.lastSave){let d=new Date(G.lastSave);$('saved').textContent='آخر حفظ '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
document.addEventListener('keydown',e=>{if(e.key==='Escape')toggleSidebar(false);if(e.key==='/'&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='TEXTAREA'&&document.activeElement.tagName!=='SELECT'){e.preventDefault();go(5)}});
window.addEventListener('error',e=>{console.error('[EIM global]',e.error||e.message)});
window.addEventListener('unhandledrejection',e=>{console.error('[EIM promise]',e.reason)});
function safeBootTask(name,task){try{task()}catch(error){console.error('[EIM boot] '+name,error);(window.__EIM_BOOT_ERRORS=window.__EIM_BOOT_ERRORS||[]).push({name,message:error?.message||String(error)})}}
applyTheme(document.documentElement.dataset.theme,false);
render();
safeBootTask('unified-registry',migrateUnifiedRegistry);
safeBootTask('course-governance',migrateCourseGovernance);
safeBootTask('client-workflow',migrateClientWorkflow);
safeBootTask('institutional-clients',migrateInstitutionalClients);
safeBootTask('finance-subscriptions',migrateFinance);
safeBootTask('account-security',migrateSecurity);
safeBootTask('client-crm',migrateClientCRM);
safeBootTask('need-fingerprints',migrateNeedFingerprints);
safeBootTask('platform-admin',migratePlatformAdmin);
safeBootTask('knowledge-research-events',migrateKnowledge);
safeBootTask('governance-privacy-integrations',migrateGovernance);
safeBootTask('membership-server-restore',membershipServerRestore);
safeBootTask('account-dashboard-restore',accountDashboardRestore);
safeBootTask('client-workspace-server-restore',clientWorkspaceServerRestore);
safeBootTask('professional-directory-server-restore',professionalDirectoryServerRestore);
safeBootTask('provider-inbox-migrate',migrateProviderInbox);
safeBootTask('provider-inbox-restore',providerRequestsRestore);
safeBootTask('service-proposals-migrate',migrateServiceProposals);
safeBootTask('service-proposals-restore',serviceProposalsRestore);
safeBootTask('service-contracts-migrate',migrateServiceContracts);
safeBootTask('service-contracts-restore',serviceContractsRestore);
safeBootTask('service-projects-migrate',migrateServiceProjects);
safeBootTask('project-closures-migrate',migrateProjectClosures);
safeBootTask('reputation-migrate',migrateReputation);
safeBootTask('quality-complaints-migrate',migrateQualityComplaints);
safeBootTask('service-projects-restore',serviceProjectsRestore);
safeBootTask('reputation-restore',reputationRestore);
safeBootTask('quality-complaints-restore',qualityComplaintsRestore);
render();setTimeout(()=>persist(true),600);
