/* =========================================================
   EIM 6.4 — البحث والنشر والفعاليات وإدارة المعرفة
   سجل موحد: مشروع بحثي ← مخرج منشور ← فعالية ← أصل معرفي
   ========================================================= */
const KNOWLEDGE_TYPES={
  research:{label:'مشروع بحثي',list:'researchProjects',prefix:'RES'},
  publication:{label:'منشور',list:'publications',prefix:'PUB'},
  event:{label:'فعالية',list:'events',prefix:'EVT'},
  asset:{label:'أصل معرفي',list:'assets',prefix:'KNO'},
  lesson:{label:'درس مستفاد',list:'lessons',prefix:'LES'}
};
const PUBLICATION_TYPES=['مقالة بحثية أصلية','مقالة مراجعة','تقرير حالة أو دراسة حالة','اتصال قصير أو ملاحظة موجزة','ورقة منهجية أو تقنية','مقالة منظورية أو تعليق','ورقة مؤتمر','رسالة علمية أو أطروحة','فصل كتاب أو كتاب محرر','نوع حديث أو متخصص'];
const EVENT_TYPES=['مؤتمر','ندوة','حلقة نقاش','ورشة معرفية','ملتقى خبراء','عرض بحثي','مجتمع ممارسة'];
const KNOWLEDGE_ASSET_TYPES=['دليل إجرائي','حالة تطبيقية','درس مستفاد','قالب أو أداة','تقرير فني','مجموعة بيانات','تسجيل معرفي','سؤال وجواب خبير'];
function knowledgeId(prefix){return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`}
function knowledgeOwner(){return G.user||'شبكة الخبراء العرب'}
function migrateKnowledge(){
  let k=G.knowledge=G.knowledge||{};['researchProjects','publications','events','assets','lessons','registrations'].forEach(x=>k[x]=Array.isArray(k[x])?k[x]:[]);
  k.filters=k.filters||{q:'',type:'all',status:'all'};k.draft=k.draft||null;k.activeId=k.activeId||'';
  if(!k.researchProjects.length)k.researchProjects.push(
    {id:'RES-2026-001',title:'جاهزية المؤسسات العربية لتطبيق الذكاء الاصطناعي',domain:'التقنيات الرقمية والذكاء الاصطناعي',lead:'د. ليلى النعيمي',partners:['مركز الابتكار المؤسسي'],status:'قيد التنفيذ',visibility:'عام',start:'2026-03-01',end:'2026-11-30',abstract:'دراسة تطبيقية لقياس الجاهزية المؤسسية وبناء خارطة انتقال قابلة للتنفيذ.',outputs:['PUB-2026-001'],createdAt:Date.now()-86400000*40}
  );
  if(!k.publications.length)k.publications.push(
    {id:'PUB-2026-001',title:'إطار قياس الجاهزية المؤسسية للذكاء الاصطناعي',publicationType:'ورقة منهجية أو تقنية',authors:['د. ليلى النعيمي','م. سامر الخطيب'],domain:'التقنيات الرقمية والذكاء الاصطناعي',language:'العربية',publishedAt:'2026-06-12',publisher:'شبكة الخبراء العرب',doi:'',license:'CC BY-NC 4.0',peerReview:'محكّم',status:'منشور',visibility:'عام',downloads:184,projectId:'RES-2026-001',summary:'إطار عملي متعدد الأبعاد لتقييم الجاهزية وتحديد أولويات التحول.',createdAt:Date.now()-86400000*25}
  );
  if(!k.events.length)k.events.push(
    {id:'EVT-2026-001',title:'ملتقى الخبراء: الذكاء الاصطناعي في إدارة المشاريع',eventType:'ملتقى خبراء',domain:'التقنيات الرقمية والذكاء الاصطناعي',start:'2026-09-18T09:00',end:'2026-09-18T14:00',mode:'هجين',country:'سلطنة عُمان',venue:'مسقط / عبر المنصة',capacity:150,status:'مفتوح للتسجيل',visibility:'عام',organizer:'شبكة الخبراء العرب',speakers:['د. ليلى النعيمي'],createdAt:Date.now()-86400000*5}
  );
  if(!k.assets.length)k.assets.push(
    {id:'KNO-2026-001',title:'قالب استخلاص الدروس المستفادة من المشاريع',assetType:'قالب أو أداة',domain:'إدارة المشاريع والبرامج',owner:'مكتب إدارة المعرفة',version:'1.0',status:'معتمد',visibility:'للأعضاء',reviewDate:'2027-01-15',tags:['دروس مستفادة','مشاريع'],summary:'قالب موحد لتسجيل السياق والقرار والنتيجة والتوصية وإعادة الاستخدام.',createdAt:Date.now()-86400000*20}
  );
}
function knowledgeAll(){
  migrateKnowledge();let k=G.knowledge;
  return[
    ...k.researchProjects.map(x=>({...x,kind:'research'})),
    ...k.publications.map(x=>({...x,kind:'publication'})),
    ...k.events.map(x=>({...x,kind:'event'})),
    ...k.assets.map(x=>({...x,kind:'asset'})),
    ...k.lessons.map(x=>({...x,kind:'lesson'}))
  ]
}
function knowledgeFind(id){return knowledgeAll().find(x=>x.id===id)}
function knowledgeCanManage(){return !!G.user&&['مدير / مشغل المنصة','باحث / أكاديمي','خبير مستقل','مدرب','مركز تدريب'].includes(G.ctx)}
function knowledgeNew(kind){
  let meta=KNOWLEDGE_TYPES[kind];if(!meta)return;
  G.knowledge.draft={kind,id:'',title:'',status:'مسودة',visibility:'خاص',domain:'',owner:knowledgeOwner(),createdAt:Date.now()};
  persist(true);go(104)
}
function knowledgeEdit(id){let row=knowledgeFind(id);if(!row)return;if(!knowledgeCanManage()){G.knowledge.activeId=id;persist(true);toast('السجل متاح للقراءة؛ يلزم حساب عضو لإدارة المحتوى');return}G.knowledge.draft=JSON.parse(JSON.stringify(row));persist(true);go(104)}
function knowledgeDraftSet(key,value){if(!G.knowledge.draft)return;G.knowledge.draft[key]=value;persist(true)}
function knowledgeSave(publish=false){
  let d=G.knowledge.draft;if(!d)return;
  if(!String(d.title||'').trim()||!String(d.domain||'').trim()){toast('أكمل العنوان والمجال قبل الحفظ');return}
  let meta=KNOWLEDGE_TYPES[d.kind],list=G.knowledge[meta.list],row={...d};
  row.id=row.id||knowledgeId(meta.prefix);row.updatedAt=Date.now();row.status=publish?(d.kind==='event'?'مفتوح للتسجيل':d.kind==='publication'?'منشور':'معتمد'):(row.status||'مسودة');
  let i=list.findIndex(x=>x.id===row.id);if(i>=0)list[i]=row;else list.unshift(row);
  G.knowledge.draft=null;G.knowledge.activeId=row.id;
  if(G.platformAdmin?.adminAudit)G.platformAdmin.adminAudit.unshift({eventId:knowledgeId('AUD'),domain:'المحتوى',action:i>=0?'تحديث سجل معرفي':'إنشاء سجل معرفي',actor:knowledgeOwner(),ref:row.id,risk:'منخفض',outcome:'ناجح',details:row.title,at:Date.now()});
  persist(true);go(row.kind==='event'?102:row.kind==='publication'?101:row.kind==='research'?100:103);toast('حُفظ السجل بنجاح')
}
function knowledgeRegister(id){
  migrateKnowledge();if(!G.user){go(65);toast('سجّل الدخول لإكمال التسجيل');return}
  if(G.knowledge.registrations.some(x=>x.eventId===id&&x.user===G.user)){toast('أنت مسجل في هذه الفعالية');return}
  G.knowledge.registrations.push({registrationId:knowledgeId('REG'),eventId:id,user:G.user,status:'مؤكد',registeredAt:Date.now()});persist(true);render();toast('تم التسجيل في الفعالية')
}
function knowledgeStatusClass(s){return /منشور|معتمد|مفتوح|مكتمل/.test(s||'')?'green':/مسودة|مراجعة|تنفيذ/.test(s||'')?'amber':'gray'}
function knowledgeHead(title,desc,actions=''){return pagehead({ctx:'المعرفة والبحث',title,desc},actions)}
function rKnowledgePublic(){
  migrateKnowledge();let k=G.knowledge,up=k.events.filter(x=>x.status==='مفتوح للتسجيل'),featured=k.publications.filter(x=>x.visibility==='عام'),assets=k.assets.filter(x=>x.visibility!=='خاص');
  return knowledgeHead('بوابة المعرفة والفعاليات','ابحث في البحوث والمنشورات والفعاليات والأدلة المهنية الموثوقة.',knowledgeCanManage()?'<button class="btn primary sm" onclick="go(100)">مساحة الإدارة</button>':'')+`
  <section class="knowledge-hero"><div><span class="kick">ARAB EXPERTS KNOWLEDGE</span><h2>معرفة عربية قابلة للاكتشاف وإعادة الاستخدام</h2><p>يربط السجل الموحد بين المشروع البحثي ومخرجاته ومؤلفيه وفعالياته وأصوله المعرفية.</p><div class="knowledge-search"><input class="ctl" placeholder="ابحث بعنوان أو مجال أو مؤلف…" oninput="G.knowledge.filters.q=this.value;persist(true)" value="${esc(k.filters.q||'')}"><button class="btn primary" onclick="render()">بحث</button></div></div><div class="knowledge-orbit"><b>${k.publications.length+k.assets.length}</b><span>أصل معرفي</span><small>${k.researchProjects.length} أبحاث · ${up.length} فعاليات قادمة</small></div></section>
  <div class="grid c4">${securityMetric('المشاريع البحثية',k.researchProjects.length,'blue')}${securityMetric('المنشورات',k.publications.length,'gold')}${securityMetric('الفعاليات القادمة',up.length,'green')}${securityMetric('الأدلة والأدوات',k.assets.length,'violet')}</div>
  <div class="grid c2 mt"><section class="card panel"><div class="casehead"><h3>منشورات مختارة</h3><button class="btn xs ghost" onclick="go(101)">عرض الكل</button></div>${featured.slice(0,4).map(x=>`<button class="knowledge-item" onclick="knowledgeEdit('${x.id}')"><span class="knowledge-type">منشور</span><b>${esc(x.title)}</b><small>${esc((x.authors||[]).join('، '))} · ${esc(x.publicationType)}</small></button>`).join('')||'<div class="empty">لا توجد منشورات عامة.</div>'}</section>
  <section class="card panel"><div class="casehead"><h3>فعاليات قادمة</h3><button class="btn xs ghost" onclick="go(102)">التقويم</button></div>${up.slice(0,4).map(x=>`<div class="event-row"><time>${esc((x.start||'').slice(0,10))}</time><div><b>${esc(x.title)}</b><small>${esc(x.mode)} · ${esc(x.country)}</small></div><button class="btn xs soft" onclick="knowledgeRegister('${x.id}')">تسجيل</button></div>`).join('')||'<div class="empty">لا توجد فعاليات مفتوحة.</div>'}</section></div>
  <section class="card panel mt"><div class="casehead"><h3>مكتبة الأدلة والأدوات</h3><button class="btn xs ghost" onclick="go(103)">فتح المكتبة</button></div><div class="knowledge-cards">${assets.slice(0,6).map(x=>`<article><span>${esc(x.assetType)}</span><h4>${esc(x.title)}</h4><p>${esc(x.summary||'')}</p><small>الإصدار ${esc(x.version||'1.0')} · ${esc(x.visibility)}</small></article>`).join('')}</div></section>`}
function rResearchRegistry(){
  migrateKnowledge();let rows=G.knowledge.researchProjects;
  return knowledgeHead('سجل المشاريع البحثية','إدارة المبادرة والشركاء والمنهجية والمخرجات وربطها بالمنشورات والأدلة.',`<button class="btn primary sm" onclick="knowledgeNew('research')">مشروع بحثي جديد</button>`)+
  knowledgeTable(rows,'research',['المشروع','القائد والشركاء','الفترة','الحالة','الإتاحة'])
}
function rPublicationRepository(){
  migrateKnowledge();let rows=G.knowledge.publications;
  return knowledgeHead('المستودع البحثي والنشر','سجل موحد للمؤلفين والتحكيم والحقوق والإصدارات والربط بالمشروع البحثي.',knowledgeCanManage()?`<button class="btn primary sm" onclick="knowledgeNew('publication')">إضافة منشور</button>`:'')+
  knowledgeTable(rows,'publication',['المنشور','النوع والمؤلفون','الناشر والتاريخ','الحالة','الإتاحة'])
}
function rEventsCalendar(){
  migrateKnowledge();let rows=G.knowledge.events;
  return knowledgeHead('الفعاليات والمجتمعات المهنية','تقويم موحد للمؤتمرات والندوات والورش ومجتمعات الممارسة مع التسجيل والحضور.',knowledgeCanManage()?`<button class="btn primary sm" onclick="knowledgeNew('event')">إنشاء فعالية</button>`:'')+
  knowledgeTable(rows,'event',['الفعالية','النوع والمجال','التاريخ والمكان','الحالة','السعة'])
}
function rKnowledgeLibrary(){
  migrateKnowledge();let rows=[...G.knowledge.assets,...G.knowledge.lessons];
  return knowledgeHead('مكتبة المعرفة المؤسسية','أدلة ودروس وقوالب وبيانات محكومة بالإصدار والمالك والمراجعة وحقوق الاستخدام.',`<button class="btn primary sm" onclick="knowledgeNew('asset')">إضافة أصل معرفي</button>`)+
  knowledgeTable(rows,'asset',['الأصل المعرفي','النوع والمجال','المالك والإصدار','الحالة','المراجعة'])
}
function knowledgeTable(rows,kind,heads){
  let q=(G.knowledge.filters.q||'').trim().toLowerCase(),filtered=rows.filter(x=>!q||JSON.stringify(x).toLowerCase().includes(q));
  return `<div class="card filterbar"><input class="ctl" placeholder="تصفية السجل…" value="${esc(G.knowledge.filters.q||'')}" oninput="G.knowledge.filters.q=this.value;persist(true)" onchange="render()"><span class="sp"></span><span class="tagb blue">${filtered.length} سجل</span></div>
  <div class="card panel"><div class="tablewrap"><table class="tbl"><thead><tr><th>الرقم</th>${heads.map(x=>`<th>${x}</th>`).join('')}<th></th></tr></thead><tbody>${filtered.map((x,i)=>knowledgeRow(x,kind,i)).join('')||`<tr><td colspan="${heads.length+2}">لا توجد سجلات مطابقة.</td></tr>`}</tbody></table></div></div>`}
function knowledgeRow(x,kind,i){
  if(kind==='research')return`<tr><td>${i+1}</td><td><b>${esc(x.title)}</b><small>${esc(x.id)} · ${esc(x.domain)}</small></td><td>${esc(x.lead||x.owner)}<small>${esc((x.partners||[]).join('، '))}</small></td><td>${esc(x.start||'—')}<small>${esc(x.end||'')}</small></td><td><span class="tagb ${knowledgeStatusClass(x.status)}">${esc(x.status)}</span></td><td>${esc(x.visibility)}</td><td><button class="btn xs ghost" onclick="knowledgeEdit('${x.id}')">فتح</button></td></tr>`;
  if(kind==='publication')return`<tr><td>${i+1}</td><td><b>${esc(x.title)}</b><small>${esc(x.id)} · ${esc(x.domain)}</small></td><td>${esc(x.publicationType)}<small>${esc((x.authors||[]).join('، '))}</small></td><td>${esc(x.publisher||'—')}<small>${esc(x.publishedAt||'')}</small></td><td><span class="tagb ${knowledgeStatusClass(x.status)}">${esc(x.status)}</span></td><td>${esc(x.visibility)}</td><td><button class="btn xs ghost" onclick="knowledgeEdit('${x.id}')">فتح</button></td></tr>`;
  if(kind==='event')return`<tr><td>${i+1}</td><td><b>${esc(x.title)}</b><small>${esc(x.id)} · ${esc(x.organizer)}</small></td><td>${esc(x.eventType)}<small>${esc(x.domain)}</small></td><td>${esc((x.start||'').replace('T',' '))}<small>${esc(x.mode)} · ${esc(x.venue||x.country)}</small></td><td><span class="tagb ${knowledgeStatusClass(x.status)}">${esc(x.status)}</span></td><td>${Number(x.capacity||0)}</td><td>${x.status==='مفتوح للتسجيل'?`<button class="btn xs soft" onclick="knowledgeRegister('${x.id}')">تسجيل</button>`:''}<button class="btn xs ghost" onclick="knowledgeEdit('${x.id}')">فتح</button></td></tr>`;
  return`<tr><td>${i+1}</td><td><b>${esc(x.title)}</b><small>${esc(x.id)} · ${esc(x.summary||'')}</small></td><td>${esc(x.assetType||'درس مستفاد')}<small>${esc(x.domain)}</small></td><td>${esc(x.owner)}<small>الإصدار ${esc(x.version||'1.0')}</small></td><td><span class="tagb ${knowledgeStatusClass(x.status)}">${esc(x.status)}</span></td><td>${esc(x.reviewDate||'—')}</td><td><button class="btn xs ghost" onclick="knowledgeEdit('${x.id}')">فتح</button></td></tr>`
}
function knowledgeOptions(list,value){return list.map(x=>`<option ${value===x?'selected':''}>${esc(x)}</option>`).join('')}
function rKnowledgeEditor(){
  migrateKnowledge();let d=G.knowledge.draft;if(!d)return knowledgeHead('محرر المعرفة','لم يُحدد سجل للتحرير.')+'<div class="empty">اختر سجلًا أو أنشئ سجلًا جديدًا.</div>';
  let typeOptions=d.kind==='publication'?PUBLICATION_TYPES:d.kind==='event'?EVENT_TYPES:d.kind==='asset'?KNOWLEDGE_ASSET_TYPES:[];
  return knowledgeHead(d.id?'تعديل '+KNOWLEDGE_TYPES[d.kind].label:'إنشاء '+KNOWLEDGE_TYPES[d.kind].label,'احفظ المسودة أو أرسلها للنشر وفق صلاحيات الدور وسياسة الإتاحة.')+`
  <div class="card formcard knowledge-editor"><div class="fields">
  <div class="field wide"><label>العنوان <em>*</em></label><input class="ctl" value="${esc(d.title||'')}" oninput="knowledgeDraftSet('title',this.value)"></div>
  <div class="field"><label>المجال <em>*</em></label><select class="ctl" onchange="knowledgeDraftSet('domain',this.value)"><option value="">اختر المجال</option>${Object.keys(TAX).map(x=>`<option ${d.domain===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
  ${typeOptions.length?`<div class="field"><label>${d.kind==='event'?'نوع الفعالية':d.kind==='publication'?'نوع المنشور':'نوع الأصل'}</label><select class="ctl" onchange="knowledgeDraftSet('${d.kind==='event'?'eventType':d.kind==='publication'?'publicationType':'assetType'}',this.value)"><option value="">اختر</option>${knowledgeOptions(typeOptions,d.eventType||d.publicationType||d.assetType)}</select></div>`:''}
  ${d.kind==='research'?`<div class="field"><label>قائد البحث</label><input class="ctl" value="${esc(d.lead||'')}" oninput="knowledgeDraftSet('lead',this.value)"></div><div class="field"><label>تاريخ البداية</label><input type="date" class="ctl" value="${esc(d.start||'')}" onchange="knowledgeDraftSet('start',this.value)"></div><div class="field"><label>تاريخ النهاية</label><input type="date" class="ctl" value="${esc(d.end||'')}" onchange="knowledgeDraftSet('end',this.value)"></div>`:''}
  ${d.kind==='publication'?`<div class="field wide"><label>المؤلفون (افصل بينهم بفاصلة)</label><input class="ctl" value="${esc((d.authors||[]).join('، '))}" oninput="knowledgeDraftSet('authors',this.value.split(/[,،]/).map(x=>x.trim()).filter(Boolean))"></div><div class="field"><label>الناشر</label><input class="ctl" value="${esc(d.publisher||'')}" oninput="knowledgeDraftSet('publisher',this.value)"></div><div class="field"><label>تاريخ النشر</label><input type="date" class="ctl" value="${esc(d.publishedAt||'')}" onchange="knowledgeDraftSet('publishedAt',this.value)"></div><div class="field"><label>التحكيم</label><select class="ctl" onchange="knowledgeDraftSet('peerReview',this.value)">${knowledgeOptions(['غير محكّم','مراجعة داخلية','محكّم'],d.peerReview)}</select></div><div class="field"><label>ترخيص الاستخدام</label><input class="ctl" value="${esc(d.license||'')}" oninput="knowledgeDraftSet('license',this.value)"></div>`:''}
  ${d.kind==='event'?`<div class="field"><label>البداية</label><input type="datetime-local" class="ctl" value="${esc(d.start||'')}" onchange="knowledgeDraftSet('start',this.value)"></div><div class="field"><label>النهاية</label><input type="datetime-local" class="ctl" value="${esc(d.end||'')}" onchange="knowledgeDraftSet('end',this.value)"></div><div class="field"><label>نمط التقديم</label><select class="ctl" onchange="knowledgeDraftSet('mode',this.value)">${knowledgeOptions(['حضوري','عن بعد','هجين'],d.mode)}</select></div><div class="field"><label>الدولة</label><select class="ctl" onchange="knowledgeDraftSet('country',this.value)"><option value="">اختر</option>${countries.map(x=>`<option ${d.country===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>المكان أو الرابط</label><input class="ctl" value="${esc(d.venue||'')}" oninput="knowledgeDraftSet('venue',this.value)"></div><div class="field"><label>الطاقة الاستيعابية</label><input type="number" min="1" step="1" class="ctl" value="${esc(d.capacity||'')}" oninput="knowledgeDraftSet('capacity',this.value)"></div>`:''}
  ${d.kind==='asset'?`<div class="field"><label>المالك المعرفي</label><input class="ctl" value="${esc(d.owner||'')}" oninput="knowledgeDraftSet('owner',this.value)"></div><div class="field"><label>الإصدار</label><input class="ctl" value="${esc(d.version||'1.0')}" oninput="knowledgeDraftSet('version',this.value)"></div><div class="field"><label>تاريخ المراجعة</label><input type="date" class="ctl" value="${esc(d.reviewDate||'')}" onchange="knowledgeDraftSet('reviewDate',this.value)"></div>`:''}
  <div class="field"><label>صلاحية العرض</label><select class="ctl" onchange="knowledgeDraftSet('visibility',this.value)">${knowledgeOptions(['عام','للأعضاء','خاص'],d.visibility)}</select></div>
  <div class="field wide"><label>الملخص</label><textarea class="ctl" rows="5" oninput="knowledgeDraftSet('${d.kind==='research'?'abstract':'summary'}',this.value)">${esc(d.abstract||d.summary||'')}</textarea></div>
  <div class="field wide"><label>المرفقات</label><label class="filebox"><input type="file" multiple style="display:none" onchange="knowledgeDraftSet('files',[...this.files].map(x=>x.name));render()"><b>رفع عدة مستندات</b><small>${esc((d.files||[]).join('، ')||'PDF، Word، صور، بيانات')}</small></label></div>
  </div><div class="wizfoot"><button class="btn ghost" onclick="goBack()">الصفحة السابقة</button><span class="sp"></span><button class="btn soft" onclick="knowledgeSave(false)">حفظ مسودة</button><button class="btn primary" onclick="knowledgeSave(true)">حفظ وإرسال للنشر</button></div></div>`}
