/* =========================================================
   السمعة والجودة ومنازعات التقييم
   ========================================================= */
function migrateReputation(){G.reputationCenter=G.reputationCenter||null}
async function reputationRestore(){
  if(!G.user)return;
  try{
    let response=await fetch('/api/reputation',{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)return;G.reputationCenter=await response.json();
    localStorage.eim5=JSON.stringify(G);if(current===112)render()
  }catch(error){console.warn('[EIM reputation]',error)}
}
function reputationLabel(score,confidence){
  if(!confidence)return['قيد التكوين','gray'];
  if(score>=90)return['متميز','green'];if(score>=80)return['موثوق جدًا','blue'];
  if(score>=70)return['موثوق','gold'];return['بحاجة إلى تحسين','amber']
}
async function disputeReview(reviewId){
  let reasonCode=$('disputeReason')?.value||'',statement=$('disputeStatement')?.value.trim()||'';
  if(!reasonCode||!statement){toast('حدد سبب الاعتراض واكتب البيان');return}
  try{
    let response=await fetch('/api/reputation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviewId,reasonCode,statement})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'dispute failed');
    await reputationRestore();toast('فُتحت منازعة التقييم وأُوقف احتسابه مؤقتًا')
  }catch(error){console.warn('[EIM reputation dispute]',error);toast('تعذر فتح المنازعة أو توجد منازعة سابقة')}
}
async function resolveReviewDispute(disputeId,decision){
  let resolution=$('disputeResolution')?.value.trim()||'';if(!resolution){toast('اكتب مبررات القرار');return}
  try{
    let response=await fetch('/api/reputation',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({disputeId,decision,resolution})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'resolve failed');
    await reputationRestore();toast(decision==='RESTORE'?'أعيد التقييم إلى الاحتساب':'استُبعد التقييم بقرار موثق')
  }catch(error){console.warn('[EIM dispute resolve]',error);toast('تعذر حسم المنازعة')}
}
function rReputationQuality(){
  let d=G.reputationCenter;
  if(!d)return pagehead({ctx:'الجودة',title:'السمعة المهنية',desc:'مؤشر موثوق مبني على أعمال مغلقة وتقييمات قابلة للتدقيق.'},`<button class="btn primary sm" onclick="reputationRestore()">تحميل المؤشرات</button>`)+`<div class="card empty mt"><b>حمّل سجل السمعة</b></div>`;
  if(d.admin){
    let rows=d.disputes||[];
    return pagehead({ctx:'إدارة الجودة',title:'منازعات التقييم',desc:'مراجعة محايدة مع فصل صلاحية صاحب التقييم عن مسؤول الحسم.'},`<button class="btn ghost sm" onclick="reputationRestore()">تحديث</button>`)+metrics([['منازعات مفتوحة',rows.length],['بحاجة إلى قرار',rows.length,'gold']])+`<div class="card panel mt"><textarea id="disputeResolution" class="ctl" rows="2" placeholder="مبررات القرار الإداري…"></textarea>${rows.length?rows.map(x=>`<div class="summarybox mt"><div class="lrow"><span><b>${esc(x.raised_by_name)}</b><small>${esc(x.reason_code)} · ${new Date(x.raised_at).toLocaleDateString('ar')}</small></span><span class="tagb amber">${esc(x.status)}</span></div><p>${esc(x.statement)}</p><div class="acts"><button class="btn success sm" onclick="resolveReviewDispute('${x.dispute_id}','RESTORE')">إعادة للاحتساب</button><button class="btn danger sm" onclick="resolveReviewDispute('${x.dispute_id}','EXCLUDE')">استبعاد التقييم</button></div></div>`).join(''):`<div class="empty"><b>لا توجد منازعات مفتوحة</b></div>`}</div>`
  }
  let r=d.reputation||{compositeScore:80,confidenceScore:0,sampleCount:0,dimensions:{},reviews:[]},state=reputationLabel(r.compositeScore,r.confidenceScore),labels={quality:'جودة المخرجات',timeliness:'الالتزام الزمني',communication:'التواصل',professionalism:'المهنية',value:'القيمة المحققة'};
  return pagehead({ctx:'الجودة',title:'السمعة المهنية',desc:'درجة بايزية تراعي حداثة التقييم وحجم العينة ولا تعتمد المتوسط الخام.'},`<button class="btn ghost sm" onclick="reputationRestore()">إعادة الاحتساب</button>`)+metrics([['درجة السمعة',r.compositeScore+'/100'],['ثقة المؤشر',r.confidenceScore+'%','blue'],['مشاريع مقيّمة',r.sampleCount,'green'],['التصنيف',state[0],state[1]]])+`
  <div class="grid c2 mt"><div class="card panel"><h3>${esc(d.party?.display_name_ar||'ملفي')}</h3><p class="hint">المنهجية ${esc(r.methodologyVersion)} · الأولوية للبيانات الحديثة مع قيمة مرجعية تمنع تضخيم الدرجات عند قلة العينات.</p>${Object.entries(labels).map(([k,v])=>`<div class="mt"><div class="lrow"><b>${v}</b><small>${r.dimensions?.[k]||80}/100</small></div><div class="progress"><i style="width:${r.dimensions?.[k]||80}%"></i></div></div>`).join('')}</div>
  <div class="card panel"><h3>الاعتراض على تقييم</h3><p class="hint">يوقف التقييم المتنازع عليه مؤقتًا من الحساب حتى يصدر قرار إداري موثق.</p><select id="disputeReason" class="ctl"><option value="">سبب الاعتراض</option><option value="FACTUAL_ERROR">خطأ واقعي</option><option value="ABUSE">محتوى غير مهني</option><option value="CONFLICT_OF_INTEREST">تعارض مصالح</option><option value="OTHER">سبب آخر</option></select><textarea id="disputeStatement" class="ctl mt" rows="3" placeholder="اشرح الاعتراض وأشر إلى الوقائع…"></textarea></div></div>
  <div class="card panel mt"><h3>التقييمات المحتسبة</h3>${(r.reviews||[]).length?r.reviews.map(x=>`<div class="summarybox mt"><div class="lrow"><span><b>${esc(x.project_code)}</b><small>${new Date(x.submitted_at).toLocaleDateString('ar')} · ${esc(x.reviewer_role)}</small></span><button class="btn danger xs" onclick="disputeReview('${x.review_id}')">اعتراض</button></div><p>${esc(x.comment||'دون تعليق')}</p></div>`).join(''):`<div class="empty"><b>لم تكتمل عينة تقييم بعد</b><p>ستتكوّن السمعة من مشاريع مغلقة وموثقة فقط.</p></div>`}</div>`
}
