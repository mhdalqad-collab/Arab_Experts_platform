/* ===== الحالة العامة ===== */
let G={ctx:'خبير مستقل',user:null,memberships:[],completed:[],activeMembership:null,membershipStatus:{},memberData:{},accountDashboard:{notifications:[],unreadCount:0},clientAccounts:[],activeClientAccountId:'',clientAccountDraft:null,clientRepresentatives:[],activeClientRepresentativeId:'',clientRepresentativeDraft:null,clientUnits:[],clientBillingProfiles:[],clientInteractions:[],clientGovernanceLog:[],clientPortfolio:{proposals:[],contracts:[],projects:[],invoices:[],reviews:[],complaints:[]},clientCRM:{opportunities:[],tasks:[],risks:[],segments:[],sla:[],notes:[],activity:[],activeOpportunityId:'',opportunityDraft:null,taskDraft:null,riskDraft:null,filters:{q:'',stage:'all'}},need:null,clientNeeds:[],activeNeedId:'',needDraft:null,needFingerprints:{},requestDraft:null,clientRequests:[],activeRequestId:'',requestFilters:{status:'all',q:''},requestNotifications:[],providerRequests:[],activeProviderRequestId:'',serviceProposals:[],activeProposalId:'',candidateCompare:{},candidateShortlist:{},matchingWeights:{specialty:25,practice:15,sector:10,evidence:10,experience:10,language:5,country:5,availability:5,price:5,rating:10},matchingRuns:[],activeMatchRunId:'',explainCandidateRef:'',selectionDecisions:[],shortlist:[],evidences:[],claims:{},enrollments:[],drafts:{},tab:{},checkout:null,subscription:null,finance:{invoices:[],payments:[],refunds:[],renewals:[],audit:[],activeInvoiceId:'',refundDraft:null},security:{mfaEnabled:false,mfaMethod:'',verifiedEmail:false,verifiedPhone:false,recoveryCodes:[],trustedDevices:[],sessions:[],events:[],recovery:null,loginFailures:0,lockedUntil:0,lastPasswordChange:0},platformAdmin:{operators:[],approvals:[],auditCases:[],policies:[],configChanges:[],workItems:[],adminAudit:[],filters:{q:'',domain:'all',risk:'all',actor:'',from:'',to:''},operatorDraft:null,caseDraft:null,policyDraft:null,activeCaseId:''},courseBuilder:null,createdCourses:[],courseRelations:[],courseOfferings:[],offeringBuilder:null,courseVersions:[],courseAliases:[],duplicateCases:[],duplicateCandidates:[],courseSemanticLinks:[],versionBuilder:null,governanceCourseId:'',taxonomyCrosswalks:[],crosswalkBuilder:null,crosswalkSuggestions:[],courseCompare:[],publicProfile:null,entities:[],entityRelations:[],memberEntityIds:{},entityMergeLog:[],privacyAudit:[],primaryPersonEntityId:null,lastSave:null};
try{let x=JSON.parse(localStorage.eim5||'null');if(x)G=Object.assign(G,x)}catch(e){}
let W={_private:{}},step=0,review=false,errors={},recEdit=null,recDraft={},submitted=false;
try{let x=JSON.parse(localStorage.eim5wiz||'null');if(x){W=Object.assign(W,x.state||{});step=x.step||0;review=!!x.review;submitted=!!x.submitted}}catch(e){}
W._private=W._private||{};
G.membershipStatus=G.membershipStatus||{};
G.memberData=G.memberData||{};
G.membershipLifecycle=G.membershipLifecycle||{};
G.checkout=G.checkout||null;
G.subscription=G.subscription||null;
G.finance=G.finance||{invoices:[],payments:[],refunds:[],renewals:[],audit:[],activeInvoiceId:'',refundDraft:null};
G.security=G.security||{mfaEnabled:false,mfaMethod:'',verifiedEmail:false,verifiedPhone:false,recoveryCodes:[],trustedDevices:[],sessions:[],events:[],recovery:null,loginFailures:0,lockedUntil:0,lastPasswordChange:0};
G.clientCRM=G.clientCRM||{opportunities:[],tasks:[],risks:[],segments:[],sla:[],notes:[],activity:[],activeOpportunityId:'',opportunityDraft:null,taskDraft:null,riskDraft:null,filters:{q:'',stage:'all'}};
G.needFingerprints=G.needFingerprints||{};
G.platformAdmin=G.platformAdmin||{operators:[],approvals:[],auditCases:[],policies:[],configChanges:[],workItems:[],adminAudit:[],filters:{q:'',domain:'all',risk:'all',actor:'',from:'',to:''},operatorDraft:null,caseDraft:null,policyDraft:null,activeCaseId:''};
G.accountDashboard=G.accountDashboard||{notifications:[],unreadCount:0};
G.knowledge=G.knowledge||{researchProjects:[],publications:[],events:[],assets:[],lessons:[],registrations:[],draft:null,filters:{q:'',type:'all',status:'all'},activeId:''};
G.governance=G.governance||{roles:[],permissions:[],grants:[],accessReviews:[],privacyPolicies:[],consents:[],integrations:[],syncRuns:[],changes:[],activeRole:'',integrationDraft:null};
G.courseBuilder=G.courseBuilder||null;
G.createdCourses=Array.isArray(G.createdCourses)?G.createdCourses:[];
G.courseRelations=Array.isArray(G.courseRelations)?G.courseRelations:[];
G.courseOfferings=Array.isArray(G.courseOfferings)?G.courseOfferings:[];
G.offeringBuilder=G.offeringBuilder||null;
G.courseVersions=Array.isArray(G.courseVersions)?G.courseVersions:[];
G.courseAliases=Array.isArray(G.courseAliases)?G.courseAliases:[];
G.duplicateCases=Array.isArray(G.duplicateCases)?G.duplicateCases:[];
G.duplicateCandidates=Array.isArray(G.duplicateCandidates)?G.duplicateCandidates:[];
G.courseSemanticLinks=Array.isArray(G.courseSemanticLinks)?G.courseSemanticLinks:[];
G.versionBuilder=G.versionBuilder||null;
G.governanceCourseId=G.governanceCourseId||'';
G.taxonomyCrosswalks=Array.isArray(G.taxonomyCrosswalks)?G.taxonomyCrosswalks:[];
G.crosswalkBuilder=G.crosswalkBuilder||null;
G.crosswalkSuggestions=Array.isArray(G.crosswalkSuggestions)?G.crosswalkSuggestions:[];
G.courseCompare=Array.isArray(G.courseCompare)?G.courseCompare:[];
G.publicProfile=G.publicProfile||null;
G.entities=Array.isArray(G.entities)?G.entities:[];
G.entityRelations=Array.isArray(G.entityRelations)?G.entityRelations:[];
G.memberEntityIds=G.memberEntityIds||{};
G.entityMergeLog=Array.isArray(G.entityMergeLog)?G.entityMergeLog:[];
G.privacyAudit=Array.isArray(G.privacyAudit)?G.privacyAudit:[];
G.savedDirectorySearches=G.savedDirectorySearches||{};
const LIFE_STATES={
 not_started:{label:'لم يبدأ',cls:'gray'},draft:{label:'مسودة',cls:'blue'},data_complete:{label:'بيانات مكتملة',cls:'green'},
 submitted:{label:'مرسلة للتحقق',cls:'amber'},under_review:{label:'قيد المراجعة',cls:'amber'},needs_changes:{label:'مطلوب استكمال',cls:'red'},
 approved:{label:'معتمدة',cls:'green'},rejected:{label:'مرفوضة',cls:'red'},suspended:{label:'معلقة',cls:'gray'},
 renewal_due:{label:'بحاجة إلى تجديد',cls:'amber'},expired:{label:'منتهية',cls:'red'}};
