/* =========================================================
   EIM 6.4 — الحوكمة والصلاحيات والخصوصية والتكاملات
   تستكمل ولا تكرر: المشغلون 95، التدقيق 96، القضايا 97، السياسات 98
   ========================================================= */
const GOV_ROLES=['زائر','عضو مهني','باحث / أكاديمي','مركز تدريب','عميل','متحقق','مشغل المنصة','مدير المنصة'];
const GOV_PERMISSIONS=[
  ['public.read','عرض المحتوى العام','الموقع العام'],
  ['profile.manage','إدارة الملف والعضويات','العضويات'],
  ['knowledge.contribute','إضافة أصل معرفي','المعرفة'],
  ['research.manage','إدارة مشروع بحثي','المعرفة'],
  ['publication.submit','إرسال منشور للمراجعة','المعرفة'],
  ['publication.approve','اعتماد النشر','المعرفة'],
  ['event.manage','إنشاء وإدارة فعالية','الفعاليات'],
  ['client.need.manage','إدارة احتياجات العميل','العملاء'],
  ['matching.run','تشغيل المطابقة','المطابقة'],
  ['verification.decide','إصدار قرار تحقق','التحقق'],
  ['privacy.self.manage','إدارة خصوصية بياناته','الخصوصية'],
  ['privacy.override','عرض البيانات المقيدة بأمر نظامي','الخصوصية'],
  ['audit.read','قراءة سجل التدقيق','التدقيق'],
  ['audit.case.manage','إدارة قضايا التدقيق','التدقيق'],
  ['role.grant','منح الأدوار والصلاحيات','الحوكمة'],
  ['integration.manage','إدارة التكاملات','التكاملات']
];
const GOV_ROLE_DEFAULTS={
  'زائر':['public.read'],
  'عضو مهني':['public.read','profile.manage','knowledge.contribute','publication.submit','event.manage','privacy.self.manage'],
  'باحث / أكاديمي':['public.read','profile.manage','knowledge.contribute','research.manage','publication.submit','event.manage','privacy.self.manage'],
  'مركز تدريب':['public.read','profile.manage','knowledge.contribute','event.manage','privacy.self.manage'],
  'عميل':['public.read','profile.manage','client.need.manage','matching.run','privacy.self.manage'],
  'متحقق':['public.read','verification.decide','privacy.self.manage'],
  'مشغل المنصة':['public.read','publication.approve','audit.read','audit.case.manage','integration.manage','privacy.self.manage'],
  'مدير المنصة':GOV_PERMISSIONS.map(x=>x[0])
};
function governanceId(prefix){return `${prefix}-${String(Date.now()).slice(-9)}`}
function migrateGovernance(){
  let g=G.governance=G.governance||{};
  ['roles','permissions','grants','accessReviews','privacyPolicies','consents','integrations','syncRuns','changes'].forEach(x=>g[x]=Array.isArray(g[x])?g[x]:[]);
  if(!g.permissions.length)g.permissions=GOV_PERMISSIONS.map((x,i)=>({permissionId:x[0],name:x[1],domain:x[2],risk:/override|grant|approve|decide|integration/.test(x[0])?'مرتفع':'عادي',sort:i}));
  if(!g.roles.length)g.roles=GOV_ROLES.map((name,i)=>({roleId:`ROLE-${String(i+1).padStart(2,'0')}`,name,system:true,status:'نشط'}));
  if(!g.grants.length)Object.entries(GOV_ROLE_DEFAULTS).forEach(([role,perms])=>perms.forEach(permissionId=>g.grants.push({role,permissionId,source:'خط الأساس',grantedAt:Date.now()})));
  if(!g.privacyPolicies.length)g.privacyPolicies=[
    {policyId:'PRI-001',name:'إظهار المعلومات المسموحة فقط',scope:'الملفات العامة',retention:'مدة العضوية + 5 سنوات',legalBasis:'موافقة المستخدم وتنفيذ العقد',status:'نافذة',version:'1.0'},
    {policyId:'PRI-002',name:'البيانات المخفية لمدير المنصة فقط',scope:'التحقق والنزاعات',retention:'7 سنوات',legalBasis:'المصلحة المشروعة والامتثال',status:'نافذة',version:'1.0'}
  ];
  if(!g.integrations.length)g.integrations=[
    {integrationId:'INT-IDENTITY',name:'الهوية والتحقق',category:'هوية',direction:'ثنائي',status:'غير متصل',environment:'تجريبي',data:['معرف المستخدم','حالة التحقق'],lastSync:'',owner:'مسؤول الأمن'},
    {integrationId:'INT-PAYMENT',name:'بوابة الدفع',category:'مالية',direction:'صادر ووارد',status:'غير متصل',environment:'تجريبي',data:['الفاتورة','حالة الدفع','الاسترداد'],lastSync:'',owner:'الإدارة المالية'},
    {integrationId:'INT-MAIL',name:'البريد والإشعارات',category:'اتصال',direction:'صادر',status:'متصل',environment:'تجريبي',data:['الإيميل','قالب الرسالة'],lastSync:new Date().toISOString(),owner:'مشغل المنصة'},
    {integrationId:'INT-SEARCH',name:'فهرس البحث',category:'بحث',direction:'صادر',status:'متصل',environment:'تجريبي',data:['الملفات العامة','الدورات','المعرفة'],lastSync:new Date().toISOString(),owner:'مسؤول البيانات'}
  ];
  g.activeRole=g.activeRole||'عضو مهني';g.integrationDraft=g.integrationDraft||null;
}
function governanceIsAdmin(){return G.user&&G.ctx==='مدير / مشغل المنصة'}
function roleHas(role,permissionId){migrateGovernance();return G.governance.grants.some(x=>x.role===role&&x.permissionId===permissionId)}
function governanceChange(action,ref,details,risk='عادي'){
  let x={changeId:governanceId('CHG'),action,ref,details,risk,actor:G.user||'النظام',at:Date.now()};
  G.governance.changes.unshift(x);
  if(G.platformAdmin?.adminAudit)G.platformAdmin.adminAudit.unshift({eventId:x.changeId,domain:'الحوكمة',action,actor:x.actor,ref,risk:risk==='عالي'?'مرتفع':'منخفض',outcome:'ناجح',details,at:x.at})
}
function permissionToggle(role,permissionId){
  role=dec(role);
  if(!governanceIsAdmin()){toast('هذه العملية متاحة لمدير المنصة فقط');return}
  if(role==='مدير المنصة'&&permissionId==='role.grant'){toast('لا يمكن إزالة صلاحية إدارة الأدوار من مدير المنصة الأساسي');return}
  let i=G.governance.grants.findIndex(x=>x.role===role&&x.permissionId===permissionId);
  if(i>=0)G.governance.grants.splice(i,1);else G.governance.grants.push({role,permissionId,source:'تعديل إداري',grantedAt:Date.now(),grantedBy:G.user});
  governanceChange(i>=0?'سحب صلاحية':'منح صلاحية',role,permissionId,'عالي');persist(true);render();toast('حُفظ التغيير في سجل الحوكمة')
}
function privacyStats(){
  let all=0,hidden=0;
  Object.values(G.memberPrivacy||{}).forEach(o=>Object.values(o||{}).forEach(v=>{all++;if(v)hidden++}));
  Object.values(G.memberRecordPrivacy||{}).forEach(o=>Object.values(o||{}).forEach(v=>{all++;if(v)hidden++}));
  Object.values(W._private||{}).forEach(v=>{all++;if(v)hidden++});
  return{all,hidden,public:Math.max(0,all-hidden),score:all?Math.round((all-hidden)/all*100):100}
}
function privacyConsent(action){
  migrateGovernance();let existing=G.governance.consents.find(x=>x.user===(G.user||'زائر')&&x.purpose==='النشر العام');
  if(existing){existing.status=action;existing.updatedAt=Date.now()}else G.governance.consents.unshift({consentId:governanceId('CON'),user:G.user||'زائر',purpose:'النشر العام',status:action,createdAt:Date.now()});
  governanceChange('تحديث موافقة الخصوصية',G.user||'زائر',action);persist(true);render();toast('تم تحديث الموافقة')
}
function privacyExport(){
  let payload={generatedAt:new Date().toISOString(),user:G.user,memberships:G.memberships,memberData:G.memberData,privacy:{member:G.memberPrivacy,records:G.memberRecordPrivacy,expert:W._private},consents:G.governance.consents.filter(x=>x.user===G.user)};
  downloadBlob('EIM_personal_data.json',JSON.stringify(payload,null,2),'application/json');governanceChange('تصدير بيانات شخصي',G.user||'زائر','JSON');persist(true)
}
function integrationToggle(id){
  if(!governanceIsAdmin())return toast('هذه العملية متاحة لمدير المنصة فقط');
  let x=G.governance.integrations.find(z=>z.integrationId===id);if(!x)return;
  x.status=x.status==='متصل'?'موقوف':'متصل';x.updatedAt=Date.now();governanceChange('تغيير حالة تكامل',id,x.status,'عالي');persist(true);render()
}
function integrationSync(id){
  if(!governanceIsAdmin())return toast('هذه العملية متاحة لمدير المنصة فقط');
  let x=G.governance.integrations.find(z=>z.integrationId===id);if(!x||x.status!=='متصل')return toast('يجب تفعيل التكامل أولًا');
  let run={runId:governanceId('SYNC'),integrationId:id,status:'ناجح',records:Math.floor(Math.random()*40)+1,startedAt:Date.now(),finishedAt:Date.now()+500};
  G.governance.syncRuns.unshift(run);x.lastSync=new Date().toISOString();governanceChange('مزامنة يدوية',id,`${run.records} سجل`);persist(true);render();toast('اكتملت المزامنة التجريبية')
}
function governanceHead(title,desc,actions=''){return pagehead({ctx:'الحوكمة المؤسسية',title,desc},actions)}
function rGovernanceCenter(){
  migrateGovernance();let g=G.governance,high=g.permissions.filter(x=>x.risk==='مرتفع').length,connected=g.integrations.filter(x=>x.status==='متصل').length;
  return governanceHead('مركز الحوكمة والامتثال','نقطة قيادة موحدة للسياسات والأدوار والخصوصية والتدقيق والتكاملات دون تكرار سجلاتها الأصلية.')+`
  <section class="admin-command-hero"><div><span class="kick">GOVERNANCE CONTROL</span><h2>حوكمة مبنية على الدور والدليل</h2><p>كل قرار حساس مرتبط بصلاحية وموافقة وسجل تدقيق، مع فصل واضح بين مالك البيانات والمراجع والمشغل.</p></div><div class="admin-health"><b>${high}</b><small>صلاحيات مرتفعة الحساسية</small></div></section>
  <div class="grid c4">${securityMetric('الأدوار',g.roles.length,'blue')}${securityMetric('الصلاحيات',g.permissions.length,'gold')}${securityMetric('التكاملات المتصلة',connected,'green')}${securityMetric('أحداث الحوكمة',g.changes.length,'violet')}</div>
  <div class="governance-map mt">
    <button class="card quick" onclick="go(106)"><b>مصفوفة الأدوار والصلاحيات</b><small>RBAC، فصل الواجبات، التفويض والمراجعة</small></button>
    <button class="card quick" onclick="go(107)"><b>الخصوصية والموافقات</b><small>إتاحة الحقول، الموافقات، التصدير والاحتفاظ</small></button>
    <button class="card quick" onclick="go(108)"><b>التكاملات وتبادل البيانات</b><small>السجل، الاتجاه، المالك، الحالة والمزامنة</small></button>
    <button class="card quick" onclick="go(95)"><b>المشغلون والتفويض</b><small>تعيين المشغلين وكشف تعارض الصلاحيات</small></button>
    <button class="card quick" onclick="go(96)"><b>سجل التدقيق الموحد</b><small>الأحداث والمخاطر والتتبع والتصدير</small></button>
    <button class="card quick" onclick="go(98)"><b>السياسات وإدارة التغيير</b><small>الإصدارات والسريان والمراجعة والاعتماد</small></button>
  </div>
  <div class="grid c2 mt"><div class="card panel"><h3>مبادئ التحكم</h3>${['أقل صلاحية لازمة','فصل الصانع عن المراجع','تقييد البيانات حسب الغرض','أثر تدقيق غير قابل للمحو','مراجعة دورية للوصول','تعطيل آمن للتكاملات'].map(x=>`<div class="security-row"><b>${x}</b><span class="tagb green">مطبق في النموذج</span></div>`).join('')}</div>
  <div class="card panel"><h3>آخر تغييرات الحوكمة</h3>${g.changes.slice(0,6).map(x=>`<div class="security-row"><div><b>${esc(x.action)}</b><small>${esc(x.actor)} · ${new Date(x.at).toLocaleString('ar')}</small></div><span class="tagb ${x.risk==='عالي'?'amber':'gray'}">${esc(x.ref)}</span></div>`).join('')||'<div class="empty">لا توجد تغييرات مسجلة بعد.</div>'}</div></div>`}
