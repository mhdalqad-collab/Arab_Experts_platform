/* =========================================================
   النواة: دخول، نوع العضوية، سياقات، مساحة العمل، أعمالي، بحث
   ========================================================= */
function rLogin(){return `<div class="authwrap"><div class="card authcard">
  <div class="mark"><img src="./assets/nae-logo.svg" alt="" width="58" height="58"></div>
  <h1 style="font-size:20px">الدخول والتسجيل</h1>
  <p style="font-size:12.5px;color:var(--muted);margin:6px 0 22px">استخدم بوابة الحساب الآمنة. إذا كان لديك حساب ستفتح مساحتك، وإذا كنت عضوًا جديدًا ستختار نوع العضوية ثم تبدأ إدخال بياناتها.</p>
  <button class="btn primary" style="width:100%;justify-content:center;margin-top:18px" onclick="location.href='/account'">الدخول الآمن أو فتح حساب ←</button>
  <button class="authlink" onclick="go(84)">نسيت كلمة المرور أو تعذّر الدخول؟</button>
  <button class="btn soft" style="width:100%;justify-content:center;margin-top:10px" onclick="seedDemo()">✨ استكشاف المنظومة ببيانات تجريبية</button>
  <p class="hint" style="margin-top:14px">لن تطلب منك هذه الشاشة حفظ كلمة المرور داخل المتصفح.</p>
</div></div>`}
function accountEmails(){
  let list=[G.accountEmail,W.accountEmail,W.email];
  Object.values(G.memberData||{}).forEach(record=>Object.entries(record||{}).forEach(([key,value])=>{
    if(/email|mail/i.test(key)&&typeof value==='string')list.push(value)
  }));
  return [...new Set(list.filter(Boolean).map(x=>String(x).trim().toLowerCase()))]
}
function startNewAccount(email){
  G.accountEmail=email;
  G.user=email.split('@')[0]||'عضو جديد';
  G.memberships=G.memberships||[];
  G.completed=G.completed||[];
  persist(true);
  go(67);
  toast('اختر نوع العضوية وباقة الاشتراك لإكمال فتح الحساب')
}
function doLogin(){
  let e=$('lg-email').value.trim().toLowerCase(),p=$('lg-pass').value;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){toast('أدخل إيميلًا صحيحًا');$('lg-email').focus();return}
  if(!p){toast('أدخل كلمة المرور');$('lg-pass').focus();return}
  migrateSecurity();
  if(G.security.lockedUntil>Date.now()){toast('الحساب محمي مؤقتًا. استخدم استعادة الحساب أو حاول لاحقًا');return}
  if(accountEmails().includes(e)){
    G.accountEmail=e;G.user=e.split('@')[0]||'عضو الشبكة';G.pkg=G.pkg||'الأساسية';securityLoginSuccess();persist(true);go(securityNeedsStepUp()?85:2);
    toast('مرحبًا بعودتك — تم فتح حسابك');return
  }
  startNewAccount(e)
}
function rAccountType(){let sel=new Set(G.memberships);
  return `<div class="authwrap"><div style="width:100%;max-width:860px">
  <div class="pagehead" style="justify-content:center;text-align:center"><div style="width:100%"><div class="kick">إنشاء الحساب — البوابة الموحدة</div><h1>تحديد نوع العضوية</h1><p style="margin-inline:auto">اختر عضوية واحدة أو أكثر. تُحفظ بيانات كل عضوية بصورة مستقلة، ويبدأ النظام بأول عضوية غير مكتملة ثم ينقلك تلقائيًا إلى التالية.</p></div></div>
  <div class="grid c3">${accountRoles.map(([r,dsc])=>{let done=G.completed.includes(r),lm=lifeMeta(r);
    return `<div class="rolecard ${sel.has(r)?'sel':''} ${done?'done':''}" role="checkbox" tabindex="0" aria-checked="${done||sel.has(r)}" onclick="toggleRole('${enc(r)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleRole('${enc(r)}')}">
      <span class="ck">${done||sel.has(r)?'✓':''}</span><b>${r}</b><small>${dsc}</small>
      <span class="tagb ${lm.cls}" style="margin-top:8px">${lm.label}${lm.dirty?' · تعديلات غير مرسلة':''}</span>
      ${r==='العميل'&&sel.has(r)?`<div style="margin-top:10px" onclick="event.stopPropagation()"><select class="ctl" id="clientType" style="font-size:12px"><option value="">تصنيف حساب العميل…</option>${clientTypes.map(t=>`<option ${G.clientType===t?'selected':''}>${t}</option>`).join('')}</select></div>`:''}
    </div>`}).join('')}</div>
  ${G.memberships.length?`<div class="card panel" style="margin-top:18px"><h3>ترتيب استكمال العضويات <span class="line"></span></h3><div class="chips" style="margin-top:12px">${G.memberships.map((r,i)=>{let lm=lifeMeta(r);return`<span class="chip static ${lm.state==='approved'?'sel':''}">${i+1}. ${esc(r)} — ${lm.label}${lm.dirty?' · تعديلات غير مرسلة':''}</span>`}).join('')}</div><button class="btn ghost sm" style="margin-top:12px" onclick="go(53)">متابعة حالات العضويات ←</button></div>`:''}
  <div style="display:flex;gap:12px;justify-content:center;margin-top:24px">
    <button class="btn ghost" onclick="go(1)">→ رجوع</button>
    <button class="btn gold" onclick="continueAccountSetup()">متابعة إعداد العضوية ←</button>
    ${G.completed.length?`<button class="btn primary" onclick="go(2)">دخول مساحة العمل</button>`:''}
  </div></div></div>`}