const LIFE_TRANSITIONS={
 not_started:['draft'],draft:['data_complete'],data_complete:['draft','submitted'],submitted:['under_review','needs_changes'],
 under_review:['approved','needs_changes','rejected'],needs_changes:['draft','submitted'],approved:['submitted','renewal_due','suspended'],
 rejected:['draft'],suspended:['under_review'],renewal_due:['submitted','expired'],expired:['draft']};
const LEGACY_LIFE_MAP={'لم يبدأ':'not_started','قيد الإدخال':'draft','بيانات مكتملة':'data_complete','مرسلة للتحقق':'submitted'};
function ensureLife(type){let old=G.membershipStatus[type],fallback=G.completed.includes(type)?'data_complete':(LEGACY_LIFE_MAP[old]||'not_started');
  if(!G.membershipLifecycle[type])G.membershipLifecycle[type]={state:fallback,dirty:false,history:[{state:fallback,at:Date.now(),actor:'ترحيل تلقائي',note:'نُقلت الحالة السابقة دون حذفها'}]};
  let L=G.membershipLifecycle[type];L.history=Array.isArray(L.history)?L.history:[];return L}
function lifeMeta(type){let L=ensureLife(type),m=LIFE_STATES[L.state]||LIFE_STATES.not_started;return{...m,state:L.state,dirty:!!L.dirty}}
function lifeTransition(type,to,actor='المستخدم',note=''){let L=ensureLife(type),allowed=LIFE_TRANSITIONS[L.state]||[];
  if(!allowed.includes(to)){toast('الانتقال غير مسموح من «'+(LIFE_STATES[L.state]?.label||L.state)+'» إلى «'+(LIFE_STATES[to]?.label||to)+'»');return false}
  L.state=to;L.dirty=false;L.updatedAt=Date.now();L.history.push({state:to,at:L.updatedAt,actor,note});G.membershipStatus[type]=LIFE_STATES[to].label;
  persist(true);return true}