function rRolePermissionMatrix(){
  migrateGovernance();let g=G.governance,roles=g.roles.map(x=>x.name);
  return governanceHead('مصفوفة الأدوار والصلاحيات','صلاحيات معيارية قابلة للمراجعة؛ التعديل الإداري يولد حدث تدقيق ولا يحذف السجل السابق.',`<button class="btn ghost sm" onclick="go(95)">المشغلون والتفويض</button>`)+`
  <div class="card panel"><div class="tablewrap"><table class="tbl permission-matrix"><thead><tr><th>الصلاحية</th>${roles.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${g.permissions.map(p=>`<tr><td><b>${esc(p.name)}</b><small>${esc(p.permissionId)} · ${esc(p.domain)}</small></td>${roles.map(role=>`<td><button class="perm-toggle ${roleHas(role,p.permissionId)?'on':''}" title="${esc(role+' — '+p.name)}" onclick="permissionToggle('${enc(role)}','${p.permissionId}')">${roleHas(role,p.permissionId)?'✓':'—'}</button></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>
  <div class="note mt">الصلاحيات الحساسة لا تُمنح عبر العضوية وحدها؛ يلزم تعيين إداري، وتُراجع دوريًا، وتظهر ضمن سجل التدقيق.</div>`}
function rPrivacyCenter(){
  migrateGovernance();let s=privacyStats(),cons=G.governance.consents.find(x=>x.user===G.user&&x.purpose==='النشر العام');
  return governanceHead('مركز الخصوصية والموافقات','تحكم العضو في إتاحة كل بيان، ومعرفة أثر الإعدادات، وتصدير بياناته ومراجعة موافقاته.',`<button class="btn ghost sm" onclick="privacyExport()">تصدير بياناتي</button>`)+`
  <div class="grid c2"><div class="privacy-score"><b>${s.score}%</b><span>من البيانات المصنفة متاح للعرض</span><small>${s.public} ظاهر · ${s.hidden} مخفي</small></div>
  <div class="card panel"><h3>موافقة النشر العام</h3><p>تتحكم هذه الموافقة في إنشاء الملف العام، بينما تبقى إعدادات الإخفاء لكل حقل هي المرجع الأعلى.</p><div class="statusband ${cons?.status==='موافق'?'success':'warning'}">${cons?.status==='موافق'?'الموافقة فعالة':'لا توجد موافقة فعالة للنشر العام'}</div><div class="table-actions mt"><button class="btn success" onclick="privacyConsent('موافق')">نعم، أوافق</button><button class="btn danger" onclick="privacyConsent('مسحوبة')">سحب الموافقة</button></div></div></div>
  <div class="grid c2 mt"><div class="card panel"><h3>ضوابط الإتاحة</h3>${G.governance.privacyPolicies.map(x=>`<div class="security-row"><div><b>${esc(x.name)}</b><small>${esc(x.scope)} · الاحتفاظ: ${esc(x.retention)}</small></div><span class="tagb green">${esc(x.status)}</span></div>`).join('')}</div>
  <div class="card panel"><h3>حقوق صاحب البيانات</h3>${[['الاطلاع والتصدير','تنزيل نسخة منظمة من البيانات والموافقات'],['التصحيح','تعديل البيانات من شاشة العضوية المصدر'],['تقييد الإتاحة','إخفاء كل حقل بصورة مستقلة'],['سحب الموافقة','إيقاف النشر دون حذف السجل المهني'],['الاعتراض أو الشكوى','فتح طلب مراجعة موثق']].map(x=>`<div class="security-row"><div><b>${x[0]}</b><small>${x[1]}</small></div><span>←</span></div>`).join('')}</div></div>
  <div class="note mt">لتغيير إتاحة حقل بعينه، افتح «بيانات العضوية» أو «وثائقي وأدلتي». تُستعاد القيم والإعدادات عند الرجوع للشاشة السابقة.</div>`}
function rIntegrationsRegistry(){
  migrateGovernance();let g=G.governance;
  return governanceHead('سجل التكاملات وتبادل البيانات','تعريف كل اتصال ومالكه واتجاهه وبياناته وحالته وسجل مزامناته قبل التنفيذ الخلفي الفعلي.')+`
  <div class="grid c4">${securityMetric('التكاملات',g.integrations.length,'blue')}${securityMetric('متصلة',g.integrations.filter(x=>x.status==='متصل').length,'green')}${securityMetric('موقوفة أو غير متصلة',g.integrations.filter(x=>x.status!=='متصل').length,'amber')}${securityMetric('عمليات المزامنة',g.syncRuns.length,'gold')}</div>
  <div class="grid c2 mt">${g.integrations.map(x=>`<div class="integration-card"><div class="integration-logo">${esc(x.category.slice(0,2))}</div><div><b>${esc(x.name)}</b><small>${esc(x.integrationId)} · ${esc(x.direction)} · المالك: ${esc(x.owner)}</small><small>البيانات: ${esc((x.data||[]).join('، '))}</small><small>آخر مزامنة: ${esc(x.lastSync?new Date(x.lastSync).toLocaleString('ar'):'لا توجد')}</small></div><div><span class="tagb ${x.status==='متصل'?'green':'gray'}">${esc(x.status)}</span><div class="table-actions mt"><button class="btn xs ghost" onclick="integrationToggle('${x.integrationId}')">${x.status==='متصل'?'إيقاف':'تفعيل'}</button><button class="btn xs soft" onclick="integrationSync('${x.integrationId}')">مزامنة</button></div></div></div>`).join('')}</div>
  <div class="card panel mt"><h3>سجل المزامنة</h3><div class="tablewrap"><table class="tbl"><thead><tr><th>المرجع</th><th>التكامل</th><th>البداية</th><th>السجلات</th><th>الحالة</th></tr></thead><tbody>${g.syncRuns.slice(0,20).map(x=>`<tr><td>${esc(x.runId)}</td><td>${esc(x.integrationId)}</td><td>${new Date(x.startedAt).toLocaleString('ar')}</td><td>${x.records}</td><td><span class="tagb green">${esc(x.status)}</span></td></tr>`).join('')||'<tr><td colspan="5">لا توجد عمليات مزامنة بعد.</td></tr>'}</tbody></table></div></div>
  <div class="note mt">هذه الواجهة تثبت عقد التكامل والحوكمة. الاتصال الحقيقي بمزود الهوية أو الدفع أو البريد يتم في المرحلة الخلفية باستخدام مفاتيح آمنة وسجلات تشغيلية.</div>`}
