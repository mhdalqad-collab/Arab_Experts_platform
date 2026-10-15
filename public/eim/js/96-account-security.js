/* =========================================================
   استعادة الحساب والتحقق والحماية حسب الدور
   نموذج واجهة قابل للربط لاحقًا بمزود هوية وخدمة رسائل
   ========================================================= */
const SECURITY_ROLE_POLICIES={
  'عضو':{level:'أساسي',mfa:'اختياري',methods:['إيميل','تطبيق مصادقة'],sessionHours:168,stepUp:[]},
  'عميل مؤسسي':{level:'معزز',mfa:'مطلوب للمدير والمفوّض المالي',methods:['تطبيق مصادقة','إيميل','رسالة نصية'],sessionHours:24,stepUp:['اعتماد طلب','تغيير مفوض','إجراء مالي']},
  'متحقق':{level:'مرتفع',mfa:'إلزامي',methods:['تطبيق مصادقة','مفتاح أمان'],sessionHours:8,stepUp:['إصدار قرار تحقق','عرض دليل سري']},
  'مشغل مالي':{level:'مرتفع',mfa:'إلزامي',methods:['تطبيق مصادقة','مفتاح أمان'],sessionHours:4,stepUp:['استرداد مالي','تعديل فاتورة','تأكيد تحويل']},
  'مدير المنصة':{level:'حرج',mfa:'إلزامي مقاوم للتصيد',methods:['مفتاح أمان','تطبيق مصادقة'],sessionHours:2,stepUp:['تغيير صلاحيات','دمج كيانات','تعليق حساب','تصدير بيانات']}
};
function securityDefault(){
  return{mfaEnabled:false,mfaMethod:'',verifiedEmail:false,verifiedPhone:false,recoveryCodes:[],trustedDevices:[],sessions:[],events:[],recovery:null,loginFailures:0,lockedUntil:0,lastPasswordChange:0}
}
function securityId(prefix){return`${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`}
function securityNow(){return new Date().toISOString()}
function securityEvent(action,status='ناجح',risk='منخفض',details=''){
  G.security.events.unshift({eventId:securityId('SEC'),action,status,risk,details,at:securityNow(),ip:'—',device:'هذا الجهاز'});
  G.security.events=G.security.events.slice(0,100);persist(true)
}
function migrateSecurity(){
  G.security=Object.assign(securityDefault(),G.security||{});
  ['recoveryCodes','trustedDevices','sessions','events'].forEach(k=>G.security[k]=Array.isArray(G.security[k])?G.security[k]:[]);
  if(G.user&&!G.security.sessions.length)G.security.sessions.push({sessionId:securityId('SES'),device:'المتصفح الحالي',location:'سلطنة عُمان',lastSeen:securityNow(),current:true,status:'نشطة'});
  return G.security
}
function securityRole(){
  if(G.ctx==='مدير / مشغل المنصة'){
    let r=G.memberData?.['مدير / مشغل المنصة']?.operatorRole||'مدير المنصة';
    return r==='مسؤول مالي'?'مشغل مالي':'مدير المنصة'
  }
  if(G.ctx==='متحقق')return'متحقق';
  if(G.ctx==='عميل'){
    let institutional=G.clientType&&G.clientType!=='فردي مستقل';
    return institutional?'عميل مؤسسي':'عضو'
  }
  return'عضو'
}
function securityPolicy(){return SECURITY_ROLE_POLICIES[securityRole()]||SECURITY_ROLE_POLICIES['عضو']}
function securityNeedsStepUp(){let p=securityPolicy();return p.mfa.startsWith('إلزامي')&&!G.security.mfaEnabled}
function securityScore(){
  migrateSecurity();let s=25;
  if(G.security.verifiedEmail)s+=20;if(G.security.verifiedPhone)s+=10;if(G.security.mfaEnabled)s+=25;
  if(G.security.recoveryCodes.length)s+=10;if(G.security.lastPasswordChange)s+=10;
  return Math.min(s,100)
}
function securityLoginSuccess(){
  migrateSecurity();G.security.loginFailures=0;G.security.lockedUntil=0;
  let current=G.security.sessions.find(x=>x.current);
  if(current)current.lastSeen=securityNow();
  else G.security.sessions.unshift({sessionId:securityId('SES'),device:'المتصفح الحالي',location:'سلطنة عُمان',lastSeen:securityNow(),current:true,status:'نشطة'});
  securityEvent('تسجيل دخول','ناجح','منخفض','تم التحقق من بيانات الدخول')
}
function recoveryStart(){
  let email=($('recovery-email')?.value||'').trim().toLowerCase(),method=$('recovery-method')?.value||'إيميل';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('أدخل إيميلًا صحيحًا');return}
  G.security.recovery={requestId:securityId('REC'),email,method,status:'code_sent',expiresAt:Date.now()+10*60*1000,attempts:0,verified:false,createdAt:securityNow()};
  securityEvent('طلب استعادة حساب','مقبول','متوسط','أُرسل رمز مؤقت دون كشف وجود الحساب');
  persist(true);go(87);toast('إذا كانت البيانات مطابقة فسيصل رمز تحقق صالح لمدة 10 دقائق')
}
function recoveryVerify(){
  let r=G.security.recovery,code=($('recovery-code')?.value||'').replace(/\D/g,'');
  if(!r||r.expiresAt<Date.now()){toast('انتهت صلاحية طلب الاستعادة؛ ابدأ طلبًا جديدًا');go(84);return}
  r.attempts=(r.attempts||0)+1;
  if(code.length!==6){securityEvent('التحقق من رمز الاستعادة','فشل','متوسط','رمز غير مكتمل');toast('أدخل رمز التحقق المكوّن من 6 أرقام');return}
  if(r.attempts>5){G.security.lockedUntil=Date.now()+15*60*1000;securityEvent('قفل الاستعادة','محمي','مرتفع','تجاوز الحد المسموح للمحاولات');toast('تم إيقاف المحاولات مؤقتًا لحماية الحساب');return}
  r.verified=true;r.status='verified';securityEvent('التحقق من ملكية الحساب','ناجح','منخفض','تم اجتياز عامل الاستعادة');persist(true);render();toast('تم التحقق؛ عيّن كلمة مرور جديدة')
}
function passwordStrength(p){
  let checks=[p.length>=10,/[A-Z]/.test(p),/[a-z]/.test(p),/\d/.test(p),/[^\w\s]/.test(p)];
  return{score:checks.filter(Boolean).length,valid:checks.every(Boolean)}
}
function recoveryResetPassword(){
  let r=G.security.recovery,p=$('new-password')?.value||'',c=$('confirm-new-password')?.value||'',q=passwordStrength(p);
  if(!r?.verified){toast('أكمل التحقق أولًا');return}
  if(!q.valid){toast('استخدم 10 أحرف على الأقل تشمل حرفًا كبيرًا وصغيرًا ورقمًا ورمزًا');return}
  if(p!==c){toast('كلمتا المرور غير متطابقتين');return}
  G.security.lastPasswordChange=Date.now();G.security.recovery={...r,status:'completed',completedAt:securityNow()};
  G.security.sessions=[];G.security.trustedDevices=[];securityEvent('إعادة تعيين كلمة المرور','ناجح','منخفض','أُغلقت جميع الجلسات السابقة');
  persist(true);go(1);toast('تم تحديث كلمة المرور وإغلاق الجلسات السابقة')
}
function securityEnableMfa(){
  let method=$('mfa-method')?.value||'';
  if(!method){toast('اختر وسيلة التحقق');return}
  G.security.mfaEnabled=true;G.security.mfaMethod=method;
  if(!G.security.recoveryCodes.length)G.security.recoveryCodes=Array.from({length:8},()=>Math.random().toString(36).slice(2,8).toUpperCase());
  securityEvent('تفعيل التحقق متعدد العوامل','ناجح','منخفض',method);persist(true);render();toast('تم تفعيل التحقق متعدد العوامل')
}
function securityVerifyChannel(channel){
  if(channel==='email')G.security.verifiedEmail=true;else G.security.verifiedPhone=true;
  securityEvent('توثيق قناة اتصال','ناجح','منخفض',channel==='email'?'الإيميل':'الهاتف');persist(true);render()
}
function securityEndSession(id){
  let s=G.security.sessions.find(x=>x.sessionId===id);if(!s)return;
  if(s.current&&!confirm('إنهاء الجلسة الحالية سيعيدك إلى تسجيل الدخول. متابعة؟'))return;
  s.status='منتهية';s.endedAt=securityNow();securityEvent('إنهاء جلسة','ناجح','منخفض',s.device);
  if(s.current){G.user=null;persist(true);go(1)}else{persist(true);render()}
}
function securityEndOtherSessions(){
  G.security.sessions.forEach(x=>{if(!x.current&&x.status==='نشطة'){x.status='منتهية';x.endedAt=securityNow()}});
  securityEvent('إنهاء الجلسات الأخرى','ناجح','متوسط','بقرار صاحب الحساب');persist(true);render();toast('أُنهيت جميع الجلسات الأخرى')
}
function securitySimulateDevice(){
  G.security.sessions.push({sessionId:securityId('SES'),device:'هاتف Android',location:'دبي، الإمارات',lastSeen:securityNow(),current:false,status:'نشطة'});
  securityEvent('تسجيل دخول من جهاز جديد','ناجح','متوسط','هاتف Android');persist(true);render()
}
function securityMetric(title,value,cls=''){return`<div class="card metric ${cls}"><div class="k">${title}</div><div class="v">${value}</div></div>`}
function rAccountRecovery(){
  migrateSecurity();return`<div class="authwrap"><div class="card authcard security-auth">
    <button class="back-inline" onclick="go(1)">→ العودة للدخول</button>
    <div class="security-symbol">⌁</div><h1>استعادة الحساب</h1>
    <p>أدخل إيميل الحساب واختر وسيلة الاستعادة المتاحة. سنعرض الرسالة نفسها سواء كان الحساب موجودًا أم لا لحماية الخصوصية.</p>
    <div class="fields one"><div class="field"><label>إيميل الحساب <em>*</em></label><input id="recovery-email" class="ctl" type="email" autocomplete="email" placeholder="name@example.com"></div>
    <div class="field"><label>وسيلة الاستعادة</label><select id="recovery-method" class="ctl"><option>إيميل</option><option>رسالة نصية إلى الهاتف الموثق</option><option>رمز استعادة محفوظ</option></select></div></div>
    <button class="btn primary wide" onclick="recoveryStart()">إرسال رمز الاستعادة ←</button>
    <div class="security-note">لن يطلب فريق الشبكة كلمة المرور أو رمز التحقق منك عبر الهاتف أو الرسائل.</div>
  </div></div>`}