function markMembershipDirty(type){let L=ensureLife(type);L.dirty=true;
  if(['not_started','needs_changes','rejected','expired'].includes(L.state)){L.state='draft';L.history.push({state:'draft',at:Date.now(),actor:'المستخدم',note:'بدأ إدخال البيانات أو استكمالها'});G.membershipStatus[type]=LIFE_STATES.draft.label}
  persist(true)}
/* =========================================================
   EIM 5.9.3 — سجل الكيانات الموحد
   هوية أساسية واحدة ← عضويات متعددة ← ملفات وعلاقات
   ========================================================= */
const PERSONAL_MEMBERSHIPS=['خبير','مدرب','مستشار','باحث / أكاديمي','مدير / مشغل المنصة'];
function entityNorm(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
function entityNewId(kind='P'){let n=String((G.entities||[]).length+1).padStart(5,'0');return `ENT-${kind}-${n}-${String(Date.now()).slice(-5)}`}
function entitySource(type){
  if(type==='خبير')return{nameAr:W.fullName||G.user||'',nameEn:W.englishName||'',email:W.email||W.accountEmail||'',phone:W.phone||'',country:W.country||'',registrationNo:'',entityClass:'person'};
  let v=G.memberData[type]||{},m={
    'مركز تدريب':['legalName','centerEnglishName','cemail','cphone','regCountry','regNo','organization'],
    'مدرب':['tname','tenglish','temail','tphone','tcountry','','person'],
    'مستشار':['cname','cenglish','cemail2','cphone2','ccountry','','person'],
    'باحث / أكاديمي':['rname','renglish','remail','rphone','rcountry','','person'],
    'العميل':['clientLegalName','', 'clemail','authorizedPhone','clcountry','clientRegNo','client'],
    'مدير / مشغل المنصة':['aname','', 'aemail','aphone','acountry','','person']
  }[type]||['','','','','','','person'];
  let cls=m[6]==='client'?(v.cltype&&v.cltype!=='فردي مستقل'?'organization':'person'):m[6];
  return{nameAr:v[m[0]]||v.clname||G.user||'',nameEn:v[m[1]]||'',email:v[m[2]]||'',phone:v[m[3]]||'',country:v[m[4]]||'',registrationNo:v[m[5]]||'',entityClass:cls}
}
function entityFindStrong(src){
  let email=entityNorm(src.email),reg=entityNorm(src.registrationNo);
  return G.entities.find(e=>e.status!=='merged'&&e.entityClass===src.entityClass&&(src.entityClass==='organization'?(reg&&entityNorm(e.registrationNo)===reg):(email&&entityNorm(e.email)===email)))||null
}
function entityMembership(e,type){e.memberships=Array.isArray(e.memberships)?e.memberships:[];let m=e.memberships.find(x=>x.type===type);
  if(!m){m={membershipId:`MEM-${String(Date.now()).slice(-7)}-${e.memberships.length+1}`,type,dataRef:type,createdAt:Date.now()};e.memberships.push(m)}
  let lm=lifeMeta(type);m.state=lm.state;m.status=lm.label;m.dirty=lm.dirty;m.updatedAt=Date.now();m.publicProfileId=`PUB-${e.entityId}-${type}`;return m}
function entityRelation(from,to,type,label){if(!from||!to||from===to)return;let exists=G.entityRelations.some(r=>r.from===from&&r.to===to&&r.type===type);if(!exists)G.entityRelations.push({relationId:`REL-${String(Date.now()).slice(-8)}-${G.entityRelations.length+1}`,from,to,type,label,status:'active',createdAt:Date.now()})}
function syncUnifiedEntity(type){
  let src=entitySource(type),personal=PERSONAL_MEMBERSHIPS.includes(type)||(type==='العميل'&&src.entityClass==='person'),e=null;
  if(personal&&G.primaryPersonEntityId)e=G.entities.find(x=>x.entityId===G.primaryPersonEntityId&&x.status!=='merged');
  if(!e&&G.memberEntityIds[type])e=G.entities.find(x=>x.entityId===G.memberEntityIds[type]&&x.status!=='merged');
  if(!e)e=entityFindStrong(src);
  if(!e){e={entityId:entityNewId(src.entityClass==='organization'?'O':'P'),entityClass:src.entityClass,status:'active',verificationStatus:'unverified',createdAt:Date.now(),updatedAt:Date.now(),aliases:[],memberships:[]};G.entities.push(e)}
  ['nameAr','nameEn','email','phone','country','registrationNo'].forEach(k=>{if(src[k])e[k]=src[k]});
  e.displayName=e.nameAr||e.nameEn||G.user||'كيان غير مسمى';e.canonicalName=entityNorm(e.displayName);e.updatedAt=Date.now();entityMembership(e,type);G.memberEntityIds[type]=e.entityId;
  if(personal&&!G.primaryPersonEntityId)G.primaryPersonEntityId=e.entityId;
  if(src.entityClass==='organization'&&G.primaryPersonEntityId)entityRelation(G.primaryPersonEntityId,e.entityId,'authorized_representative','ممثل مخول / مسؤول الحساب');
  return e}
function migrateUnifiedRegistry(){
  let types=[...new Set([...(G.memberships||[]),...(G.completed||[]),...Object.keys(G.memberData||{})])];
  if(W.fullName||G.memberships.includes('خبير'))types.unshift('خبير');
  types.filter(t=>t&&t!=='undefined').forEach(syncUnifiedEntity);
  let person=G.primaryPersonEntityId;if(person)G.entities.filter(e=>e.entityClass==='organization'&&e.status!=='merged').forEach(e=>entityRelation(person,e.entityId,'authorized_representative','ممثل مخول / مسؤول الحساب'));
  syncDirectoryEntities();
}
function syncDirectoryEntities(){let role={expert:'خبير',researcher:'باحث / أكاديمي',trainer:'مدرب',center:'مركز تدريب',consultant:'مستشار'};
  Object.entries(SEARCH_DIRS||{}).forEach(([kind,M])=>(M.list||[]).forEach((x,i)=>{let ref=`directory:${kind}:${i}`,e=G.entities.find(z=>z.sourceRef===ref),cls=kind==='center'?'organization':'person';
    if(!e){e={entityId:`ENT-${cls==='organization'?'O':'P'}-DIR-${kind.toUpperCase()}-${String(i+1).padStart(3,'0')}`,entityClass:cls,status:'active',sourceSystem:'directory',sourceRef:ref,createdAt:Date.now(),aliases:[],memberships:[]};G.entities.push(e)}
    e.nameAr=x.name;e.displayName=x.name;e.canonicalName=entityNorm(x.name);e.country=x.country;e.city=x.city||'';e.verificationStatus=x.verified?'verified':'unverified';e.rating=x.rating;e.updatedAt=Date.now();x.entityId=e.entityId;
    let t=role[kind];if(t&&!e.memberships.some(m=>m.type===t))e.memberships.push({membershipId:`MEM-DIR-${kind}-${i+1}`,type:t,dataRef:ref,state:x.verified?'approved':'under_review',status:x.verified?'معتمدة':'قيد المراجعة',publicProfileId:`PUB-${e.entityId}-${t}`,createdAt:Date.now(),updatedAt:Date.now()})
  }))}
function entityDuplicatePairs(){let a=G.entities.filter(e=>e.status!=='merged'),out=[];
  for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){let A=a[i],B=a[j];if(A.entityClass!==B.entityClass)continue;let reasons=[];
    if(A.registrationNo&&entityNorm(A.registrationNo)===entityNorm(B.registrationNo))reasons.push('رقم التسجيل متطابق');
    if(A.email&&entityNorm(A.email)===entityNorm(B.email))reasons.push('البريد الإلكتروني متطابق');
    if(A.canonicalName&&A.canonicalName===B.canonicalName&&entityNorm(A.country)===entityNorm(B.country))reasons.push('الاسم والدولة متطابقان');
    if(reasons.length)out.push({a:A,b:B,reasons,score:reasons.some(x=>x.includes('التسجيل'))?100:reasons.some(x=>x.includes('البريد'))?95:70})}
  return out}
