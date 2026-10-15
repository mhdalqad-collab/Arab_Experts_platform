/* ===== مكونات عامة ===== */
const CLIENT_NAV_SCREENS=[20,74,75,76,77,78];
function clientNav(){
  if(!CLIENT_NAV_SCREENS.includes(current))return'';
  let a=typeof activeClientAccount==='function'?activeClientAccount():null,items=[[20,'مركز العميل'],[74,'ملف الجهة'],[75,'الممثلون والصلاحيات'],[76,'المحفظة'],[77,'سجل التواصل'],[78,'الفوترة والحوكمة']];
  return `<nav class="clientnav" aria-label="التنقل في إدارة العميل">${items.map(x=>`<button class="${current===x[0]?'on':''}" onclick="go(${x[0]})">${x[1]}</button>`).join('')}<span class="sp"></span>${a?`<span class="clientcode">${esc(a.publicCode||'')}</span>`:''}</nav>`}
function pagehead(d,acts=''){return `<div class="pagehead"><div><div class="kick">${esc(d.ctx)}</div><h1>${esc(d.title)}</h1><p>${esc(d.desc)}</p></div><div class="acts">${acts}</div></div>${clientNav()}`}
function metrics(m=[],onclick){return m.length?`<div class="grid c4">${m.map((x,i)=>`<div class="card metric ${x[2]||''}" ${onclick?`onclick="${onclick(i)}"`:''}><div class="k">${x[0]}</div><div class="v">${x[1]}</div><div class="hint">عرض التفاصيل ←</div></div>`).join('')}</div>`:''}
function cardsGrid(c=[],extra=''){return c.length?`<div class="grid c${Math.min(c.length,4)} mt">${c.map(([t,rows])=>`<div class="card infocard"><h4>${t}</h4>${rows.map(r=>{let[a,b]=r.split('|');return `<div class="lrow"><b>${esc(a)}</b><small>${esc(b||'')}</small></div>`}).join('')}</div>`).join('')}</div>`:''}
function tabsBar(id,tabs){if(!tabs||!tabs.length)return'';let cur=G.tab[id]||0;
  return `<div class="tabs">${tabs.map((t,i)=>`<button class="${cur===i?'on':''}" onclick="tab(${id},${i})">${t}</button>`).join('')}</div>`}
function hubCards(d){let c=d.c||[],tabs=d.tabs;if(!tabs||!tabs.length)return cardsGrid(c);
  let cur=G.tab[current]||0,per=Math.max(1,Math.ceil(c.length/tabs.length)),slice=c.slice(cur*per,cur*per+per);
  return cardsGrid(slice.length?slice:c)}
function hub(d,acts=''){return pagehead(d,acts)+metrics(d.m)+tabsBar(current,d.tabs)+hubCards(d)}
function tableView(d){return pagehead(d,`<button class="btn ghost sm" onclick="toast('صدّر الجدول — تجريبي')">تصدير ⭱</button>`)+`
  <div class="card" style="padding:8px 6px"><div class="filterbar" style="margin:0"><input class="ctl" placeholder="تصفية سريعة…" oninput="filterTbl(this)"></div>
  <table class="tbl"><thead><tr><th>المهمة</th><th>القسم</th><th>الأولوية</th><th>الموعد</th><th></th></tr></thead><tbody>
  ${d.rows.map(r=>`<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td><span class="tagb ${r[2]==='مرتفع'?'red':r[2]==='متوسط'?'amber':'gray'}">${r[2]}</span></td><td><small style="color:var(--muted)">${esc(r[3])}</small></td><td><button class="btn xs soft" onclick="toast('فُتحت المهمة: ${esc(r[0])}')">فتح</button></td></tr>`).join('')}
  </tbody></table></div>`}
