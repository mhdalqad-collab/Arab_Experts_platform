/* =========================================================
   رحلة الخبير: المركز، الأدوار، الأدلة، التحقق، البصمات، الملف العام
   ========================================================= */
function rExpertCenter(){let d=data[6];let p=wpct();
  let evN=(G.evidences||[]).length+3, recsN=['qualifications','accreditations','experiences','projects'].reduce((a,k)=>a+((W[k]||[]).length),0);
  return pagehead(d,`<button class="btn ghost sm" onclick="previewMembershipPublic('خبير')">الملف العام</button><button class="btn primary sm" onclick="go(33)">تحديث السجل المهني</button>`)+`
  ${submitted?`<div class="statusband pending" style="margin-bottom:16px">${IC.clock} ملفك مُرسل — قضية التحقق VER-2026-104 قيد الفحص. <span class="rowlink" style="cursor:pointer" onclick="go(14)">متابعة القضية ←</span></div>`:''}
  ${metrics([['اكتمال الملف',p+'%',p===100?'green':'gold'],['سجلات مهنية',recsN,'blue'],['أدلة مضافة',evN],['الحالة',G.verified?'موثق ✓':submitted?'قيد التحقق':'مسودة',G.verified?'green':submitted?'amber':'']],i=>[ 'go(33)','go(33)','go(11)','go(14)'][i])}
  ${cardsGrid(d.c)}`}
/* متصفح الأدوار عبر التصنيف */
function rRoles(){let d=data[8];let dom=G.roleDom||'',sp=G.roleSp||'';
  let doms=Object.keys(TAX),sps=dom?Object.keys(TAX[dom]||{}):[];
  let stages=dom&&sp?(TAX[dom]||{})[sp]||[]:[];
  return pagehead(d)+`
  <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:14px;align-items:start">
    <div class="card panel" style="padding:14px"><h3 style="font-size:13px;padding:4px 6px">الاختصاص الرئيسي</h3>
      ${doms.map(x=>`<div class="lrow" style="cursor:pointer;${x===dom?'background:var(--gold-soft);font-weight:700':''}" onclick="G.roleDom=dec('${enc(x)}');G.roleSp='';persist(true);render()"><b style="font-size:12.5px">${x}</b><small>←</small></div>`).join('')}</div>
    <div class="card panel" style="padding:14px"><h3 style="font-size:13px;padding:4px 6px">التخصص الفرعي</h3>
      ${sps.length?sps.map(x=>`<div class="lrow" style="cursor:pointer;${x===sp?'background:var(--gold-soft);font-weight:700':''}" onclick="G.roleSp=dec('${enc(x)}');persist(true);render()"><b style="font-size:12.5px">${x}</b><small>←</small></div>`).join(''):'<div class="empty" style="padding:24px"><b>اختر اختصاصًا أولًا</b></div>'}</div>
    <div class="card panel" style="padding:14px"><h3 style="font-size:13px;padding:4px 6px">مراحل دورة الحياة</h3>
      ${stages.length?stages.map(st=>{let areas=(TAX_DETAILS[dom]||{})[sp]?.[st]||[];
        return `<div class="rolecard" style="margin-bottom:10px;cursor:pointer" onclick="G.roleStage=dec('${enc(st)}');persist(true);go(9)"><b style="font-size:12.5px">${st}</b><small>${areas.slice(0,3).join('، ')}${areas.length>3?'…':''}</small></div>`}).join(''):'<div class="empty" style="padding:24px"><b>اختر تخصصًا لعرض المراحل</b></div>'}</div>
  </div>`}
function rRoleDetails(){let d=data[9];let dom=G.roleDom,sp=G.roleSp,st=G.roleStage;
  let areas=dom&&sp&&st?(TAX_DETAILS[dom]||{})[sp]?.[st]||[]:[];
  return pagehead(d,`<button class="btn ghost sm" onclick="go(8)">→ تصفح الأدوار</button><button class="btn primary sm" onclick="go(10)">إضافة خبرة لهذا الدور</button>`)+`
  ${dom?`<div class="statusband draft" style="margin-bottom:16px">${IC.shield} الدور المحدد: <b>${esc(dom)} ← ${esc(sp)} ← ${esc(st||'')}</b></div>`:''}
  ${metrics(d.m)}${tabsBar(current,d.tabs)}
  ${areas.length?`<div class="card panel"><h3>مجالات الخبرة التطبيقية في هذا الدور <span class="line"></span><span class="tagb gold">${areas.length} مجالًا</span></h3><div class="chips" style="margin-top:12px">${areas.map(a=>`<span class="chip static">${esc(a)}</span>`).join('')}</div></div>`:''}
  <div class="mt">${hubCards(d)}</div>`}