function mergeEntities(primaryId,secondaryId){let a=G.entities.find(e=>e.entityId===primaryId),b=G.entities.find(e=>e.entityId===secondaryId);if(!a||!b||a===b||b.status==='merged')return;
  if(!confirm(`توحيد «${b.displayName}» داخل «${a.displayName}»؟ لن تُحذف البيانات؛ سيُحفظ السجل الثاني كسجل مدمج قابل للتدقيق.`))return;
  a.aliases=[...new Set([...(a.aliases||[]),b.displayName,...(b.aliases||[])].filter(Boolean))];
  (b.memberships||[]).forEach(m=>{if(!a.memberships.some(x=>x.type===m.type))a.memberships.push(m);G.memberEntityIds[m.type]=a.entityId});
  G.entityRelations.forEach(r=>{if(r.from===b.entityId)r.from=a.entityId;if(r.to===b.entityId)r.to=a.entityId});
  G.entityRelations.forEach(r=>{if(r.from===r.to)r.status='merged_duplicate'});
  b.status='merged';b.mergedInto=a.entityId;b.mergedAt=Date.now();a.updatedAt=Date.now();
  G.entityMergeLog.push({primaryId:a.entityId,secondaryId:b.entityId,at:Date.now(),actor:G.user||'مدير المنصة',snapshot:{displayName:b.displayName,memberships:(b.memberships||[]).map(x=>x.type)}});
  persist(true);render();toast('تم توحيد السجلين مع الاحتفاظ بأثر الدمج')}