function toggleRole(r){r=dec(r);let i=G.memberships.indexOf(r);
  if(i<0){G.memberships.push(r);G.membershipStatus[r]=G.membershipStatus[r]||'لم يبدأ';ensureLife(r)}
  else if(!G.completed.includes(r)){G.memberships.splice(i,1);delete G.membershipStatus[r]}
  else{toast('لا يمكن إزالة عضوية مكتملة من هنا؛ يمكن تعليقها من إعدادات العضويات');return}
  persist(true);render()}
function continueAccountSetup(){let next=G.memberships.find(r=>!G.completed.includes(r));
  if(!next){toast(G.completed.length?'كل العضويات المختارة مكتملة':'اختر نوع عضوية واحدًا على الأقل');return}
  if(next==='العميل'){let ct=$('clientType');G.clientType=ct?ct.value:(G.clientType||'');
    if(!G.clientType){toast('حدّد تصنيف حساب العميل');return}}
  G.activeMembership=next;if(ensureLife(next).state==='not_started')lifeTransition(next,'draft','المستخدم','بدء إدخال بيانات العضوية');
  G.ctx=next==='العميل'?'عميل':next;persist(true);go(MEMBER_SCREENS[next]);toast('ابدأ بإدخال بيانات عضوية «'+next+'»')}
