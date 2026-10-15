/* =========================================================
   هيكل قاعدة البيانات والعلاقات — عرض مفاهيمي/منطقي للإدارة
   ========================================================= */
const DB_DOMAINS=[
  {id:'identity',name:'الهوية والحسابات',color:'#2563a7',entities:[
    ['account','حساب المستخدم','user_account',['PK account_id','email (UQ)','status','last_login_at']],
    ['party','الطرف الموحد','party',['PK party_id','party_type','display_name','country_code']],
    ['person','الشخص','person',['PK/FK party_id','name_ar','name_en','birth_date']],
    ['organization','المنظمة','organization',['PK/FK party_id','legal_name','legal_type','registration_no']],
    ['membership','العضوية','membership',['PK membership_id','FK party_id','membership_type','lifecycle_status']],
    ['access_role','دور الصلاحية','access_role',['PK role_id','role_code','scope']],
    ['account_role','إسناد الصلاحية','account_role',['PK account_role_id','FK account_id','FK role_id','FK party_id']]
  ]},
  {id:'professional',name:'الملف والخبرة المهنية',color:'#16815d',entities:[
    ['profile','الملف المهني','professional_profile',['PK profile_id','FK membership_id','headline','visibility']],
    ['pro_role','الدور المهني','professional_role',['PK professional_role_id','FK profile_id','FK taxonomy_node_id','status']],
    ['experience','الخبرة','experience',['PK experience_id','FK profile_id','organization_name','start_date','end_date']],
    ['qualification','المؤهل العلمي','qualification',['PK qualification_id','FK profile_id','degree','graduation_date']],
    ['credential','الاعتماد المهني','credential',['PK credential_id','FK profile_id','issuer','valid_until']],
    ['fingerprint','البصمة المهنية','professional_fingerprint',['PK fingerprint_id','FK profile_id','level','confidence_score']]
  ]},
  {id:'taxonomy',name:'التصنيفات والأنطولوجيا',color:'#7a43a8',entities:[
    ['taxonomy','عقدة التصنيف','taxonomy_node',['PK taxonomy_node_id','FK parent_node_id','node_type','code','name_ar']],
    ['practice','نوع العمل والممارسة','professional_practice',['PK practice_id','FK taxonomy_node_id','practice_name']],
    ['applied_area','المحتوى التفصيلي','applied_area',['PK applied_area_id','FK practice_id','description']],
    ['claim','ادعاء الخبرة','expertise_claim',['PK claim_id','FK fingerprint_id','FK applied_area_id','claim_level']]
  ]},
  {id:'evidence',name:'الأدلة والتحقق والجودة',color:'#b67b16',entities:[
    ['evidence','الدليل','evidence',['PK evidence_id','FK party_id','evidence_type','issued_at','confidentiality']],
    ['evidence_link','ربط الدليل','evidence_claim_link',['PK link_id','FK evidence_id','FK claim_id','support_strength']],
    ['verification','قضية التحقق','verification_case',['PK case_id','FK evidence_id','status','assigned_to']],
    ['decision','قرار التحقق','verification_decision',['PK decision_id','FK case_id','result','confidence','valid_until']],
    ['review','التقييم','review',['PK review_id','FK subject_party_id','FK service_request_id','rating']],
    ['complaint','الشكوى','complaint',['PK complaint_id','FK service_request_id','status','resolution']]
  ]},
  {id:'training',name:'التدريب والدورات',color:'#c05b3d',entities:[
    ['center','مركز التدريب','training_center',['PK center_id','FK membership_id','legal_name','verification_status']],
    ['course','الدورة الموحدة','course',['PK course_id','FK taxonomy_node_id','canonical_title','owner_party_id']],
    ['course_version','إصدار الدورة','course_version',['PK course_version_id','FK course_id','version_no','approval_status']],
    ['offering','طرح الدورة','course_offering',['PK offering_id','FK course_version_id','FK center_id','start_at','price']],
    ['trainer_assignment','إسناد المدرب','trainer_assignment',['PK assignment_id','FK offering_id','FK trainer_membership_id','role']],
    ['enrollment','التسجيل في الدورة','enrollment',['PK enrollment_id','FK offering_id','FK learner_party_id','status']]
  ]},
  {id:'client',name:'العملاء والاحتياجات والمطابقة',color:'#167c91',entities:[
    ['client_account','حساب العميل','client_account',['PK client_account_id','FK party_id','client_type','verification_status']],
    ['representative','ممثل العميل','client_representative',['PK representative_id','FK client_account_id','FK account_id','authority_scope']],
    ['need','احتياج العميل','client_need',['PK need_id','FK client_account_id','service_type','status','confidentiality']],
    ['task_fp','بصمة المهمة','task_fingerprint',['PK task_fingerprint_id','FK need_id','criteria_json','version_no']],
    ['match_run','تشغيل المطابقة','match_run',['PK match_run_id','FK task_fingerprint_id','weights_json','run_at']],
    ['candidate','مرشح المطابقة','match_candidate',['PK candidate_id','FK match_run_id','FK fingerprint_id','score','rank']],
    ['shortlist','القائمة المختصرة','shortlist_item',['PK shortlist_item_id','FK need_id','FK candidate_id','status']],
    ['service_request','طلب الخدمة','service_request',['PK service_request_id','FK need_id','FK selected_party_id','lifecycle_status']]
  ]},
  {id:'delivery',name:'العروض والعقود والتسليم المالي',color:'#4d647c',entities:[
    ['proposal','العرض','proposal',['PK proposal_id','FK service_request_id','FK provider_party_id','amount','status']],
    ['contract','العقد','contract',['PK contract_id','FK proposal_id','effective_from','effective_to','status']],
    ['project','المشروع','project',['PK project_id','FK contract_id','project_status','completion_pct']],
    ['deliverable','التسليم','deliverable',['PK deliverable_id','FK project_id','due_at','acceptance_status']],
    ['invoice','الفاتورة','invoice',['PK invoice_id','FK contract_id','amount','currency','status']],
    ['payment','الدفعة','payment',['PK payment_id','FK invoice_id','paid_amount','paid_at','reference_no']],
    ['subscription','الاشتراك','subscription',['PK subscription_id','FK party_id','package_code','period','status']]
  ]}
];
const DB_RELATIONSHIPS=[
  ['account','account_role','1:N','الحساب يمتلك أدوار صلاحية'],['access_role','account_role','1:N','الدور يُسند إلى حسابات'],
  ['party','person','1:0..1','الطرف قد يكون شخصًا'],['party','organization','1:0..1','الطرف قد يكون منظمة'],
  ['party','membership','1:N','الطرف يمتلك عضوية أو أكثر'],['membership','profile','1:0..1','العضوية المهنية تنشئ ملفًا'],
  ['profile','pro_role','1:N','الملف يتضمن أدوارًا مهنية'],['profile','experience','1:N','الملف يتضمن خبرات'],
  ['profile','qualification','1:N','الملف يتضمن مؤهلات'],['profile','credential','1:N','الملف يتضمن اعتمادات'],
  ['profile','fingerprint','1:N','الملف يمتلك محفظة بصمات'],['taxonomy','taxonomy','1:N','هيكل تصنيف هرمي'],
  ['taxonomy','practice','1:N','التخصص يتضمن ممارسات'],['practice','applied_area','1:N','الممارسة تتضمن محتوى تفصيليًا'],
  ['fingerprint','claim','1:N','البصمة تُبنى من ادعاءات'],['applied_area','claim','1:N','الادعاء يرتبط بممارسة دقيقة'],
  ['evidence','evidence_link','1:N','الدليل يدعم ادعاءات'],['claim','evidence_link','1:N','الادعاء تدعمه أدلة'],
  ['evidence','verification','1:N','الدليل يدخل قضايا تحقق'],['verification','decision','1:1..N','القضية تنتج قرارًا'],
  ['membership','center','1:0..1','عضوية المركز تنشئ مركزًا'],['taxonomy','course','1:N','الدورة تقع ضمن التصنيف'],
  ['course','course_version','1:N','للدورة إصدارات'],['course_version','offering','1:N','الإصدار له طروحات'],
  ['center','offering','1:N','المركز يقدم طروحات'],['offering','trainer_assignment','1:N','الطرح يرتبط بمدربين'],
  ['offering','enrollment','1:N','الطرح يستقبل تسجيلات'],['party','client_account','1:0..N','الطرف قد يمتلك حساب عميل'],
  ['client_account','representative','1:N','للعميل ممثلون'],['client_account','need','1:N','للعميل احتياجات'],
  ['need','task_fp','1:N','الاحتياج له نسخ بصمة مهمة'],['task_fp','match_run','1:N','البصمة تشغل المطابقة'],
  ['match_run','candidate','1:N','التشغيل ينتج مرشحين'],['fingerprint','candidate','1:N','المرشح مبني على بصمة'],
  ['need','shortlist','1:N','الاحتياج له قائمة مختصرة'],['need','service_request','1:N','الاحتياج ينتج طلب خدمة'],
  ['service_request','proposal','1:N','الطلب يستقبل عروضًا'],['proposal','contract','1:0..1','العرض المقبول ينشئ عقدًا'],
  ['contract','project','1:N','العقد ينفذ عبر مشروع'],['project','deliverable','1:N','المشروع له تسليمات'],
  ['contract','invoice','1:N','العقد يصدر فواتير'],['invoice','payment','1:N','الفاتورة تُسدد بدفعات'],
  ['party','subscription','1:N','الطرف يمتلك اشتراكات'],['service_request','review','1:N','الطلب يقبل تقييمات'],
  ['service_request','complaint','1:N','الطلب قد يرتبط بشكاوى']
];
function dbEntity(id){for(const d of DB_DOMAINS){let e=d.entities.find(x=>x[0]===id);if(e)return{domain:d,...{id:e[0],name:e[1],table:e[2],fields:e[3]}}}}
function dbConnected(id){let s=new Set([id]);DB_RELATIONSHIPS.forEach(r=>{if(r[0]===id)s.add(r[1]);if(r[1]===id)s.add(r[0])});return s}
function setDbDomain(id){G.dbDomain=id;G.dbEntity='';persist(true);render()}
function selectDbEntity(id){G.dbEntity=G.dbEntity===id?'':id;persist(true);render()}
function drawDbLinks(){
  let stage=$('db-stage'),svg=$('db-links');if(!stage||!svg)return;
  let sr=stage.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${stage.scrollWidth} ${stage.scrollHeight}`);
  let selected=G.dbEntity||'',rels=DB_RELATIONSHIPS.filter(r=>(!selected||r[0]===selected||r[1]===selected));
  svg.innerHTML=`<defs><marker id="db-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>`+rels.map(r=>{
    let a=stage.querySelector(`[data-db-entity="${r[0]}"]`),b=stage.querySelector(`[data-db-entity="${r[1]}"]`);if(!a||!b)return'';
    let A=a.getBoundingClientRect(),B=b.getBoundingClientRect(),x1=A.left-sr.left+stage.scrollLeft+A.width/2,y1=A.top-sr.top+stage.scrollTop+A.height/2,x2=B.left-sr.left+stage.scrollLeft+B.width/2,y2=B.top-sr.top+stage.scrollTop+B.height/2,m=(x1+x2)/2;
    return `<path d="M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}" marker-end="url(#db-arrow)"/>`
  }).join('')
}
function rDatabaseERD(){
  let domain=G.dbDomain||'all',selected=G.dbEntity||'',connected=selected?dbConnected(selected):new Set(),domains=domain==='all'?DB_DOMAINS:DB_DOMAINS.filter(d=>d.id===domain);
  setTimeout(drawDbLinks,0);
  let entityCount=DB_DOMAINS.reduce((n,d)=>n+d.entities.length,0),filteredRels=DB_RELATIONSHIPS.filter(r=>domain==='all'||domains[0].entities.some(e=>e[0]===r[0]||e[0]===r[1]));
  return pagehead({ctx:'إدارة المنصة',title:'هيكل قاعدة البيانات وعلاقاتها',desc:'نموذج مفاهيمي ومنطقي موحد لبيانات EIM؛ اضغط على أي كيان لإبراز علاقاته.'},
    `<button class="btn ghost sm" onclick="G.dbEntity='';G.dbDomain='all';persist(true);render()">إعادة ضبط العرض</button>`)+`
    <div class="grid c4 db-kpis">
      <div class="card metric blue"><div class="k">مجالات البيانات</div><div class="v">${DB_DOMAINS.length}</div><div class="hint">حدود واضحة للملكية</div></div>
      <div class="card metric green"><div class="k">الكيانات المنطقية</div><div class="v">${entityCount}</div><div class="hint">جداول أساسية ورابطة</div></div>
      <div class="card metric amber"><div class="k">العلاقات الموثقة</div><div class="v">${DB_RELATIONSHIPS.length}</div><div class="hint">واحد لواحد وواحد لمتعدد</div></div>
      <div class="card metric violet"><div class="k">المبدأ الحاكم</div><div class="v" style="font-size:18px">Party</div><div class="hint">هوية موحدة دون تكرار</div></div>
    </div>
    <div class="card db-toolbar" role="toolbar" aria-label="تصفية مخطط البيانات">
      <b>نطاق العرض</b>${[['all','المخطط الكامل'],...DB_DOMAINS.map(d=>[d.id,d.name])].map(x=>`<button class="${domain===x[0]?'on':''}" onclick="setDbDomain('${x[0]}')">${esc(x[1])}</button>`).join('')}
      <span class="sp"></span><span class="db-legend"><i class="pk">PK</i> مفتاح أساسي <i class="fk">FK</i> مفتاح خارجي</span>
    </div>
    <div class="db-stage-wrap"><div class="db-stage" id="db-stage"><svg class="db-links" id="db-links" aria-hidden="true"></svg>
      ${domains.map(d=>`<section class="db-domain" style="--db-color:${d.color}"><header><span></span><b>${esc(d.name)}</b><small>${d.entities.length} كيانات</small></header><div class="db-entities">
        ${d.entities.map(e=>{let active=selected===e[0],dim=selected&&!connected.has(e[0]);return`<button class="db-entity ${active?'selected':''} ${dim?'dim':''}" data-db-entity="${e[0]}" onclick="selectDbEntity('${e[0]}')">
          <span class="db-table">${esc(e[2])}</span><b>${esc(e[1])}</b><ul>${e[3].map(f=>`<li class="${f.startsWith('PK')?'key':f.startsWith('FK')||f.includes('/FK')?'foreign':''}">${esc(f)}</li>`).join('')}</ul></button>`}).join('')}
      </div></section>`).join('')}
    </div></div>
    <div class="grid c2 mt">
      <section class="card panel"><h3>${selected?'علاقات الكيان المحدد':'سجل العلاقات'} <span class="line"></span></h3>
        <div class="db-rel-list">${filteredRels.filter(r=>!selected||r[0]===selected||r[1]===selected).map(r=>{let a=dbEntity(r[0]),b=dbEntity(r[1]);return`<button onclick="selectDbEntity('${r[0]===selected?r[1]:r[0]}')"><span>${esc(a.name)}</span><i>${esc(r[2])}</i><span>${esc(b.name)}</span><small>${esc(r[3])}</small></button>`}).join('')||'<div class="empty"><b>لا توجد علاقة ضمن هذا النطاق</b></div>'}</div>
      </section>
      <section class="card panel"><h3>قواعد التصميم الحاكمة <span class="line"></span></h3>
        <div class="db-rules">
          <div><b>1</b><span><strong>طرف واحد وهوية واحدة</strong><small>الشخص أو المنظمة يُحفظ مرة واحدة في Party، وتُربط به جميع العضويات.</small></span></div>
          <div><b>2</b><span><strong>فصل الدورة عن الطرح</strong><small>Course تعريف موحد؛ أما الموعد والمدرب والسعر فتُحفظ في Course Offering.</small></span></div>
          <div><b>3</b><span><strong>الأدلة لا تُنسخ</strong><small>الدليل يُسجل مرة ويرتبط بالادعاءات عبر جدول رابط قابل للتدقيق.</small></span></div>
          <div><b>4</b><span><strong>الإصدارات لا تستبدل التاريخ</strong><small>الدورات والبصمات والقرارات تحتفظ بإصداراتها وسجل انتقالاتها.</small></span></div>
          <div><b>5</b><span><strong>الخصوصية على مستوى البيان</strong><small>صلاحية العرض ترتبط بالسجل والحقل والسياق، وليس بالصفحة فقط.</small></span></div>
        </div>
      </section>
    </div>
    <div class="note mt">هذا مخطط منطقي مرجعي للمنصة. عند بناء الـBackend يُحوّل إلى DDL فعلي مع القيود والفهارس وسياسات الحذف والأرشفة وسجل التدقيق.</div>`
}
window.addEventListener('resize',()=>{if(current===79)drawDbLinks()});