function rAddExperience(){let d=data[10];
  return pagehead(d)+`<div class="card panel"><h3>إضافة خبرة إلى سجلك المهني</h3>
    <p style="font-size:12px;color:var(--muted);margin:6px 0 14px">تُضاف الخبرة مباشرة إلى سجل الخبرات الوظيفية في ملفك المهني وتدعم أهليتك للأدوار.</p>
    <button class="btn primary" onclick="wjump(5);go(33)">فتح سجل الخبرات الوظيفية ←</button>
    <button class="btn ghost" style="margin-inline-start:8px" onclick="wjump(6);go(33)">أو إضافة مشروع منجز</button></div>`+hub(data[10])}
/* ===== الأدلة والتحقق ===== */
const EV_TYPES=['شهادة علمية','اعتماد مهني','خطاب توصية','وثيقة مشروع','تقييم أداء','نشر علمي','أخرى'];
function rEvidenceCenter(){let d=data[11];let ev=G.evidences||[];
  return pagehead(d,`<button class="btn primary sm" onclick="go(12)">＋ إضافة دليل</button>`)+`
  ${metrics([['إجمالي الأدلة',ev.length+3],['متحققة',(G.claims.ok?1:0)+2,'green'],['قيد الفحص',submitted?1:0,'amber'],['تحتاج تجديدًا',1,'red']])}
  <div class="card mt" style="padding:8px 6px"><table class="tbl"><thead><tr><th>الدليل</th><th>النوع</th><th>الجهة</th><th>الحالة</th><th></th></tr></thead><tbody>
    <tr><td><b>شهادة PMP</b></td><td>اعتماد مهني</td><td>PMI</td><td><span class="tagb green">متحقق</span></td><td><button class="btn xs soft" onclick="go(13)">تفاصيل</button></td></tr>
    <tr><td><b>شهادة الماجستير</b></td><td>شهادة علمية</td><td>الجامعة</td><td><span class="tagb green">متحقق</span></td><td><button class="btn xs soft" onclick="go(13)">تفاصيل</button></td></tr>
    <tr><td><b>وثيقة إنجاز مشروع</b></td><td>وثيقة مشروع</td><td>الجهة المستفيدة</td><td><span class="tagb amber">قيد الفحص</span></td><td><button class="btn xs soft" onclick="go(13)">تفاصيل</button></td></tr>
    ${ev.map((e,i)=>`<tr><td><b>${esc(e.title)}</b></td><td>${esc(e.type)}</td><td>${esc(e.issuer)}</td><td><span class="tagb gray">بانتظار الفحص</span></td><td><button class="btn xs danger" onclick="G.evidences.splice(${i},1);persist(true);render()">حذف</button></td></tr>`).join('')}
  </tbody></table></div>`}
