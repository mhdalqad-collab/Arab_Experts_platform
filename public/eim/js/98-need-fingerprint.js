/* =========================================================
   بصمة الاحتياج — توصيف المهمة، الحوكمة، الأوزان، والإصدارات
   ========================================================= */
const NEED_COMPLEXITY=['محدود وواضح','متوسط متعدد العناصر','معقد متعدد الأطراف','تحولي عالي التعقيد'];
const NEED_URGENCY=['اعتيادي','مهم','عاجل','حرج زمنيًا'];
const NEED_AUTONOMY=['تنفيذ تحت إشراف العميل','مسؤولية جزئية مشتركة','استقلالية تنفيذية ضمن الحوكمة','مسؤولية كاملة عن النتيجة'];
const NEED_TEAM_MODE=['خبير واحد','خبير رئيسي مع دعم','فريق خبراء متعدد التخصصات','مركز أو مؤسسة متكاملة'];
const NEED_EVIDENCE_TYPES=['مؤهل علمي','اعتماد مهني','خبرة موثقة مماثلة','نتائج قابلة للتحقق','مرجع عميل سابق','نماذج أعمال','مقابلة فنية','اختبار أو مهمة قصيرة'];
const NEED_ACCEPTANCE_TYPES=['اعتماد وثيقة','تحقق مؤشر كمي','اجتياز مراجعة فنية','قبول مرحلي','تجربة مستخدم أو مستفيد','مطابقة مواصفة أو معيار','نقل معرفة وتسليم ملفات المصدر'];
const NEED_RISK_LEVELS=['منخفض','متوسط','عالٍ','حرج'];
const DEFAULT_NEED_WEIGHTS={specialty:25,practice:15,sector:10,evidence:10,experience:10,language:5,country:5,availability:5,price:5,rating:10};
function needFpId(){return'FP-NEED-'+Date.now().toString(36).toUpperCase()}
function needFingerprintSeed(n){
  return{fingerprintId:needFpId(),needId:n.needId,version:1,status:'مسودة',purpose:n.target||'',businessOutcome:n.target||'',successMeasures:'',scopeIncluded:n.projectScope||n.studyQuestions||n.productRequirements||n.decisionQuestion||'',scopeExcluded:'',deliverables:n.advisoryDeliverable||n.outputFormat||'',main:n.main||'',sub:n.sub||'',practice:n.practice||'',role:n.role||'',complexity:'متوسط متعدد العناصر',urgency:'اعتيادي',autonomy:'مسؤولية جزئية مشتركة',teamMode:'خبير واحد',stakeholders:'',dependencies:'',riskLevel:'متوسط',constraints:'',acceptanceCriteria:[],requiredEvidence:['خبرة موثقة مماثلة','نتائج قابلة للتحقق'],minimumExperience:0,minimumRating:0,verifiedOnly:false,mandatory:[...(n.mandatory||['specialty'])],preferred:[...(n.preferred||MATCH_CRITERIA.map(x=>x[0]))],weights:{...DEFAULT_NEED_WEIGHTS,...(G.matchingWeights||{})},versions:[],history:[{action:'إنشاء البصمة',at:Date.now(),actor:G.user||'العميل'}],createdAt:Date.now(),updatedAt:Date.now()}
}
function migrateNeedFingerprints(){
  G.needFingerprints=G.needFingerprints||{};
  (G.clientNeeds||[]).forEach(n=>{
    let fp=G.needFingerprints[n.needId];
    if(!fp)fp=G.needFingerprints[n.needId]=needFingerprintSeed(n);
    fp.weights={...DEFAULT_NEED_WEIGHTS,...(fp.weights||{})};fp.mandatory=Array.isArray(fp.mandatory)?fp.mandatory:[...(n.mandatory||['specialty'])];fp.preferred=Array.isArray(fp.preferred)?fp.preferred:MATCH_CRITERIA.map(x=>x[0]);
    fp.requiredEvidence=Array.isArray(fp.requiredEvidence)?fp.requiredEvidence:[];fp.acceptanceCriteria=Array.isArray(fp.acceptanceCriteria)?fp.acceptanceCriteria:[];fp.versions=Array.isArray(fp.versions)?fp.versions:[];fp.history=Array.isArray(fp.history)?fp.history:[];
  });
  return G.needFingerprints
}
function needFingerprint(id=G.activeNeedId){
  if(!id)return null;let n=G.clientNeeds.find(x=>x.needId===id);if(!n)return null;
  G.needFingerprints=G.needFingerprints||{};let fp=G.needFingerprints[id]||(G.needFingerprints[id]=needFingerprintSeed(n));
  if(id===G.activeNeedId)G.matchingWeights={...fp.weights};return fp
}
function needFingerprintSnapshot(fp=needFingerprint()){
  if(!fp)return null;let x=JSON.parse(JSON.stringify(fp));delete x.versions;return x
}
function needFpSet(k,v){
  let fp=needFingerprint();if(!fp)return;fp[k]=v;fp.status='مسودة';fp.updatedAt=Date.now();persist(true)
}
function needFpToggle(k,v,on){
  v=dec(v);let fp=needFingerprint();if(!fp)return;fp[k]=Array.isArray(fp[k])?fp[k]:[];let i=fp[k].indexOf(v);if(on&&i<0)fp[k].push(v);if(!on&&i>=0)fp[k].splice(i,1);fp.status='مسودة';fp.updatedAt=Date.now();persist(true)
}
function needFingerprintCompleteness(fp=needFingerprint()){
  if(!fp)return{pct:0,sections:[]};let sections=[
    ['النتيجة',!!fp.businessOutcome&&!!fp.successMeasures],
    ['النطاق',!!fp.scopeIncluded&&!!fp.scopeExcluded],
    ['التصنيف',!!fp.main&&!!fp.sub&&!!fp.practice],
    ['السياق',!!fp.complexity&&!!fp.urgency&&!!fp.autonomy&&!!fp.teamMode],
    ['القبول',fp.acceptanceCriteria.length>0],
    ['الأدلة',fp.requiredEvidence.length>0],
    ['المطابقة',fp.mandatory.length>0&&Object.values(fp.weights).reduce((a,b)=>a+Number(b||0),0)===100]
  ];return{pct:Math.round(sections.filter(x=>x[1]).length/sections.length*100),sections}
}
function needFingerprintIssues(fp=needFingerprint()){
  if(!fp)return['لا توجد بصمة احتياج'];
  let a=[];if(!fp.businessOutcome?.trim())a.push('حدد النتيجة المؤسسية المطلوبة');if(!fp.successMeasures?.trim())a.push('حدد مؤشرات نجاح قابلة للقياس');
  if(!fp.scopeIncluded?.trim())a.push('حدد ما يشمله نطاق المهمة');if(!fp.scopeExcluded?.trim())a.push('حدد ما لا يشمله النطاق');
  if(!fp.main||!fp.sub||!fp.practice)a.push('أكمل التصنيف المهني حتى مستوى الممارسة');
  if(!fp.acceptanceCriteria.length)a.push('حدد معيار قبول واحدًا على الأقل');if(!fp.requiredEvidence.length)a.push('حدد دليل أهلية واحدًا على الأقل');
  if(!fp.mandatory.length)a.push('حدد شرط مطابقة إلزاميًا واحدًا على الأقل');if(Object.values(fp.weights).reduce((a,b)=>a+Number(b||0),0)!==100)a.push('مجموع أوزان المطابقة لا يساوي 100%');
  return a
}
function approveNeedFingerprint(){
  let fp=needFingerprint();if(!fp||needFingerprintIssues(fp).length)return false;
  let snap=needFingerprintSnapshot(fp),same=fp.versions.some(v=>JSON.stringify(v.snapshot)===JSON.stringify(snap));
  if(!same){fp.versions.push({version:fp.version,status:'معتمدة',snapshot:snap,approvedAt:Date.now(),approvedBy:G.user||'العميل'});fp.history.push({action:'اعتماد الإصدار '+fp.version,at:Date.now(),actor:G.user||'العميل'})}
  fp.status='معتمدة';fp.approvedAt=Date.now();fp.approvedBy=G.user||'العميل';persist(true);return true
}
function reviseNeedFingerprint(){
  let fp=needFingerprint();if(!fp)return;if(fp.status==='مسودة'){toast('البصمة في وضع المسودة بالفعل');return}
  fp.version=Number(fp.version||1)+1;fp.status='مسودة';fp.approvedAt=null;fp.history.push({action:'بدء إصدار '+fp.version,at:Date.now(),actor:G.user||'العميل'});persist(true);render();toast('بدأ إصدار جديد مع حفظ الإصدار المعتمد السابق')
}
function restoreNeedFingerprintVersion(i){
  let fp=needFingerprint(),v=fp?.versions?.[i];if(!fp||!v)return;
  let keep={versions:fp.versions,history:fp.history,fingerprintId:fp.fingerprintId,needId:fp.needId};
  Object.assign(fp,JSON.parse(JSON.stringify(v.snapshot)),keep,{version:Number(fp.version||1)+1,status:'مسودة',approvedAt:null,updatedAt:Date.now()});
  fp.history.push({action:'إنشاء مسودة من الإصدار '+v.version,at:Date.now(),actor:G.user||'العميل'});G.matchingWeights={...fp.weights};persist(true);render();toast('أُنشئت مسودة جديدة من الإصدار المحدد دون حذف الإصدارات')
}
function needFpPillGroup(key,values){
  let fp=needFingerprint();return`<div class="fingerprint-options">${values.map(x=>`<label class="fp-check ${(fp[key]||[]).includes(x)?'selected':''}"><input type="checkbox" ${(fp[key]||[]).includes(x)?'checked':''} onchange="needFpToggle('${key}','${enc(x)}',this.checked);render()"> ${esc(x)}</label>`).join('')}</div>`
}
function needFpSelect(label,key,values){
  let fp=needFingerprint();return`<div class="field"><label>${label}</label><select class="ctl" onchange="needFpSet('${key}',this.value);render()">${values.map(x=>`<option ${fp[key]===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>`
}
function renderNeedFingerprint(){
  migrateNeedFingerprints();let n=activeNeed(),fp=needFingerprint();if(!n||!fp)return pagehead(data[23])+`<div class="card empty"><b>لا يوجد احتياج نشط</b><button class="btn primary sm mt" onclick="go(20)">سجل الاحتياجات ←</button></div>`;
  let c=needFingerprintCompleteness(fp),mains=Object.keys(TAX),subs=fp.main?Object.keys(TAX[fp.main]||{}):[],practices=fp.main&&fp.sub?(TAX[fp.main][fp.sub]||[]):[],issues=needFingerprintIssues(fp);
  return pagehead({ctx:'إدارة العملاء',title:'بصمة الاحتياج',desc:'وصف معياري للمهمة يحوّل حاجة العميل إلى شروط أهلية وقياس ومطابقة قابلة للتفسير.'},
    `<span class="tagb ${fp.status==='معتمدة'?'green':'amber'}">الإصدار ${fp.version} · ${fp.status}</span><button class="btn ghost sm" onclick="go(22)">الصفحة السابقة</button><button class="btn primary sm" onclick="go(24)">فحص الجاهزية ←</button>`)+`
  <section class="need-fp-hero"><div><span class="kick">NEED FINGERPRINT</span><h2>${esc(n.title)}</h2><p>${esc(NEED_OUTPUT_LABEL[n.outputType]||'مخرج غير محدد')} · ${esc(n.service||'—')} · ${esc(n.clientAccountId||'')}</p></div><div class="fp-complete"><b>${c.pct}%</b><small>اكتمال البصمة</small></div></section>
  <div class="fp-section-nav">${c.sections.map((x,i)=>`<span class="${x[1]?'done':''}">${i+1}. ${x[0]}</span>`).join('')}</div>
  <div class="card formcard mt"><div class="fp-title"><span>1</span><div><h3>الغاية والنتيجة</h3><p>ما التغيير الذي ينبغي أن تصنعه المهمة؟ وكيف نعرف أنها نجحت؟</p></div></div><div class="fields">
    <div class="field wide"><label>النتيجة المؤسسية المطلوبة <em>*</em></label><textarea class="ctl" rows="3" oninput="needFpSet('businessOutcome',this.value)">${esc(fp.businessOutcome||'')}</textarea></div>
    <div class="field wide"><label>مؤشرات النجاح القابلة للقياس <em>*</em></label><textarea class="ctl" rows="3" placeholder="مثال: اعتماد الخارطة؛ خفض زمن العملية 20%؛ تدريب 15 موظفًا…" oninput="needFpSet('successMeasures',this.value)">${esc(fp.successMeasures||'')}</textarea></div>
  </div></div>
  <div class="card formcard mt"><div class="fp-title"><span>2</span><div><h3>النطاق والتسليمات</h3><p>فصل ما يدخل في المهمة عما يقع خارجها يمنع تضخم النطاق.</p></div></div><div class="fields">
    <div class="field wide"><label>ما يشمله نطاق المهمة <em>*</em></label><textarea class="ctl" rows="3" oninput="needFpSet('scopeIncluded',this.value)">${esc(fp.scopeIncluded||'')}</textarea></div>
    <div class="field wide"><label>ما لا يشمله النطاق <em>*</em></label><textarea class="ctl" rows="3" oninput="needFpSet('scopeExcluded',this.value)">${esc(fp.scopeExcluded||'')}</textarea></div>
    <div class="field wide"><label>التسليمات المتوقعة</label><textarea class="ctl" rows="2" oninput="needFpSet('deliverables',this.value)">${esc(fp.deliverables||'')}</textarea></div>
  </div></div>
  <div class="card formcard mt"><div class="fp-title"><span>3</span><div><h3>التصنيف المهني الدقيق</h3><p>المجال ← التخصص ← نوع الأعمال والممارسات، مع الدور المطلوب.</p></div></div><div class="fields">
    <div class="field"><label>المجال</label><select class="ctl" onchange="needFpSet('main',this.value);needFpSet('sub','');needFpSet('practice','');render()"><option value="">اختر…</option>${mains.map(x=>`<option ${fp.main===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
    <div class="field"><label>التخصص</label><select class="ctl" ${!fp.main?'disabled':''} onchange="needFpSet('sub',this.value);needFpSet('practice','');render()"><option value="">اختر…</option>${subs.map(x=>`<option ${fp.sub===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
    <div class="field"><label>نوع الأعمال والممارسات</label><select class="ctl" ${!fp.sub?'disabled':''} onchange="needFpSet('practice',this.value);render()"><option value="">اختر…</option>${practices.map(x=>`<option ${fp.practice===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
    <div class="field"><label>الدور المهني المطلوب</label><select class="ctl" onchange="needFpSet('role',this.value)"><option value="">اختر…</option>${expertRoles.map(x=>`<option ${fp.role===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
  </div></div>
  <div class="card formcard mt"><div class="fp-title"><span>4</span><div><h3>سياق التنفيذ والتعقيد</h3><p>هذه الخصائص تحدد مستوى الاستقلالية وتركيب الفريق ومخاطر المهمة.</p></div></div><div class="fields">
    ${needFpSelect('درجة التعقيد','complexity',NEED_COMPLEXITY)}${needFpSelect('الأولوية الزمنية','urgency',NEED_URGENCY)}${needFpSelect('مستوى المسؤولية والاستقلالية','autonomy',NEED_AUTONOMY)}${needFpSelect('تكوين مقدم الخدمة','teamMode',NEED_TEAM_MODE)}
    ${needFpSelect('مستوى مخاطر المهمة','riskLevel',NEED_RISK_LEVELS)}
    <div class="field wide"><label>الأطراف المعنية وصناع القرار</label><textarea class="ctl" rows="2" oninput="needFpSet('stakeholders',this.value)">${esc(fp.stakeholders||'')}</textarea></div>
    <div class="field wide"><label>الاعتماديات والقيود</label><textarea class="ctl" rows="2" oninput="needFpSet('dependencies',this.value)">${esc(fp.dependencies||'')}</textarea></div>
  </div></div>
  <div class="grid c2 mt"><div class="card formcard"><div class="fp-title"><span>5</span><div><h3>معايير القبول</h3><p>كيف سيقبل العميل المخرج رسميًا؟</p></div></div>${needFpPillGroup('acceptanceCriteria',NEED_ACCEPTANCE_TYPES)}</div>
  <div class="card formcard"><div class="fp-title"><span>6</span><div><h3>أدلة أهلية مقدم الخدمة</h3><p>الأدلة المطلوبة قبل إدراج المرشح.</p></div></div>${needFpPillGroup('requiredEvidence',NEED_EVIDENCE_TYPES)}
  <div class="fields mt"><div class="field"><label>الحد الأدنى للخبرة (سنوات)</label><input type="number" min="0" step="1" class="ctl" value="${fp.minimumExperience||0}" onchange="needFpSet('minimumExperience',Number(this.value)||0)"></div><div class="field"><label>الحد الأدنى للتقييم</label><select class="ctl" onchange="needFpSet('minimumRating',Number(this.value))">${[0,3,3.5,4,4.5].map(x=>`<option value="${x}" ${Number(fp.minimumRating)===x?'selected':''}>${x?x+' من 5':'دون حد'}</option>`).join('')}</select></div><label class="fp-check ${fp.verifiedOnly?'selected':''}"><input type="checkbox" ${fp.verifiedOnly?'checked':''} onchange="needFpSet('verifiedOnly',this.checked);render()"> مرشحون موثقون فقط</label></div></div></div>
  <div class="grid c2 mt"><div class="card formcard"><div class="fp-title"><span>7</span><div><h3>بوابات القبول</h3><p>فشل الشرط الإلزامي يستبعد المرشح مهما ارتفعت نتيجته.</p></div></div><h4>شروط إلزامية</h4>${needFpPillGroup('mandatory',MATCH_CRITERIA.slice(0,7).map(x=>x[0]))}<div class="fp-criteria-labels">${MATCH_CRITERIA.slice(0,7).map(x=>`<span><b>${x[0]}</b> = ${x[1]}</span>`).join('')}</div></div>
  <div class="card formcard"><div class="fp-title"><span>8</span><div><h3>أوزان المطابقة</h3><p>أهمية نسبية يحددها العميل، ومجموعها 100%.</p></div></div><div class="fields">${MATCH_CRITERIA.map(x=>`<div class="field"><label>${x[1]}</label><input class="ctl" type="number" min="0" max="100" value="${fp.weights[x[0]]||0}" oninput="weightSet('${x[0]}',this.value)"></div>`).join('')}</div><div class="statusband ${weightTotal()===100?'approved':'warning'}">مجموع الأوزان: <b id="weightTotal">${weightTotal()}%</b></div></div></div>
  <div class="card panel mt"><div class="casehead"><h3>الاعتماد والإصدارات</h3><span class="sp"></span>${fp.status==='معتمدة'?`<button class="btn sm ghost" onclick="reviseNeedFingerprint()">إنشاء إصدار جديد</button>`:`<button class="btn sm success" ${issues.length?'disabled':''} onclick="if(approveNeedFingerprint()){render();toast('اعتُمدت بصمة الاحتياج')}">اعتماد البصمة</button>`}</div>
    ${issues.length?`<div class="fp-issues">${issues.map(x=>`<span>• ${esc(x)}</span>`).join('')}</div>`:`<div class="statusband approved">${IC.check} البصمة مكتملة وجاهزة للاعتماد والمطابقة.</div>`}
    <div class="fp-version-list">${[...fp.versions].reverse().map((v,ri)=>{let i=fp.versions.length-1-ri;return`<div class="security-row"><div><b>الإصدار ${v.version}</b><small>اعتمده ${esc(v.approvedBy)} · ${new Date(v.approvedAt).toLocaleString('ar')}</small></div><button class="btn xs ghost" onclick="restoreNeedFingerprintVersion(${i})">إنشاء مسودة منه</button></div>`}).join('')||'<p class="hint">لا توجد إصدارات معتمدة بعد.</p>'}</div>
  </div>`}
