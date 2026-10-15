/* =========================================================
   إدارة المنصة والتدقيق — قيادة، موافقات، صلاحيات، سجل موحد
   ========================================================= */
const PLATFORM_ROLES={
  'مدير المنصة':['إدارة المستخدمين','إدارة الصلاحيات','إدارة السياسات','إدارة المحتوى','إدارة التصنيفات','عرض التقارير','تعليق الحسابات'],
  'مسؤول تحقق':['قضايا التحقق','عرض الأدلة المقيدة','طلب استكمال','إصدار توصية'],
  'مسؤول مالي':['الفواتير','تأكيد التحويلات','طلبات الاسترداد','تقارير الإيرادات'],
  'مدقق داخلي':['عرض سجل التدقيق','فتح قضايا تدقيق','متابعة الإجراءات التصحيحية','تصدير سجلات التدقيق'],
  'مدير محتوى':['إدارة الصفحات','إدارة الدورات','إدارة التصنيفات','مراجعة النشر'],
  'دعم فني':['تذاكر الدعم','استعادة الحساب','عرض الحالة التقنية'],
  'مراقب جودة':['الشكاوى','مراجعات الجودة','مؤشرات الأداء','الإجراءات التصحيحية']
};
const PLATFORM_SCOPE_CONFLICTS=[
  ['تأكيد التحويلات','طلبات الاسترداد','لا يجوز إنشاء العملية المالية واعتمادها بواسطة الشخص نفسه'],
  ['إدارة المستخدمين','عرض سجل التدقيق','يفصل التشغيل اليومي عن التدقيق المستقل'],
  ['إدارة الدورات','مراجعة النشر','يفصل إعداد المحتوى عن اعتماده'],
  ['قضايا التحقق','إصدار توصية','يجب فصل إسناد القضية عن القرار النهائي عند المخاطر المرتفعة']
];
const AUDIT_DOMAINS=['العضويات','الكيانات','الخصوصية','الأمن','المالية','العملاء','الدورات','المطابقة','إدارة المنصة'];
const AUDIT_RISKS=['منخفض','متوسط','مرتفع','حرج'];
const AUDIT_CASE_STATES=['مفتوحة','قيد الفحص','بانتظار المعالجة','قيد التحقق من المعالجة','مغلقة'];
function adminDefault(){return{operators:[],approvals:[],auditCases:[],policies:[],configChanges:[],workItems:[],adminAudit:[],filters:{q:'',domain:'all',risk:'all',actor:'',from:'',to:''},operatorDraft:null,caseDraft:null,policyDraft:null,activeCaseId:''}}
function adminId(p){return`${p}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`}
function adminNow(){return Date.now()}
function adminLog(action,ref='',domain='إدارة المنصة',risk='منخفض',details='',outcome='ناجح'){
  let e={eventId:adminId('ADM'),at:adminNow(),actor:G.user||'مشغل المنصة',action,ref,domain,risk,details,outcome,source:'platform-admin'};
  G.platformAdmin.adminAudit.unshift(e);G.platformAdmin.adminAudit=G.platformAdmin.adminAudit.slice(0,300);persist(true);return e
}
function migratePlatformAdmin(){
  G.platformAdmin=Object.assign(adminDefault(),G.platformAdmin||{});
  ['operators','approvals','auditCases','policies','configChanges','workItems','adminAudit'].forEach(k=>G.platformAdmin[k]=Array.isArray(G.platformAdmin[k])?G.platformAdmin[k]:[]);
  G.platformAdmin.filters=G.platformAdmin.filters||{q:'',domain:'all',risk:'all',actor:'',from:'',to:''};
  if(!G.platformAdmin.operators.length){
    let m=G.memberData?.['مدير / مشغل المنصة']||{},name=m.aname||G.user||'مدير المنصة';
    G.platformAdmin.operators.push({operatorId:'OP-PLATFORM-001',name,email:m.aemail||G.accountEmail||'',role:m.operatorRole||'مدير المنصة',scopes:[...(PLATFORM_ROLES[m.operatorRole||'مدير المنصة']||PLATFORM_ROLES['مدير المنصة'])],status:'نشط',mfa:true,delegationStart:'',delegationEnd:'',createdAt:adminNow(),lastAccess:adminNow()});
    G.platformAdmin.operators.push({operatorId:'OP-AUDIT-002',name:'مدقق النظام المستقل',email:'audit@arabexperts.net',role:'مدقق داخلي',scopes:[...PLATFORM_ROLES['مدقق داخلي']],status:'نشط',mfa:true,createdAt:adminNow(),lastAccess:adminNow()});
  }
  if(!G.platformAdmin.policies.length)G.platformAdmin.policies.push(
    {policyId:'POL-SEC-001',name:'سياسة أمن الحسابات والوصول',category:'الأمن',version:1,status:'سارية',owner:'مدير المنصة',effectiveDate:new Date().toISOString().slice(0,10),reviewDate:'2027-01-01',summary:'ضوابط الوصول والتحقق متعدد العوامل والجلسات.',history:[]},
    {policyId:'POL-AUD-001',name:'سياسة سجل التدقيق والاحتفاظ',category:'التدقيق',version:1,status:'سارية',owner:'المدقق الداخلي',effectiveDate:new Date().toISOString().slice(0,10),reviewDate:'2027-01-01',summary:'نطاق الأحداث وفترة الاحتفاظ وصلاحيات الاطلاع والتصدير.',history:[]}
  );
  return G.platformAdmin
}
function auditNormalize(x,domain,source,index=0){
  let at=x.at||x.createdAt||x.updatedAt||x.uploadedAt||adminNow(),action=x.action||x.event||x.note||x.state||'حدث مسجل',actor=x.actor||x.approvedBy||x.owner||'النظام';
  let ref=x.ref||x.eventId||x.auditId||x.relationId||x.primaryId||x.entityId||x.requestId||`${source}-${index+1}`;
  let risk=x.risk||(/رفض|فشل|تعليق|استرداد|دمج|صلاحية|سرية/.test(String(action))?'مرتفع':'منخفض');
  risk=risk==='عالية'?'مرتفع':risk;let outcome=x.outcome||x.status||x.result||'مسجل';
  return{eventId:String(ref),at:Number(at)||new Date(at).getTime()||adminNow(),actor:String(actor),action:String(action),ref:String(ref),domain,risk:AUDIT_RISKS.includes(risk)?risk:'متوسط',details:String(x.details||x.note||x.meta?.reason||''),outcome:String(outcome),source}
}
function unifiedAuditEvents(){
  migratePlatformAdmin();let out=[...G.platformAdmin.adminAudit.map(x=>auditNormalize(x,x.domain||'إدارة المنصة','platform-admin'))];
  (G.security?.events||[]).forEach((x,i)=>out.push(auditNormalize(x,'الأمن','security',i)));
  (G.finance?.audit||[]).forEach((x,i)=>out.push(auditNormalize(x,'المالية','finance',i)));
  (G.privacyAudit||[]).forEach((x,i)=>out.push(auditNormalize(x,'الخصوصية','privacy',i)));
  (G.entityMergeLog||[]).forEach((x,i)=>out.push(auditNormalize({...x,action:'دمج سجل كيان',ref:x.primaryId+' ← '+x.secondaryId,risk:'مرتفع'},'الكيانات','entity-registry',i)));
  (G.clientGovernanceLog||[]).forEach((x,i)=>out.push(auditNormalize(x,'العملاء','client-governance',i)));
  (G.clientCRM?.activity||[]).forEach((x,i)=>out.push(auditNormalize(x,'العملاء','client-crm',i)));
  Object.entries(G.membershipLifecycle||{}).forEach(([type,L])=>(L.history||[]).forEach((x,i)=>out.push(auditNormalize({...x,action:`عضوية ${type}: ${LIFE_STATES[x.state]?.label||x.state}`,ref:type},'العضويات','membership',i))));
  (G.courseVersions||[]).forEach((x,i)=>out.push(auditNormalize({...x,action:`إصدار دورة ${x.version||''}`,ref:x.courseId||x.versionId||''},'الدورات','course-governance',i)));
  (G.matchingRuns||[]).forEach((x,i)=>out.push(auditNormalize({...x,action:'تشغيل مطابقة موزونة',ref:x.runId},'المطابقة','matching',i)));
  let seen=new Set();return out.filter(x=>{let k=[x.source,x.eventId,x.at,x.action].join('|');if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>b.at-a.at)
}
function auditFiltered(){
  let f=G.platformAdmin.filters||{},q=(f.q||'').trim(),rows=unifiedAuditEvents();
  return rows.filter(x=>(f.domain==='all'||!f.domain||x.domain===f.domain)&&(f.risk==='all'||!f.risk||x.risk===f.risk)&&(!f.actor||x.actor.includes(f.actor))&&(!q||[x.eventId,x.action,x.ref,x.actor,x.details,x.source].join(' ').includes(q))&&(!f.from||x.at>=new Date(f.from).getTime())&&(!f.to||x.at<=new Date(f.to+'T23:59:59').getTime()))
}
function adminRiskClass(r){return r==='حرج'?'red':r==='مرتفع'?'amber':r==='متوسط'?'blue':'green'}
function platformOperatorConflicts(scopes=[]){return PLATFORM_SCOPE_CONFLICTS.filter(([a,b])=>scopes.includes(a)&&scopes.includes(b))}
function adminOperatorNew(){G.platformAdmin.operatorDraft={operatorId:adminId('OP'),name:'',email:'',role:'دعم فني',scopes:[...PLATFORM_ROLES['دعم فني']],status:'نشط',mfa:true,delegationStart:'',delegationEnd:'',createdAt:adminNow()};persist(true);render()}
function adminOperatorSet(k,v){let d=G.platformAdmin.operatorDraft;if(!d)return;d[k]=v;if(k==='role')d.scopes=[...(PLATFORM_ROLES[v]||[])];persist(true);render()}
function adminOperatorScope(s,on){s=dec(s);let d=G.platformAdmin.operatorDraft;if(!d)return;let i=d.scopes.indexOf(s);if(on&&i<0)d.scopes.push(s);if(!on&&i>=0)d.scopes.splice(i,1);persist(true);render()}
function adminOperatorEdit(id){let o=G.platformAdmin.operators.find(x=>x.operatorId===id);if(!o)return;G.platformAdmin.operatorDraft=JSON.parse(JSON.stringify(o));persist(true);render()}
function adminOperatorSave(){
  let d=G.platformAdmin.operatorDraft;if(!d?.name?.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email||'')){toast('أكمل الاسم وإيميلًا صحيحًا');return}
  let conflicts=platformOperatorConflicts(d.scopes);if(conflicts.length&&!confirm('توجد صلاحيات متعارضة. سيُحفظ المشغل مع تنبيه رقابي. متابعة؟'))return;
  let i=G.platformAdmin.operators.findIndex(x=>x.operatorId===d.operatorId),old=i>=0?G.platformAdmin.operators[i]:null;
  if(i>=0)G.platformAdmin.operators[i]={...d,updatedAt:adminNow()};else G.platformAdmin.operators.push({...d});
  adminLog(i>=0?'تحديث صلاحيات مشغل':'إضافة مشغل',d.operatorId,'إدارة المنصة',conflicts.length?'مرتفع':'متوسط',`${d.role} · ${d.scopes.length} صلاحيات`);
  if(old&&JSON.stringify(old.scopes)!==JSON.stringify(d.scopes))adminApprovalCreate('تغيير صلاحيات مشغل',d.operatorId,'إدارة المنصة','مرتفع',`من ${old.scopes.length} إلى ${d.scopes.length} صلاحيات`);
  G.platformAdmin.operatorDraft=null;persist(true);render();toast('حُفظ سجل المشغل')
}
function adminOperatorToggle(id){let o=G.platformAdmin.operators.find(x=>x.operatorId===id);if(!o)return;if(!confirm(`${o.status==='نشط'?'تعليق':'تفعيل'} حساب المشغل «${o.name}»؟`))return;o.status=o.status==='نشط'?'معلق':'نشط';adminLog('تغيير حالة مشغل',id,'إدارة المنصة','مرتفع',o.status);persist(true);render()}
function adminApprovalCreate(action,ref,domain='إدارة المنصة',risk='مرتفع',details=''){
  let a={approvalId:adminId('APR'),action,ref,domain,risk,details,status:'بانتظار الاعتماد',requestedBy:G.user||'مقدم الطلب',requestedAt:adminNow(),decidedBy:'',decidedAt:null,reason:''};
  G.platformAdmin.approvals.unshift(a);adminLog('إنشاء طلب موافقة',a.approvalId,domain,risk,`${action} · ${ref}`);persist(true);return a
}
function adminApprovalDecision(id,decision){
  let a=G.platformAdmin.approvals.find(x=>x.approvalId===id);if(!a||a.status!=='بانتظار الاعتماد')return;
  let actor=G.user||'مشغل المنصة';if(a.requestedBy===actor){toast('فصل الواجبات: لا يجوز لمقدم الطلب اعتماد طلبه');return}
  let reason=prompt(decision==='اعتماد'?'اكتب ملاحظة الاعتماد:':'سبب الرفض إلزامي:','');if(reason===null)return;if(decision==='رفض'&&!reason.trim()){toast('سبب الرفض إلزامي');return}
  a.status=decision==='اعتماد'?'معتمد':'مرفوض';a.decidedBy=actor;a.decidedAt=adminNow();a.reason=reason.trim();adminLog(`${decision} طلب موافقة`,id,a.domain,a.risk,a.reason,a.status);persist(true);render()
}
function platformWorkItems(){
  let rows=[];
  (G.platformAdmin.approvals||[]).filter(x=>x.status==='بانتظار الاعتماد').forEach(x=>rows.push({id:x.approvalId,type:'موافقة',title:x.action,owner:'مدير مخول مستقل',due:'اليوم',priority:x.risk,status:x.status,target:94}));
  Object.entries(G.membershipLifecycle||{}).forEach(([t,L])=>{if(['submitted','under_review','needs_changes','renewal_due'].includes(L.state))rows.push({id:'MEM-'+t,type:'عضوية',title:`مراجعة عضوية ${t}`,owner:'فريق التحقق',due:'وفق SLA',priority:L.state==='renewal_due'?'مرتفع':'متوسط',status:LIFE_STATES[L.state]?.label,target:53})});
  (G.finance?.refunds||[]).filter(x=>['requested','under_review','approved'].includes(x.status)).forEach(x=>rows.push({id:x.refundId,type:'مالي',title:'طلب استرداد '+x.refundId,owner:'المسؤول المالي',due:'24 ساعة',priority:'مرتفع',status:x.status,target:82}));
  (G.platformAdmin.auditCases||[]).filter(x=>x.status!=='مغلقة').forEach(x=>rows.push({id:x.caseId,type:'تدقيق',title:x.title,owner:x.owner,due:x.dueDate||'—',priority:x.risk,status:x.status,target:97}));
  (G.duplicateCases||[]).filter(x=>x.status!=='resolved').forEach(x=>rows.push({id:x.caseId||'DUP',type:'بيانات',title:'حالة ازدواجية دورة',owner:'حوكمة الدورات',due:'—',priority:'متوسط',status:x.status||'مفتوحة',target:70}));
  return rows
}
function auditCaseNew(eventId=''){
  let e=unifiedAuditEvents().find(x=>x.eventId===eventId);G.platformAdmin.caseDraft={caseId:adminId('AUD'),title:e?`مراجعة: ${e.action}`:'',domain:e?.domain||'إدارة المنصة',risk:e?.risk||'متوسط',eventRefs:e?[e.eventId]:[],finding:'',rootCause:'',correctiveAction:'',owner:'المدقق الداخلي',actionOwner:'',dueDate:'',status:'مفتوحة',history:[],createdAt:adminNow()};persist(true);go(97)
}
function auditCaseSet(k,v){let d=G.platformAdmin.caseDraft;if(!d)return;d[k]=v;persist(true)}
function auditCaseSave(){
  let d=G.platformAdmin.caseDraft;if(!d?.title?.trim()||!d.finding?.trim()||!d.correctiveAction?.trim()||!d.dueDate){toast('أكمل العنوان والملاحظة والإجراء التصحيحي والموعد');return}
  let i=G.platformAdmin.auditCases.findIndex(x=>x.caseId===d.caseId),old=i>=0?G.platformAdmin.auditCases[i]:null;d.history=old?.history||d.history||[];d.history.push({status:d.status,at:adminNow(),actor:G.user||'المدقق'});
  if(i>=0)G.platformAdmin.auditCases[i]={...d,updatedAt:adminNow()};else G.platformAdmin.auditCases.push({...d});G.platformAdmin.activeCaseId=d.caseId;adminLog(i>=0?'تحديث قضية تدقيق':'فتح قضية تدقيق',d.caseId,'إدارة المنصة',d.risk,d.title);G.platformAdmin.caseDraft=null;persist(true);render();toast('حُفظت قضية التدقيق')
}
function auditCaseEdit(id){let c=G.platformAdmin.auditCases.find(x=>x.caseId===id);if(!c)return;G.platformAdmin.caseDraft=JSON.parse(JSON.stringify(c));persist(true);render()}
function auditCaseTransition(id,to){
  let c=G.platformAdmin.auditCases.find(x=>x.caseId===id);if(!c||!AUDIT_CASE_STATES.includes(to))return;if(to==='مغلقة'&&!c.correctiveEvidence){toast('لا يمكن الإغلاق قبل توثيق دليل تنفيذ الإجراء التصحيحي');return}
  let from=c.status;c.status=to;c.history.push({from,status:to,at:adminNow(),actor:G.user||'المدقق'});adminLog('انتقال قضية تدقيق',id,'إدارة المنصة',c.risk,`${from} ← ${to}`);persist(true);render()
}
function auditCaseEvidence(id){let c=G.platformAdmin.auditCases.find(x=>x.caseId===id);if(!c)return;let note=prompt('صف دليل تنفيذ الإجراء التصحيحي:','');if(!note?.trim())return;c.correctiveEvidence=note.trim();c.evidenceAt=adminNow();adminLog('إضافة دليل معالجة',id,'إدارة المنصة','متوسط',note.trim());persist(true);render()}
function platformPolicyNew(){G.platformAdmin.policyDraft={policyId:adminId('POL'),name:'',category:'الحوكمة',version:1,status:'مسودة',owner:'مدير المنصة',effectiveDate:'',reviewDate:'',summary:'',history:[],createdAt:adminNow()};persist(true);render()}
function platformPolicySet(k,v){let d=G.platformAdmin.policyDraft;if(!d)return;d[k]=v;persist(true)}
function platformPolicyEdit(id){let p=G.platformAdmin.policies.find(x=>x.policyId===id);if(!p)return;G.platformAdmin.policyDraft={...JSON.parse(JSON.stringify(p)),version:Number(p.version||1)+1,status:'مسودة',previousVersion:p.version};persist(true);render()}
function platformPolicySave(){
  let d=G.platformAdmin.policyDraft;if(!d?.name?.trim()||!d.owner||!d.reviewDate||!d.summary?.trim()){toast('أكمل اسم السياسة ومالكها وتاريخ المراجعة والملخص');return}
  let i=G.platformAdmin.policies.findIndex(x=>x.policyId===d.policyId),old=i>=0?G.platformAdmin.policies[i]:null;d.history=old?.history||d.history||[];if(old)d.history.push({version:old.version,status:old.status,snapshot:JSON.parse(JSON.stringify(old)),at:adminNow()});
  if(i>=0)G.platformAdmin.policies[i]={...d,updatedAt:adminNow()};else G.platformAdmin.policies.push({...d});
  adminApprovalCreate('اعتماد سياسة أو إصدار جديد',d.policyId,'إدارة المنصة','مرتفع',`${d.name} · الإصدار ${d.version}`);adminLog(old?'إنشاء إصدار سياسة':'إنشاء سياسة',d.policyId,'إدارة المنصة','متوسط',d.name);G.platformAdmin.policyDraft=null;persist(true);render();toast('حُفظت المسودة وأُرسلت للاعتماد')
}
function auditExportCsv(){
  let rows=auditFiltered(),head=['event_id','date','domain','action','actor','reference','risk','outcome','source'],csv=[head.join(',')].concat(rows.map(x=>[x.eventId,new Date(x.at).toISOString(),x.domain,x.action,x.actor,x.ref,x.risk,x.outcome,x.source].map(v=>`"${String(v).replaceAll('"','""')}"`).join(','))).join('\n');
  let blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='NAE_unified_audit.csv';a.click();URL.revokeObjectURL(a.href);adminLog('تصدير سجل التدقيق','CSV','إدارة المنصة','مرتفع',`${rows.length} حدث`);toast('تم تجهيز ملف سجل التدقيق')
}
function platformHead(title,desc,actions=''){return pagehead({ctx:'إدارة المنصة والتدقيق',title,desc},actions)}
function rPlatformCommand(){
  migratePlatformAdmin();let audit=unifiedAuditEvents(),work=platformWorkItems(),high=audit.filter(x=>['مرتفع','حرج'].includes(x.risk)).length,openCases=G.platformAdmin.auditCases.filter(x=>x.status!=='مغلقة').length,pending=G.platformAdmin.approvals.filter(x=>x.status==='بانتظار الاعتماد').length;
  return platformHead('مركز قيادة المنصة','منظور تشغيلي موحد للحوكمة والمخاطر والقرارات وقوائم الأعمال.',`<button class="btn ghost sm" onclick="go(96)">سجل التدقيق</button><button class="btn primary sm" onclick="go(94)">قائمة الأعمال (${work.length})</button>`)+`
  <section class="admin-command-hero"><div><span class="kick">PLATFORM CONTROL</span><h2>الحالة التشغيلية للمنصة</h2><p>الأحداث والإجراءات الحساسة مجمعة وقابلة للتتبع دون تغيير سجلات الوحدات الأصلية.</p></div><div class="admin-health"><b>${high?'تحتاج متابعة':'مستقرة'}</b><small>${high} أحداث مرتفعة المخاطر</small></div></section>
  <div class="grid c4">${securityMetric('أعمال مفتوحة',work.length,'blue')}${securityMetric('موافقات معلقة',pending,pending?'amber':'green')}${securityMetric('قضايا تدقيق',openCases,openCases?'red':'green')}${securityMetric('أحداث موحدة',audit.length,'gold')}</div>
  <div class="grid c2 mt"><div class="card panel"><div class="casehead"><h3>الأعمال الأعلى أولوية</h3><span class="sp"></span><button class="btn xs ghost" onclick="go(94)">الكل</button></div>${work.slice(0,6).map(x=>`<div class="security-row"><div><b>${esc(x.title)}</b><small>${esc(x.type)} · ${esc(x.owner)} · ${esc(x.due)}</small></div><span class="tagb ${adminRiskClass(x.priority)}">${esc(x.priority)}</span></div>`).join('')||'<div class="empty">لا توجد أعمال مفتوحة.</div>'}</div>
  <div class="card panel"><h3>الرقابة حسب المجال</h3>${AUDIT_DOMAINS.map(d=>{let n=audit.filter(x=>x.domain===d).length;return`<div class="admin-domain-row"><span>${d}</span><i><b style="width:${Math.min(100,n/Math.max(1,audit.length)*400)}%"></b></i><strong>${n}</strong></div>`}).join('')}</div></div>
  <div class="grid c4 mt">${[['الأعمال والموافقات','الإسناد وفصل الواجبات',94],['المشغلون والصلاحيات','النطاقات والتعارضات',95],['سجل التدقيق','بحث وتتبع وتصدير',96],['قضايا التدقيق','الملاحظات والمعالجة',97]].map(x=>`<button class="card quick" onclick="go(${x[2]})"><b>${x[0]}</b><small>${x[1]}</small></button>`).join('')}</div>`}
