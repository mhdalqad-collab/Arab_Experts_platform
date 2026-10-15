/* =========================================================
   إدارة العملاء المؤسسية — العلاقة والفرص والمتابعة والمخاطر
   ========================================================= */
const CRM_STAGES=['مؤهل أوليًا','اكتشاف الاحتياج','تحديد الحل','إعداد العرض','تفاوض','فوز','خسارة','مؤجلة'];
const CRM_SEGMENTS=['استراتيجي','رئيسي','نامٍ','قياسي','محتمل'];
const CRM_TASK_TYPES=['اتصال','اجتماع','متابعة عرض','استكمال بيانات','تجديد عقد','تحصيل','مراجعة جودة','زيارة'];
const CRM_RISK_TYPES=['تأخر قرار','تعثر دفع','انخفاض تفاعل','عدم اكتمال تفويض','شكوى مفتوحة','انتهاء عقد','منافس قوي','متطلبات غير مستقرة'];
function crmDefault(){return{opportunities:[],tasks:[],risks:[],segments:[],sla:[],notes:[],activity:[],activeOpportunityId:'',opportunityDraft:null,taskDraft:null,riskDraft:null,filters:{q:'',stage:'all'}}}
function crmId(p){return`${p}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`}
function crmLog(action,ref='',details=''){G.clientCRM.activity.unshift({activityId:crmId('ACT'),clientAccountId:G.activeClientAccountId,action,ref,details,actor:G.user||'المستخدم',at:Date.now()});G.clientCRM.activity=G.clientCRM.activity.slice(0,200)}
function migrateClientCRM(){
  G.clientCRM=Object.assign(crmDefault(),G.clientCRM||{});
  ['opportunities','tasks','risks','segments','sla','notes','activity'].forEach(k=>G.clientCRM[k]=Array.isArray(G.clientCRM[k])?G.clientCRM[k]:[]);
  G.clientCRM.filters=G.clientCRM.filters||{q:'',stage:'all'};
  (G.clientAccounts||[]).forEach(a=>{
    if(!a.segment)a.segment=a.type==='منظمات حكومية'||a.type==='منظمات دولية'?'استراتيجي':'قياسي';
    if(!a.relationshipStage)a.relationshipStage='عميل قائم';
    if(!a.relationshipOwner)a.relationshipOwner='فريق خدمة العملاء';
    if(!a.healthStatus)a.healthStatus='جيدة';
  });
  (G.clientNeeds||[]).forEach(n=>{
    if(!G.clientCRM.opportunities.some(o=>o.sourceNeedId===n.needId)){
      G.clientCRM.opportunities.push({opportunityId:crmId('OPP'),clientAccountId:n.clientAccountId||G.activeClientAccountId,sourceNeedId:n.needId,title:n.title||'احتياج غير معنون',service:n.service||NEED_OUTPUT_LABEL[n.outputType]||'',stage:n.published?'تحديد الحل':'اكتشاف الاحتياج',value:Number(n.budget)||0,probability:n.published?45:25,owner:'مدير العلاقة',expectedClose:'',nextAction:'مراجعة الاحتياج مع العميل',status:'مفتوحة',createdAt:n.createdAt||Date.now(),updatedAt:Date.now(),history:[]})
    }
  });
  return G.clientCRM
}
function crmAccount(){return activeClientAccount?.()||G.clientAccounts?.find(x=>x.clientAccountId===G.activeClientAccountId)||null}
function crmRows(k){return(G.clientCRM[k]||[]).filter(x=>x.clientAccountId===G.activeClientAccountId)}
function crmSetAccount(k,v){let a=crmAccount();if(!a)return;a[k]=v;a.updatedAt=Date.now();crmLog('تحديث ملف العلاقة',a.clientAccountId,`${k}: ${v}`);persist(true)}
function crmOpportunityNew(){
  G.clientCRM.opportunityDraft={opportunityId:crmId('OPP'),clientAccountId:G.activeClientAccountId,title:'',service:'',stage:'مؤهل أوليًا',value:'',probability:20,owner:'مدير العلاقة',expectedClose:'',nextAction:'',status:'مفتوحة',createdAt:Date.now(),history:[]};persist(true);render()
}
function crmOppSet(k,v){G.clientCRM.opportunityDraft=G.clientCRM.opportunityDraft||{};G.clientCRM.opportunityDraft[k]=v;persist(true)}
function crmOpportunitySave(){
  let d=G.clientCRM.opportunityDraft;if(!d?.title?.trim()||!d.service||!d.stage){toast('أكمل عنوان الفرصة والخدمة والمرحلة');return}
  d.value=Math.max(0,Number(d.value)||0);d.probability=Math.max(0,Math.min(100,Number(d.probability)||0));d.updatedAt=Date.now();
  let i=G.clientCRM.opportunities.findIndex(x=>x.opportunityId===d.opportunityId);
  let old=i>=0?G.clientCRM.opportunities[i]:null;d.history=old?.history||d.history||[];d.history.push({stage:d.stage,at:Date.now(),actor:G.user||'المستخدم'});
  if(i>=0)G.clientCRM.opportunities[i]={...d};else G.clientCRM.opportunities.push({...d});
  G.clientCRM.activeOpportunityId=d.opportunityId;crmLog(i>=0?'تحديث فرصة':'إنشاء فرصة',d.opportunityId,d.title);G.clientCRM.opportunityDraft=null;persist(true);render();toast('حُفظت الفرصة')
}
function crmOpportunityEdit(id){let o=G.clientCRM.opportunities.find(x=>x.opportunityId===id);if(!o)return;G.clientCRM.opportunityDraft=JSON.parse(JSON.stringify(o));persist(true);render()}
function crmOpportunityStage(id,stage){
  let o=G.clientCRM.opportunities.find(x=>x.opportunityId===id);if(!o||!CRM_STAGES.includes(stage))return;
  let from=o.stage;o.stage=stage;o.status=stage==='فوز'?'مغلقة — فوز':stage==='خسارة'?'مغلقة — خسارة':stage==='مؤجلة'?'مؤجلة':'مفتوحة';o.updatedAt=Date.now();o.history=o.history||[];o.history.push({stage,from,at:Date.now(),actor:G.user||'المستخدم'});crmLog('نقل مرحلة فرصة',id,`${from} ← ${stage}`);persist(true);render()
}
function crmTaskNew(opp=''){G.clientCRM.taskDraft={taskId:crmId('TSK'),clientAccountId:G.activeClientAccountId,opportunityId:opp,type:'متابعة عرض',title:'',owner:'مدير العلاقة',due:'',priority:'متوسطة',status:'مفتوحة',notes:'',createdAt:Date.now()};persist(true);render()}
function crmTaskSet(k,v){G.clientCRM.taskDraft=G.clientCRM.taskDraft||{};G.clientCRM.taskDraft[k]=v;persist(true)}
function crmTaskSave(){let d=G.clientCRM.taskDraft;if(!d?.title?.trim()||!d.due){toast('أدخل عنوان المتابعة وتاريخ الاستحقاق');return}let i=G.clientCRM.tasks.findIndex(x=>x.taskId===d.taskId);if(i>=0)G.clientCRM.tasks[i]={...d};else G.clientCRM.tasks.push({...d});crmLog(i>=0?'تحديث متابعة':'إنشاء متابعة',d.taskId,d.title);G.clientCRM.taskDraft=null;persist(true);render();toast('حُفظت المتابعة')}
function crmTaskToggle(id){let t=G.clientCRM.tasks.find(x=>x.taskId===id);if(!t)return;t.status=t.status==='مكتملة'?'مفتوحة':'مكتملة';t.completedAt=t.status==='مكتملة'?Date.now():null;crmLog('تحديث حالة متابعة',id,t.status);persist(true);render()}
function crmRiskNew(){G.clientCRM.riskDraft={riskId:crmId('RSK'),clientAccountId:G.activeClientAccountId,type:'تأخر قرار',likelihood:'متوسطة',impact:'متوسط',owner:'مدير العلاقة',mitigation:'',status:'مفتوحة',reviewDate:'',createdAt:Date.now()};persist(true);render()}
function crmRiskSet(k,v){G.clientCRM.riskDraft=G.clientCRM.riskDraft||{};G.clientCRM.riskDraft[k]=v;persist(true)}
function crmRiskSave(){let d=G.clientCRM.riskDraft;if(!d?.type||!d.mitigation?.trim()){toast('حدد الخطر وإجراء المعالجة');return}let i=G.clientCRM.risks.findIndex(x=>x.riskId===d.riskId);if(i>=0)G.clientCRM.risks[i]={...d};else G.clientCRM.risks.push({...d});crmLog(i>=0?'تحديث خطر':'تسجيل خطر',d.riskId,d.type);G.clientCRM.riskDraft=null;persist(true);render();toast('حُفظ سجل الخطر')}
function crmRiskClose(id){let r=G.clientCRM.risks.find(x=>x.riskId===id);if(!r)return;r.status='مغلقة';r.closedAt=Date.now();crmLog('إغلاق خطر',id,r.type);persist(true);render()}
function crmSlaEnsure(){
  let s=crmRows('sla')[0];if(!s){s={slaId:crmId('SLA'),clientAccountId:G.activeClientAccountId,tier:'قياسي',firstResponseHours:24,resolutionHours:72,escalationOwner:'مدير خدمة العملاء',businessHours:'الأحد–الخميس، 8:00–17:00',status:'نشط',createdAt:Date.now()};G.clientCRM.sla.push(s)}return s
}
function crmSlaSet(k,v){let s=crmSlaEnsure();s[k]=['firstResponseHours','resolutionHours'].includes(k)?Math.max(1,Number(v)||1):v;s.updatedAt=Date.now();crmLog('تحديث مستوى الخدمة',s.slaId,`${k}: ${v}`);persist(true)}
function crmPipeline(){
  let rows=crmRows('opportunities').filter(x=>!['مغلقة — خسارة'].includes(x.status)),total=rows.reduce((s,x)=>s+Number(x.value||0),0),weighted=rows.reduce((s,x)=>s+Number(x.value||0)*Number(x.probability||0)/100,0);
  return{rows,total,weighted,won:rows.filter(x=>x.stage==='فوز').reduce((s,x)=>s+Number(x.value||0),0)}
}
function crmHealth(){
  let a=crmAccount(),tasks=crmRows('tasks'),risks=crmRows('risks'),overdue=tasks.filter(x=>x.status!=='مكتملة'&&x.due&&new Date(x.due)<new Date()).length,high=risks.filter(x=>x.status!=='مغلقة'&&(x.impact==='عالٍ'||x.likelihood==='عالية')).length;
  let score=100-overdue*10-high*15-(a?.verification!=='متحقق'?10:0);score=Math.max(20,Math.min(100,score));return{score,overdue,high,label:score>=80?'جيدة':score>=60?'تحتاج متابعة':'معرضة للخطر'}
}
function crmMoney(v){return'$'+Number(v||0).toLocaleString('en-US')}
function crmPageHead(title,desc,actions=''){let a=crmAccount();return pagehead({ctx:'إدارة العملاء',title,desc},`${a?`<span class="tagb blue">${esc(a.legalNameAr)}</span>`:''}${actions}`)}
function rClientRelationship(){
  migrateClientCRM();let a=crmAccount();if(!a)return`<div class="card empty"><h2>لا يوجد حساب عميل نشط</h2><button class="btn primary" onclick="go(74)">إنشاء ملف عميل</button></div>`;
  let p=crmPipeline(),h=crmHealth(),tasks=crmRows('tasks').filter(x=>x.status!=='مكتملة').slice(0,5),activity=crmRows('activity').slice(0,7);
  return crmPageHead('إدارة علاقة العميل','مركز موحد لمتابعة قيمة العلاقة والفرص والالتزامات والمخاطر.',
    `<button class="btn primary sm" onclick="crmOpportunityNew();go(89)">فرصة جديدة</button>`)+`
  <section class="crm-relationship-hero"><div class="clientlogo">${esc((a.legalNameAr||'ع').slice(0,2))}</div><div class="crm-account-title"><h2>${esc(a.legalNameAr)}</h2><p>${esc(a.type)} · ${esc(a.country||'الدولة غير محددة')}</p><div class="chips"><span class="tagb gold">${esc(a.segment||'قياسي')}</span><span class="tagb ${h.score>=80?'green':h.score>=60?'amber':'red'}">صحة العلاقة: ${h.label}</span><span class="tagb blue">${esc(a.relationshipStage||'عميل قائم')}</span></div></div><div class="crm-health"><b>${h.score}%</b><small>مؤشر صحة العلاقة</small></div></section>
  <div class="grid c4">${securityMetric('قيمة الفرص',crmMoney(p.total),'blue')}${securityMetric('القيمة الموزونة',crmMoney(p.weighted),'gold')}${securityMetric('متابعات متأخرة',h.overdue,h.overdue?'red':'green')}${securityMetric('مخاطر نشطة',crmRows('risks').filter(x=>x.status!=='مغلقة').length,'amber')}</div>
  <div class="grid c2 mt">
    <div class="card panel"><h3>حوكمة العلاقة</h3><div class="fields one">
      <div class="field"><label>شريحة العميل</label><select class="ctl" onchange="crmSetAccount('segment',this.value)">${CRM_SEGMENTS.map(x=>`<option ${a.segment===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>مرحلة العلاقة</label><select class="ctl" onchange="crmSetAccount('relationshipStage',this.value)">${['عميل محتمل','تأهيل','عميل جديد','عميل قائم','نمو وتوسع','تجديد','استعادة عميل','مغلق'].map(x=>`<option ${a.relationshipStage===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>مالك العلاقة</label><input class="ctl" value="${esc(a.relationshipOwner||'')}" onchange="crmSetAccount('relationshipOwner',this.value)"></div>
    </div><button class="btn ghost sm mt" onclick="go(74)">فتح الملف القانوني</button></div>
    <div class="card panel"><div class="casehead"><h3>المتابعات القادمة</h3><span class="sp"></span><button class="btn xs soft" onclick="go(90)">الكل</button></div>${tasks.map(t=>`<div class="security-row"><div><b>${esc(t.title)}</b><small>${esc(t.type)} · ${esc(t.owner)} · ${esc(t.due)}</small></div><button class="btn xs success" onclick="crmTaskToggle('${t.taskId}')">إكمال</button></div>`).join('')||'<div class="empty">لا توجد متابعة مفتوحة.</div>'}</div>
  </div>
  <div class="grid c4 mt">${[['الفرص','خط المبيعات والقيمة المتوقعة',89],['المتابعات','المهام والمواعيد والمسؤوليات',90],['المخاطر وSLA','التصعيد والتزامات الاستجابة',91],['التحليلات','التحويل والاحتفاظ وجودة العلاقة',92]].map(x=>`<button class="card quick" onclick="go(${x[2]})"><b>${x[0]}</b><small>${x[1]}</small></button>`).join('')}</div>
  <div class="card panel mt"><h3>سجل نشاط العلاقة</h3>${activity.map(x=>`<div class="activityitem"><i></i><span><b>${esc(x.action)}</b><small>${esc(x.details||x.ref||'')}</small></span><small>${new Date(x.at).toLocaleDateString('ar')}</small></div>`).join('')||'<div class="empty">يبدأ السجل عند إنشاء فرصة أو متابعة أو خطر.</div>'}</div>`}
function crmOpportunityForm(d){
  return`<div class="card formcard crm-form"><div class="casehead"><h3>${G.clientCRM.opportunities.some(x=>x.opportunityId===d.opportunityId)?'تعديل الفرصة':'فرصة جديدة'}</h3><span class="sp"></span><button class="btn xs ghost" onclick="G.clientCRM.opportunityDraft=null;persist(true);render()">إلغاء</button></div><div class="fields">
  <div class="field wide"><label>عنوان الفرصة <em>*</em></label><input class="ctl" value="${esc(d.title||'')}" oninput="crmOppSet('title',this.value)"></div>
  <div class="field"><label>الخدمة <em>*</em></label><select class="ctl" onchange="crmOppSet('service',this.value)"><option value="">اختر…</option>${clientRequestedServices.map(x=>`<option ${d.service===x?'selected':''}>${x}</option>`).join('')}</select></div>
  <div class="field"><label>المرحلة</label><select class="ctl" onchange="crmOppSet('stage',this.value)">${CRM_STAGES.map(x=>`<option ${d.stage===x?'selected':''}>${x}</option>`).join('')}</select></div>
  <div class="field"><label>القيمة المتوقعة ($)</label><input type="number" min="0" step="1" class="ctl" value="${esc(d.value||'')}" oninput="crmOppSet('value',this.value)"></div>
  <div class="field"><label>احتمال الفوز (%)</label><input type="number" min="0" max="100" class="ctl" value="${esc(d.probability||'')}" oninput="crmOppSet('probability',this.value)"></div>
  <div class="field"><label>مالك الفرصة</label><input class="ctl" value="${esc(d.owner||'')}" oninput="crmOppSet('owner',this.value)"></div>
  <div class="field"><label>تاريخ الإغلاق المتوقع</label><input type="date" class="ctl" value="${esc(d.expectedClose||'')}" onchange="crmOppSet('expectedClose',this.value)"></div>
  <div class="field wide"><label>الإجراء التالي</label><input class="ctl" value="${esc(d.nextAction||'')}" oninput="crmOppSet('nextAction',this.value)"></div></div>
  <div class="wizfoot"><span class="sp"></span><button class="btn primary" onclick="crmOpportunitySave()">حفظ الفرصة</button></div></div>`}
function rClientOpportunities(){
  migrateClientCRM();let f=G.clientCRM.filters,p=crmPipeline(),rows=crmRows('opportunities').filter(x=>(f.stage==='all'||x.stage===f.stage)&&(!f.q||[x.title,x.service,x.owner].join(' ').includes(f.q)));
  return crmPageHead('الفرص وخط المبيعات','إدارة الفرص من الاكتشاف إلى التعاقد مع حفظ تاريخ انتقال المراحل.',`<button class="btn primary sm" onclick="crmOpportunityNew()">فرصة جديدة</button>`)+`
  <div class="grid c3">${securityMetric('إجمالي الخط',crmMoney(p.total),'blue')}${securityMetric('القيمة الموزونة',crmMoney(p.weighted),'gold')}${securityMetric('فرص مفتوحة',p.rows.filter(x=>x.status==='مفتوحة').length,'green')}</div>
  ${G.clientCRM.opportunityDraft?crmOpportunityForm(G.clientCRM.opportunityDraft):''}
  <div class="card panel mt"><div class="crm-filters"><input class="ctl" placeholder="بحث في الفرص…" value="${esc(f.q||'')}" oninput="G.clientCRM.filters.q=this.value;persist(true)" onchange="render()"><select class="ctl" onchange="G.clientCRM.filters.stage=this.value;persist(true);render()"><option value="all">كل المراحل</option>${CRM_STAGES.map(x=>`<option ${f.stage===x?'selected':''}>${x}</option>`).join('')}</select></div>
  <div class="tablewrap"><table class="tbl"><thead><tr><th>الفرصة</th><th>الخدمة</th><th>المرحلة</th><th>القيمة</th><th>الاحتمال</th><th>الإغلاق المتوقع</th><th>إجراءات</th></tr></thead><tbody>${rows.map(o=>`<tr><td><b>${esc(o.title)}</b><small>${o.opportunityId}</small></td><td>${esc(o.service)}</td><td><select class="ctl compact" onchange="crmOpportunityStage('${o.opportunityId}',this.value)">${CRM_STAGES.map(x=>`<option ${o.stage===x?'selected':''}>${x}</option>`).join('')}</select></td><td>${crmMoney(o.value)}</td><td>${o.probability}%</td><td>${esc(o.expectedClose||'—')}</td><td><div class="table-actions"><button class="btn xs ghost" onclick="crmOpportunityEdit('${o.opportunityId}')">تعديل</button><button class="btn xs soft" onclick="crmTaskNew('${o.opportunityId}');go(90)">متابعة</button></div></td></tr>`).join('')||'<tr><td colspan="7">لا توجد فرص مطابقة.</td></tr>'}</tbody></table></div></div>`}
function crmTaskForm(d){let opp=crmRows('opportunities');return`<div class="card formcard crm-form"><div class="fields"><div class="field wide"><label>عنوان المتابعة <em>*</em></label><input class="ctl" value="${esc(d.title||'')}" oninput="crmTaskSet('title',this.value)"></div><div class="field"><label>النوع</label><select class="ctl" onchange="crmTaskSet('type',this.value)">${CRM_TASK_TYPES.map(x=>`<option ${d.type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>الفرصة المرتبطة</label><select class="ctl" onchange="crmTaskSet('opportunityId',this.value)"><option value="">دون فرصة</option>${opp.map(x=>`<option value="${x.opportunityId}" ${d.opportunityId===x.opportunityId?'selected':''}>${esc(x.title)}</option>`).join('')}</select></div><div class="field"><label>المسؤول</label><input class="ctl" value="${esc(d.owner||'')}" oninput="crmTaskSet('owner',this.value)"></div><div class="field"><label>تاريخ الاستحقاق <em>*</em></label><input type="date" class="ctl" value="${esc(d.due||'')}" onchange="crmTaskSet('due',this.value)"></div><div class="field"><label>الأولوية</label><select class="ctl" onchange="crmTaskSet('priority',this.value)">${['منخفضة','متوسطة','عالية','عاجلة'].map(x=>`<option ${d.priority===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field wide"><label>ملاحظات</label><textarea class="ctl" oninput="crmTaskSet('notes',this.value)">${esc(d.notes||'')}</textarea></div></div><div class="wizfoot"><button class="btn ghost" onclick="G.clientCRM.taskDraft=null;persist(true);render()">إلغاء</button><span class="sp"></span><button class="btn primary" onclick="crmTaskSave()">حفظ المتابعة</button></div></div>`}
function rClientTasks(){
  migrateClientCRM();let rows=crmRows('tasks').sort((a,b)=>(a.status==='مكتملة')-(b.status==='مكتملة')||String(a.due).localeCompare(String(b.due))),today=new Date().toISOString().slice(0,10);
  return crmPageHead('المتابعات والمهام','متابعة التزامات العميل والفريق مع مسؤول وموعد وحالة واضحة.',`<button class="btn primary sm" onclick="crmTaskNew()">متابعة جديدة</button>`)+`${G.clientCRM.taskDraft?crmTaskForm(G.clientCRM.taskDraft):''}
  <div class="card panel"><div class="tablewrap"><table class="tbl"><thead><tr><th>المتابعة</th><th>النوع</th><th>المسؤول</th><th>الاستحقاق</th><th>الأولوية</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${rows.map(t=>{let late=t.status!=='مكتملة'&&t.due&&t.due<today;return`<tr><td><b>${esc(t.title)}</b><small>${esc(G.clientCRM.opportunities.find(x=>x.opportunityId===t.opportunityId)?.title||'')}</small></td><td>${esc(t.type)}</td><td>${esc(t.owner)}</td><td><span class="tagb ${late?'red':'gray'}">${esc(t.due||'—')}${late?' · متأخرة':''}</span></td><td>${esc(t.priority)}</td><td>${esc(t.status)}</td><td><button class="btn xs ${t.status==='مكتملة'?'ghost':'success'}" onclick="crmTaskToggle('${t.taskId}')">${t.status==='مكتملة'?'إعادة فتح':'إكمال'}</button></td></tr>`}).join('')||'<tr><td colspan="7">لا توجد متابعات بعد.</td></tr>'}</tbody></table></div></div>`}
function crmRiskForm(d){return`<div class="card formcard crm-form"><div class="fields"><div class="field"><label>نوع الخطر</label><select class="ctl" onchange="crmRiskSet('type',this.value)">${CRM_RISK_TYPES.map(x=>`<option ${d.type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>الاحتمال</label><select class="ctl" onchange="crmRiskSet('likelihood',this.value)">${['منخفضة','متوسطة','عالية'].map(x=>`<option ${d.likelihood===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>الأثر</label><select class="ctl" onchange="crmRiskSet('impact',this.value)">${['منخفض','متوسط','عالٍ'].map(x=>`<option ${d.impact===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>المسؤول</label><input class="ctl" value="${esc(d.owner||'')}" oninput="crmRiskSet('owner',this.value)"></div><div class="field"><label>تاريخ المراجعة</label><input type="date" class="ctl" value="${esc(d.reviewDate||'')}" onchange="crmRiskSet('reviewDate',this.value)"></div><div class="field wide"><label>إجراء المعالجة <em>*</em></label><textarea class="ctl" oninput="crmRiskSet('mitigation',this.value)">${esc(d.mitigation||'')}</textarea></div></div><div class="wizfoot"><button class="btn ghost" onclick="G.clientCRM.riskDraft=null;persist(true);render()">إلغاء</button><span class="sp"></span><button class="btn primary" onclick="crmRiskSave()">حفظ الخطر</button></div></div>`}
function rClientRiskSla(){
  migrateClientCRM();let risks=crmRows('risks'),sla=crmSlaEnsure();
  return crmPageHead('المخاطر ومستوى الخدمة','ضبط مخاطر العلاقة وأزمنة الاستجابة والحل والتصعيد.',`<button class="btn primary sm" onclick="crmRiskNew()">تسجيل خطر</button>`)+`${G.clientCRM.riskDraft?crmRiskForm(G.clientCRM.riskDraft):''}
  <div class="grid c2"><div class="card panel"><h3>اتفاقية مستوى الخدمة</h3><div class="fields one"><div class="field"><label>المستوى</label><select class="ctl" onchange="crmSlaSet('tier',this.value)">${['قياسي','مميز','استراتيجي'].map(x=>`<option ${sla.tier===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>زمن الاستجابة الأولى (ساعة)</label><input type="number" min="1" class="ctl" value="${sla.firstResponseHours}" onchange="crmSlaSet('firstResponseHours',this.value)"></div><div class="field"><label>زمن الحل المستهدف (ساعة)</label><input type="number" min="1" class="ctl" value="${sla.resolutionHours}" onchange="crmSlaSet('resolutionHours',this.value)"></div><div class="field"><label>مسؤول التصعيد</label><input class="ctl" value="${esc(sla.escalationOwner)}" onchange="crmSlaSet('escalationOwner',this.value)"></div></div></div>
  <div class="card panel"><h3>قاعدة التصعيد</h3><div class="tline"><div class="tstep done"><b>استجابة أولى</b><small>خلال ${sla.firstResponseHours} ساعة</small></div><div class="tstep now"><b>معالجة</b><small>هدف الحل خلال ${sla.resolutionHours} ساعة</small></div><div class="tstep"><b>تصعيد</b><small>${esc(sla.escalationOwner)}</small></div></div></div></div>
  <div class="card panel mt"><h3>سجل مخاطر العلاقة</h3><div class="tablewrap"><table class="tbl"><thead><tr><th>الخطر</th><th>الاحتمال</th><th>الأثر</th><th>المعالجة</th><th>المسؤول</th><th>الحالة</th><th></th></tr></thead><tbody>${risks.map(r=>`<tr><td><b>${esc(r.type)}</b></td><td>${esc(r.likelihood)}</td><td><span class="tagb ${r.impact==='عالٍ'?'red':r.impact==='متوسط'?'amber':'green'}">${esc(r.impact)}</span></td><td>${esc(r.mitigation)}</td><td>${esc(r.owner)}</td><td>${esc(r.status)}</td><td>${r.status!=='مغلقة'?`<button class="btn xs success" onclick="crmRiskClose('${r.riskId}')">إغلاق</button>`:''}</td></tr>`).join('')||'<tr><td colspan="7">لا توجد مخاطر مسجلة.</td></tr>'}</tbody></table></div></div>`}
function rClientAnalytics(){
  migrateClientCRM();let p=crmPipeline(),all=crmRows('opportunities'),won=all.filter(x=>x.stage==='فوز'),closed=all.filter(x=>['فوز','خسارة'].includes(x.stage)),conversion=closed.length?Math.round(won.length/closed.length*100):0,h=crmHealth();
  let stageCounts=CRM_STAGES.map(s=>[s,all.filter(x=>x.stage===s).length]),max=Math.max(1,...stageCounts.map(x=>x[1]));
  return crmPageHead('تحليلات العملاء','مؤشرات عملية لدعم قرارات النمو والاحتفاظ وتحسين الخدمة.')+`
  <div class="grid c4">${securityMetric('قيمة الفرص',crmMoney(p.total),'blue')}${securityMetric('معدل الفوز',conversion+'%',conversion>=50?'green':'amber')}${securityMetric('صحة العلاقة',h.score+'%',h.score>=80?'green':'amber')}${securityMetric('طلبات الخدمة',G.clientRequests.filter(x=>x.clientAccountId===G.activeClientAccountId).length,'gold')}</div>
  <div class="grid c2 mt"><div class="card panel"><h3>توزيع خط الفرص</h3><div class="crm-bars">${stageCounts.map(([s,n])=>`<div><span>${s}</span><i><b style="width:${Math.round(n/max*100)}%"></b></i><strong>${n}</strong></div>`).join('')}</div></div>
  <div class="card panel"><h3>مؤشرات إدارة العلاقة</h3>${[['قيمة العقود',crmMoney((G.clientPortfolio.contracts||[]).filter(x=>!x.clientAccountId||x.clientAccountId===G.activeClientAccountId).reduce((s,x)=>s+Number(x.value||0),0))],['المشاريع النشطة',(G.clientPortfolio.projects||[]).filter(x=>!x.clientAccountId||x.clientAccountId===G.activeClientAccountId).length],['الشكاوى المفتوحة',(G.clientPortfolio.complaints||[]).filter(x=>x.status!=='مغلقة').length],['التفاعلات',G.clientInteractions.filter(x=>x.clientAccountId===G.activeClientAccountId).length],['المتابعات المتأخرة',h.overdue]].map(x=>`<div class="security-row"><b>${x[0]}</b><strong>${x[1]}</strong></div>`).join('')}</div></div>
  <div class="statusband draft mt">هذه المؤشرات مرتبطة بحساب العميل النشط فقط، وتتغير تلقائيًا عند تبديل الجهة من مركز العميل.</div>`}
