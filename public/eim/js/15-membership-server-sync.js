/* =========================================================
   مزامنة مسودات العضويات مع التخزين الدائم
   ========================================================= */
const MEMBER_CODE_BY_LABEL={
  'خبير':'expert','مدرب':'trainer','مستشار':'consultant',
  'باحث / أكاديمي':'researcher','مركز تدريب':'center','العميل':'client'
};
const MEMBER_LABEL_BY_CODE=Object.fromEntries(Object.entries(MEMBER_CODE_BY_LABEL).map(([k,v])=>[v,k]));
let membershipSyncTimer=null,membershipSyncBusy=false,membershipSyncQueued=false;

async function accountDashboardRestore(rerender=true){
  if(!G.user)return;
  try{
    let response=await fetch('/api/account-dashboard',{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)return;let result=await response.json();
    G.accountDashboard={notifications:result.notifications||[],unreadCount:Number(result.unreadCount||0)};
    localStorage.eim5=JSON.stringify(G);if(rerender&&current===2)render()
  }catch(error){console.warn('[EIM account dashboard]',error)}
}
async function openAccountNotification(id,route){
  try{
    await fetch('/api/account-dashboard',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({notificationId:id})});
    await accountDashboardRestore(false);if(route){let screen=Number(String(route).replace('#/',''));if(screen)go(screen);else render()}else render()
  }catch(error){console.warn('[EIM notification read]',error);toast('تعذر تحديث الإشعار')}
}
async function markAllAccountNotifications(){
  try{
    await fetch('/api/account-dashboard',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({markAll:true})});
    await accountDashboardRestore();toast('تم تعليم جميع الإشعارات كمقروءة')
  }catch(error){console.warn('[EIM notifications read all]',error)}
}

function membershipSyncBadge(text,state=''){
  let el=$('saved');if(!el)return;
  el.textContent=text;el.dataset.syncState=state
}
function membershipSyncProfiles(){
  return Object.entries(MEMBER_CODE_BY_LABEL).filter(([label])=>(G.memberships||[]).includes(label)||G.memberData?.[label]).map(([label,code])=>{
    let life=G.membershipLifecycle?.[label]||{};
    return{
      membershipCode:code,
      data:G.memberData?.[label]||{},
      privacy:G.memberPrivacy?.[label]||{},
      records:G.memberRecords?.[label]||{},
      currentStep:G.memberStep?.[label]||0,
      lifecycleStatus:life.state||'draft'
    }
  })
}
function queueMembershipServerSync(delay=1200){
  if(!G.user||!membershipSyncProfiles().length)return;
  clearTimeout(membershipSyncTimer);
  membershipSyncBadge('تغييرات غير متزامنة','pending');
  membershipSyncTimer=setTimeout(()=>membershipServerSave(),delay)
}
async function membershipServerSave(){
  if(membershipSyncBusy){membershipSyncQueued=true;return}
  let profiles=membershipSyncProfiles();if(!profiles.length)return;
  membershipSyncBusy=true;membershipSyncQueued=false;membershipSyncBadge('جارٍ الحفظ…','saving');
  try{
    let response=await fetch('/api/membership-profiles',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({profiles})});
    if(!response.ok)throw new Error('sync failed');
    let result=await response.json();
    G.serverProfileSync={savedAt:result.savedAt,revisions:Object.fromEntries((result.saved||[]).map(x=>[x.membershipCode,x.revision]))};
    localStorage.eim5=JSON.stringify(G);
    membershipSyncBadge('محفوظ في الحساب','saved')
  }catch(error){
    console.warn('[EIM profile sync]',error);
    membershipSyncBadge('محفوظ على الجهاز','error')
  }finally{
    membershipSyncBusy=false;
    if(membershipSyncQueued)queueMembershipServerSync(200)
  }
}
async function membershipServerRestore(){
  try{
    let response=await fetch('/api/membership-profiles',{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)return;
    let result=await response.json(),changed=false;
    if(result.activePartyId&&(G.partySwitchPending||(G.activePartyId&&result.activePartyId!==G.activePartyId))){
      G.memberData={};G.memberPrivacy={};G.memberRecords={};G.memberStep={};
      G.membershipLifecycle={};G.memberships=[];G.completed=[];G.lastSave=0;
      G.partySwitchPending=false;
      changed=true
    }
    if(result.activePartyId)G.activePartyId=result.activePartyId;
    (result.profiles||[]).forEach(profile=>{
      let label=MEMBER_LABEL_BY_CODE[profile.membershipCode];if(!label)return;
      let remoteTime=Date.parse(profile.updatedAt||'')||0,localTime=Number(G.lastSave||0);
      if(!G.memberData?.[label]||remoteTime>=localTime){
        G.memberData=G.memberData||{};G.memberData[label]=profile.data||{};
        G.memberPrivacy=G.memberPrivacy||{};G.memberPrivacy[label]=profile.privacy||{};
        G.memberRecords=G.memberRecords||{};G.memberRecords[label]=profile.records||{};
        G.memberStep=G.memberStep||{};G.memberStep[label]=profile.currentStep||0;
        G.membershipLifecycle=G.membershipLifecycle||{};
        let life=G.membershipLifecycle[label]||{history:[]};
        life.state=profile.lifecycleStatus||life.state||'draft';life.dirty=false;
        G.membershipLifecycle[label]=life;
        if(!(G.memberships||[]).includes(label))G.memberships.push(label);
        changed=true
      }
    });
    if(changed){
      localStorage.eim5=JSON.stringify(G);
      render();membershipSyncBadge('تم استرجاع بيانات الحساب','saved')
    }else membershipSyncBadge('محفوظ في الحساب','saved')
  }catch(error){console.warn('[EIM profile restore]',error)}
}

const persistOnDevice=persist;
persist=function(silent){
  persistOnDevice(silent);
  queueMembershipServerSync()
};