function rRecoveryVerification(){
  migrateSecurity();let r=G.security.recovery,verified=!!r?.verified;
  if(!r)return`<div class="card empty"><h2>لا يوجد طلب استعادة نشط</h2><p>ابدأ من شاشة استعادة الحساب.</p><button class="btn primary" onclick="go(84)">بدء الاستعادة</button></div>`;
  return`<div class="authwrap"><div class="card authcard security-auth">
    <button class="back-inline" onclick="go(84)">→ طلب جديد</button>
    <div class="recovery-steps"><span class="done">1. تعريف الحساب</span><span class="${verified?'done':'now'}">2. التحقق</span><span class="${verified?'now':''}">3. كلمة مرور جديدة</span></div>
    ${!verified?`<h1>أدخل رمز التحقق</h1><p>أرسلنا رمزًا مؤقتًا عبر ${esc(r.method)}. ينتهي خلال عشر دقائق ويسمح بخمس محاولات فقط.</p>
      <input id="recovery-code" class="ctl otp-input" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000">
      <button class="btn primary wide" onclick="recoveryVerify()">تحقق من الرمز</button>`
    :`<h1>عيّن كلمة مرور جديدة</h1><p>ستُغلق جميع الجلسات والأجهزة الموثوقة السابقة بعد نجاح التغيير.</p>
      <div class="fields one"><div class="field"><label>كلمة المرور الجديدة <em>*</em></label><input id="new-password" class="ctl" type="password" autocomplete="new-password"></div>
      <div class="field"><label>تأكيد كلمة المرور <em>*</em></label><input id="confirm-new-password" class="ctl" type="password" autocomplete="new-password"></div></div>
      <div class="password-rules">10 أحرف على الأقل · حرف كبير وصغير · رقم · رمز خاص</div>
      <button class="btn primary wide" onclick="recoveryResetPassword()">حفظ وإغلاق الجلسات السابقة</button>`}
  </div></div>`}