function isPlatformOperator(){let t='مدير / مشغل المنصة',L=ensureLife(t);return G.completed.includes(t)&&L.state==='approved'}
async function submitMembership(type){let L=ensureLife(type),can=L.state==='data_complete'||L.state==='needs_changes'||(L.state==='approved'&&L.dirty)||(L.state==='renewal_due'&&L.dirty);
  if(!can){toast(L.state==='needs_changes'?'افتح العضوية، استكمل التعديلات المطلوبة ثم أكمل البيانات قبل إعادة الإرسال':'يجب إكمال البيانات أو التعديلات قبل إرسال العضوية للتحقق');return}
  await membershipServerSave();
  let code=MEMBER_CODE_BY_LABEL[type];if(!code){toast('نوع العضوية غير مدعوم');return}
  try{
    let response=await fetch('/api/membership-lifecycle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),membershipCode:code,action:'SUBMIT'})});
    let result=await response.json();if(!response.ok)throw new Error(result.error||'submit failed');
    L.state=result.status;L.dirty=false;L.updatedAt=Date.now();L.history.push({state:result.status,at:L.updatedAt,actor:'صاحب العضوية',note:'إرسال العضوية للتحقق'});G.membershipStatus[type]=LIFE_STATES[result.status].label;
    persist(true);render();toast('أُرسلت عضوية «'+type+'» للتحقق')
  }catch(error){console.error('[membership submit]',error);toast('تعذر إرسال العضوية. تأكد من اكتمال الحفظ ثم أعد المحاولة')}}
function editMembership(type){let L=ensureLife(type);G.activeMembership=type;
  if(['needs_changes','rejected','expired'].includes(L.state))lifeTransition(type,'draft','صاحب العضوية','بدء الاستكمال أو التصحيح');
  else if(L.state==='renewal_due')markMembershipDirty(type);
  else markMembershipDirty(type);go(MEMBER_SCREENS[type])}
function reviewMembership(type,to){if(!isPlatformOperator()){toast('هذا الإجراء متاح فقط لمشغل منصة معتمد');return}
  let labels={under_review:'بدء المراجعة',approved:'اعتماد العضوية',needs_changes:'طلب استكمال',rejected:'رفض العضوية',suspended:'تعليق العضوية',renewal_due:'طلب التجديد',expired:'انتهاء العضوية'};
  if(['rejected','suspended'].includes(to)&&!confirm('هل أنت متأكد من إجراء «'+labels[to]+'» لعضوية «'+type+'»؟'))return;
  let note=labels[to]||'',requiresNote=['needs_changes','rejected','suspended','renewal_due'].includes(to);
  if(requiresNote){let x=prompt('اكتب سبب الإجراء أو الملاحظات التي ستظهر في سجل العضوية:','');if(x===null)return;if(!x.trim()){toast('سبب الإجراء إلزامي لضمان قابلية التدقيق');return}note+=' — '+x.trim()}
  if(lifeTransition(type,to,'مدير / مشغل المنصة',note)){render();toast('تم تحديث حالة عضوية «'+type+'»')}}
function lifecycleActions(type){let L=ensureLife(type),member='',admin='';
  if(L.state==='data_complete'||(L.state==='approved'&&L.dirty)||(L.state==='renewal_due'&&L.dirty))member+=`<button class="btn gold sm" onclick="submitMembership('${type}')">${L.state==='renewal_due'?'إرسال التجديد':'إرسال للتحقق'}</button>`;
  if(['draft','data_complete','needs_changes','rejected','expired','approved','renewal_due'].includes(L.state))member+=`<button class="btn ghost sm" onclick="editMembership('${type}')">${L.state==='renewal_due'?'استكمال التجديد':'تعديل البيانات'}</button>`;
  if(G.ctx==='مدير / مشغل المنصة'&&isPlatformOperator()){
    if(L.state==='submitted')admin+=`<button class="btn soft sm" onclick="reviewMembership('${type}','under_review')">بدء المراجعة</button>`;
    if(L.state==='under_review')admin+=`<button class="btn success sm" onclick="reviewMembership('${type}','approved')">اعتماد</button><button class="btn soft sm" onclick="reviewMembership('${type}','needs_changes')">طلب استكمال</button><button class="btn danger sm" onclick="reviewMembership('${type}','rejected')">رفض</button>`;
    if(L.state==='approved')admin+=`<button class="btn soft sm" onclick="reviewMembership('${type}','renewal_due')">طلب تجديد</button><button class="btn ghost sm" onclick="reviewMembership('${type}','suspended')">تعليق</button>`;
    if(L.state==='suspended')admin+=`<button class="btn soft sm" onclick="reviewMembership('${type}','under_review')">إعادة إلى المراجعة</button>`;
    if(L.state==='renewal_due')admin+=`<button class="btn danger sm" onclick="reviewMembership('${type}','expired')">تسجيل الانتهاء</button>`;
  }
  return member+admin}
function rMembershipCases(){let roles=G.memberships||[],states=roles.map(r=>lifeMeta(r).state),pending=states.filter(s=>['submitted','under_review','needs_changes','renewal_due'].includes(s)).length,approved=states.filter(s=>s==='approved').length,drafts=states.filter(s=>['not_started','draft','data_complete'].includes(s)).length;
  return pagehead({ctx:'الحساب والحوكمة',title:'حالات العضويات',desc:'متابعة دورة حياة كل عضوية وسجل انتقالاتها دون تغيير أو حذف البيانات المدخلة.'},`<button class="btn ghost sm" onclick="go(44)">إدارة العضويات</button>`)+`
  ${roles.length?`<div class="grid c3" style="margin-bottom:16px">
    <div class="card metric blue"><div class="k">المسودات والبيانات المكتملة</div><div class="v">${drafts}</div><div class="hint">تحتاج إكمالًا أو إرسالًا</div></div>
    <div class="card metric amber"><div class="k">قيد الإجراء والمراجعة</div><div class="v">${pending}</div><div class="hint">تتطلب متابعة</div></div>
    <div class="card metric green"><div class="k">العضويات المعتمدة</div><div class="v">${approved}</div><div class="hint">صالحة ونشطة</div></div>
  </div>`:''}
  ${!roles.length?`<div class="card empty"><b>لا توجد عضويات محددة بعد</b><p>ابدأ باختيار نوع عضوية واحد أو أكثر، ثم أدخل بيانات كل عضوية في مسار مستقل.</p><button class="btn gold" onclick="go(44)">اختيار أنواع العضوية</button></div>`:''}
  <div class="grid c2">${roles.map(type=>{let L=ensureLife(type),m=lifeMeta(type),hist=[...L.history].reverse().slice(0,5);return`<div class="card panel">
    <div class="casehead"><h3>${esc(type)}</h3><span class="sp"></span><span class="tagb ${m.cls}">${m.label}</span>${m.dirty?'<span class="tagb amber">تعديلات غير مرسلة</span>':''}</div>
    <div class="tline" style="margin-top:14px">${hist.map((h,i)=>`<div class="tstep ${i===0?'now':'done'}"><b>${esc(LIFE_STATES[h.state]?.label||h.state)}</b><small>${new Date(h.at).toLocaleString('ar')} · ${esc(h.actor||'النظام')}${h.note?' — '+esc(h.note):''}</small></div>`).join('')}</div>
    <div class="case-actions">${lifecycleActions(type)||'<span class="hint">لا يوجد إجراء مطلوب في هذه الحالة.</span>'}</div>
  </div>`}).join('')}</div>`}
const CONTEXTS=[['خبير مستقل','عرض الخبرة والأدلة والخدمات',6],['عميل','طلب الخبراء والاستشارات',20],['متعلم','دوراتي وشهاداتي',38],['مدرب','ملفي التدريبي وجلساتي',39],['مركز تدريب','إدارة الدورات والطرح',40],['متحقق','قضايا التحقق المسندة',15],['مدير / مشغل المنصة','إدارة المنظومة والاعتمادات',15]];
function rContexts(){let d=data[3];return pagehead(d)+`<div class="grid c3">${CONTEXTS.map(([n,ds,target])=>{let locked=n==='مدير / مشغل المنصة'&&!isPlatformOperator();return`
  <div class="rolecard ${G.ctx===n?'sel':''}" role="button" tabindex="0" aria-disabled="${locked}" onclick="setCtx('${enc(n)}',${target})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();setCtx('${enc(n)}',${target})}" style="${locked?'opacity:.62':''}">
    <span class="ck">${G.ctx===n?'✓':''}</span><b>${n}</b><small>${ds}</small>
    <div style="margin-top:10px"><span class="tagb ${G.ctx===n?'gold':'gray'}">${G.ctx===n?'السياق الحالي':locked?'يتطلب اعتماد المشغل':'التبديل إليه'}</span></div>
  </div>`}).join('')}</div>`}
function setCtx(n,target){n=dec(n);if(n==='مدير / مشغل المنصة'&&!isPlatformOperator()){toast('سياق إدارة المنصة يتطلب عضوية مشغل معتمدة');return}G.ctx=n;persist(true);go(target);toast('انتقلت إلى سياق «'+G.ctx+'»')}
function rWorkspace(){let p=wpct();let d=data[2];
  let notices=G.accountDashboard?.notifications||[],unread=Number(G.accountDashboard?.unreadCount||0),
      urgent=notices.filter(n=>!n.is_read&&['HIGH','CRITICAL'].includes(n.priority)).length,
      overdue=notices.filter(n=>!n.is_read&&n.due_at&&new Date(n.due_at)<new Date()).length;
  let band=G.verified?`<div class="statusband approved mt">${IC.check} ملفك <b>موثق ✓</b> — اكتمل الاعتماد${G.verifyDate?' بتاريخ '+G.verifyDate:''}، وظهرت شارة التوثيق في ملفك العام ونتائج البحث.</div>`
    :submitted?`<div class="statusband pending mt">${IC.clock} ملفك المهني قيد التحقق من إدارة المنصة.</div>`
    :p===100?`<div class="statusband approved mt">${IC.check} اكتمل ملفك المهني 100% — يمكنك إرساله للتحقق.</div>`
    :`<div class="statusband draft mt">${IC.doc.replace('<svg','<svg style="width:17px;height:17px"')} ملفك المهني في وضع المسودة (${p}%) — أكمله لزيادة فرص المطابقة.</div>`;
  return `<div class="hero" style="background:linear-gradient(120deg,#0a2540 30%,#143f6e 75%,#1b4f86);border-radius:18px;color:#fff;padding:28px 32px;display:flex;align-items:center;gap:24px;position:relative;overflow:hidden;box-shadow:var(--shadow-lg)">
    <div style="width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg,var(--gold),#8f6f2a);display:grid;place-items:center;font-size:26px;font-weight:700;color:#0a2540;flex:none">${esc(((W.fullName||G.user||'؟').trim()[0]||'؟'))}</div>
    <div style="flex:1;min-width:0"><h1 style="font-size:20px">مرحبًا${W.fullName?'، '+esc(W.fullName.split(' ')[0]):''} 👋</h1>
      <p style="color:#b9cade;font-size:12.5px;margin-top:3px">${esc(d.desc)}</p>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <span class="tagb gold">${esc(G.ctx)}</span>
        ${(G.completed||[]).map(r=>`<span class="tagb" style="background:rgba(255,255,255,.12);color:#e8eef6">عضوية ${esc(r)}</span>`).join('')}
        ${W.specialty?`<span class="tagb" style="background:rgba(255,255,255,.12);color:#e8eef6">${esc(W.specialty)}</span>`:''}
      </div></div>
    <div class="ring2" style="width:112px;height:112px;margin:0">${ringSVG(p,44,8,'#d9b660','#b08a34','rgba(255,255,255,.14)','ws')}<div class="num"><div><b style="color:#fff">${p}%</b><span style="color:#a9bdd3">اكتمال الملف</span></div></div></div>
  </div>${band}
  ${homeSearchBand()}
  ${notices.length?`<div class="card panel mt"><div class="lrow"><span><h3>صندوق الأعمال والإشعارات</h3><small>قرارات ومتابعات المشاريع والمالية والجودة في قائمة موحدة.</small></span><div class="acts"><button class="btn ghost xs" onclick="accountDashboardRestore()">تحديث</button>${unread?`<button class="btn soft xs" onclick="markAllAccountNotifications()">تعليم الكل كمقروء</button>`:''}</div></div><div class="grid c3 mt"><div class="summarybox"><small>غير مقروء</small><b>${unread}</b></div><div class="summarybox"><small>أولوية مرتفعة</small><b>${urgent}</b></div><div class="summarybox"><small>متأخر عن الاستحقاق</small><b>${overdue}</b></div></div>${notices.slice(0,10).map(n=>{let late=!n.is_read&&n.due_at&&new Date(n.due_at)<new Date();return`<button class="lrow ${n.is_read?'':'summarybox'}" style="width:100%;text-align:right;cursor:pointer;border:0" onclick="openAccountNotification('${n.notification_id}','${esc(n.action_route||'')}')"><span><b>${n.is_read?'':'● '}${esc(n.title)}</b><small>${esc(n.message)}${n.due_at?' · الاستحقاق '+esc(n.due_at):''}</small></span><span><span class="tagb ${late||n.priority==='CRITICAL'?'red':n.priority==='HIGH'?'amber':'gray'}">${late?'متأخر':esc(n.priority||'NORMAL')}</span><small>${new Date(n.created_at).toLocaleDateString('ar')}</small></span></button>`}).join('')}</div>`:''}
  ${metrics(d.m,i=>['go(4)','go(14)','go(4)','go(4)'][i])}
  <div class="grid mt" style="grid-template-columns:1.7fr 1fr">
    <div class="card panel"><h3>أعمالي القادمة <span class="line"></span><span class="more" onclick="go(4)" style="cursor:pointer">الكل ←</span></h3>
      ${(data[4].rows||[]).slice(0,4).map(r=>`<div class="lrow"><b>${esc(r[0])}</b><small><span class="tagb ${r[2]==='مرتفع'?'red':r[2]==='متوسط'?'amber':'gray'}">${r[2]}</span> · ${esc(r[3])}</small></div>`).join('')}
    </div>
    <div class="card panel"><h3>إجراءات سريعة</h3><div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
      <button class="btn primary sm" style="justify-content:center" onclick="go(33)">استكمال السجل المهني</button>
      <button class="btn ghost sm" style="justify-content:center" onclick="previewMembershipPublic('خبير')">معاينة ملفي العام</button>
      <button class="btn ghost sm" style="justify-content:center" onclick="go(34)">مركز الدورات</button>
      <button class="btn ghost sm" style="justify-content:center" onclick="go(21)">إنشاء احتياج جديد</button>
    </div></div>
  </div>
  ${cardsGrid(d.c)}`}
const SEARCH_INDEX=[
 ['خبير','د. أحمد محمد العتيبي — إدارة مشاريع وتحول رقمي',19,'خبراء'],
 ['خبير','د. سارة خالد الحربي — طاقة متجددة وهيدروجين',19,'خبراء'],
 ['دورة','إعداد محترف إدارة المشاريع (PMP) — الرياض',36,'دورات'],
 ['دورة','أساسيات التحول الرقمي للمؤسسات — عن بعد',36,'دورات'],
 ['دورة','إدارة المخاطر المؤسسية — مسقط',36,'دورات'],
 ['مركز تدريب','معهد الريادة للتدريب — الرياض',43,'مراكز'],
 ['مركز تدريب','أكاديمية المستقبل — دبي',43,'مراكز'],
 ['خدمة','استشارات تشخيص الجاهزية الرقمية',8,'خدمات'],
 ['خدمة','مراجعة منهجية وتقييم (Audit)',8,'خدمات'],
 ['احتياج','طلب قائد تحول رقمي لجهة حكومية',22,'طلبات'],
 ['معرفة','دليل إعداد بصمة المهمة للمطابقة',23,'معرفة'],
 ['معرفة','ضوابط التحقق من الأدلة المهنية',14,'معرفة']];
/* البحث الموحد — ينوّع النتائج من الأدلة الخمسة الحقيقية */
const U_DIR_PAGES={expert:50,researcher:51,trainer:41,center:42,consultant:58,course:35};
function uSearch(kind,q){q=(q||'').trim();
  if(kind==='course'){let f=(q||'').toString();return courses.filter(c=>!q||c.title.includes(q)||c.provider.includes(q)||c.trainer.includes(q)||(COURSE_TAX[c.title]||['','',''])[2].includes(q)).map(c=>{let tx=COURSE_TAX[c.title]||['','',''];
    return{label:c.title,sub:tx[1]||c.academy,country:c.country,lang:c.lang,rating:0,meta:`${c.date} · ${c.mode} · ${c.price}`,target:36,pick:()=>{G.course=enc(c.title);persist(true)}}})}
  return SEARCH_DIRS[kind].list.filter(x=>{if(!q)return true;
    let hay=[x.name,x.title,x.inst,x.spec,x.main,x.sub,x.extra,x.country].filter(Boolean).join(' ');
    return q.split(/\s+/).some(w=>hay.includes(w))}).map(x=>({label:x.name,sub:x.sub||x.title||x.inst||x.spec,main:x.main,country:x.country,lang:(x.langs||[]).join('، '),rating:x.rating,verified:x.verified,meta:x.extra,target:U_DIR_PAGES[kind]}))}
const U_KINDS=[['expert','خبراء','green','🎖'],['consultant','مستشارون','blue','💼'],['researcher','باحثون','violet','🔬'],['trainer','مدربون','blue','🎓'],['center','مراكز تدريب','amber','🏛'],['course','دورات تدريبية','gold','📚']];
function uGo(kind){let q=G.searchQ||'';
  if(kind==='course'){G.catF=G.catF||{};G.catF.q=q}
  else{(G.dirF=G.dirF||{})[kind]=G.dirF[kind]||{};G.dirF[kind].q=q}
  persist(true);go(U_DIR_PAGES[kind])}
function uCountsHTML(q){q=(q||'').trim();if(!q)return'';
  return `<div class="chips" style="margin-top:10px">${U_KINDS.map(([kind,label,cls])=>{let n=uSearch(kind,q).length;
    return `<button class="chip" onclick="uGo('${kind}')" ${!n?'disabled style="opacity:.45;cursor:default"':''}>${label}: <b style="color:var(--${cls==='gold'?'gold-2':cls})">${n}</b> نتيجة ←</button>`}).join('')}
    <span class="hint" style="align-self:center">اختر الدليل لفتح النتائج بفلاتره الكاملة — لا تُعرض قوائم مطوّلة هنا.</span></div>`}
/* البحث المعمّق لكل دليل */
const DEEP_DEFS={
 expert:{label:'البحث عن خبير',icon:'🎖',cls:'green',page:50},
 consultant:{label:'البحث عن مستشار',icon:'💼',cls:'blue',page:58},
 researcher:{label:'البحث عن باحث / أكاديمي',icon:'🔬',cls:'violet',page:51},
 trainer:{label:'البحث عن مدرب',icon:'🎓',cls:'blue',page:41},
 center:{label:'البحث عن مركز تدريب',icon:'🏛',cls:'amber',page:42},
 course:{label:'البحث عن دورة تدريبية',icon:'📚',cls:'gold',page:35}};
function deepSet(k,f,v){(G.deep=G.deep||{})[k]=G.deep[k]||{};G.deep[k][f]=v;if(f==='main')G.deep[k].sub='';persist(true);render()}
function deepGo(k){let d=(G.deep||{})[k]||{};let q=G.searchQ||'';
  if(k==='course'){G.catF={q,main:d.main||'',sub:d.sub||'',country:d.country||'',lang:d.lang||'',mode:d.mode||''}}
  else{G.dirF=G.dirF||{};G.dirF[k]={q,main:d.main||'',sub:d.sub||'',country:d.country||'',lang:d.lang||''}}
  persist(true);go(DEEP_DEFS[k].page)}
function deepCard(k){let M=DEEP_DEFS[k];let d=(G.deep||{})[k]||{};
  let mains=Object.keys(TAX),subs=d.main?Object.keys(TAX[d.main]||{}):[];
  return `<div class="card" style="padding:18px 20px;display:flex;flex-direction:column;gap:10px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="width:36px;height:36px;border-radius:10px;background:var(--${M.cls}-soft);display:grid;place-items:center;font-size:17px">${M.icon}</span>
      <b style="font-size:13.5px">${M.label}</b></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <select class="ctl" style="font-size:11.5px;padding:7px 10px" onchange="deepSet('${k}','main',this.value)"><option value="">الاختصاص (7×7×7)…</option>${mains.map(s=>`<option ${d.main===s?'selected':''}>${s}</option>`).join('')}</select>
      <select class="ctl" style="font-size:11.5px;padding:7px 10px" ${!d.main?'disabled':''} onchange="deepSet('${k}','sub',this.value)"><option value="">${d.main?'التخصص الفرعي…':'اختر الاختصاص أولًا'}</option>${subs.map(s=>`<option ${d.sub===s?'selected':''}>${s}</option>`).join('')}</select>
      <select class="ctl" style="font-size:11.5px;padding:7px 10px" onchange="deepSet('${k}','country',this.value)"><option value="">الدولة…</option>${countries.map(s=>`<option ${d.country===s?'selected':''}>${s}</option>`).join('')}</select>
      <select class="ctl" style="font-size:11.5px;padding:7px 10px" onchange="deepSet('${k}','lang',this.value)"><option value="">اللغة…</option>${SEARCH_LANGS.map(s=>`<option ${d.lang===s?'selected':''}>${s}</option>`).join('')}</select>
    </div>
    ${k==='course'?`<select class="ctl" style="font-size:11.5px;padding:7px 10px" onchange="deepSet('${k}','mode',this.value)"><option value="">نمط الدورة…</option>${['حضوري','عن بعد','هجين'].map(s=>`<option ${d.mode===s?'selected':''}>${s}</option>`).join('')}</select>`:''}
    <button class="btn primary sm" style="justify-content:center;margin-top:auto" onclick="deepGo('${k}')">${d.main||d.sub||d.country||d.lang||d.mode?'بحث معمّق بهذه المعايير ←':'فتح الدليل كاملًا ←'}</button>
  </div>`}
function rSearch(){let q=G.searchQ||'';
  return pagehead({ctx:'البحث',title:'البحث الموحد',desc:'مدخل واحد للبحث: بالكلمات المفتاحية عبر كل الأدلة، أو بحث معمّق بمعايير كل دليل.'},`<button class="btn ghost sm" onclick="go(60)">→ الرئيسية</button>`)+`
  <div class="search-type-tabs" aria-label="أدلة البحث">
    ${[[50,'خبير','★'],[58,'مستشار','◆'],[51,'باحث / أكاديمي','▣'],[41,'مدرب','●'],[42,'مركز تدريبي','⌂'],[35,'دورة تدريبية','▤']].map(x=>`<button onclick="go(${x[0]})"><span>${x[2]}</span>${x[1]}</button>`).join('')}
  </div>
  <div class="card" style="padding:18px 22px;margin-bottom:18px">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:260px;border:1.5px solid var(--line);border-radius:12px;padding:2px 12px;background:#fff">
        ${IC.search.replace('<svg','<svg style="width:17px;height:17px;color:var(--muted)"')}
        <input id="uq" style="border:0;outline:0;flex:1;padding:9px 0;font-size:13.5px;background:transparent" placeholder="ابحث بالاسم أو الكلمة المفتاحية في كل الأدلة…" value="${esc(q)}" oninput="G.searchQ=this.value;uRefresh()" autofocus>
      </div>
    </div>
    <div id="ucounts" aria-live="polite">${uCountsHTML(q)}</div>
  </div>
  <h2 style="font-size:15px;color:var(--navy);margin-bottom:12px">البحث المعمّق — اختر الدليل وحدّد معاييره</h2>
  <div class="grid c3">${Object.keys(DEEP_DEFS).map(deepCard).join('')}</div>
  <p class="hint mt">💡 نصيحة: للبحث عن دورة في اختصاص معين — حدّد الاختصاص في بطاقة «دورة تدريبية» ثم التخصص الفرعي واضغط «بحث معمّق»، وستُفتح نتائج الدليل مصفّاة مباشرة.</p>`}
function uRefresh(){persist(true);let el=$('ucounts');if(el)el.innerHTML=uCountsHTML(G.searchQ)}
