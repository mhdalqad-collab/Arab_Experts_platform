/* =========================================================
   السجل المهني — معالج الخبير الموحد (بعد شاشة الحساب واختيار العضوية)
   ========================================================= */
if(W.domain&&!TAX[W.domain]){W.domain='';W.specialty='';W.subspecialty=''}
else if(W.specialty&&!(TAX[W.domain]||{})[W.specialty]){W.specialty='';W.subspecialty=''}
else if(W.subspecialty&&!((TAX[W.domain]||{})[W.specialty]||[]).includes(W.subspecialty))W.subspecialty='';
if(step>=S.length)step=0;
const WGROUPS=[['الهوية الشخصية',[0]],['التخصص والمؤهلات',[1,2,3]],['الخبرة التطبيقية',[4,5,6]],['القدرات واللغات',[7,8]],['التوفر والإرسال',[9,10]],['الاعتماد النهائي',[99]]];
function wjump(i){review=false;step=i;recEdit=null;render();window.scrollTo({top:0})}
function stepperHTML(){return `<div class="card stepper">${WGROUPS.map(g=>`<div class="grp">${g[0]}</div>${g[1].map(i=>{
  if(i===99)return `<button class="step ${review?'on':''}" onclick="review=true;render()"><span class="n">★</span><span class="tt"><b>المراجعة والإرسال</b><small>التدقيق قبل الاعتماد</small></span></button>`;
  return `<button class="step ${!review&&i===step?'on':''} ${wcomplete(i)?'done':''}" onclick="wjump(${i})"><span class="n">${wcomplete(i)?'✓':i+1}</span><span class="tt"><b>${S[i][0]}</b><small>${S[i][1]}</small></span></button>`}).join('')}`).join('')}</div>`}
function minisideHTML(){let p=wpct();return `<div class="miniside">
  <div class="card panel" style="text-align:center"><h3 style="justify-content:center;font-size:13px">اكتمال الملف</h3>
    <div class="ring2">${ringSVG(p,38,7,'#c9a24b','#b08a34','#edf0f4','wz')}<div class="num"><div><b>${p}%</b><span>مكتمل</span></div></div></div>
    <div class="meter"><i style="width:${p}%"></i></div>
    <p style="font-size:10.8px;color:var(--muted);margin-top:7px">البيانات المكتملة <b style="color:var(--ink)">${wrequired.filter(f=>wval(f[0])).length} من ${wrequired.length}</b></p></div>
  <div class="note">🔒 البيانات «المخفية» لا تظهر في ملفك العام وتبقى لإدارة المنصة فقط.</div></div>`}
function wlinked(k,fb){if(k==='domain')return Object.keys(TAX);
  if(k==='specialty')return Object.keys(TAX[W.domain]||{});
  if(k==='subspecialty')return (TAX[W.domain]||{})[W.specialty]||[];
  if(k==='appliedAreas')return (TAX_DETAILS[W.domain]||{})[W.specialty]?.[W.subspecialty]||[];
  return fb}
function wsetv(k,v){W[k]=v;errors[k]='';markMembershipDirty('خبير')}
function wsetSelect(k,v){W[k]=v;errors[k]='';
  if(k==='domain'){W.specialty='';W.subspecialty='';W.appliedAreas=[]}
  if(k==='specialty'){W.subspecialty='';W.appliedAreas=[]}
  if(k==='subspecialty')W.appliedAreas=[];
  markMembershipDirty('خبير');if(['domain','specialty','subspecialty'].includes(k))render()}
