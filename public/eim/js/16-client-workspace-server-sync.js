/* =========================================================
   مزامنة احتياجات العميل وبصمتها وطلبات الخدمة
   ========================================================= */
let clientWorkspaceSyncTimer=null,clientWorkspaceSyncBusy=false,clientWorkspaceSyncQueued=false;

function clientWorkspacePayload(){
  let needs=(G.clientNeeds||[]).map(n=>({
    ...n,
    fingerprint:G.needFingerprints?.[n.needId]||{}
  }));
  return{needs,requests:G.clientRequests||[]}
}
function queueClientWorkspaceSync(delay=1400){
  if(!G.user||G.ctx!=='عميل')return;
  clearTimeout(clientWorkspaceSyncTimer);
  clientWorkspaceSyncTimer=setTimeout(()=>clientWorkspaceServerSave(),delay)
}
async function clientWorkspaceServerSave(){
  if(!G.user||G.ctx!=='عميل')return;
  if(clientWorkspaceSyncBusy){clientWorkspaceSyncQueued=true;return}
  clientWorkspaceSyncBusy=true;clientWorkspaceSyncQueued=false;
  try{
    let response=await fetch('/api/client-workspace',{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(clientWorkspacePayload())
    });
    if(!response.ok)throw new Error('client workspace sync failed');
    let result=await response.json();
    G.clientWorkspaceServer={savedAt:result.savedAt,needs:result.savedNeeds||[],requests:result.savedRequests||[]};
    localStorage.eim5=JSON.stringify(G);
    membershipSyncBadge('بيانات العميل محفوظة','saved')
  }catch(error){
    console.warn('[EIM client workspace sync]',error);
    membershipSyncBadge('بيانات العميل محفوظة على الجهاز','error')
  }finally{
    clientWorkspaceSyncBusy=false;
    if(clientWorkspaceSyncQueued)queueClientWorkspaceSync(250)
  }
}
async function clientWorkspaceServerRestore(){
  if(!G.user)return;
  try{
    let response=await fetch('/api/client-workspace',{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)return;
    let result=await response.json(),remoteNeeds=result.needs||[],remoteRequests=result.requests||[];
    remoteNeeds.forEach(remote=>{
      let local=(G.clientNeeds||[]).find(x=>x.needId===remote.needId);
      let remoteTime=Date.parse(remote.serverUpdatedAt||'')||0;
      if(!local||remoteTime>Number(local.updatedAt||0)){
        let clean={...remote};delete clean.fingerprint;
        let i=(G.clientNeeds||[]).findIndex(x=>x.needId===remote.needId);
        if(i<0)G.clientNeeds.push(clean);else G.clientNeeds[i]=clean;
        G.needFingerprints=G.needFingerprints||{};
        G.needFingerprints[remote.needId]=remote.fingerprint||{};
      }
    });
    remoteRequests.forEach(remote=>{
      let local=(G.clientRequests||[]).find(x=>x.requestId===remote.requestId);
      let remoteTime=Date.parse(remote.serverUpdatedAt||'')||0;
      if(!local||remoteTime>Number(local.updatedAt||0)){
        let i=(G.clientRequests||[]).findIndex(x=>x.requestId===remote.requestId);
        if(i<0)G.clientRequests.push(remote);else G.clientRequests[i]=remote
      }
    });
    if(remoteNeeds.length||remoteRequests.length){
      localStorage.eim5=JSON.stringify(G);
      render();membershipSyncBadge('استُعيدت مساحة العميل','saved')
    }
  }catch(error){console.warn('[EIM client workspace restore]',error)}
}

const persistWithMembershipSync=persist;
persist=function(silent){
  persistWithMembershipSync(silent);
  queueClientWorkspaceSync()
};
