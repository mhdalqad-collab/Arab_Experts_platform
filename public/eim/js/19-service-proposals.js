/* =========================================================
   العروض الرسمية وإصدارات التفاوض
   ========================================================= */
function migrateServiceProposals(){
  G.serviceProposals=Array.isArray(G.serviceProposals)?G.serviceProposals:[];
  G.activeProposalId=G.activeProposalId||''
}
async function serviceProposalsRestore(){
  if(!G.user)return;
  try{
    let response=await fetch('/api/service-proposals',{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)return;
    let result=await response.json();G.serviceProposals=result.proposals||[];
    let p=G.serviceProposals.find(x=>x.proposalId===G.activeProposalId)||G.serviceProposals[0];
    if(p){G.activeProposalId=p.proposalId;G.proposalDraft=p}
    localStorage.eim5=JSON.stringify(G);if(current===30)render()
  }catch(error){console.warn('[EIM service proposals]',error)}
}
function activeServiceProposal(){return(G.serviceProposals||[]).find(x=>x.proposalId===G.activeProposalId)||G.proposalDraft||null}
function openServiceProposal(id){G.activeProposalId=id;G.proposalDraft=(G.serviceProposals||[]).find(x=>x.proposalId===id)||null;persist(true);go(30)}
const PROPOSAL_STATUS={DRAFT:['مسودة','gray'],SENT:['مرسل للمراجعة','blue'],CHANGES_REQUESTED:['تعديلات مطلوبة','amber'],ACCEPTED:['معتمد نهائيًا','green'],REJECTED:['مرفوض','amber'],WITHDRAWN:['مسحوب','gray']};
function proposalState(s){return PROPOSAL_STATUS[s]||[s||'—','gray']}
function proposalAmendmentsFromForm(p){
  return{
    methodology:$('proposalMethodology')?.value.trim()||p.amendments?.methodology||p.providerResponse?.methodology||'',
    deliverables:$('proposalDeliverables')?.value.trim()||p.amendments?.deliverables||p.providerResponse?.deliverables||'',
    amount:Number($('proposalAmount')?.value),
    currency:$('proposalCurrency')?.value||p.terms?.currency||'USD',
    durationDays:Number($('proposalDuration')?.value)||0,
    validUntil:$('proposalValidUntil')?.value||'',
    assumptions:$('proposalAssumptions')?.value.trim()||'',
    exclusions:$('proposalExclusions')?.value.trim()||''
  }
}
async function proposalAction(to){
  let p=activeServiceProposal();if(!p)return;
  let note=$('proposalActionNote')?.value.trim()||'',amendments=null;
  if(['CHANGES_REQUESTED','REJECTED','WITHDRAWN'].includes(to)&&!note){toast('اكتب سبب الإجراء أولًا');return}
  if(to==='SENT'){
    amendments=proposalAmendmentsFromForm(p);
    if(!Number.isFinite(amendments.amount)||amendments.amount<0||amendments.durationDays<1||!amendments.validUntil){toast('أكمل السعر والمدة وصلاحية العرض');return}
  }
  try{
    let response=await fetch('/api/service-proposals',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({proposalId:p.proposalId,to,expectedRevision:p.revision,note,amendments})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'proposal action failed');
    let i=G.serviceProposals.findIndex(x=>x.proposalId===p.proposalId);if(i<0)G.serviceProposals.push(result);else G.serviceProposals[i]=result;
    G.proposalDraft=result;G.activeProposalId=result.proposalId;persist(true);render();toast('حُفظ إصدار العرض وانتقلت حالته بنجاح')
  }catch(error){console.warn('[EIM proposal action]',error);toast('تعذر اعتماد الإجراء؛ حدّث العرض ثم حاول مجددًا')}
}
function proposalActions(p){
  let provider=G.ctx!=='عميل';
  if(provider&&['DRAFT','CHANGES_REQUESTED'].includes(p.status))return`<button class="btn gold" onclick="proposalAction('SENT')">حفظ إصدار وإرساله</button><button class="btn danger" onclick="proposalAction('WITHDRAWN')">سحب العرض</button>`;
  if(!provider&&p.status==='SENT')return`<button class="btn gold" onclick="proposalAction('ACCEPTED')">اعتماد العرض نهائيًا</button><button class="btn soft" onclick="proposalAction('CHANGES_REQUESTED')">طلب تعديل</button><button class="btn danger" onclick="proposalAction('REJECTED')">رفض العرض</button>`;
  if(!provider&&p.status==='ACCEPTED')return`<button class="btn gold" onclick="createContractFromProposal()">إنشاء العقد ←</button>`;
  return''
}
