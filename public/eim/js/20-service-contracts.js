/* =========================================================
   العقود والتوقيع المتبادل
   ========================================================= */
function migrateServiceContracts(){
  G.serviceContracts=Array.isArray(G.serviceContracts)?G.serviceContracts:[];
  G.activeContractId=G.activeContractId||''
}
async function serviceContractsRestore(){
  if(!G.user)return;
  try{
    let response=await fetch('/api/service-contracts',{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)return;
    let result=await response.json();G.serviceContracts=result.contracts||[];
    if(!G.activeContractId&&G.serviceContracts[0])G.activeContractId=G.serviceContracts[0].contractId;
    localStorage.eim5=JSON.stringify(G);if(current===110)render()
  }catch(error){console.warn('[EIM service contracts]',error)}
}
function activeServiceContract(){return(G.serviceContracts||[]).find(x=>x.contractId===G.activeContractId)||null}
function openServiceContract(id){G.activeContractId=id;persist(true);go(110)}
const CONTRACT_STATUS={DRAFT:['بانتظار التوقيع','gray'],CLIENT_SIGNED:['وقّع العميل','blue'],PROVIDER_SIGNED:['وقّع مقدم الخدمة','blue'],ACTIVE:['نافذ','green'],CANCELLED:['ملغى','amber']};
function contractState(s){return CONTRACT_STATUS[s]||[s||'—','gray']}
async function createContractFromProposal(){
  let p=activeServiceProposal();if(!p||p.status!=='ACCEPTED'){toast('اختر عرضًا معتمدًا نهائيًا');return}
  try{
    let response=await fetch('/api/service-contracts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({proposalId:p.proposalId})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'contract create failed');
    if(!result.duplicate)G.serviceContracts.push(result);
    G.activeContractId=result.contractId;persist(true);go(110);toast(result.duplicate?'فُتح العقد القائم':'أُنشئت مسودة العقد من العرض المعتمد')
  }catch(error){console.warn('[EIM contract create]',error);toast('تعذر إنشاء العقد')}
}
async function contractAction(action){
  let c=activeServiceContract(),declaration=$('contractDeclaration')?.value.trim()||'';if(!c)return;
  if(!declaration){toast('اكتب إقرار الموافقة أو سبب الإلغاء');return}
  try{
    let response=await fetch('/api/service-contracts',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({contractId:c.contractId,action,expectedRevision:c.revision,declaration})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'contract action failed');
    let i=G.serviceContracts.findIndex(x=>x.contractId===c.contractId);G.serviceContracts[i]=result;persist(true);render();toast(result.status==='ACTIVE'?'اكتمل توقيع الطرفين وأصبح العقد نافذًا':'سُجل الإجراء بنجاح')
  }catch(error){console.warn('[EIM contract action]',error);toast('تعذر اعتماد الإجراء؛ حدّث العقد وحاول مجددًا')}
}
function contractActions(c){
  if(c.status==='ACTIVE'&&G.ctx==='عميل')return`<button class="btn gold" onclick="createProjectFromContract()">إنشاء المشروع وأمر البدء ←</button>`;
  if(['ACTIVE','CANCELLED'].includes(c.status))return'';
  let signed=c.signatures||{},provider=G.ctx!=='عميل',b=[];
  if(!provider&&!signed.client)b.push(`<button class="btn gold" onclick="contractAction('SIGN_CLIENT')">توقيع العميل</button>`);
  if(provider&&!signed.provider)b.push(`<button class="btn gold" onclick="contractAction('SIGN_PROVIDER')">توقيع مقدم الخدمة</button>`);
  b.push(`<button class="btn danger" onclick="contractAction('CANCEL')">إلغاء قبل النفاذ</button>`);return b.join('')
}
function rServiceContracts(){
  let list=G.serviceContracts||[],c=activeServiceContract(),st=c?contractState(c.status):null,t=c?.terms||{},s=c?.signatures||{};
  return pagehead({ctx:'التعاقد',title:'العقود',desc:'العقود الناتجة من عروض معتمدة، مع توقيع متبادل وسجل تدقيق.'},`<button class="btn ghost sm" onclick="serviceContractsRestore()">تحديث العقود</button>`)+metrics([['إجمالي العقود',list.length],['بانتظار التوقيع',list.filter(x=>!['ACTIVE','CANCELLED'].includes(x.status)).length,'gold'],['نافذة',list.filter(x=>x.status==='ACTIVE').length,'green'],['ملغاة',list.filter(x=>x.status==='CANCELLED').length,'gray']])+`
  <div class="grid c2 mt"><div>${list.length?list.map(x=>{let z=contractState(x.status);return`<button class="card lrow" style="width:100%;text-align:right;cursor:pointer" onclick="openServiceContract('${x.contractId}')"><span><b>${esc(x.title||x.publicCode)}</b><small>${esc(x.publicCode)} · الإصدار ${x.revision}</small></span><span class="tagb ${z[1]}">${z[0]}</span></button>`}).join(''):`<div class="card empty"><b>لا توجد عقود</b><p>ينشأ العقد من شاشة عرض معتمد نهائيًا.</p></div>`}</div><div>${c?`<div class="card panel"><div class="lrow"><span><h3>${esc(c.title||'عقد خدمة')}</h3><small>${esc(c.publicCode)} · مصدره العرض ${esc(c.proposalPublicCode||'—')}</small></span><span class="tagb ${st[1]}">${st[0]}</span></div><h3 class="mt">النطاق والشروط</h3>${[['القيمة',(t.currency||'')+' '+Number(t.amount||0).toLocaleString()],['المدة',(t.durationDays||'—')+' يوم'],['نمط التنفيذ',t.mode],['الملكية الفكرية',c.intellectualProperty],['السرية',c.confidentiality],['ضبط التغيير',c.changeControl],['تسوية الخلاف',c.disputeResolution]].map(x=>`<div class="lrow"><b>${x[0]}</b><small>${esc(x[1]||'—')}</small></div>`).join('')}<h3 class="mt">حالة توقيع الطرفين</h3><div class="grid c2"><div class="summarybox"><b>العميل</b><p>${s.client?'✓ وُقّع '+new Date(s.client.signedAt).toLocaleString('ar'):'بانتظار التوقيع'}</p></div><div class="summarybox"><b>مقدم الخدمة</b><p>${s.provider?'✓ وُقّع '+new Date(s.provider.signedAt).toLocaleString('ar'):'بانتظار التوقيع'}</p></div></div></div>${contractActions(c)?`<div class="card panel mt"><label>الإقرار أو سبب الإلغاء</label><textarea id="contractDeclaration" class="ctl" rows="3" placeholder="أقر بصحة الصلاحية والموافقة على النسخة المعروضة…"></textarea><p class="hint mt">هذا قبول موثق داخل المنصة، وليس بديلًا تلقائيًا عن التوقيع الإلكتروني المؤهل الذي قد يفرضه القانون.</p><div class="acts mt">${contractActions(c)}</div></div>`:''}`:`<div class="card empty"><b>اختر عقدًا من القائمة</b></div>`}</div></div>`
}