function rAddEvidence(){let d=data[12];let v=G.evDraft=G.evDraft||{};
  return pagehead(d)+`<div class="card formcard" style="min-height:0">
    <div class="fields">
      <div class="field"><label>عنوان الدليل <em>*</em></label><input class="ctl" value="${esc(v.title||'')}" oninput="G.evDraft.title=this.value;persist(true)"></div>
      <div class="field"><label>نوع الدليل <em>*</em></label><select class="ctl" onchange="G.evDraft.type=this.value;persist(true)"><option value="">اختر…</option>${EV_TYPES.map(t=>`<option ${v.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>الجهة المصدرة <em>*</em></label><input class="ctl" value="${esc(v.issuer||'')}" oninput="G.evDraft.issuer=this.value;persist(true)"></div>
      <div class="field"><label>تاريخ الإصدار</label><input class="ctl" type="date" value="${esc(v.issued||'')}" onchange="G.evDraft.issued=this.value;persist(true)"></div>
      <div class="field"><label>الادعاء المدعوم</label><select class="ctl" onchange="G.evDraft.claim=this.value;persist(true)"><option value="">اختر الادعاء…</option><option ${v.claim==='أهلية الدور المهني'?'selected':''}>أهلية الدور المهني</option><option ${v.claim==='المؤهل العلمي'?'selected':''}>المؤهل العلمي</option><option ${v.claim==='الخبرة التطبيقية'?'selected':''}>الخبرة التطبيقية</option></select></div>
      <div class="field"><label>مستوى السرية</label><select class="ctl" onchange="G.evDraft.conf=this.value;persist(true)"><option ${v.conf==='عام'?'selected':''}>عام</option><option ${v.conf==='مقيد'?'selected':''}>مقيد</option><option ${v.conf==='سري'?'selected':''}>سري — للتحقق فقط</option></select></div>
      <div class="field wide"><label>ملف الدليل <em>*</em></label><label class="filebox"><input type="file" style="display:none" onchange="G.evDraft.file=this.files[0]?.name;persist(true);render()"><b>⭱ رفع ملف الدليل</b><small>PDF أو صورة</small></label>${v.file?`<span class="filetag">${esc(v.file)}</span>`:''}</div>
    </div>
    <div class="wizfoot"><button class="btn ghost" onclick="go(11)">إلغاء</button><span class="sp"></span><button class="btn primary" onclick="saveEvidence()">حفظ الدليل وإرساله للفحص ✓</button></div></div>`}
function saveEvidence(){let v=G.evDraft||{};
  if(!v.title||!v.type||!v.issuer){toast('أكمل الحقول الإلزامية');return}
  G.evidences=G.evidences||[];G.evidences.push({...v});G.evDraft={};persist(true);go(11);toast('أُضيف الدليل وأُرسل للفحص')}
function rEvidenceDetails(){return hub(data[13],`<button class="btn ghost sm" onclick="go(11)">→ مركز الأدلة</button>`)}
/* قضية التحقق */
function rVerifyCase(){let d=data[14];
  let stages=[['تم استلام الملف','مكتمل',1],['إسناد إلى متحقق مستقل','مكتمل',1],['فحص الادعاءات والأدلة',G.verified||G.verdict?'مكتمل':'جارٍ',G.verified||G.verdict?1:(submitted?2:0)],['إصدار القرار',G.verified?'اعتُمد ✓':G.verdict==='conditional'?'مشروط':G.verdict==='rejected'?'مرفوض':'بانتظار',G.verdict?1:0]];
  return pagehead(d,`<button class="btn ghost sm" onclick="go(16)">عرض نموذج القرار</button>`)+`
  ${metrics(d.m)}
  <div class="grid mt" style="grid-template-columns:1fr 1.2fr">
    <div class="card panel"><h3>الخط الزمني للقضية</h3><div class="tline" style="margin-top:14px">
      ${stages.map(s=>`<div class="tstep ${s[2]===1?'done':s[2]===2?'now':''}"><b>${s[0]}</b><small>${s[1]}</small></div>`).join('')}</div></div>
    <div class="card panel"><h3>الادعاءات قيد الفحص</h3>
      ${[['ممارسة تشخيص الجاهزية الرقمية 2023–2025','أدلة كافية · قيد المراجعة','amber'],['المؤهل العلمي المعلن','متحقق من المصدر','green'],['عضوية الاعتماد المهني','متحقق من المصدر','green']].map(c=>`<div class="lrow"><b>${c[0]}</b><small><span class="tagb ${c[2]}">${c[1]}</span></small></div>`).join('')}
      <div class="note mt">لا يوجد إجراء مطلوب منك حاليًا — سيصلك إشعار عند أي طلب معلومات.</div></div>
  </div>${tabsBar(current,d.tabs)}${hubCards(d)}`}
function rVerifier(){let d=data[15];G.claims=G.claims||{};
  let claims=[['c1','ممارسة تشخيص الجاهزية الرقمية خلال الفترة المحددة'],['c2','صحة المؤهل العلمي المعلن'],['c3','استيفاء متطلبات دور «مستشار تحول رقمي»']];
  let decided=claims.filter(c=>G.claims[c[0]]).length;
  return pagehead(d)+`
  <div class="statusband draft" style="margin-bottom:16px">${IC.shield} أنت في مساحة المتحقق — قراراتك على مستوى كل ادعاء مع تعليل إلزامي.</div>
  ${metrics([['قضايا مسندة','3'],['قررت اليوم',decided,'green'],['متوسط زمن القضية','4 أيام'],['طلبات معلقة','1','amber']])}
  <div class="card panel mt"><h3>القضية VER-2026-104 — الادعاءات <span class="line"></span><span class="tagb gold">${decided}/${claims.length} مقرّة</span></h3>
    ${claims.map(c=>{let st=G.claims[c[0]];
      return `<div class="admrow" style="border:1px solid var(--line);border-radius:13px;padding:15px 18px;background:#fff;display:flex;gap:12px;align-items:center;margin-top:10px">
        <div style="flex:1"><b style="font-size:13px">${c[1]}</b><p style="font-size:11.5px;color:var(--muted)">5 أدلة مرتبطة · آخر تحديث أمس</p>
          ${st?`<span class="tagb ${st==='ok'?'green':st==='part'?'amber':'red'}">${st==='ok'?'مثبت':st==='part'?'مثبت جزئيًا':'غير مثبت'}</span>`:''}</div>
        <button class="btn xs success" onclick="G.claims['${c[0]}']='ok';persist(true);render()">إثبات</button>
        <button class="btn xs soft" onclick="G.claims['${c[0]}']='part';persist(true);render()">إثبات جزئي</button>
        <button class="btn xs danger" onclick="G.claims['${c[0]}']='no';persist(true);render()">عدم إثبات</button>
        <button class="btn xs ghost" onclick="toast('أُرسل طلب معلومات للخبير')">طلب معلومات</button></div>`}).join('')}
    <div class="wizfoot" style="border-top:1px solid var(--line);margin-top:16px;padding-top:16px;display:flex"><span class="sp" style="flex:1"></span>
      <button class="btn ${decided===claims.length?'gold':'ghost'}" ${decided===claims.length?'':'disabled'} onclick="issueVerdict()">إصدار القرار النهائي ←</button></div></div>`}
function issueVerdict(){let vals=Object.values(G.claims);
  let okN=vals.filter(v=>v==='ok').length,partN=vals.filter(v=>v==='part').length;
  G.verdict=okN===3?'verified':(okN+partN>0?'conditional':'rejected');
  if(G.verdict==='verified'){G.verified=true;G.verifyDate=new Date().toISOString().slice(0,10)}
  else{G.verified=false;delete G.verifyDate}
  persist(true);go(16);
  toast(G.verdict==='verified'?'اعتُمد الملف — أصبح الخبير «موثقًا ✓»':G.verdict==='conditional'?'صدر قرار مشروط — أُشعر الخبير بالمطلوب':'رُفض الملف — أُشعر الخبير بالأسباب')}
function rDecision(){let d=data[16];let v=G.verdict;
  let banner=!v?`<div class="statusband draft" style="margin-bottom:16px">${IC.clock} لم يُصدر قرار بعد — تُعتمد النتيجة من مساحة المتحقق بعد تقرير الادعاءات الثلاثة.</div>`
    :v==='verified'?`<div class="statusband approved" style="margin-bottom:16px">${IC.check} <b>القرار: اعتماد الملف وتوثيق الخبير ✓</b> — صدر بتاريخ ${G.verifyDate||'اليوم'}، وأُشعر الخبير، وظهرت شارة «موثق» في ملفه العام ونتائج البحث.</div>`
    :v==='conditional'?`<div class="statusband pending" style="margin-bottom:16px">${IC.clock} <b>القرار: اعتماد مشروط</b> — يُستكمل التوثيق بعد استيفاء الملاحظات خلال 30 يومًا.</div>`
    :`<div class="statusband rejected" style="margin-bottom:16px">${IC.lock.replace('<svg','<svg style="width:17px;height:17px"')} <b>القرار: عدم اعتماد الملف</b> — يمكن للخبير الاستئناف أو إعادة التقدم بعد المعالجة.</div>`;
  return banner+hub(d,`<button class="btn ghost sm" onclick="go(14)">→ القضية</button>`)+`
  <div class="grid c3 mt">${['قبول القرار','طلب تفسير','تقديم استئناف'].map(a=>`<button class="btn ${v?'ghost':'ghost'}" style="justify-content:center" onclick="toast('سُجل: ${a} — وصل إشعار للمتحقق')">${a}</button>`).join('')}</div>`}
/* البصمات */
function rFingerprints(){let rows=W.specializationRecords||[];
  return pagehead(data[17])+`
  ${rows.length?`<div class="grid c3">${rows.map((r,i)=>`<div class="card panel" style="cursor:pointer" onclick="go(18)">
      <span class="tagb gold">${r.isPrimary==='نعم'?'بصمة رئيسية':'بصمة مهنية'}</span>
      <h3 style="margin-top:10px;font-size:14px">${esc(r.specialty)}</h3>
      <p style="font-size:11.5px;color:var(--muted)">${esc(r.domain)} ← ${esc(r.subspecialty)}</p>
      <div class="chips" style="margin-top:10px">${(r.services||[]).slice(0,3).map(s=>`<span class="chip static" style="font-size:10.5px;padding:3px 10px">${esc(s)}</span>`).join('')}</div>
      <div class="meter mt"><i style="width:${submitted?72:45}%"></i></div>
      <small class="hint">${submitted?'التحقق جارٍ — 72%':'مكتملة البيانات — بانتظار الإرسال'}</small></div>`).join('')}</div>`:
  `<div class="card empty"><div class="ic">${IC.shield}</div><b>لا بصمات مهنية بعد</b><p>تُنشأ البصمة تلقائيًا من سجلات التخصص المحفوظة في ملفك المهني</p><button class="btn primary sm mt" onclick="wjump(2);go(33)">إنشاء بصمتك الأولى ←</button></div>`}
  ${cardsGrid(data[17].c)}`}
function rFingerprintDetails(){let r=(W.specializationRecords||[])[0];
  return pagehead(data[18],`<button class="btn ghost sm" onclick="go(17)">→ المحفظة</button>`)+`
  ${r?`<div class="card panel"><h3>${esc(r.specialty)} — ${esc(r.expertise)}</h3>
    <div class="grid c2 mt">
      <div><div class="lrow"><b>المسار التصنيفي</b><small>${esc(r.domain)} ← ${esc(r.specialty)} ← ${esc(r.subspecialty)}</small></div>
      <div class="lrow"><b>سنوات الخبرة</b><small>${esc(r.specialtyYears||'—')}</small></div>
      <div class="lrow"><b>قطاعات التطبيق</b><small>${(r.sectors||[]).join('، ')}</small></div></div>
      <div><b style="font-size:12px">مجالات الخبرة التطبيقية</b><div class="chips" style="margin-top:8px">${(r.appliedAreas||[]).map(a=>`<span class="chip static" style="font-size:10.5px">${esc(a)}</span>`).join('')||'<small class="hint">—</small>'}</div></div>
    </div></div>`:''}
  ${hub(data[18])}`}
/* الملف العام */
function whid(k){return !!W._private[k]}
function rPublic(){let p=wpct();let name=whid('fullName')?'خبير الشبكة':(W.fullName||'خبير جديد');
  let spLine=[[W.domain,'domain'],[W.specialty,'specialty'],[W.subspecialty,'subspecialty']].filter(x=>x[0]&&!whid(x[1])).map(x=>x[0]).join(' › ');
  let pfSec=(t,b)=>b?`<div class="card pf-sec mt"><h3>${t}</h3>${b}</div>`:'';
  let recList=(key,fmt)=>{let arr=W[key]||[];return arr.length?arr.map(r=>{let[t,s]=fmt(r);return `<div class="pf-item"><b>${esc(t)}</b><small>${esc(s)}</small></div>`}).join(''):''};
  let cefrBar=l=>{let m={A1:1,A2:2,B1:3,B2:4,C1:5,C2:6},n=m[l]||0;return `<span class="bars">${Array.from({length:6},(_,i)=>`<i class="${i<n?'f':''}"></i>`).join('')}</span>`};
  let contact=[];if(!whid('country')&&W.country)contact.push(`الإقامة: ${W.country}${W.city?' — '+W.city:''}`);
  if(!whid('email')&&W.email)contact.push(`البريد: ${W.email}`);if(!whid('phone')&&W.phone)contact.push(`الهاتف: ${(W.phoneCode||'')+' '+W.phone}`);
  if(!whid('linkedin')&&W.linkedin)contact.push(`LinkedIn: ${W.linkedin}`);
  let skills=W.skills||[],langs=W.languageRecords||[],pricing=W.pricing||[];
  return `<div class="statusband draft" style="margin-bottom:16px">${IC.eye} معاينة ملفك العام كما يظهر لعملاء الشبكة — البيانات المخفية لا تظهر.</div>
  <div class="pf-hero"><div class="cov"></div><div class="bd">
    <div class="av">${esc(name.trim()[0]||'؟')}</div>
    <div style="padding-bottom:4px"><h2>${esc(name)}</h2>
      ${!whid('englishName')&&W.englishName?`<div class="en">${esc(W.englishName)}</div>`:''}
      <div class="sp-line">${esc(spLine||'التخصص لم يُحدد بعد')}</div>
      <div class="badges">${W.expertise&&!whid('expertise')?`<span class="bdg">◆ ${esc(W.expertise)}</span>`:''}${!whid('professionalRoles')?(W.professionalRoles||[]).map(r=>`<span class="bdg">${esc(r)}</span>`).join(''):''}${G.verified?`<span class="bdg" style="background:rgba(21,115,71,.4);border-color:rgba(21,115,71,.5)">✓ خبير موثق${G.verifyDate?' — '+G.verifyDate:''}</span>`:submitted?'<span class="bdg" style="background:rgba(201,162,75,.3)">◔ قيد التوثيق</span>':''}</div></div></div></div>
  ${pfSec('التواصل والموقع',contact.length?contact.map(c=>`<div class="pf-item"><b>${esc(c)}</b></div>`).join(''):'')}
  ${pfSec('سجلات التخصص (البصمات)',(W.specializationRecords||[]).map(r=>`<div class="pf-item"><b>${!whid('specialty')?esc(r.specialty):'تخصص مهني'} ${r.isPrimary==='نعم'&&!whid('isPrimary')?'◆':''}</b><small>${[[r.domain,'domain'],[r.subspecialty,'subspecialty'],[r.expertise,'expertise'],[r.specialtyYears&&r.specialtyYears+' سنوات','specialtyYears']].filter(x=>x[0]&&!whid(x[1])).map(x=>esc(x[0])).join(' ← ')}</small></div>`).join(''))}
  ${!whid('qualifications')?pfSec('المؤهلات العلمية',recList('qualifications',r=>[[r.degree,r.specialization].filter(Boolean).join(' — '),[r.institution,r.country,r.year].filter(Boolean).join(' · ')])):''}
  ${!whid('accreditations')?pfSec('الاعتمادات المهنية',recList('accreditations',r=>[r.name,[r.issuer,r.number?'رقم: '+r.number:''].filter(Boolean).join(' · ')])):''}
  ${!whid('experiences')?pfSec('الخبرات الوظيفية',recList('experiences',r=>[[r.title,r.organization].filter(Boolean).join(' — '),[r.jobLevel,r.country,(r.start||'')+' ← '+(r.current==='نعم'?'حتى الآن':r.end||'')].filter(Boolean).join(' · ')])):''}
  ${!whid('projects')?pfSec('أبرز المشاريع',recList('projects',r=>[r.name,[r.sector,r.country,r.year,r.role,r.value?'$'+Number(r.value).toLocaleString():''].filter(Boolean).join(' · ')])):''}
  ${skills.length&&!whid('skills')?pfSec('المهارات والمعارف',`<div class="chips">${skills.map(s=>`<span class="chip sel static">${esc(s.name)}${s.level?' · '+esc(s.level):''}</span>`).join('')}</div>`):''}
  ${langs.length&&!whid('languageRecords')?pfSec('إتقان اللغات (CEFR)',langs.map(l=>`<div class="cefr"><span class="lb">${esc(l.language)}</span>${cefrBar(l.reading)}<small>قراءة ${l.reading||'—'}</small>${cefrBar(l.writing)}<small>كتابة ${l.writing||'—'}</small>${cefrBar(l.speaking)}<small>محادثة ${l.speaking||'—'}</small></div>`).join('')):''}
  ${pricing.length&&!whid('pricing')?pfSec('الأسعار المرجعية',`<table class="tbl"><thead><tr><th>الخدمة</th><th>نمط العمل</th><th>سعر الساعة</th><th>سعر اليوم</th></tr></thead><tbody>${pricing.map(r=>`<tr><td>${esc(r.service)}</td><td>${esc(r.mode)}</td><td>${r.hour?'$'+r.hour:'—'}</td><td>${r.day?'$'+r.day:'—'}</td></tr>`).join('')}</tbody></table>`):''}
  <div class="card pf-sec mt" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <div style="flex:1;min-width:200px"><h3 style="margin:0">جاهز للتعاون؟</h3><p style="font-size:12px;color:var(--muted);margin-top:4px">اطلب خدمات هذا الخبير عبر منصة شبكة الخبراء العرب.</p></div>
    <button class="btn gold" onclick="go(21)">طلب خدمة ←</button>
    <button class="btn ghost" onclick="go(33)">تعديل الملف</button></div>`}