function rPlatformWorkApprovals(){
  migratePlatformAdmin();let work=platformWorkItems(),approvals=G.platformAdmin.approvals;
  return platformHead('قوائم الأعمال والموافقات','تجميع الأعمال الحرجة واعتماد القرارات الحساسة وفق مبدأ الصانع والمراجع.',`<button class="btn ghost sm" onclick="go(93)">مركز القيادة</button>`)+`
  <div class="grid c3">${securityMetric('إجمالي الأعمال',work.length,'blue')}${securityMetric('عالية وحرجة',work.filter(x=>['مرتفع','حرج'].includes(x.priority)).length,'red')}${securityMetric('بانتظار الموافقة',approvals.filter(x=>x.status==='بانتظار الاعتماد').length,'amber')}</div>
  <div class="card panel mt"><h3>قائمة العمل الموحدة</h3><div class="tablewrap"><table class="tbl"><thead><tr><th>المرجع</th><th>النوع</th><th>العمل</th><th>المسؤول</th><th>الموعد</th><th>الأولوية</th><th>الحالة</th><th></th></tr></thead><tbody>${work.map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.type)}</td><td><b>${esc(x.title)}</b></td><td>${esc(x.owner)}</td><td>${esc(x.due)}</td><td><span class="tagb ${adminRiskClass(x.priority)}">${esc(x.priority)}</span></td><td>${esc(x.status)}</td><td><button class="btn xs ghost" onclick="go(${x.target})">فتح</button></td></tr>`).join('')||'<tr><td colspan="8">لا توجد أعمال مفتوحة.</td></tr>'}</tbody></table></div></div>
  <div class="card panel mt"><h3>طلبات الموافقة وفصل الواجبات</h3>${approvals.map(a=>`<div class="approval-card"><div><b>${esc(a.action)}</b><small>${esc(a.approvalId)} · طلبه ${esc(a.requestedBy)} · ${new Date(a.requestedAt).toLocaleString('ar')}</small><p>${esc(a.details||a.ref)}</p></div><span class="tagb ${a.status==='معتمد'?'green':a.status==='مرفوض'?'red':'amber'}">${a.status}</span>${a.status==='بانتظار الاعتماد'?`<div class="table-actions"><button class="btn xs success" onclick="adminApprovalDecision('${a.approvalId}','اعتماد')">اعتماد</button><button class="btn xs danger" onclick="adminApprovalDecision('${a.approvalId}','رفض')">رفض</button></div>`:''}</div>`).join('')||'<div class="empty">لا توجد طلبات موافقة.</div>'}</div>`}
function operatorForm(d){
  let conflicts=platformOperatorConflicts(d.scopes||[]);return`<div class="card formcard admin-form"><div class="casehead"><h3>بيانات المشغل والتفويض</h3><span class="sp"></span><button class="btn xs ghost" onclick="G.platformAdmin.operatorDraft=null;persist(true);render()">إلغاء</button></div><div class="fields"><div class="field"><label>الاسم <em>*</em></label><input class="ctl" value="${esc(d.name||'')}" oninput="adminOperatorSet('name',this.value)"></div><div class="field"><label>الإيميل <em>*</em></label><input type="email" class="ctl" value="${esc(d.email||'')}" oninput="adminOperatorSet('email',this.value)"></div><div class="field"><label>الدور</label><select class="ctl" onchange="adminOperatorSet('role',this.value)">${Object.keys(PLATFORM_ROLES).map(x=>`<option ${d.role===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>الحالة</label><select class="ctl" onchange="adminOperatorSet('status',this.value)">${['نشط','معلق','منتهي التفويض'].map(x=>`<option ${d.status===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>بداية التفويض</label><input type="date" class="ctl" value="${esc(d.delegationStart||'')}" onchange="adminOperatorSet('delegationStart',this.value)"></div><div class="field"><label>نهاية التفويض</label><input type="date" class="ctl" value="${esc(d.delegationEnd||'')}" onchange="adminOperatorSet('delegationEnd',this.value)"></div><div class="field wide"><label>نطاق الصلاحيات</label><div class="fingerprint-options">${[...new Set(Object.values(PLATFORM_ROLES).flat())].map(x=>`<label class="fp-check ${(d.scopes||[]).includes(x)?'selected':''}"><input type="checkbox" ${(d.scopes||[]).includes(x)?'checked':''} onchange="adminOperatorScope('${enc(x)}',this.checked);render()"> ${x}</label>`).join('')}</div></div></div>${conflicts.length?`<div class="statusband warning">${conflicts.map(x=>'⚠ '+x[2]).join('<br>')}</div>`:''}<div class="wizfoot"><span class="sp"></span><button class="btn primary" onclick="adminOperatorSave()">حفظ المشغل</button></div></div>`}
function rPlatformOperators(){
  migratePlatformAdmin();let rows=G.platformAdmin.operators;
  return platformHead('المشغلون والصلاحيات','أدوار محددة ونطاقات قابلة للتدقيق مع كشف تعارض الصلاحيات والتفويض المؤقت.',`<button class="btn primary sm" onclick="adminOperatorNew()">إضافة مشغل</button>`)+`${G.platformAdmin.operatorDraft?operatorForm(G.platformAdmin.operatorDraft):''}
  <div class="card panel"><div class="tablewrap"><table class="tbl"><thead><tr><th>المشغل</th><th>الدور</th><th>الصلاحيات</th><th>التحقق المتعدد</th><th>التفويض</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>${rows.map(o=>{let c=platformOperatorConflicts(o.scopes||[]);return`<tr><td><b>${esc(o.name)}</b><small>${esc(o.email)} · ${o.operatorId}</small></td><td>${esc(o.role)}</td><td>${o.scopes.length} ${c.length?`<span class="tagb red">${c.length} تعارض</span>`:''}</td><td><span class="tagb ${o.mfa?'green':'red'}">${o.mfa?'مفعّل':'غير مفعّل'}</span></td><td>${esc([o.delegationStart,o.delegationEnd].filter(Boolean).join(' — ')||'دائم')}</td><td>${esc(o.status)}</td><td><div class="table-actions"><button class="btn xs ghost" onclick="adminOperatorEdit('${o.operatorId}')">تعديل</button><button class="btn xs ${o.status==='نشط'?'danger':'success'}" onclick="adminOperatorToggle('${o.operatorId}')">${o.status==='نشط'?'تعليق':'تفعيل'}</button></div></td></tr>`}).join('')}</tbody></table></div></div>
  <div class="card panel mt"><h3>قواعد تعارض الصلاحيات</h3>${PLATFORM_SCOPE_CONFLICTS.map(x=>`<div class="security-row"><div><b>${x[0]} × ${x[1]}</b><small>${x[2]}</small></div><span class="tagb amber">فصل واجبات</span></div>`).join('')}</div>`}
function rUnifiedAudit(){
  migratePlatformAdmin();let f=G.platformAdmin.filters,rows=auditFiltered();
  return platformHead('سجل التدقيق الموحد','عرض زمني موحد لأحداث المنصة مع بقاء السجلات الأصلية داخل وحداتها.',`<button class="btn ghost sm" onclick="auditExportCsv()">تصدير CSV</button>`)+`
  <div class="grid c4">${securityMetric('الأحداث المعروضة',rows.length,'blue')}${securityMetric('مرتفعة المخاطر',rows.filter(x=>x.risk==='مرتفع').length,'amber')}${securityMetric('حرجة',rows.filter(x=>x.risk==='حرج').length,'red')}${securityMetric('المجالات',new Set(rows.map(x=>x.domain)).size,'gold')}</div>
  <div class="card filterbar mt audit-filters"><input class="ctl" placeholder="الحدث، المرجع، المستخدم…" value="${esc(f.q||'')}" oninput="G.platformAdmin.filters.q=this.value;persist(true)" onchange="render()"><select class="ctl" onchange="G.platformAdmin.filters.domain=this.value;persist(true);render()"><option value="all">كل المجالات</option>${AUDIT_DOMAINS.map(x=>`<option ${f.domain===x?'selected':''}>${x}</option>`).join('')}</select><select class="ctl" onchange="G.platformAdmin.filters.risk=this.value;persist(true);render()"><option value="all">كل المخاطر</option>${AUDIT_RISKS.map(x=>`<option ${f.risk===x?'selected':''}>${x}</option>`).join('')}</select><input type="date" class="ctl" value="${esc(f.from||'')}" onchange="G.platformAdmin.filters.from=this.value;persist(true);render()"><input type="date" class="ctl" value="${esc(f.to||'')}" onchange="G.platformAdmin.filters.to=this.value;persist(true);render()"></div>
  <div class="card panel"><div class="tablewrap"><table class="tbl audit-table"><thead><tr><th>الوقت</th><th>المجال</th><th>الحدث</th><th>المنفذ</th><th>المرجع</th><th>المخاطر</th><th>النتيجة</th><th></th></tr></thead><tbody>${rows.slice(0,200).map(x=>`<tr><td>${new Date(x.at).toLocaleString('ar')}</td><td>${esc(x.domain)}</td><td><b>${esc(x.action)}</b><small>${esc(x.details)}</small></td><td>${esc(x.actor)}</td><td><small>${esc(x.ref)}</small></td><td><span class="tagb ${adminRiskClass(x.risk)}">${esc(x.risk)}</span></td><td>${esc(x.outcome)}</td><td><button class="btn xs ghost" onclick="auditCaseNew('${x.eventId}')">فتح قضية</button></td></tr>`).join('')||'<tr><td colspan="8">لا توجد أحداث مطابقة.</td></tr>'}</tbody></table></div>${rows.length>200?'<p class="hint mt">يعرض آخر 200 حدث وفق عوامل التصفية.</p>':''}</div>`}
function auditCaseForm(d){return`<div class="card formcard admin-form"><div class="fields"><div class="field wide"><label>عنوان القضية <em>*</em></label><input class="ctl" value="${esc(d.title||'')}" oninput="auditCaseSet('title',this.value)"></div><div class="field"><label>المجال</label><select class="ctl" onchange="auditCaseSet('domain',this.value)">${AUDIT_DOMAINS.map(x=>`<option ${d.domain===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>المخاطر</label><select class="ctl" onchange="auditCaseSet('risk',this.value)">${AUDIT_RISKS.map(x=>`<option ${d.risk===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>المدقق المسؤول</label><input class="ctl" value="${esc(d.owner||'')}" oninput="auditCaseSet('owner',this.value)"></div><div class="field"><label>مسؤول المعالجة</label><input class="ctl" value="${esc(d.actionOwner||'')}" oninput="auditCaseSet('actionOwner',this.value)"></div><div class="field"><label>موعد المعالجة <em>*</em></label><input type="date" class="ctl" value="${esc(d.dueDate||'')}" onchange="auditCaseSet('dueDate',this.value)"></div><div class="field"><label>الحالة</label><select class="ctl" onchange="auditCaseSet('status',this.value)">${AUDIT_CASE_STATES.map(x=>`<option ${d.status===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field wide"><label>الملاحظة أو عدم المطابقة <em>*</em></label><textarea class="ctl" rows="3" oninput="auditCaseSet('finding',this.value)">${esc(d.finding||'')}</textarea></div><div class="field wide"><label>تحليل السبب الجذري</label><textarea class="ctl" rows="2" oninput="auditCaseSet('rootCause',this.value)">${esc(d.rootCause||'')}</textarea></div><div class="field wide"><label>الإجراء التصحيحي <em>*</em></label><textarea class="ctl" rows="3" oninput="auditCaseSet('correctiveAction',this.value)">${esc(d.correctiveAction||'')}</textarea></div></div><div class="wizfoot"><button class="btn ghost" onclick="G.platformAdmin.caseDraft=null;persist(true);render()">إلغاء</button><span class="sp"></span><button class="btn primary" onclick="auditCaseSave()">حفظ القضية</button></div></div>`}
function rAuditCases(){
  migratePlatformAdmin();let rows=G.platformAdmin.auditCases;
  return platformHead('قضايا التدقيق والإجراءات التصحيحية','من الملاحظة إلى تحليل السبب والإجراء ودليل التنفيذ والتحقق ثم الإغلاق.',`<button class="btn primary sm" onclick="auditCaseNew()">قضية جديدة</button>`)+`${G.platformAdmin.caseDraft?auditCaseForm(G.platformAdmin.caseDraft):''}
  <div class="card panel"><div class="tablewrap"><table class="tbl"><thead><tr><th>القضية</th><th>المجال</th><th>المخاطر</th><th>المسؤول</th><th>الموعد</th><th>الحالة</th><th>دليل المعالجة</th><th>إجراءات</th></tr></thead><tbody>${rows.map(c=>`<tr><td><b>${esc(c.title)}</b><small>${c.caseId}</small></td><td>${esc(c.domain)}</td><td><span class="tagb ${adminRiskClass(c.risk)}">${esc(c.risk)}</span></td><td>${esc(c.actionOwner||c.owner)}</td><td>${esc(c.dueDate||'—')}</td><td><select class="ctl compact" onchange="auditCaseTransition('${c.caseId}',this.value)">${AUDIT_CASE_STATES.map(x=>`<option ${c.status===x?'selected':''}>${x}</option>`).join('')}</select></td><td>${c.correctiveEvidence?'<span class="tagb green">موثق</span>':`<button class="btn xs soft" onclick="auditCaseEvidence('${c.caseId}')">إضافة</button>`}</td><td><button class="btn xs ghost" onclick="auditCaseEdit('${c.caseId}')">تعديل</button></td></tr>`).join('')||'<tr><td colspan="8">لا توجد قضايا تدقيق.</td></tr>'}</tbody></table></div></div>`}
function policyForm(d){return`<div class="card formcard admin-form"><div class="fields"><div class="field wide"><label>اسم السياسة <em>*</em></label><input class="ctl" value="${esc(d.name||'')}" oninput="platformPolicySet('name',this.value)"></div><div class="field"><label>الفئة</label><select class="ctl" onchange="platformPolicySet('category',this.value)">${['الحوكمة','الأمن','الخصوصية','التدقيق','المالية','المحتوى','التحقق','استمرارية الأعمال'].map(x=>`<option ${d.category===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>الإصدار</label><input class="ctl" value="${d.version}" readonly></div><div class="field"><label>مالك السياسة <em>*</em></label><input class="ctl" value="${esc(d.owner||'')}" oninput="platformPolicySet('owner',this.value)"></div><div class="field"><label>تاريخ السريان</label><input type="date" class="ctl" value="${esc(d.effectiveDate||'')}" onchange="platformPolicySet('effectiveDate',this.value)"></div><div class="field"><label>تاريخ المراجعة <em>*</em></label><input type="date" class="ctl" value="${esc(d.reviewDate||'')}" onchange="platformPolicySet('reviewDate',this.value)"></div><div class="field wide"><label>ملخص السياسة والتغيير <em>*</em></label><textarea class="ctl" rows="4" oninput="platformPolicySet('summary',this.value)">${esc(d.summary||'')}</textarea></div></div><div class="wizfoot"><button class="btn ghost" onclick="G.platformAdmin.policyDraft=null;persist(true);render()">إلغاء</button><span class="sp"></span><button class="btn primary" onclick="platformPolicySave()">حفظ وإرسال للاعتماد</button></div></div>`}
function rPlatformPolicies(){
  migratePlatformAdmin();let rows=G.platformAdmin.policies,today=new Date().toISOString().slice(0,10);
  return platformHead('السياسات وإدارة التغيير','إصدارات محكومة للسياسات وتغييرات الإعدادات مع موافقة مستقلة وسجل تاريخي.',`<button class="btn primary sm" onclick="platformPolicyNew()">سياسة جديدة</button>`)+`${G.platformAdmin.policyDraft?policyForm(G.platformAdmin.policyDraft):''}
  <div class="card panel"><div class="tablewrap"><table class="tbl"><thead><tr><th>السياسة</th><th>الفئة</th><th>الإصدار</th><th>المالك</th><th>السريان</th><th>المراجعة</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map(p=>{let due=p.reviewDate&&p.reviewDate<today;return`<tr><td><b>${esc(p.name)}</b><small>${p.policyId}</small></td><td>${esc(p.category)}</td><td>${p.version}</td><td>${esc(p.owner)}</td><td>${esc(p.effectiveDate||'—')}</td><td><span class="tagb ${due?'red':'gray'}">${esc(p.reviewDate||'—')}${due?' · متأخرة':''}</span></td><td>${esc(p.status)}</td><td><button class="btn xs ghost" onclick="platformPolicyEdit('${p.policyId}')">إصدار جديد</button></td></tr>`}).join('')}</tbody></table></div></div>
  <div class="note mt">أي تغيير جوهري في سياسة أو صلاحية أو إعداد حساس ينشئ طلب موافقة مستقل؛ ولا يصبح نافذًا لمجرد حفظ المسودة.</div>`}