function wtoggle(k,v){let a=W[k]||[],sel=a.includes(v);W[k]=sel?a.filter(x=>x!==v):[...a,v];markMembershipDirty('خبير');render()}
function wprivacy(k){W._private[k]=!W._private[k];privacyAudit('خبير',k,W._private[k]);persist(true);render();toast(W._private[k]?'أُخفي هذا البيان عن الملف العام':'أصبح هذا البيان ظاهرًا')}
function wsetFiles(k,inp){W[k]=[...inp.files].map(f=>f.name);markMembershipDirty('خبير');render();toast('أُرفقت الملفات')}
function wrmFile(k,n){W[k]=(W[k]||[]).filter(x=>x!==n);persist(true);render()}
function wfield(f){let[k,l,t,req,opts]=f,v=W[k]??'',wide=['multi','textarea','file','records','specializationSave'].includes(t)?' wide':'';
  opts=wlinked(k,opts);let c='';
  if(t==='specializationSave')c=specBlock();
  else if(t==='select')c=`<select class="ctl" onchange="wsetSelect('${k}',this.value)" ${(k==='specialty'&&!W.domain)||(k==='subspecialty'&&!W.specialty)?'disabled':''}><option value="">اختر من القائمة…</option>${opts.map(o=>`<option ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  else if(t==='multi')c=`<div class="chips">${opts.length?opts.map(o=>`<button type="button" class="chip ${(v||[]).includes(o)?'sel':''}" onclick="wtoggle('${k}',dec('${enc(o)}'))">${(v||[]).includes(o)?'✓ ':''}${esc(o)}</button>`).join(''):'<small class="hint">أكمل اختيارات التصنيف السابقة أولًا لتظهر مجالات الخبرة التطبيقية.</small>'}</div>`;
  else if(t==='records')c=wrecords(k,l);
  else if(t==='textarea')c=`<textarea class="ctl" rows="4" oninput="wsetv('${k}',this.value)">${esc(v)}</textarea>`;
  else if(t==='file')c=`<label class="filebox"><input type="file" multiple style="display:none" onchange="wsetFiles('${k}',this)"><b>⭱ اضغط لرفع الملفات</b><small>يمكن رفع عدة مستندات (PDF، صور…)</small></label><div>${(Array.isArray(v)?v:[]).map(n=>`<span class="filetag">${esc(n)} <i onclick="wrmFile('${k}',dec('${enc(n)}'))">✕</i></span>`).join('')}</div>`;
  else c=`<input class="ctl" type="${t}" ${t==='number'?'min="0" step="1"':''} value="${esc(v)}" oninput="wsetv('${k}',this.value)">`;
  let pv=t==='specializationSave'?'':`<button type="button" class="pv ${W._private[k]?'off':''}" onclick="wprivacy('${k}')" title="ظهور هذا البيان في الملف العام">${W._private[k]?'◉ مخفي':'◎ ظاهر'}</button>`;
  return `<div class="field${wide} ${errors[k]?'invalid':''}"><label><span>${l} ${req?'<em>*</em>':''}</span>${pv}</label>${c}${errors[k]?`<small class="err">⚠ ${errors[k]}</small>`:''}</div>`}
/* سجل التخصصات المحفوظة (3.2.4) */
function specBlock(){let rows=W.specializationRecords||[];
  return `<div class="recs">${rows.map((r,i)=>`<div class="reccard"><span class="idx">★</span><div class="inf"><b>${esc(r.specialty||'تخصص')} ${r.isPrimary==='نعم'?'<span class="tagb gold">رئيسي</span>':''}</b><small>${esc(r.domain)} ← ${esc(r.specialty)} ← ${esc(r.subspecialty)} — ${esc(r.expertise)}${r.specialtyYears?' · '+r.specialtyYears+' سنوات':''}</small></div>
    <div class="ops"><button class="icbtn del" onclick="W.specializationRecords.splice(${i},1);persist(true);render()">${IC.trash}</button></div></div>`).join('')}
  <button type="button" class="addrec" onclick="saveSpec()">＋ حفظ سجل التخصص وإضافة سجل جديد</button>
  <small class="hint">يُحفظ التخصص الحالي كسجل مستقل ثم تُصفّر الحقول لإضافة تخصص آخر — يمكنك امتلاك عدة بصمات تخصص.</small></div>`}
function saveSpec(){let keys=['domain','specialty','subspecialty','appliedAreas','expertise','specialtyYears','isPrimary','sectors','professionalRoles','services'];
  let missing=['domain','specialty','subspecialty','appliedAreas','expertise','isPrimary','sectors','professionalRoles','services'].filter(k=>!wval(k));
  if(missing.length){toast('أكمل جميع بيانات سجل التخصص أولًا');return}
  W.specializationRecords=W.specializationRecords||[];let rec={};keys.forEach(k=>rec[k]=W[k]);
  W.specializationRecords.push(rec);keys.forEach(k=>W[k]=Array.isArray(W[k])?[]:'');
  markMembershipDirty('خبير');render();toast('حُفظ سجل التخصص — أضف تخصصًا آخر أو تابع')}
/* السجلات المتعددة */
function wrecSummary(key,row){let vals=REC[key].map(d=>row[d[0]]).filter(x=>x!==undefined&&String(x||'').trim());
  return[vals[0]||'سجل بدون عنوان',vals.slice(1,4).map(x=>Array.isArray(x)?x.join('، '):x).join(' · ')]}