function rAccountSecurity(){
  migrateSecurity();let p=securityPolicy(),score=securityScore(),sessions=G.security.sessions.filter(x=>x.status==='نشطة'),events=G.security.events.slice(0,8);
  return pagehead({ctx:'الحساب والحماية',title:'أمان الحساب',desc:'إدارة وسائل التحقق والجلسات وخيارات الاستعادة وفق مستوى حماية دورك.'},
    `<span class="tagb ${p.level==='حرج'?'red':p.level==='مرتفع'?'amber':'green'}">حماية ${p.level}</span>`)+`
  <div class="security-score"><div>${ringSVG(score,44,7,'#1a8f63','#177455','var(--line)','security')}<b>${score}%</b></div><section><h2>مؤشر حماية الحساب</h2><p>الدور الحالي: <b>${securityRole()}</b> · التحقق المتعدد: <b>${p.mfa}</b> · مدة الجلسة القصوى: <b>${p.sessionHours} ساعة</b></p></section></div>
  <div class="grid c4">${securityMetric('الإيميل',G.security.verifiedEmail?'موثق':'غير موثق',G.security.verifiedEmail?'green':'amber')}${securityMetric('الهاتف',G.security.verifiedPhone?'موثق':'غير موثق',G.security.verifiedPhone?'green':'amber')}${securityMetric('التحقق المتعدد',G.security.mfaEnabled?'مفعّل':'غير مفعّل',G.security.mfaEnabled?'green':'red')}${securityMetric('جلسات نشطة',sessions.length,'blue')}</div>
  ${securityNeedsStepUp()?`<div class="statusband pending mt">${IC.shield} يتطلب دور «${securityRole()}» تفعيل تحقق متعدد العوامل قبل تنفيذ إجراءاته الحساسة.</div>`:''}
  <div class="grid c2 mt">
    <div class="card panel"><h3>وسائل التحقق <span class="line"></span></h3>
      <div class="security-row"><div><b>الإيميل</b><small>${esc(G.accountEmail||W.accountEmail||W.email||'لم يحدد')}</small></div>${G.security.verifiedEmail?'<span class="tagb green">موثق</span>':'<button class="btn xs soft" onclick="securityVerifyChannel(\'email\')">تحقق الآن</button>'}</div>
      <div class="security-row"><div><b>الهاتف</b><small>${esc(W.phone||'أضف هاتفك من بيانات العضوية')}</small></div>${G.security.verifiedPhone?'<span class="tagb green">موثق</span>':'<button class="btn xs soft" onclick="securityVerifyChannel(\'phone\')">تحقق الآن</button>'}</div>
      <div class="field mt"><label>التحقق متعدد العوامل</label><select id="mfa-method" class="ctl"><option value="">اختر الوسيلة…</option>${p.methods.map(x=>`<option ${G.security.mfaMethod===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <button class="btn ${G.security.mfaEnabled?'success':'primary'} sm mt" onclick="securityEnableMfa()">${G.security.mfaEnabled?'تحديث وسيلة التحقق':'تفعيل التحقق المتعدد'}</button>
      ${G.security.recoveryCodes.length?`<div class="security-note">رموز الاستعادة جاهزة: ${G.security.recoveryCodes.length}. خزّنها في مكان آمن، وكل رمز يستخدم مرة واحدة.</div>`:''}
    </div>
    <div class="card panel"><h3>السياسة حسب الدور <span class="line"></span></h3>
      <div class="policy-list"><div><span>مستوى الحماية</span><b>${p.level}</b></div><div><span>التحقق المتعدد</span><b>${p.mfa}</b></div><div><span>انتهاء الجلسة</span><b>${p.sessionHours} ساعة</b></div></div>
      <h4>إعادة التحقق قبل الإجراءات الحساسة</h4><div class="chips">${p.stepUp.length?p.stepUp.map(x=>`<span class="chip static">${x}</span>`).join(''):'<span class="hint">لا توجد إجراءات إضافية لهذا الدور.</span>'}</div>
      <button class="btn ghost sm mt" onclick="go(84)">بدء استعادة الحساب</button>
    </div>
  </div>
  <div class="card panel mt"><div class="casehead"><h3>الجلسات والأجهزة</h3><span class="sp"></span><button class="btn xs ghost" onclick="securitySimulateDevice()">إضافة جلسة تجريبية</button><button class="btn xs danger" onclick="securityEndOtherSessions()">إنهاء الجلسات الأخرى</button></div>
    <div class="session-list">${sessions.map(s=>`<div class="security-row"><div><b>${esc(s.device)} ${s.current?'<span class="tagb green">الحالية</span>':''}</b><small>${esc(s.location)} · آخر نشاط ${new Date(s.lastSeen).toLocaleString('ar')}</small></div><button class="btn xs ghost" onclick="securityEndSession('${s.sessionId}')">إنهاء</button></div>`).join('')||'<div class="empty">لا توجد جلسات نشطة.</div>'}</div>
  </div>
  <div class="card panel mt"><h3>سجل الأمان <span class="line"></span></h3><div class="tablewrap"><table class="tbl"><thead><tr><th>الحدث</th><th>الحالة</th><th>المخاطر</th><th>التاريخ</th></tr></thead><tbody>${events.map(e=>`<tr><td><b>${esc(e.action)}</b><small>${esc(e.details||'')}</small></td><td><span class="tagb ${e.status==='ناجح'?'green':e.status==='فشل'?'red':'amber'}">${esc(e.status)}</span></td><td>${esc(e.risk)}</td><td>${new Date(e.at).toLocaleString('ar')}</td></tr>`).join('')||'<tr><td colspan="4">لا توجد أحداث مسجلة.</td></tr>'}</tbody></table></div></div>`}
function rSecurityOperations(){
  migrateSecurity();let events=G.security.events,high=events.filter(x=>x.risk==='مرتفع').length,failed=events.filter(x=>x.status==='فشل').length;
  return pagehead({ctx:'إدارة المنصة',title:'مراقبة الحماية',desc:'رؤية تشغيلية للحوادث ومحاولات الدخول والحسابات المقفلة مع فصل الواجبات.'},
    `<button class="btn ghost sm" onclick="go(85)">أمان حسابي</button>`)+`
  <div class="grid c4">${securityMetric('أحداث اليوم',events.length,'blue')}${securityMetric('مخاطر مرتفعة',high,high?'red':'green')}${securityMetric('محاولات فاشلة',failed,failed?'amber':'green')}${securityMetric('حسابات مقفلة',G.security.lockedUntil>Date.now()?1:0,'amber')}</div>
  <div class="grid c2 mt"><div class="card panel"><h3>ضوابط محوكمة</h3>${[
    ['الاسترداد المالي','مصادقة إضافية + مسؤول مالي'],
    ['تغيير الصلاحيات','مصادقة إضافية + سجل تدقيق'],
    ['تعليق حساب','سبب إلزامي + إشعار المالك'],
    ['تصدير البيانات','نطاق محدد + موافقة مخولة']
  ].map(x=>`<div class="security-row"><b>${x[0]}</b><span class="tagb blue">${x[1]}</span></div>`).join('')}</div>
  <div class="card panel"><h3>سياسات الأدوار</h3>${Object.entries(SECURITY_ROLE_POLICIES).map(([r,p])=>`<div class="security-row"><div><b>${r}</b><small>جلسة ${p.sessionHours} ساعة</small></div><span class="tagb ${p.level==='حرج'?'red':p.level==='مرتفع'?'amber':'green'}">${p.level}</span></div>`).join('')}</div></div>
  <div class="card panel mt"><h3>الأحداث الأمنية القابلة للتدقيق</h3><div class="tablewrap"><table class="tbl"><thead><tr><th>المرجع</th><th>الحدث</th><th>النتيجة</th><th>المخاطر</th><th>الوقت</th></tr></thead><tbody>${events.map(e=>`<tr><td>${e.eventId}</td><td>${esc(e.action)}</td><td>${esc(e.status)}</td><td>${esc(e.risk)}</td><td>${new Date(e.at).toLocaleString('ar')}</td></tr>`).join('')||'<tr><td colspan="5">لا توجد أحداث بعد.</td></tr>'}</tbody></table></div></div>`}
