/* =========================================================
   إغلاق المشروع وشهادة الإنجاز والتقييم المتبادل
   ========================================================= */
function migrateProjectClosures(){
  G.projectClosures=G.projectClosures||{}
}
async function projectClosureRestore(projectId=G.activeServiceProjectId,rerender=true){
  if(!G.user||!projectId)return;
  try{
    let response=await fetch('/api/project-closure?projectId='+encodeURIComponent(projectId),{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)return;G.projectClosures[projectId]=await response.json();
    localStorage.eim5=JSON.stringify(G);if(rerender&&current===111)render()
  }catch(error){console.warn('[EIM project closure]',error)}
}
function activeProjectClosure(){
  return G.projectClosures?.[G.activeServiceProjectId]||{closure:null,certificate:null,reviews:[]}
}
async function submitProjectClosure(){
  let p=activeServiceProject(),summary=$('closureSummary')?.value.trim()||'',lessons=$('closureLessons')?.value.trim()||'';
  if(!p||!summary){toast('أدخل ملخص الإنجاز');return}
  try{
    let response=await fetch('/api/project-closure',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:p.projectId,summary,lessons})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'closure failed');
    await serviceProjectsRestore();await projectClosureRestore();toast(result.revised?'أعيد تقديم محضر الإغلاق':'أُرسل محضر الإغلاق للعميل')
  }catch(error){console.warn('[EIM closure submit]',error);toast('تعذر تقديم الإغلاق؛ تحقق من المستحقات وأوامر التغيير والمخاطر والقضايا المفتوحة')}
}
async function projectClosureAction(action){
  let p=activeServiceProject(),note=$('closureDecisionNote')?.value.trim()||'';if(!p)return;
  if(!note){toast('اكتب ملاحظة القرار');return}
  try{
    let response=await fetch('/api/project-closure',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:p.projectId,action,note})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'closure action failed');
    await serviceProjectsRestore();await projectClosureRestore();toast(action==='ACCEPT_CLOSURE'?'أُغلق المشروع وصدرت شهادة الإنجاز':'أعيد المحضر لاستكماله')
  }catch(error){console.warn('[EIM closure action]',error);toast('تعذر اعتماد قرار الإغلاق')}
}
function reviewStars(id,label){
  return`<label>${label}<select id="${id}" class="ctl"><option value="">اختر التقييم</option>${[5,4,3,2,1].map(x=>`<option value="${x}">${'★'.repeat(x)} ${x}/5</option>`).join('')}</select></label>`
}
async function submitProjectReview(){
  let p=activeServiceProject(),scores={
    quality:Number($('reviewQuality')?.value),timeliness:Number($('reviewTimeliness')?.value),
    communication:Number($('reviewCommunication')?.value),professionalism:Number($('reviewProfessionalism')?.value),
    value:Number($('reviewValue')?.value)
  },note=$('reviewComment')?.value.trim()||'';
  if(!p||Object.values(scores).some(x=>!x)){toast('قيّم جميع المؤشرات الخمسة');return}
  try{
    let response=await fetch('/api/project-closure',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:p.projectId,action:'SUBMIT_REVIEW',scores,note})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'review failed');
    await projectClosureRestore();toast('حُفظ التقييم الموثق لهذا المشروع')
  }catch(error){console.warn('[EIM review submit]',error);toast('تعذر حفظ التقييم أو سبق تقديمه')}
}
function projectClosurePanel(p,provider){
  let x=activeProjectClosure(),closure=x.closure,certificate=x.certificate,reviews=x.reviews||[],
      role=provider?'PROVIDER':'CLIENT',reviewed=reviews.some(r=>r.reviewer_role===role),
      allPaid=(activeProjectFinance().schedules||[]).length>0&&(activeProjectFinance().schedules||[]).every(s=>s.status==='PAID');
  return`<div class="card panel mt"><div class="lrow"><span><h3>الإغلاق وشهادة الإنجاز</h3><small>إغلاق محكوم بعد اكتمال التسليمات وسداد المستحقات.</small></span><button class="btn ghost xs" onclick="projectClosureRestore()">تحديث</button></div>
  ${provider&&p.status==='COMPLETED'&&allPaid?`<div class="summarybox mt"><label>ملخص الإنجاز <span class="req">*</span></label><textarea id="closureSummary" class="ctl" rows="3" placeholder="ما تم إنجازه ونتيجة المشروع…"></textarea><label class="mt">الدروس المستفادة</label><textarea id="closureLessons" class="ctl" rows="2" placeholder="دروس قابلة للاستفادة في المشاريع اللاحقة…"></textarea><button class="btn gold mt" onclick="submitProjectClosure()">${closure?.status==='REVISION_REQUIRED'?'إعادة تقديم محضر الإغلاق':'تقديم محضر الإغلاق'}</button></div>`:''}
  ${!provider&&p.status==='CLOSURE_PENDING'?`<div class="summarybox mt"><b>محضر الإغلاق بانتظار قرارك</b><p>${esc(closure?.report?.summary||'')}</p><label>ملاحظة القرار <span class="req">*</span></label><textarea id="closureDecisionNote" class="ctl" rows="2" placeholder="مبررات القبول أو المطلوب استكماله…"></textarea><div class="acts mt"><button class="btn success" onclick="projectClosureAction('ACCEPT_CLOSURE')">القبول النهائي وإصدار الشهادة</button><button class="btn danger" onclick="projectClosureAction('REJECT_CLOSURE')">إعادة للاستكمال</button></div></div>`:''}
  ${certificate?`<div class="summarybox mt"><div class="lrow"><span><b>شهادة إنجاز المشروع</b><small>${esc(certificate.public_code)} · ${new Date(certificate.issued_at).toLocaleDateString('ar')}</small></span><span class="tagb green">موثقة</span></div><p>${esc(certificate.snapshot?.title||p.title)} — اكتمل وأُغلق وفق التسليمات المقبولة والسجل المالي.</p></div>`:''}
  ${p.status==='CLOSED'&&!reviewed?`<div class="summarybox mt"><h3>التقييم المتبادل</h3><div class="grid c2">${reviewStars('reviewQuality','جودة المخرجات')}${reviewStars('reviewTimeliness','الالتزام الزمني')}${reviewStars('reviewCommunication','التواصل')}${reviewStars('reviewProfessionalism','المهنية')}${reviewStars('reviewValue','القيمة المحققة')}</div><label class="mt">تعليق مهني</label><textarea id="reviewComment" class="ctl" rows="2" placeholder="ملاحظة مرتبطة بالتجربة الفعلية…"></textarea><button class="btn primary mt" onclick="submitProjectReview()">إرسال التقييم</button></div>`:''}
  ${reviews.length?`<div class="mt"><small>التقييمات المقدمة: ${reviews.length}/2</small></div>`:''}</div>`
}
