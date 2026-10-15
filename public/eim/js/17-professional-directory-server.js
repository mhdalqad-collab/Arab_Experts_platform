/* الدليل المهني المركزي — العضويات المعتمدة فقط */
async function professionalDirectoryServerRestore(){
  try{
    let response=await fetch('/api/professional-directory',{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)return;
    let result=await response.json();
    G.serverDirectoryCandidates=Array.isArray(result.candidates)?result.candidates:[];
    G.serverDirectoryLoadedAt=Date.now();
    Object.keys(SEARCH_DIRS).forEach(kind=>{
      let remote=G.serverDirectoryCandidates.filter(x=>x.kind===kind);
      remote.forEach(x=>{
        if(!SEARCH_DIRS[kind].list.some(y=>y.partyId===x.partyId))SEARCH_DIRS[kind].list.push(x)
      })
    });
    localStorage.eim5=JSON.stringify(G);
    if([50,51,41,42,58].includes(Number(G.route)))render()
  }catch(error){console.warn('[EIM professional directory]',error)}
}
