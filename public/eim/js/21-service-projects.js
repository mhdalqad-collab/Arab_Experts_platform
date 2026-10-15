/* =========================================================
   المشاريع التنفيذية والتسليمات وأوامر التغيير
   ========================================================= */
function migrateServiceProjects(){
  G.serviceProjects=Array.isArray(G.serviceProjects)?G.serviceProjects:[];
  G.activeServiceProjectId=G.activeServiceProjectId||'';
  G.projectFinance=G.projectFinance||{}
}
async function serviceProjectsRestore(){
  if(!G.user)return;
  try{
    let response=await fetch('/api/service-projects',{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)return;
    let result=await response.json();G.serviceProjects=result.projects||[];
    if(!G.activeServiceProjectId&&G.serviceProjects[0])G.activeServiceProjectId=G.serviceProjects[0].projectId;
    if(G.activeServiceProjectId){
      await projectFinanceRestore(G.activeServiceProjectId,false);
      await projectClosureRestore(G.activeServiceProjectId,false)
    }
    localStorage.eim5=JSON.stringify(G);if(current===111)render()
  }catch(error){console.warn('[EIM service projects]',error)}
}
function activeServiceProject(){return(G.serviceProjects||[]).find(x=>x.projectId===G.activeServiceProjectId)||null}
async function openServiceProject(id){G.activeServiceProjectId=id;persist(true);await projectFinanceRestore(id,false);await projectClosureRestore(id,false);go(111)}
async function projectFinanceRestore(projectId=G.activeServiceProjectId,rerender=true){
  if(!G.user||!projectId)return;
  try{
    let response=await fetch('/api/project-finance?projectId='+encodeURIComponent(projectId),{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)return;G.projectFinance[projectId]=await response.json();
    localStorage.eim5=JSON.stringify(G);if(rerender&&current===111)render()
  }catch(error){console.warn('[EIM project finance]',error)}
}
function activeProjectFinance(){return G.projectFinance?.[G.activeServiceProjectId]||{schedules:[],invoices:[],payments:[]}}
function projectMoney(minor,currency){return`${(Number(minor||0)/100).toLocaleString('ar',{minimumFractionDigits:2,maximumFractionDigits:2})} ${esc(currency||'USD')}`}
async function projectIssueInvoice(scheduleId){
  let p=activeServiceProject(),note=$('projectFinanceNote')?.value.trim()||'';if(!p)return;
  try{
    let response=await fetch('/api/project-finance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:p.projectId,scheduleId,note})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'invoice failed');
    await projectFinanceRestore();toast(result.duplicate?'الفاتورة صادرة مسبقًا':'صدرت الفاتورة وربطت بالمرحلة المقبولة')
  }catch(error){console.warn('[EIM project invoice]',error);toast('تعذر إصدار الفاتورة')}
}
async function projectFinanceAction(action,invoiceId){
  let p=activeServiceProject(),note=$('projectFinanceNote')?.value.trim()||'',method=$('projectPaymentMethod')?.value||'',reference=$('projectPaymentReference')?.value.trim()||'';if(!p)return;
  if(action==='DISPUTE'&&!note){toast('اكتب سبب الاعتراض');return}
  if(action==='RECORD_PAYMENT'&&!reference){toast('أدخل مرجع عملية الدفع');return}
  try{
    let response=await fetch('/api/project-finance',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:p.projectId,invoiceId,action,note,method,reference})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'finance action failed');
    await projectFinanceRestore();toast(action==='APPROVE'?'اعتُمدت الفاتورة':action==='RECORD_PAYMENT'?'سُجل السداد وأُغلق الاستحقاق':'سُجل الاعتراض')
  }catch(error){console.warn('[EIM project finance action]',error);toast('تعذر تنفيذ الإجراء المالي')}
}
async function createProjectFromContract(){
  let c=activeServiceContract();if(!c||c.status!=='ACTIVE'){toast('اختر عقدًا نافذًا');return}
  try{
    let response=await fetch('/api/service-projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contractId:c.contractId})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'project create failed');
    await serviceProjectsRestore();G.activeServiceProjectId=result.projectId;persist(true);go(111);toast(result.duplicate?'فُتح المشروع القائم':'صدر أمر البدء وأُنشئ المشروع')
  }catch(error){console.warn('[EIM project create]',error);toast('تعذر إنشاء المشروع')}
}
async function uploadDeliverableFiles(deliverableId){
  let p=activeServiceProject(),input=$('deliverableFiles-'+deliverableId),files=[...(input?.files||[])];
  if(!p||!files.length){toast('اختر ملفًا واحدًا على الأقل');return}
  let form=new FormData();form.append('category','PROJECT_DELIVERABLE');form.append('confidentiality','PLATFORM_ONLY');
  form.append('projectId',p.projectId);form.append('deliverableId',deliverableId);
  files.slice(0,5).forEach(file=>form.append('files',file));
  try{
    let response=await fetch('/api/documents',{method:'POST',body:form}),result=await response.json();
    if(!response.ok&&!(result.uploaded||[]).length)throw new Error(result.error||'upload failed');
    await serviceProjectsRestore();toast(`تم رفع ${(result.uploaded||[]).length} ملف${(result.rejected||[]).length?'، وتعذر رفع '+result.rejected.length:''}`)
  }catch(error){console.warn('[EIM deliverable upload]',error);toast('تعذر رفع الملفات؛ الصيغ المتاحة PDF وWord وPNG وJPG بحد 10MB')}
}
async function serviceProjectAction(action,targetId=''){
  let p=activeServiceProject(),note=$('projectActionNote')?.value.trim()||'';if(!p)return;
  if(['SUBMIT_DELIVERABLE','ACCEPT_DELIVERABLE','REJECT_DELIVERABLE','REQUEST_CHANGE','APPROVE_CHANGE','REJECT_CHANGE','WITHDRAW_CHANGE'].includes(action)&&!note){toast('اكتب تفاصيل الإجراء أولًا');return}
  let change=action==='REQUEST_CHANGE'?{impactDays:Number($('changeImpactDays')?.value)||0,impactAmount:Number($('changeImpactAmount')?.value)||0}:null;
  try{
    let response=await fetch('/api/service-projects',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:p.projectId,action,targetId,note,change})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'project action failed');
    await serviceProjectsRestore();toast(result.progress===100?'اكتملت جميع التسليمات وأُغلق التنفيذ':action==='APPROVE_CHANGE'?'اعتُمد أمر التغيير وحُدّث خط أساس المشروع':action==='REJECT_CHANGE'?'رُفض أمر التغيير ووُثق القرار':action==='WITHDRAW_CHANGE'?'سُحب أمر التغيير':'سُجل الإجراء وتحدث تقدم المشروع')
  }catch(error){console.warn('[EIM project action]',error);toast('تعذر اعتماد الإجراء')}
}
async function createProjectRegisterItem(){
  let p=activeServiceProject(),item={
    itemType:$('registerItemType')?.value||'RISK',
    title:$('registerItemTitle')?.value.trim()||'',
    description:$('registerItemDescription')?.value.trim()||'',
    priority:$('registerItemPriority')?.value||'MEDIUM',
    ownerRole:$('registerItemOwner')?.value||'provider',
    dueDate:$('registerItemDue')?.value||''
  };
  if(!p||!item.title){toast('أدخل عنوان السجل');return}
  try{
    let response=await fetch('/api/service-projects',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:p.projectId,action:'CREATE_REGISTER_ITEM',register:item})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'register create failed');
    await serviceProjectsRestore();toast(item.itemType==='RISK'?'سُجل الخطر':item.itemType==='ISSUE'?'سُجلت القضية':'وُثق القرار')
  }catch(error){console.warn('[EIM project register create]',error);toast('تعذر إنشاء بند السجل')}
}
async function transitionProjectRegisterItem(id,nextStatus){
  let p=activeServiceProject(),note=$('projectActionNote')?.value.trim()||'';
  if(!p||!note){toast('اكتب مبررات الانتقال في خانة الإجراء والتوثيق');return}
  try{
    let response=await fetch('/api/service-projects',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:p.projectId,action:'TRANSITION_REGISTER_ITEM',targetId:id,nextStatus,note})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'register transition failed');
    await serviceProjectsRestore();toast('حُدثت حالة السجل ووُثق الانتقال')
  }catch(error){console.warn('[EIM project register transition]',error);toast('تعذر تحديث الحالة أو يتطلب القرار صلاحية العميل')}
}
function projectRegisterActions(x,provider){
  let actions=[];
  if(x.item_type==='RISK'){
    if(x.status==='OPEN')actions.push(['MITIGATING','بدء المعالجة','primary']);
    if(x.status==='MITIGATING')actions.push(['OPEN','إعادة للمتابعة','ghost']);
    if(!provider&&['OPEN','MITIGATING'].includes(x.status))actions.push(['CLOSED','إغلاق الخطر','success']);
    if(x.status==='CLOSED')actions.push(['OPEN','إعادة فتح','ghost'])
  }else if(x.item_type==='ISSUE'){
    if(x.status==='OPEN')actions.push(['IN_PROGRESS','بدء المعالجة','primary']);
    if(x.status==='IN_PROGRESS')actions.push(['RESOLVED','إرسال كمحلولة','success'],['OPEN','إعادة للمتابعة','ghost']);
    if(x.status==='RESOLVED')actions.push(['IN_PROGRESS','إعادة للمعالجة','ghost']);
    if(!provider&&x.status==='RESOLVED')actions.push(['CLOSED','اعتماد الإغلاق','success']);
    if(x.status==='CLOSED')actions.push(['OPEN','إعادة فتح','ghost'])
  }else if(!provider&&x.status==='RECORDED')actions.push(['SUPERSEDED','اعتبار القرار مستبدلًا','ghost']);
  return actions.map(a=>`<button class="btn ${a[2]} sm" onclick="transitionProjectRegisterItem('${x.register_item_id}','${a[0]}')">${a[1]}</button>`).join('')
}
function projectRegisterPanel(p,provider){
  let rows=p.registerItems||[],open=rows.filter(x=>!['CLOSED','SUPERSEDED'].includes(x.status)).length,
      labels={RISK:'خطر',ISSUE:'قضية',DECISION:'قرار'},tones={CRITICAL:'red',HIGH:'amber',MEDIUM:'gold',LOW:'gray'};
  return`<div class="card panel mt"><div class="lrow"><span><h3>سجل المخاطر والقضايا والقرارات</h3><small>سجل تنفيذي مشترك؛ إغلاق المخاطر والقضايا واعتماد استبدال القرارات من صلاحية العميل.</small></span><span class="tagb ${open?'amber':'green'}">${open} مفتوح</span></div>
  ${p.status==='ACTIVE'?`<div class="summarybox mt"><div class="grid c2"><label>نوع السجل <select id="registerItemType" class="ctl"><option value="RISK">خطر</option><option value="ISSUE">قضية تنفيذية</option><option value="DECISION">قرار مشروع</option></select></label><label>الأولوية <select id="registerItemPriority" class="ctl"><option value="MEDIUM">متوسطة</option><option value="LOW">منخفضة</option><option value="HIGH">مرتفعة</option><option value="CRITICAL">حرجة</option></select></label><label>المسؤول <select id="registerItemOwner" class="ctl"><option value="provider">مقدم الخدمة</option><option value="client">العميل</option></select></label><label>تاريخ الاستحقاق <input id="registerItemDue" type="date" class="ctl"></label></div><label class="mt">العنوان <span class="req">*</span><input id="registerItemTitle" class="ctl" maxlength="300" placeholder="وصف مختصر ومحدد"></label><label class="mt">الوصف وخطة الاستجابة<input id="registerItemDescription" class="ctl" maxlength="4000" placeholder="السياق، الأثر، الاستجابة أو أساس القرار"></label><button class="btn soft mt" onclick="createProjectRegisterItem()">إضافة إلى سجل المشروع</button></div>`:''}
  ${rows.length?rows.map(x=>`<div class="summarybox mt"><div class="lrow"><span><b>${esc(x.public_code)} · ${labels[x.item_type]||esc(x.item_type)} — ${esc(x.title)}</b><small>${esc(x.description||'')} · المسؤول: ${x.owner_role==='client'?'العميل':'مقدم الخدمة'}${x.due_date?' · الاستحقاق '+esc(x.due_date):''}</small></span><span><span class="tagb ${tones[x.priority]||'gray'}">${esc(x.priority)}</span> <span class="tagb ${['CLOSED','SUPERSEDED'].includes(x.status)?'green':'blue'}">${esc(x.status)}</span></span></div>${projectRegisterActions(x,provider)?`<div class="acts mt">${projectRegisterActions(x,provider)}</div>`:''}${(x.transitions||[]).length?`<details class="mt"><summary>سجل انتقالات البند</summary>${x.transitions.map(t=>`<div class="lrow mt"><span><b>${esc(t.from_status)} ← ${esc(t.to_status)}</b><small>${esc(t.note||'')}</small></span><small>${esc(t.actor_role)} · ${esc(t.occurred_at)}</small></div>`).join('')}</details>`:''}</div>`).join(''):'<div class="empty mt"><p>لم تسجل مخاطر أو قضايا أو قرارات بعد.</p></div>'}</div>`
}
function editProjectProgressReport(id){G.editProgressReportId=id;persist(true);render()}
function cancelProjectProgressReportEdit(){G.editProgressReportId='';persist(true);render()}
async function submitProjectProgressReport(){
  let p=activeServiceProject(),report={
    progressReportId:G.editProgressReportId||'',
    periodStart:$('progressPeriodStart')?.value||'',
    periodEnd:$('progressPeriodEnd')?.value||'',
    declaredProgress:Number($('progressDeclared')?.value),
    health:{
      schedule:$('progressHealthSchedule')?.value||'',
      cost:$('progressHealthCost')?.value||'',
      scope:$('progressHealthScope')?.value||'',
      quality:$('progressHealthQuality')?.value||''
    },
    summary:$('progressSummary')?.value.trim()||'',
    nextSteps:$('progressNextSteps')?.value.trim()||'',
    blockers:$('progressBlockers')?.value.trim()||''
  };
  if(!p||!report.periodStart||!report.periodEnd||!report.summary||!Number.isInteger(report.declaredProgress)||report.declaredProgress<0||report.declaredProgress>100){toast('أكمل فترة التقرير والإنجاز والملخص بصورة صحيحة');return}
  try{
    let response=await fetch('/api/service-projects',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:p.projectId,action:'SUBMIT_PROGRESS_REPORT',report})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'progress report failed');
    G.editProgressReportId='';persist(true);await serviceProjectsRestore();toast(report.progressReportId?'أُنشئت مراجعة جديدة وأعيد إرسال التقرير':'أُرسل تقرير التقدم للعميل')
  }catch(error){console.warn('[EIM progress report]',error);toast('تعذر إرسال التقرير؛ تحقق من الفترة والحقول المطلوبة')}
}
async function reviewProjectProgressReport(id,action){
  let p=activeServiceProject(),note=$('projectActionNote')?.value.trim()||'';
  if(!p||!note){toast('اكتب مبررات قرار المراجعة في خانة الإجراء والتوثيق');return}
  try{
    let response=await fetch('/api/service-projects',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:p.projectId,targetId:id,action,note})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'progress review failed');
    await serviceProjectsRestore();toast(action==='ACCEPT_PROGRESS_REPORT'?'اعتُمد تقرير التقدم':'أُعيد التقرير للتعديل')
  }catch(error){console.warn('[EIM progress review]',error);toast('تعذر اعتماد قرار التقرير')}
}
function progressHealthField(id,label,value='GREEN'){
  return`<label>${label}<select id="${id}" class="ctl"><option value="GREEN" ${value==='GREEN'?'selected':''}>أخضر — ضمن الخطة</option><option value="AMBER" ${value==='AMBER'?'selected':''}>كهرماني — يحتاج انتباهًا</option><option value="RED" ${value==='RED'?'selected':''}>أحمر — متعثر</option></select></label>`
}
function projectProgressReportsPanel(p,provider){
  let rows=p.progressReports||[],edit=rows.find(x=>x.progress_report_id===G.editProgressReportId&&x.status==='REVISION_REQUIRED'),d=edit?.details||{},h=d.health||{},
      healthTone=x=>x==='GREEN'?'green':x==='AMBER'?'amber':'red',statusTone=x=>x==='ACCEPTED'?'green':x==='REVISION_REQUIRED'?'amber':'blue';
  return`<div class="card panel mt"><div class="lrow"><span><h3>تقارير تقدم المشروع</h3><small>التقدم المعلن للمقارنة والرقابة؛ لا يستبدل نسبة الإنجاز الرسمية المحسوبة من التسليمات المقبولة.</small></span><span class="tagb blue">${rows.length} تقرير</span></div>
  ${provider&&p.status==='ACTIVE'?`<div class="summarybox mt">${edit?`<div class="statusband draft">تعديل ${esc(edit.public_code)} — ستبقى النسخة السابقة محفوظة.</div>`:''}<div class="grid c2"><label>بداية الفترة <span class="req">*</span><input id="progressPeriodStart" type="date" class="ctl" value="${esc(edit?.period_start||'')}"></label><label>نهاية الفترة <span class="req">*</span><input id="progressPeriodEnd" type="date" class="ctl" value="${esc(edit?.period_end||'')}"></label><label>الإنجاز المعلن % <span class="req">*</span><input id="progressDeclared" type="number" min="0" max="100" step="1" class="ctl" value="${edit?Number(edit.declared_progress):''}"></label><div class="summarybox"><small>الإنجاز الرسمي المقبول</small><b>${Number(p.progress||0)}%</b></div>${progressHealthField('progressHealthSchedule','حالة الجدول الزمني',h.schedule)}${progressHealthField('progressHealthCost','حالة التكلفة',h.cost)}${progressHealthField('progressHealthScope','حالة النطاق',h.scope)}${progressHealthField('progressHealthQuality','حالة الجودة',h.quality)}</div><label class="mt">ملخص المنجز <span class="req">*</span><textarea id="progressSummary" class="ctl" rows="2">${esc(d.summary||'')}</textarea></label><label class="mt">الأعمال القادمة<textarea id="progressNextSteps" class="ctl" rows="2">${esc(d.nextSteps||'')}</textarea></label><label class="mt">العوائق والاحتياجات<textarea id="progressBlockers" class="ctl" rows="2">${esc(d.blockers||'')}</textarea></label><div class="acts mt"><button class="btn gold" onclick="submitProjectProgressReport()">${edit?'إعادة إرسال المراجعة':'إرسال تقرير التقدم'}</button>${edit?`<button class="btn ghost" onclick="cancelProjectProgressReportEdit()">إلغاء التعديل</button>`:''}</div></div>`:''}
  ${rows.length?rows.map(x=>{let d=x.details||{},h=d.health||{};return`<div class="summarybox mt"><div class="lrow"><span><b>${esc(x.public_code)} · ${esc(x.period_start)} — ${esc(x.period_end)}</b><small>المعلن ${Number(x.declared_progress)}% · الرسمي ${Number(p.progress||0)}% · المراجعة ${Number(x.current_revision)}</small></span><span class="tagb ${statusTone(x.status)}">${esc(x.status)}</span></div><div class="acts mt"><span class="tagb ${healthTone(h.schedule)}">الوقت</span><span class="tagb ${healthTone(h.cost)}">التكلفة</span><span class="tagb ${healthTone(h.scope)}">النطاق</span><span class="tagb ${healthTone(h.quality)}">الجودة</span></div><p>${esc(d.summary||'')}</p>${d.nextSteps?`<small>القادم: ${esc(d.nextSteps)}</small>`:''}${d.blockers?`<small>العوائق: ${esc(d.blockers)}</small>`:''}${!provider&&x.status==='SUBMITTED'?`<div class="acts mt"><button class="btn success sm" onclick="reviewProjectProgressReport('${x.progress_report_id}','ACCEPT_PROGRESS_REPORT')">اعتماد التقرير</button><button class="btn danger sm" onclick="reviewProjectProgressReport('${x.progress_report_id}','REQUEST_PROGRESS_REPORT_REVISION')">طلب تعديل</button></div>`:''}${provider&&x.status==='REVISION_REQUIRED'?`<button class="btn primary sm mt" onclick="editProjectProgressReport('${x.progress_report_id}')">فتح التقرير للتعديل</button>`:''}<details class="mt"><summary>الإصدارات وسجل المراجعة</summary>${(x.versions||[]).map(v=>`<div class="lrow mt"><b>الإصدار ${v.revision}</b><small>${esc(v.created_at)}</small></div>`).join('')}${(x.transitions||[]).map(t=>`<div class="lrow mt"><span><b>${esc(t.from_status)} ← ${esc(t.to_status)}</b><small>${esc(t.note||'')}</small></span><small>${esc(t.actor_role)} · ${esc(t.occurred_at)}</small></div>`).join('')}</details></div>`}).join(''):'<div class="empty mt"><p>لم تُقدّم تقارير تقدم بعد.</p></div>'}</div>`
}
function rServiceProjects(){
  let list=G.serviceProjects||[],p=activeServiceProject(),provider=G.ctx!=='عميل',f=activeProjectFinance();
  return pagehead({ctx:'التنفيذ',title:'المشاريع والتسليمات',desc:'أوامر البدء والمعالم والتسليمات والقبول وأوامر التغيير المرتبطة بالعقود.'},`<button class="btn ghost sm" onclick="serviceProjectsRestore()">تحديث المشاريع</button>`)+metrics([['إجمالي المشاريع',list.length],['نشطة',list.filter(x=>x.status==='ACTIVE').length,'blue'],['بانتظار مراجعة',list.reduce((n,x)=>n+(x.deliverables||[]).filter(y=>y.status==='SUBMITTED').length,0),'gold'],['مكتملة',list.filter(x=>x.status==='COMPLETED').length,'green']])+`
  <div class="grid c2 mt"><div>${list.length?list.map(x=>`<button class="card lrow" style="width:100%;text-align:right;cursor:pointer" onclick="openServiceProject('${x.projectId}')"><span><b>${esc(x.title)}</b><small>${esc(x.publicCode)} · ${esc(x.contractPublicCode||'')}</small></span><span><b>${x.progress}%</b><small>${esc(x.status)}</small></span></button>`).join(''):`<div class="card empty"><b>لا توجد مشاريع تنفيذية</b><p>ينشأ المشروع بعد توقيع الطرفين ونفاذ العقد.</p></div>`}</div><div>${p?`<div class="card panel"><div class="lrow"><span><h3>${esc(p.title)}</h3><small>${esc(p.publicCode)} · ${esc(p.contractPublicCode)}</small></span><span class="tagb ${p.status==='COMPLETED'?'green':'blue'}">${esc(p.status)}</span></div><div class="progress mt"><i style="width:${p.progress}%"></i></div><div class="lrow"><small>التقدم المقبول</small><b>${p.progress}%</b></div><div class="grid c2 mt"><div class="summarybox"><small>موعد الإكمال الحالي</small><b>${esc(p.currentPlannedEndDate||p.plannedEndDate||'غير محدد')}</b></div><div class="summarybox"><small>قيمة التغييرات المعتمدة</small><b>${Number(p.authorizedChangeAmount||0).toLocaleString('ar')} USD</b></div></div>${p.status==='PLANNED'&&G.ctx==='عميل'?`<button class="btn gold mt" onclick="serviceProjectAction('START')">إصدار أمر البدء</button>`:''}</div>
  <div class="card panel mt"><h3>المعالم والتسليمات</h3>${(p.milestones||[]).map(m=>{let d=(p.deliverables||[]).find(x=>x.milestone_id===m.milestone_id),attachments=d?.attachments||[];return`<div class="summarybox mt"><div class="lrow"><span><b>${m.sequence}. ${esc(m.title)}</b><small>الاستحقاق ${esc(m.due_date||'—')} · الوزن ${m.weight}%</small></span><span class="tagb ${d?.status==='ACCEPTED'?'green':d?.status==='SUBMITTED'?'gold':d?.status==='REJECTED'?'amber':'gray'}">${esc(d?.status||m.status)}</span></div>${attachments.length?`<div class="mt"><small>مرفقات التسليم (${attachments.length})</small>${attachments.map(a=>`<div class="lrow mt"><span><b>${esc(a.original_file_name)}</b><small>${Math.ceil(Number(a.size_bytes||0)/1024).toLocaleString('ar')} KB · الإصدار ${a.current_version} · ${esc(a.scan_status)}</small></span><a class="btn ghost xs" href="/api/documents/${a.document_id}">تنزيل</a></div>`).join('')}</div>`:''}${d&&p.status==='ACTIVE'?`<div class="mt">${provider&&['PLANNED','REJECTED'].includes(d.status)?`<label>ملفات التسليم — حتى 5 ملفات في الدفعة<input id="deliverableFiles-${d.deliverable_id}" type="file" class="ctl" multiple accept=".pdf,.docx,.png,.jpg,.jpeg"></label><div class="acts mt"><button class="btn soft" onclick="uploadDeliverableFiles('${d.deliverable_id}')">رفع وربط الملفات</button>${attachments.length?`<button class="btn primary" onclick="serviceProjectAction('SUBMIT_DELIVERABLE','${d.deliverable_id}')">إرسال التسليم للمراجعة</button>`:''}</div>`:''}${!provider&&d.status==='SUBMITTED'?`<div class="acts mt"><button class="btn success" onclick="serviceProjectAction('ACCEPT_DELIVERABLE','${d.deliverable_id}')">قبول التسليم</button><button class="btn danger" onclick="serviceProjectAction('REJECT_DELIVERABLE','${d.deliverable_id}')">إعادته للتصحيح</button></div>`:''}</div>`:''}</div>`}).join('')}</div>
  <div class="card panel mt"><h3>الإجراء والتوثيق</h3><textarea id="projectActionNote" class="ctl" rows="3" placeholder="ملاحظات التسليم أو المراجعة أو وصف التغيير…"></textarea><div class="grid c2 mt"><input id="changeImpactDays" type="number" step="1" class="ctl" placeholder="أثر التغيير بالأيام"><input id="changeImpactAmount" type="number" step="1" class="ctl" placeholder="أثر التغيير المالي"></div><button class="btn soft mt" onclick="serviceProjectAction('REQUEST_CHANGE')">طلب أمر تغيير</button></div>
  ${(p.changeOrders||[]).length?`<div class="card panel mt"><h3>أوامر التغيير</h3><p class="muted">يعدّل الأمر المعتمد خط أساس المشروع مع بقاء العقد الأصلي محفوظًا دون تغيير.</p>${p.changeOrders.map(x=>{let requestedByProvider=x.details?.requestedByRole==='provider',currentRequester=requestedByProvider===provider,open=x.status==='REQUESTED',tone=x.status==='APPROVED'?'green':x.status==='REQUESTED'?'amber':'gray';return`<div class="summarybox mt"><div class="lrow"><span><b>${esc(x.public_code)}</b><small>${esc(x.details?.note||'')}</small></span><span class="tagb ${tone}">${esc(x.status)}</span></div><div class="grid c2 mt"><small>الأثر الزمني: <b>${Number(x.details?.impactDays||0).toLocaleString('ar')} يوم</b></small><small>الأثر المالي: <b>${Number(x.details?.impactAmount||0).toLocaleString('ar')} USD</b></small></div>${open?`<div class="acts mt">${currentRequester?`<button class="btn ghost sm" onclick="serviceProjectAction('WITHDRAW_CHANGE','${x.change_order_id}')">سحب الطلب</button>`:`<button class="btn success sm" onclick="serviceProjectAction('APPROVE_CHANGE','${x.change_order_id}')">اعتماد التغيير</button><button class="btn danger sm" onclick="serviceProjectAction('REJECT_CHANGE','${x.change_order_id}')">رفض التغيير</button>`}</div>`:''}${(x.transitions||[]).length?`<details class="mt"><summary>سجل انتقالات أمر التغيير</summary>${x.transitions.map(t=>`<div class="lrow mt"><span><b>${esc(t.from_status)} ← ${esc(t.to_status)}</b><small>${esc(t.note||'')}</small></span><small>${esc(t.actor_role)} · ${esc(t.occurred_at)}</small></div>`).join('')}</details>`:''}</div>`}).join('')}</div>`:''}
  ${projectProgressReportsPanel(p,provider)}
  ${projectRegisterPanel(p,provider)}
  <div class="card panel mt"><div class="lrow"><span><h3>المستحقات والفواتير</h3><small>لا يصبح الاستحقاق قابلًا للفوترة إلا بعد قبول تسليم مرحلته.</small></span><button class="btn ghost xs" onclick="projectFinanceRestore()">تحديث</button></div>
  ${(f.schedules||[]).map(s=>{let inv=(f.invoices||[]).find(x=>x.schedule_id===s.schedule_id);return`<div class="summarybox mt"><div class="lrow"><span><b>${s.sequence}. ${esc(s.milestone_title)}</b><small>${s.percentage}% · ${projectMoney(s.amount_minor,s.currency)}</small></span><span class="tagb ${s.status==='PAID'?'green':s.status==='ELIGIBLE'?'gold':s.status==='INVOICED'?'blue':'gray'}">${esc(s.status)}</span></div>${provider&&s.status==='ELIGIBLE'?`<button class="btn primary sm mt" onclick="projectIssueInvoice('${s.schedule_id}')">إصدار الفاتورة</button>`:''}${inv?`<div class="lrow mt"><span><b>${esc(inv.public_code)}</b><small>${projectMoney(inv.amount_minor,inv.currency)}</small></span><span class="tagb ${inv.status==='PAID'?'green':inv.status==='DISPUTED'?'amber':'blue'}">${esc(inv.status)}</span></div>${!provider&&inv.status==='ISSUED'?`<div class="acts mt"><button class="btn success sm" onclick="projectFinanceAction('APPROVE','${inv.invoice_id}')">اعتماد الفاتورة</button><button class="btn danger sm" onclick="projectFinanceAction('DISPUTE','${inv.invoice_id}')">اعتراض</button></div>`:''}${!provider&&inv.status==='APPROVED'?`<div class="grid c2 mt"><select id="projectPaymentMethod" class="ctl"><option value="PAYMENT_GATEWAY">بوابة دفع</option><option value="BANK_TRANSFER">تحويل مصرفي</option></select><input id="projectPaymentReference" class="ctl" placeholder="مرجع الدفع"></div><button class="btn gold sm mt" onclick="projectFinanceAction('RECORD_PAYMENT','${inv.invoice_id}')">تسجيل السداد</button>`:''}`:''}</div>`}).join('')||'<div class="empty"><p>يظهر جدول الدفعات بعد إنشاء المشروع من العقد.</p></div>'}
  <textarea id="projectFinanceNote" class="ctl mt" rows="2" placeholder="ملاحظة الفاتورة أو سبب الاعتراض…"></textarea></div>${projectClosurePanel(p,provider)}`:`<div class="card empty"><b>اختر مشروعًا من القائمة</b></div>`}</div></div>`
}