function entityDetail(id){let e=G.entities.find(x=>x.entityId===id);if(!e)return;let rel=G.entityRelations.filter(r=>r.from===id||r.to===id),aud=G.privacyAudit.filter(a=>a.entityId===id).slice(-5).reverse();
  openModal(`<h3>${esc(e.displayName)} <button class="btn xs ghost x" onclick="closeOverlay()">✕</button></h3>
    <div class="chips"><span class="tagb ${e.entityClass==='organization'?'amber':'blue'}">${e.entityClass==='organization'?'منظمة':'شخص'}</span><span class="tagb ${e.status==='active'?'green':'gray'}">${e.status==='active'?'نشط':'مدمج'}</span><span class="entity-id">${esc(e.entityId)}</span></div>
    ${pubRows([['الاسم العربي',e.nameAr],['الاسم الإنجليزي',e.nameEn],['الدولة',e.country],['البريد الإلكتروني',e.email],['الهاتف',e.phone],['رقم التسجيل',e.registrationNo]],{})}
    <h4 style="margin:16px 0 8px">العضويات المرتبطة</h4><div class="chips">${(e.memberships||[]).map(m=>G.memberEntityIds[m.type]===e.entityId?`<button class="chip" onclick="closeOverlay();previewMembershipPublic('${enc(m.type)}')">${esc(m.type)} · ${esc(m.status||m.state)} · معاينة العام</button>`:`<span class="chip static">${esc(m.type)} · ${esc(m.status||m.state)}</span>`).join('')||'—'}</div>
    <h4 style="margin:16px 0 8px">العلاقات</h4>${rel.map(r=>{let other=G.entities.find(x=>x.entityId===(r.from===id?r.to:r.from));return`<div class="entity-rel"><span class="tagb gray">${esc(r.label)}</span><b>${esc(other?.displayName||'—')}</b></div>`}).join('')||'<small class="hint">لا توجد علاقات مسجلة.</small>'}
    <h4 style="margin:16px 0 8px">آخر تغييرات الخصوصية</h4>${aud.map(a=>`<div class="entity-rel"><span class="tagb ${a.visibility==='public'?'green':'gray'}">${a.visibility==='public'?'ظاهر':'مخفي'}</span><b>${esc(a.membership)} · ${esc(a.field)}</b><small>${new Date(a.at).toLocaleString('ar')}</small></div>`).join('')||'<small class="hint">لا توجد تغييرات مسجلة بعد.</small>'}`)}
