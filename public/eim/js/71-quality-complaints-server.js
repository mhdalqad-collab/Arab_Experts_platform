/* =========================================================
   الشكاوى والإجراءات التصحيحية — سجل خادمي محكوم
   ========================================================= */
function migrateQualityComplaints(){G.qualityComplaints=G.qualityComplaints||{admin:false,complaints:[]}}
async function qualityComplaintsRestore(){
  if(!G.user)return;
  try{
    let response=await fetch('/api/quality-complaints',{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)return;G.qualityComplaints=await response.json();
    localStorage.eim5=JSON.stringify(G);if(current===32)render()
  }catch(error){console.warn('[EIM complaints]',error)}
}
async function submitQualityComplaint(){
  let projectId=$('complaintProject')?.value||'',category=$('complaintCategory')?.value||'',
      subject=$('complaintSubject')?.value.trim()||'',statement=$('complaintStatement')?.value.trim()||'';
  if(!projectId||!category||!subject||!statement){toast('أكمل بيانات الشكوى الإلزامية');return}
  try{
    let response=await fetch('/api/quality-complaints',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId,category,subject,statement})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'complaint failed');
    await qualityComplaintsRestore();toast('سُجلت الشكوى بالرقم '+result.publicCode)
  }catch(error){console.warn('[EIM complaint submit]',error);toast('تعذر تسجيل الشكوى')}
}
async function qualityComplaintAction(complaintId,action){
  let note=$('complaintActionNote')?.value.trim()||'',priority=$('complaintPriority')?.value||'NORMAL',dueAt=$('correctiveDue')?.value||'';
  if(['RESPOND','RESOLVE','APPEAL','ADD_CORRECTIVE'].includes(action)&&!note){toast('اكتب تفاصيل الإجراء');return}
  try{
    let response=await fetch('/api/quality-complaints',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({complaintId,action,note,priority,dueAt})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'action failed');
    await qualityComplaintsRestore();toast('حُفظ الإجراء في سجل الشكوى')
  }catch(error){console.warn('[EIM complaint action]',error);toast('هذا الانتقال غير مسموح لدورك أو لحالة الشكوى')}
}
function complaintActions(x,admin){
  if(admin&&x.status==='SUBMITTED')return`<button class="btn primary sm" onclick="qualityComplaintAction('${x.complaint_id}','TRIAGE')">بدء المراجعة</button>`;
  if(admin&&['UNDER_REVIEW','RESPONSE_RECEIVED','APPEALED'].includes(x.status))return`<button class="btn success sm" onclick="qualityComplaintAction('${x.complaint_id}','RESOLVE')">إصدار القرار</button><button class="btn soft sm" onclick="qualityComplaintAction('${x.complaint_id}','ADD_CORRECTIVE')">إجراء تصحيحي</button>`;
  if(x.isRespondent&&x.status==='UNDER_REVIEW')return`<button class="btn primary sm" onclick="qualityComplaintAction('${x.complaint_id}','RESPOND')">تقديم الرد</button>`;
  if(x.isComplainant&&x.status==='RESOLVED')return`<button class="btn success sm" onclick="qualityComplaintAction('${x.complaint_id}','CLOSE')">قبول القرار والإغلاق</button><button class="btn danger sm" onclick="qualityComplaintAction('${x.complaint_id}','APPEAL')">استئناف</button>`;
  if(x.isComplainant&&x.status==='CLOSED')return`<button class="btn danger sm" onclick="qualityComplaintAction('${x.complaint_id}','APPEAL')">استئناف القرار</button>`;
  return''
}
function rComplaint(){
  let d=G.qualityComplaints||{admin:false,complaints:[]},rows=d.complaints||[],projects=G.serviceProjects||[];
  return pagehead({ctx:d.admin?'إدارة الجودة':'الجودة والشكاوى',title:d.admin?'قضايا الجودة والشكاوى':'الشكاوى والمراجعات',desc:'سجل رسمي مرتبط بمشروع، مع انتقالات وصلاحيات وإجراءات تصحيحية قابلة للتدقيق.'},`<button class="btn ghost sm" onclick="qualityComplaintsRestore()">تحديث</button>`)+metrics([['إجمالي القضايا',rows.length],['مفتوحة',rows.filter(x=>!['CLOSED'].includes(x.status)).length,'gold'],['حرجة',rows.filter(x=>x.priority==='CRITICAL').length,'amber'],['مغلقة',rows.filter(x=>x.status==='CLOSED').length,'green']])+`
  ${!d.admin?`<div class="card panel mt"><h3>تسجيل شكوى جديدة</h3><div class="grid c2"><label>المشروع <span class="req">*</span><select id="complaintProject" class="ctl"><option value="">اختر مشروعًا</option>${projects.map(x=>`<option value="${x.projectId}">${esc(x.publicCode)} — ${esc(x.title)}</option>`).join('')}</select></label><label>التصنيف <span class="req">*</span><select id="complaintCategory" class="ctl"><option value="">اختر</option><option value="QUALITY">جودة المخرجات</option><option value="DELAY">التأخير</option><option value="CONDUCT">السلوك المهني</option><option value="PAYMENT">المدفوعات</option><option value="SCOPE">النطاق</option><option value="CONFIDENTIALITY">السرية</option><option value="OTHER">أخرى</option></select></label></div><label class="mt">الموضوع <span class="req">*</span><input id="complaintSubject" class="ctl"></label><label class="mt">البيان <span class="req">*</span><textarea id="complaintStatement" class="ctl" rows="3"></textarea></label><button class="btn gold mt" onclick="submitQualityComplaint()">تسجيل الشكوى</button></div>`:''}
  <div class="card panel mt"><h3>الإجراء الحالي</h3><div class="grid c2">${d.admin?`<select id="complaintPriority" class="ctl"><option value="NORMAL">عادية</option><option value="LOW">منخفضة</option><option value="HIGH">عالية</option><option value="CRITICAL">حرجة</option></select><input id="correctiveDue" type="date" class="ctl">`:''}</div><textarea id="complaintActionNote" class="ctl mt" rows="2" placeholder="الرد أو مبررات القرار أو وصف الإجراء التصحيحي…"></textarea></div>
  <div class="mt">${rows.length?rows.map(x=>`<div class="card panel mt"><div class="lrow"><span><b>${esc(x.subject)}</b><small>${esc(x.public_code)} · ${esc(x.complainant_name)} ← ${esc(x.respondent_name||'المنصة')}</small></span><span class="tagb ${x.status==='CLOSED'?'green':x.priority==='CRITICAL'?'amber':'blue'}">${esc(x.status)}</span></div><p>${esc(x.statement)}</p>${x.resolution?`<div class="summarybox"><b>القرار</b><p>${esc(x.resolution)}</p></div>`:''}${(x.correctiveActions||[]).map(a=>`<div class="lrow mt"><span><b>إجراء تصحيحي</b><small>${esc(a.action_text)} · ${esc(a.due_at||'دون موعد')}</small></span><span class="tagb gold">${esc(a.status)}</span></div>`).join('')}<div class="acts mt">${complaintActions(x,d.admin)}</div><details class="mt"><summary>سجل الانتقالات (${(x.transitions||[]).length})</summary>${(x.transitions||[]).map(t=>`<div class="lrow"><small>${esc(t.action_code)} · ${esc(t.from_status)} ← ${esc(t.to_status)}</small><small>${new Date(t.occurred_at).toLocaleString('ar')}</small></div>`).join('')}</details></div>`).join(''):`<div class="card empty"><b>لا توجد شكاوى مسجلة</b></div>`}</div>`
}