function filterTbl(inp){let q=inp.value.trim();inp.closest('.card').querySelectorAll('tbody tr').forEach(tr=>tr.style.display=!q||tr.textContent.includes(q)?'':'none')}
/* نموذج متعدد الخطوات عام مع مسودة */
function genericForm(d,onDone){let fid='f'+current,cur=G.drafts[fid]||{step:0,vals:{}};
  let steps=d.steps||['البيانات'],fields=d.fields||[];
  let per=Math.max(1,Math.ceil(fields.length/steps.length));
  let slice=fields.slice(cur.step*per,cur.step*per+per);
  let last=cur.step>=steps.length-1;
  return (d.title==='__skip__'?'':pagehead(d))+`
  <div class="grid" style="grid-template-columns:1fr 220px;gap:18px;align-items:start">
    <div class="card formcard" style="min-height:0">
      <div class="chips" style="margin-bottom:18px">${steps.map((s,i)=>`<span class="chip static ${i===cur.step?'sel':''}" style="${i<cur.step?'background:var(--green-soft);border-color:#9fd3b8;color:var(--green)':''}">${i<cur.step?'✓ ':''}${s}</span>`).join('')}</div>
      <div class="fields">${slice.map(f=>{let v=cur.vals[f]||'',isLong=/وصف|ما الذي|المنهجية|النتائج|الواقعة|الملخص|المساهمة/.test(f);
        return `<div class="field ${isLong?'wide':''}"><label>${f} <em>*</em></label>${isLong?`<textarea class="ctl" rows="3" oninput="draftVal('${fid}','${enc(f)}',this.value)">${esc(v)}</textarea>`:`<input class="ctl" value="${esc(v)}" oninput="draftVal('${fid}','${enc(f)}',this.value)">`}</div>`}).join('')}
      <div class="field wide"><label>مرفقات داعمة</label><label class="filebox"><input type="file" multiple style="display:none" onchange="draftFiles('${fid}',this)"><b>⭱ اضغط لرفع الملفات</b><small>يمكن رفع عدة مستندات</small></label><div>${(cur.files||[]).map(n=>`<span class="filetag">${IC.doc.replace('<svg','<svg style="width:12px;height:12px"')} ${esc(n)}</span>`).join('')}</div></div>
      </div>
      <div class="wizfoot"><button class="btn ghost" ${cur.step===0?'disabled':''} onclick="draftStep('${fid}',-1)">→ السابق</button><span class="sp"></span><button class="btn soft" onclick="persist()">حفظ مسودة</button><button class="btn primary" onclick="draftStep('${fid}',1,${last})">${last?'إرسال ✓':'متابعة ←'}</button></div>
    </div>
    <div class="miniside" style="position:static"><div class="card panel"><h3>إرشادات</h3><p style="font-size:11.5px;color:var(--muted);margin-top:8px;line-height:1.9">تُحفظ مدخلاتك تلقائيًا كمسودة ويمكن استئنافها لاحقًا. الحقول المعلّمة إلزامية قبل الإرسال.</p></div>
    <div class="note">🔒 تخضع البيانات لضوابط السرية التي تحددها، ولا تُنشر دون موافقتك.</div></div>
  </div>`}
function draftVal(fid,k,v){let d=G.drafts[fid]=G.drafts[fid]||{step:0,vals:{}};d.vals[dec(k)]=v;persist(true)}
function draftFiles(fid,inp){let d=G.drafts[fid]=G.drafts[fid]||{step:0,vals:{}};d.files=[...inp.files].map(f=>f.name);persist(true);render();toast('أُرفقت الملفات')}
function draftStep(fid,delta,last){let d=G.drafts[fid];
  if(last&&delta>0){delete G.drafts[fid];persist(true);render();toast('أُرسل الطلب بنجاح ✓');return}
  d.step=Math.max(0,d.step+delta);persist(true);render();window.scrollTo({top:0})}
/* ===== الإحصاءات الحية من المعالج ===== */
const wrequired=S.flatMap(s=>s[2]).filter(f=>f[3]&&f[2]!=='specializationSave');
function wval(k){let v=W[k];if(Array.isArray(v))return v.length>0&&(typeof v[0]!=='object'||v.some(r=>Object.values(r).some(x=>Array.isArray(x)?x.length:String(x||'').trim())));return!!String(v||'').trim()}
function wcomplete(i){let fs=S[i][2].filter(f=>f[2]!=='specializationSave'),rq=fs.filter(f=>f[3]);if(!rq.length)return fs.some(f=>wval(f[0]));return rq.every(f=>wval(f[0]))}
function wpct(){let f=wrequired.filter(f=>wval(f[0])).length;return Math.round(f/wrequired.length*100)}
function ringSVG(p,r,sw,c1,c2,track,id){let c=2*Math.PI*r;return `<svg width="${(r+sw)*2}" height="${(r+sw)*2}" viewBox="0 0 ${(r+sw)*2} ${(r+sw)*2}"><circle cx="${r+sw}" cy="${r+sw}" r="${r}" fill="none" stroke="${track}" stroke-width="${sw}"/><circle cx="${r+sw}" cy="${r+sw}" r="${r}" fill="none" stroke="url(#rg${id})" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c*p/100} ${c}"/><defs><linearGradient id="rg${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs></svg>`}
function refreshChrome(){let n=(W.fullName||G.user||'زائر');$('uname').textContent=n;$('uav').textContent=n.trim()[0]||'؟';
  $('urole').textContent=G.user?G.ctx+(G.pkg?' · '+G.pkg:''):'زائر الموقع';$('ctxname').textContent=G.user?G.ctx:'الموقع العام';
  let ab=$('authbtn');if(ab)ab.textContent=G.user?'خروج':'دخول';
  let back=$('globalBack');if(back)back.hidden=current===60}
function toggleAuth(){location.href='/account'}