function wrecords(key,label){let arr=Array.isArray(W[key])?W[key]:[];W[key]=arr;let html='<div class="recs">';
  arr.forEach((row,i)=>{let[t,s]=wrecSummary(key,row);
    if(recEdit&&recEdit.key===key&&recEdit.idx===i){html+=wrecForm(key,i,label);return}
    html+=`<div class="reccard"><span class="idx">${i+1}</span><div class="inf"><b>${esc(t)}</b><small>${esc(s)}</small></div>
      <div class="ops"><button class="icbtn" title="تعديل" onclick="recEdit={key:'${key}',idx:${i}};recDraft=JSON.parse(JSON.stringify(W['${key}'][${i}]));render()">${IC.edit}</button>
      <button class="icbtn del" title="حذف" onclick="wdelRec('${key}',${i})">${IC.trash}</button></div></div>`});
  if(recEdit&&recEdit.key===key&&recEdit.idx===-1)html+=wrecForm(key,-1,label);
  html+=`<button type="button" class="addrec" onclick="recEdit={key:'${key}',idx:-1};recDraft={};render()">＋ إضافة سجل جديد — ${label}</button></div>`;
  return html}
function wrecForm(key,idx,label){return `<div class="recform"><div class="fh2">${idx===-1?'إضافة':'تعديل'} — ${label}</div>${REC[key].map(d=>{let[sk,sl,st,sopts]=d,v=recDraft[sk]??'';let c='';let full=st==='textarea'||st==='file';
    if(st==='select')c=`<select class="ctl" onchange="recDraft['${sk}']=this.value"><option value="">اختر…</option>${(sopts||[]).map(o=>`<option ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
    else if(st==='textarea')c=`<textarea class="ctl" rows="3" oninput="recDraft['${sk}']=this.value">${esc(v)}</textarea>`;
    else if(st==='file')c=`<label class="filebox" style="padding:10px"><input type="file" multiple style="display:none" onchange="recDraft['${sk}']=Array.from(this.files).map(f=>f.name);render()"><b>⭱ رفع الملف</b></label><div>${(Array.isArray(v)?v:[]).map(n=>`<span class="filetag">${esc(n)}</span>`).join('')}</div>`;
    else c=`<input class="ctl" type="${st}" ${st==='number'?'min="0"':''} value="${esc(v)}" oninput="recDraft['${sk}']=this.value">`;
    return `<div class="f ${full?'full':''}"><label>${sl}</label>${c}</div>`}).join('')}
  <div class="f full" style="flex-direction:row;gap:10px"><button type="button" class="btn primary sm" onclick="wsaveRec('${key}',${idx})">حفظ السجل ✓</button><button type="button" class="btn ghost sm" onclick="recEdit=null;render()">إلغاء</button></div></div>`}
function wsaveRec(key,idx){if(!Object.values(recDraft).some(x=>String(x||'').trim())){toast('أدخل بيانات السجل أولًا');return}
  if(idx===-1)W[key].push({...recDraft});else W[key][idx]={...recDraft};
  recEdit=null;recDraft={};errors[key]='';markMembershipDirty('خبير');render();toast('حُفظ السجل بنجاح')}
function wdelRec(key,i){if(!confirm('حذف هذا السجل؟'))return;W[key].splice(i,1);markMembershipDirty('خبير');render();toast('حُذف السجل')}
/* التحقق والتنقل */
function wvalidate(){errors={};S[step][2].forEach(f=>{let[k,,t,req]=f,v=W[k];if(t==='specializationSave')return;
  if(req&&!wval(k))errors[k]='هذا الحقل مطلوب';
  if(t==='email'&&v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))errors[k]='أدخل بريدًا إلكترونيًا صحيحًا';
  if(t==='number'&&v&&!/^\d+$/.test(v))errors[k]='أدخل رقمًا صحيحًا موجبًا';
  if(k==='confirmPassword'&&v!==W.password)errors[k]='كلمتا المرور غير متطابقتين';
  if(k==='terms'&&v!=='نعم')errors[k]='الموافقة على الشروط مطلوبة للمتابعة'});
  return !Object.keys(errors).length}
function wnext(){if(!wvalidate()){render();toast('أكمل الحقول الإلزامية أولًا');return}
  recEdit=null;if(step<S.length-1)step++;else review=true;persist(true);render();window.scrollTo({top:0})}
function wback(){recEdit=null;if(review)review=false;else if(step>0)step--;persist(true);render()}
function wsecPreview(i){let parts=[];
  for(let f of S[i][2]){let v=W[f[0]];if(f[2]==='specializationSave'){if((W.specializationRecords||[]).length)parts.push(`سجلات تخصص: ${W.specializationRecords.length}`);continue}
    if(Array.isArray(v)&&v.length&&typeof v[0]==='object'){parts.push(`${f[1]}: ${v.length} سجل`);continue}
    if(Array.isArray(v)&&v.length){parts.push(`${f[1]}: ${v.slice(0,2).join('، ')}${v.length>2?'…':''}`);continue}
    if(String(v||'').trim()&&f[2]!=='password')parts.push(`${f[1]}: ${String(v).slice(0,26)}`);
    if(parts.length>=2)break}
  return parts.slice(0,2).join(' — ')||'لا توجد بيانات بعد'}
function rWizard(){if(submitted&&review)return successHTML();
  if(review){let allOk=S.every((s,i)=>wcomplete(i));
    return `<div class="wiz"><div>${stepperHTML()}</div><div class="card formcard">
      <div class="fh"><div class="kick">الخطوة الأخيرة — ${S.length+1} من ${S.length+1}</div><h2>مراجعة ملف الخبير</h2><p>راجع اكتمال الأقسام قبل الإرسال — يمكن العودة لأي قسم وتعديله.</p></div>
      <div class="grid c2">${S.map((s,i)=>`<button class="rolecard" style="text-align:right" onclick="wjump(${i})">
        <span class="tagb ${wcomplete(i)?'green':'amber'}">${wcomplete(i)?'✓ مكتمل':'بحاجة للإكمال'}</span>
        <b style="display:block;margin-top:8px">${s[0]}</b><small>${s[1]}</small>
        <div style="margin-top:8px;font-size:11px;color:#43546b;background:#f7f9fb;border-radius:8px;padding:6px 10px">${esc(wsecPreview(i))}</div></button>`).join('')}</div>
      <div class="wizfoot"><button class="btn ghost" onclick="wback()">→ عودة للتعديل</button><span class="sp"></span>
        <button class="btn ${allOk?'gold':'ghost'}" ${allOk?'':'disabled title="أكمل جميع الأقسام الإلزامية أولًا"'} onclick="wsubmit()">إرسال الملف للتحقق ★</button></div>
    </div>${minisideHTML()}</div>`}
  let s=S[step];
  return `<div class="wiz"><div>${stepperHTML()}</div>
    <div class="card formcard">
      <div class="fh"><div class="kick">الخطوة ${step+1} من ${S.length+1} — عضوية خبير</div><h2>${s[0]}</h2><p>${s[1]} — الحقول المعلّمة بـ <em style="color:var(--red);font-style:normal">*</em> إلزامية.</p></div>
      <div class="fields">${s[2].map(wfield).join('')}</div>
      <div class="wizfoot"><button class="btn ghost" ${step===0?'disabled':''} onclick="wback()">→ الخطوة السابقة</button><span class="sp"></span>
        <button class="btn soft" onclick="persist()">حفظ كمسودة</button><button class="btn primary" onclick="wnext()">حفظ ومتابعة ←</button></div>
    </div>${minisideHTML()}</div>`}
function wsubmit(){submitted=true;if(!G.completed.includes('خبير'))G.completed.push('خبير');G.activeMembership='خبير';let L=ensureLife('خبير');if(L.state==='draft')lifeTransition('خبير','data_complete','صاحب العضوية','اكتملت بيانات ملف الخبير');L=ensureLife('خبير');if(['data_complete','needs_changes','approved'].includes(L.state))lifeTransition('خبير','submitted','صاحب العضوية','إرسال ملف الخبير للتحقق');syncUnifiedEntity('خبير');persist(true);render();toast('أُرسل ملفك للتحقق وربط بالسجل الموحد بنجاح')}
function successHTML(){return `<div class="card success"><div class="ck">${IC.check}</div>
  <h2>تم إرسال ملفك للتحقق بنجاح 🎉</h2>
  <p>وصل ملفك المهني إلى إدارة شبكة الخبراء العرب وستتم مراجعته. تابع حالة قضية التحقق أو عاين ملفك العام.</p>
  <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
    <button class="btn primary" onclick="go(14)">متابعة قضية التحقق</button>
    <button class="btn ghost" onclick="previewMembershipPublic('خبير')">معاينة الملف العام</button>
    <button class="btn soft" onclick="submitted=false;persist(true);render()">استئناف التعديل</button></div></div>`}
