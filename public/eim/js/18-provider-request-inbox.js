/* =========================================================
   صندوق طلبات مقدم الخدمة
   ========================================================= */
function migrateProviderInbox(){
  G.providerRequests=Array.isArray(G.providerRequests)?G.providerRequests:[];
  G.activeProviderRequestId=G.activeProviderRequestId||''
}
async function providerRequestsRestore(){
  if(!G.user||G.ctx==='عميل'||G.ctx==='مدير / مشغل المنصة')return;
  try{
    let response=await fetch('/api/service-requests?view=provider',{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)return;
    let result=await response.json();G.providerRequests=result.requests||[];
    localStorage.eim5=JSON.stringify(G);if(current===109)render()
  }catch(error){console.warn('[EIM provider requests]',error)}
}
function activeProviderRequest(){return(G.providerRequests||[]).find(x=>x.requestId===G.activeProviderRequestId)||null}
function openProviderRequest(id){G.activeProviderRequestId=id;persist(true);render()}
async function providerRequestAction(to,kind){
  let r=activeProviderRequest();if(!r)return;
  let message=$('providerReply')?.value.trim()||'';
  if(['responded','clarification_requested','declined'].includes(to)&&!message){toast('اكتب الرد أو سبب الإجراء أولًا');return}
  let providerResponse=null;
  if(to==='responded'){
    providerResponse={
      methodology:$('providerMethodology')?.value.trim()||'',
      deliverables:$('providerDeliverables')?.value.trim()||'',
      durationDays:Number($('providerDuration')?.value)||0,
      price:Number($('providerPrice')?.value),
      currency:$('providerCurrency')?.value||'USD',
      availableFrom:$('providerAvailableFrom')?.value||'',
      validUntil:$('providerValidUntil')?.value||'',
      mode:$('providerMode')?.value||'هجين',
      assumptions:$('providerAssumptions')?.value.trim()||'',
      exclusions:$('providerExclusions')?.value.trim()||''
    };
    if(providerResponse.methodology.length<20||!providerResponse.deliverables||providerResponse.durationDays<1||!Number.isFinite(providerResponse.price)||!providerResponse.availableFrom||!providerResponse.validUntil){toast('أكمل المنهجية والتسليمات والمدة والسعر والتوفر وصلاحية الرد');return}
  }
  try{
    let response=await fetch('/api/service-requests',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:r.requestId,to,expectedRevision:r.revision,note:message,message,messageKind:kind||to,providerResponse})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'provider action failed');
    r.status=result.status;r.revision=result.revision;r.updatedAt=result.updatedAt;r.messages=result.messages||r.messages||[];r.providerResponse=result.providerResponse||r.providerResponse||null;
    persist(true);render();toast('سُجل الإجراء واعتمد في طلب الخدمة')
  }catch(error){console.warn('[EIM provider request action]',error);toast('تعذر اعتماد الإجراء؛ حدّث الصندوق ثم حاول مجددًا')}
}
function providerRequestActions(r){
  if(['sent','delivered'].includes(r.status))return`<button class="btn primary" onclick="providerRequestAction('viewed','opened')">فتح الطلب وتأكيد الاطلاع</button>`;
  if(['viewed','clarification_requested'].includes(r.status))return`<button class="btn soft" onclick="providerRequestAction('clarification_requested','clarification')">طلب توضيح</button><button class="btn success" onclick="providerRequestAction('responded','response')">إرسال الرد</button><button class="btn danger" onclick="providerRequestAction('declined','decline')">اعتذار عن الطلب</button>`;
  return''
}
function rProviderRequests(){
  let rows=G.providerRequests||[],r=activeProviderRequest(),st=r?requestState(r.status):null;
  return pagehead({ctx:'أعمالي',title:'طلبات الخدمة الواردة',desc:'الطلبات الموجهة إلى عضويتك المعتمدة؛ لا تظهر إلا المعلومات التي سمح العميل بمشاركتها.'},`<button class="btn ghost sm" onclick="providerRequestsRestore()">تحديث الصندوق</button>`)+
  metrics([['إجمالي الوارد',rows.length],['جديد',rows.filter(x=>['sent','delivered'].includes(x.status)).length,'gold'],['بانتظار ردك',rows.filter(x=>['viewed','clarification_requested'].includes(x.status)).length,'blue'],['تم الرد',rows.filter(x=>x.status==='responded').length,'green']])+
  `<div class="grid c2 mt"><div>${rows.length?rows.map(x=>{let s=requestState(x.status);return`<button class="card lrow" style="width:100%;text-align:right;cursor:pointer" onclick="openProviderRequest('${x.requestId}')"><span><b>${esc(x.subject||x.publicCode)}</b><small>${esc(x.service||'طلب خدمة')} · ${esc(x.responseDeadline||'دون مهلة')}</small></span><span class="tagb ${s[1]}">${s[0]}</span></button>`}).join(''):`<div class="card empty"><b>لا توجد طلبات واردة</b><p>ستظهر هنا الطلبات المرسلة إلى عضويتك بعد اعتمادها وربطها بملفك المهني.</p></div>`}</div>
  <div>${r?`<div class="card formcard"><div class="lrow"><span><b>${esc(r.subject||'طلب خدمة')}</b><small>${esc(r.publicCode)} · الإصدار ${r.revision}</small></span><span class="tagb ${st[1]}">${st[0]}</span></div>
  <div class="summarybox mt"><b>رسالة العميل</b><p>${esc(r.message||'—')}</p><b>نطاق الخدمة</b><p>${esc(r.scope||'—')}</p><b>التسليمات</b><p>${esc(r.deliverables||'—')}</p><div class="grid c2"><span><small>نمط التنفيذ</small><b>${esc(r.mode||'—')}</b></span><span><small>آخر موعد للرد</small><b>${esc(r.responseDeadline||'—')}</b></span></div></div>
  <div class="mt"><h3>بيانات الاحتياج المصرح بها</h3>${Object.keys(r.disclosedNeed||{}).length?Object.entries(r.disclosedNeed).map(([k,v])=>`<div class="lrow"><small>${esc(k)}</small><b>${esc(Array.isArray(v)?v.join('، '):String(v||'—'))}</b></div>`).join(''):'<p class="hint">لم يصرح العميل بعرض بيانات إضافية.</p>'}</div>
  ${(r.messages||[]).length?`<div class="mt"><h3>سجل المراسلات</h3>${r.messages.map(m=>`<div class="timeline-item"><b>${esc(m.actor==='provider'?'مقدم الخدمة':'العميل')}</b><p>${esc(m.text)}</p><small>${new Date(m.at).toLocaleString('ar')}</small></div>`).join('')}</div>`:''}
  ${['viewed','clarification_requested'].includes(r.status)?`<div class="mt"><h3>الرد المهني المنظم</h3><div class="fields"><div class="field wide"><label>المنهجية المقترحة <em>*</em></label><textarea id="providerMethodology" class="ctl" rows="4" placeholder="اشرح منهجية التنفيذ ومراحله…"></textarea></div><div class="field wide"><label>التسليمات المقترحة <em>*</em></label><textarea id="providerDeliverables" class="ctl" rows="3"></textarea></div><div class="field"><label>المدة (أيام) <em>*</em></label><input id="providerDuration" type="number" min="1" step="1" class="ctl"></div><div class="field"><label>السعر الإجمالي <em>*</em></label><input id="providerPrice" type="number" min="0" step="1" class="ctl"></div><div class="field"><label>العملة</label><select id="providerCurrency" class="ctl"><option>USD</option><option>EUR</option></select></div><div class="field"><label>نمط التنفيذ</label><select id="providerMode" class="ctl"><option>حضوري</option><option>عن بعد</option><option selected>هجين</option></select></div><div class="field"><label>متاح من <em>*</em></label><input id="providerAvailableFrom" type="date" class="ctl"></div><div class="field"><label>الرد صالح حتى <em>*</em></label><input id="providerValidUntil" type="date" class="ctl"></div><div class="field wide"><label>الافتراضات</label><textarea id="providerAssumptions" class="ctl" rows="2"></textarea></div><div class="field wide"><label>الاستثناءات</label><textarea id="providerExclusions" class="ctl" rows="2"></textarea></div></div></div>`:''}
  ${providerRequestActions(r)?`<div class="mt"><label>الرسالة المرافقة أو سبب الإجراء</label><textarea id="providerReply" class="ctl" rows="3" placeholder="اكتب رسالة مهنية واضحة…"></textarea><div class="acts mt">${providerRequestActions(r)}</div></div>`:''}</div>`:`<div class="card empty"><b>اختر طلبًا من القائمة</b><p>ستظهر تفاصيل الطلب ونطاق الإفصاح والإجراءات المتاحة هنا.</p></div>`}</div></div>`
}