function registrySet(k,v){G.entityFilter=G.entityFilter||{};G.entityFilter[k]=v;persist(true);render()}
function rEntityRegistry(){migrateUnifiedRegistry();let f=G.entityFilter||{},all=G.entities||[],dups=entityDuplicatePairs(),list=all.filter(e=>(f.status==='all'||!f.status?e.status!=='merged':e.status===f.status)&&(!f.cls||e.entityClass===f.cls)&&(!f.q||[e.displayName,e.nameEn,e.email,e.registrationNo,e.entityId].filter(Boolean).join(' ').includes(f.q)));
  let people=all.filter(e=>e.entityClass==='person'&&e.status!=='merged').length,orgs=all.filter(e=>e.entityClass==='organization'&&e.status!=='merged').length;
  return pagehead(data[59],`<button class="btn ghost sm" onclick="migrateUnifiedRegistry();persist(true);render()">تحديث السجل ↻</button>`)+metrics([['الكيانات النشطة',people+orgs],['الأشخاص',people,'green'],['المنظمات',orgs],['اشتباه تكرار',dups.length,dups.length?'amber':'green']])+`
  ${dups.length?`<div class="registry-alert mt"><h3>⚠ سجلات تحتاج مراجعة قبل الدمج</h3>${dups.map(d=>`<div class="entity-rel"><span class="tagb amber">${d.score}% تشابه</span><b>${esc(d.a.displayName)}</b><span>↔</span><b>${esc(d.b.displayName)}</b><small>${esc(d.reasons.join('، '))}</small><span class="sp"></span><button class="btn xs ghost" onclick="mergeEntities('${d.a.entityId}','${d.b.entityId}')">مراجعة وتوحيد</button></div>`).join('')}</div>`:''}
  <div class="card filterbar mt"><input class="ctl" placeholder="الاسم، البريد، رقم التسجيل أو معرف الكيان…" value="${esc(f.q||'')}" onchange="registrySet('q',this.value)"><select class="ctl" onchange="registrySet('cls',this.value)"><option value="">كل الكيانات</option><option value="person" ${f.cls==='person'?'selected':''}>أشخاص</option><option value="organization" ${f.cls==='organization'?'selected':''}>منظمات</option></select><select class="ctl" onchange="registrySet('status',this.value)"><option value="all">النشطة فقط</option><option value="merged" ${f.status==='merged'?'selected':''}>السجلات المدمجة</option></select><span class="tagb gold">${list.length} سجل</span></div>
  <div class="dirtable-wrap"><table class="tbl dirtable"><thead><tr><th>#</th><th>معرف الكيان</th><th>الاسم الموحد</th><th>النوع</th><th>الدولة</th><th>المعرفات الأساسية</th><th>العضويات</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>${list.map((e,i)=>`<tr class="${e.status==='merged'?'merged-row':''}"><td>${i+1}</td><td><span class="entity-id">${esc(e.entityId)}</span></td><td><b>${esc(e.displayName)}</b>${e.nameEn?`<br><small>${esc(e.nameEn)}</small>`:''}</td><td><span class="tagb ${e.entityClass==='organization'?'amber':'blue'}">${e.entityClass==='organization'?'منظمة':'شخص'}</span></td><td>${esc(e.country||'—')}</td><td><small>${e.registrationNo?'سجل: '+esc(e.registrationNo):e.email?'إيميل: '+esc(e.email):'لم يكتمل المعرف القوي'}</small></td><td><div class="chips">${(e.memberships||[]).map(m=>`<span class="tagb blue">${esc(m.type)}</span>`).join('')||'—'}</div></td><td><span class="tagb ${e.status==='active'?'green':'gray'}">${e.status==='active'?'نشط':'مدمج في '+esc(e.mergedInto||'')}</span></td><td><button class="btn xs primary" onclick="entityDetail('${e.entityId}')">عرض السجل</button></td></tr>`).join('')}</tbody></table></div>
  <p class="hint mt">لا تُحذف بيانات العضويات السابقة؛ يحتفظ كل كيان بمراجعها الأصلية، ويُسجل أي دمج في سجل تدقيق مستقل.</p>`}
function persist(silent){G.lastSave=Date.now();
  localStorage.eim5=JSON.stringify(G);
  localStorage.eim5wiz=JSON.stringify({state:W,step,review,submitted});
  let d=new Date(G.lastSave);$('saved').textContent='آخر حفظ '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  if(!silent)toast('حُفظ تلقائيًا')}
let toastT;function toast(m){let t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2400)}
function openModal(html){$('modal').innerHTML=html;$('overlay').classList.add('open')}
function closeOverlay(){$('overlay').classList.remove('open')}
