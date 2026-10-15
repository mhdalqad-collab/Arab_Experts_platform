/* =========================================================
   مركز البحث المتخصص (خبير / باحث / مدرب / مركز / دورة)
   ========================================================= */
const DIR_EXPERTS=[
 {name:'د. سارة بنت خالد الحربي',title:'خبيرة طاقة متجددة وهيدروجين',spec:'الطاقة والتعدين',main:'الطاقة والتعدين',sub:'الطاقة المتجددة والهيدروجين',country:'المملكة العربية السعودية',city:'الرياض',langs:['العربية','الإنجليزية'],rating:4.9,verified:1,extra:'$180/ساعة · 12 سنة خبرة'},
 {name:'د. أحمد محمد العتيبي',title:'خبير إدارة مشاريع ومخاطر وجودة',spec:'المهن الإدارية والمالية والقانونية التطبيقية',main:'المهن الإدارية والمالية والقانونية التطبيقية',sub:'إدارة المشاريع والمخاطر والجودة',country:'المملكة العربية السعودية',city:'جدة',langs:['العربية','الإنجليزية'],rating:4.8,verified:1,extra:'$150/ساعة · PMP'},
 {name:'م. خالد منصور',title:'استشاري حوكمة وتحكيم وامتثال',spec:'المهن الإدارية والمالية والقانونية التطبيقية',main:'المهن الإدارية والمالية والقانونية التطبيقية',sub:'القانون التطبيقي والتحكيم والحوكمة',country:'سلطنة عُمان',city:'مسقط',langs:['العربية'],rating:4.6,verified:0,extra:'$120/ساعة'},
 {name:'د. ليلى حسن',title:'خبيرة تطوير مؤسسي وبناء قدرات',spec:'التعليم التطبيقي وبناء القدرات',main:'التعليم التطبيقي وبناء القدرات',sub:'التعليم مدى الحياة والتطوير المؤسسي',country:'الأردن',city:'عمّان',langs:['العربية','الإنجليزية'],rating:4.7,verified:1,extra:'$140/ساعة'},
 {name:'د. يوسف بن راشد النعيمي',title:'خبير إدارة تشييد وبنية تحتية',spec:'العمران والنقل والبنية التحتية',main:'العمران والنقل والبنية التحتية',sub:'إدارة التشييد ومشاريع البنية التحتية',country:'الإمارات العربية المتحدة',city:'دبي',langs:['العربية','الإنجليزية','الفرنسية'],rating:4.8,verified:1,extra:'$200/ساعة · 15 سنة خبرة'},
 {name:'د. مريم القحطاني',title:'خبيرة تقنية حيوية وتطبيقات صحية',spec:'الزراعة والغذاء والمياه والبيئة',main:'الزراعة والغذاء والمياه والبيئة',sub:'التقنية الحيوية والأحياء التطبيقية',country:'المملكة العربية السعودية',city:'الدمام',langs:['العربية','الإنجليزية'],rating:4.5,verified:0,extra:'$130/ساعة'}];
const DIR_RESEARCHERS=[
 {name:'د. هالة بنت سامي الزهراني',inst:'جامعة الملك عبدالعزيز',spec:'الطاقة والتعدين',main:'الطاقة والتعدين',sub:'الطاقة المتجددة والهيدروجين',country:'المملكة العربية السعودية',langs:['العربية','الإنجليزية'],rating:4.8,verified:1,extra:'42 بحثًا محكمًا · h-index 17'},
 {name:'أ.د. عمر فاروق',inst:'الجامعة الأردنية',spec:'التعليم التطبيقي وبناء القدرات',main:'التعليم التطبيقي وبناء القدرات',sub:'تصميم المناهج والخبرات التعليمية',country:'الأردن',langs:['العربية','الإنجليزية'],rating:4.7,verified:1,extra:'65 بحثًا · h-index 23'},
 {name:'د. كريم بوعلام',inst:'جامعة محمد الخامس',spec:'الزراعة والغذاء والمياه والبيئة',main:'الزراعة والغذاء والمياه والبيئة',sub:'التقنية الحيوية والأحياء التطبيقية',country:'المغرب',langs:['العربية','الفرنسية'],rating:4.6,verified:1,extra:'31 بحثًا · h-index 12'},
 {name:'د. نور الهدى السبيعي',inst:'جامعة الإمارات',spec:'التقنيات الرقمية والذكاء الاصطناعي',main:'التقنيات الرقمية والذكاء الاصطناعي',sub:'الذكاء الاصطناعي وتعلم الآلة',country:'الإمارات العربية المتحدة',langs:['العربية','الإنجليزية'],rating:4.9,verified:1,extra:'28 بحثًا · ذكاء اصطناعي تطبيقي'},
 {name:'د. حسان عبد الرحمن',inst:'جامعة القاهرة',spec:'الزراعة والغذاء والمياه والبيئة',main:'الزراعة والغذاء والمياه والبيئة',sub:'الإنتاج النباتي والمحاصيل الزراعية',country:'مصر',langs:['العربية','الإنجليزية'],rating:4.4,verified:0,extra:'37 بحثًا · h-index 14'}];
const DIR_TRAINERS=[
 {name:'د. أحمد العتيبي',title:'مدرب إدارة مشاريع معتمد',spec:'المهن الإدارية والمالية والقانونية التطبيقية',main:'المهن الإدارية والمالية والقانونية التطبيقية',sub:'إدارة المشاريع والمخاطر والجودة',country:'المملكة العربية السعودية',langs:['العربية','الإنجليزية'],rating:4.8,verified:1,extra:'7 دورات مرتبطة · 86 متعلمًا'},
 {name:'د. سارة العلي',title:'مدربة تحول رقمي وحكومة رقمية',spec:'التقنيات الرقمية والذكاء الاصطناعي',main:'التقنيات الرقمية والذكاء الاصطناعي',sub:'الحكومة الرقمية والتحول المؤسسي',country:'الإمارات العربية المتحدة',langs:['العربية','الإنجليزية'],rating:4.9,verified:1,extra:'5 دورات · عن بعد وحضوري'},
 {name:'خالد منصور',title:'مدرب حوكمة ومخاطر وامتثال',spec:'المهن الإدارية والمالية والقانونية التطبيقية',main:'المهن الإدارية والمالية والقانونية التطبيقية',sub:'القانون التطبيقي والتحكيم والحوكمة',country:'سلطنة عُمان',langs:['العربية'],rating:4.6,verified:1,extra:'4 دورات مرتبطة'},
 {name:'د. ليلى حسن',title:'مدربة قيادة وبناء قدرات',spec:'التعليم التطبيقي وبناء القدرات',main:'التعليم التطبيقي وبناء القدرات',sub:'التدريب وبناء القدرات والإرشاد المهني',country:'الأردن',langs:['العربية','الإنجليزية'],rating:4.7,verified:1,extra:'6 دورات · تقييم مرتفع'},
 {name:'م. طارق الشمري',title:'مدرب أمن سيبراني',spec:'التقنيات الرقمية والذكاء الاصطناعي',main:'التقنيات الرقمية والذكاء الاصطناعي',sub:'الأمن السيبراني',country:'المملكة العربية السعودية',langs:['العربية','الإنجليزية'],rating:4.5,verified:0,extra:'3 دورات · مختبرات تطبيقية'}];
const DIR_CENTERS=[
 {name:'معهد الريادة للتدريب',city:'الرياض',spec:'المهن الإدارية والمالية والقانونية التطبيقية',main:'المهن الإدارية والمالية والقانونية التطبيقية',sub:'إدارة المشاريع والمخاطر والجودة',country:'المملكة العربية السعودية',langs:['العربية','الإنجليزية'],rating:4.7,verified:1,extra:'24 دورة · 19 مدربًا · طرح حضوري وعن بعد'},
 {name:'أكاديمية المستقبل',city:'دبي',spec:'التقنيات الرقمية والذكاء الاصطناعي',main:'التقنيات الرقمية والذكاء الاصطناعي',sub:'الحكومة الرقمية والتحول المؤسسي',country:'الإمارات العربية المتحدة',langs:['العربية','الإنجليزية'],rating:4.6,verified:1,extra:'18 دورة · تعلم عن بعد'},
 {name:'مركز النخبة',city:'مسقط',spec:'المهن الإدارية والمالية والقانونية التطبيقية',main:'المهن الإدارية والمالية والقانونية التطبيقية',sub:'القانون التطبيقي والتحكيم والحوكمة',country:'سلطنة عُمان',langs:['العربية'],rating:4.5,verified:1,extra:'12 دورة · اعتماد مهني ساري'},
 {name:'معهد آفاق المعرفة',city:'الدوحة',spec:'التعليم التطبيقي وبناء القدرات',main:'التعليم التطبيقي وبناء القدرات',sub:'التدريب وبناء القدرات والإرشاد المهني',country:'قطر',langs:['العربية','الإنجليزية'],rating:4.8,verified:1,extra:'15 دورة · برامج قيادية تنفيذية'},
 {name:'المركز العربي للتطوير',city:'عمّان',spec:'التعليم التطبيقي وبناء القدرات',main:'التعليم التطبيقي وبناء القدرات',sub:'التعلم الإلكتروني وتقنيات التعليم',country:'الأردن',langs:['العربية'],rating:4.3,verified:0,extra:'9 دورات · برامج تأسيسية'}];
const DIR_CONSULTANTS=[
 {name:'د. نجلاء السعدي',title:'مستشارة تحول مؤسسي وحوكمة',spec:'المهن الإدارية والمالية والقانونية التطبيقية',main:'المهن الإدارية والمالية والقانونية التطبيقية',sub:'إدارة الأعمال والإدارة العامة',country:'سلطنة عُمان',city:'مسقط',langs:['العربية','الإنجليزية'],rating:4.9,verified:1,extra:'32 مشروعًا · حضوري وعن بعد'},
 {name:'م. وائل الخطيب',title:'مستشار بنية تحتية وإدارة أصول',spec:'العمران والنقل والبنية التحتية',main:'العمران والنقل والبنية التحتية',sub:'إدارة المرافق والأصول المبنية',country:'الإمارات العربية المتحدة',city:'أبوظبي',langs:['العربية','الإنجليزية'],rating:4.8,verified:1,extra:'18 سنة خبرة · $220/يوم'},
 {name:'د. ريم عبدالسلام',title:'مستشارة استراتيجية وقياس أداء',spec:'المهن الإدارية والمالية والقانونية التطبيقية',main:'المهن الإدارية والمالية والقانونية التطبيقية',sub:'إدارة المشاريع والمخاطر والجودة',country:'المملكة العربية السعودية',city:'الرياض',langs:['العربية','الإنجليزية'],rating:4.7,verified:1,extra:'27 مشروعًا استشاريًا'},
 {name:'سامي الزدجالي',title:'مستشار أمن سيبراني وامتثال',spec:'التقنيات الرقمية والذكاء الاصطناعي',main:'التقنيات الرقمية والذكاء الاصطناعي',sub:'الأمن السيبراني',country:'سلطنة عُمان',city:'صحار',langs:['العربية','الإنجليزية'],rating:4.6,verified:1,extra:'تدقيق · تقييم · تصميم ضوابط'},
 {name:'د. يارا منصور',title:'مستشارة تعليم وتطوير مؤسسي',spec:'التعليم التطبيقي وبناء القدرات',main:'التعليم التطبيقي وبناء القدرات',sub:'التعليم مدى الحياة والتطوير المؤسسي',country:'الأردن',city:'عمّان',langs:['العربية','الإنجليزية','الفرنسية'],rating:4.5,verified:0,extra:'استشارات وتصميم برامج'}];
const SEARCH_DIRS={
 expert:{title:'البحث عن خبير',ctx:'دليل الخبراء',desc:'ابحث في قاعدة الخبراء بالاسم أو الاختصاص أو الدولة أو اللغة، واعرض الملف العام للمرشح المناسب.',list:DIR_EXPERTS,specLabel:'الاختصاص',sub:'title'},
 researcher:{title:'البحث عن باحث / أكاديمي',ctx:'دليل الباحثين',desc:'باحثون وأكاديميون موثقون بمجالاتهم وإنتاجهم العلمي ومؤشرات الاستشهاد.',list:DIR_RESEARCHERS,specLabel:'المجال البحثي',sub:'inst'},
 trainer:{title:'البحث عن مدرب',ctx:'دليل المدربين',desc:'مدربون معتمدون بتخصصاتهم ولغات تقديمهم وتقييمات متعلميهم.',list:DIR_TRAINERS,specLabel:'التخصص التدريبي',sub:'title'},
 center:{title:'البحث عن مركز تدريب',ctx:'دليل المراكز',desc:'مراكز تدريب موثقة بدوراتها ومدربيها وأنماط طرحها.',list:DIR_CENTERS,specLabel:'مجال التدريب',sub:'city'},
 consultant:{title:'البحث عن مستشار',ctx:'دليل المستشارين',desc:'ابحث عن مستشار بحسب الاختصاص والقطاع والدولة واللغة، ثم افتح ملفه العام المفصل.',list:DIR_CONSULTANTS,specLabel:'المجال الاستشاري',sub:'title'}};
const DIR_TARGET={expert:57,researcher:57,trainer:57,center:57,consultant:57};
const DIR_KIND_LABEL={expert:'خبير',researcher:'باحث / أكاديمي',trainer:'مدرب',center:'مركز تدريب',consultant:'مستشار'};
const DIR_GATES={expert:[1,2,3,Infinity],researcher:[1,1,2,Infinity],trainer:[1,1,3,Infinity],center:[1,2,3,Infinity],consultant:[1,2,3,Infinity]};
function dirLimit(k){return DIR_GATES[k][pkgTier()]}
function dirSet(k,f,v){(G.dirF=G.dirF||{})[k]=G.dirF[k]||{};G.dirF[k][f]=v;persist(true)}
function dirSaveSearch(k){G.savedDirectorySearches=G.savedDirectorySearches||{};G.savedDirectorySearches[k]={...((G.dirF||{})[k]||{}),savedAt:Date.now()};persist(true);render();toast('حُفظ نطاق البحث ويمكن استعادته لاحقًا')}
function dirLoadSearch(k){let s=(G.savedDirectorySearches||{})[k];if(!s){toast('لا يوجد بحث محفوظ لهذا الدليل');return}let{savedAt,...filters}=s;G.dirF=G.dirF||{};G.dirF[k]=filters;persist(true);render();toast('استُعيد البحث المحفوظ')}
function dirClearFilter(k,key){G.dirF=G.dirF||{};G.dirF[k]=G.dirF[k]||{};G.dirF[k][key]='';if(key==='main')G.dirF[k].sub='';persist(true);render()}
function dirActiveChips(k,f){let labels={q:'كلمات البحث',main:'المجال',sub:'التخصص',country:'الدولة',lang:'اللغة',min:'التقييم'};return Object.keys(labels).filter(x=>f[x]).map(x=>`<button class="filter-chip" onclick="dirClearFilter('${k}','${x}')" title="إزالة هذا العامل"><span>${labels[x]}:</span> ${esc(f[x])} ×</button>`).join('')}
function dirSortSet(k,key){G.dirSort=G.dirSort||{};let s=G.dirSort[k]||{key:'rating',dir:'desc'};G.dirSort[k]={key,dir:s.key===key&&s.dir==='asc'?'desc':'asc'};persist(true);dirRefresh(k)}
function dirSortMark(k,key){let s=(G.dirSort||{})[k];return s&&s.key===key?(s.dir==='asc'?'↑':'↓'):'↕'}
const SEARCH_LANGS=['العربية','الإنجليزية','الفرنسية','الإسبانية','الألمانية','التركية','الأردية'];
function dirList(k){let M=SEARCH_DIRS[k],f=(G.dirF||{})[k]||{};
  let list=M.list.filter(x=>(!f.q||[x.name,x.title,x.inst,x.spec,x.sub,x.extra].filter(Boolean).join(' ').includes(f.q))&&(!f.main||x.main===f.main)&&(!f.sub||x.sub===f.sub)&&(!f.country||x.country===f.country)&&(!f.lang||(x.langs||[]).includes(f.lang))&&(!f.min||x.rating>=+f.min));
  let s=(G.dirSort||{})[k]||{key:'rating',dir:'desc'},v=x=>s.key==='location'?[x.country,x.city].filter(Boolean).join(' '):s.key==='role'?(x[M.sub]||''):x[s.key];
  return list.sort((a,b)=>{let A=v(a),B=v(b),n=typeof A==='number'&&typeof B==='number'?A-B:String(A||'').localeCompare(String(B||''),'ar');return s.dir==='asc'?n:-n})}
function dirCandidateRef(k,i,x){return x.ref||`dir:${k}:${i}`}
function dirCards(k,list){list=list||dirList(k);
  if(!list.length)return `<div class="card empty"><div class="ic">${IC.search}</div><b>لا نتائج مطابقة</b><p>عدّل نطاق البحث أو الفلاتر</p></div>`;
  let M=SEARCH_DIRS[k];
  return `<div class="dirtable-wrap"><table class="tbl dirtable">
    <thead><tr>
      <th class="seq">#</th>
      <th><button onclick="dirSortSet('${k}','name')">الاسم ${dirSortMark(k,'name')}</button></th>
      <th><button onclick="dirSortSet('${k}','role')">${k==='center'?'نوع الجهة':'المسمى المهني / المؤسسة'} ${dirSortMark(k,'role')}</button></th>
      <th><button onclick="dirSortSet('${k}','main')">المجال الرئيسي ${dirSortMark(k,'main')}</button></th>
      <th><button onclick="dirSortSet('${k}','sub')">${M.specLabel} ${dirSortMark(k,'sub')}</button></th>
      <th><button onclick="dirSortSet('${k}','location')">الدولة / المدينة ${dirSortMark(k,'location')}</button></th>
      <th>اللغات</th><th>التحقق</th>
      <th><button onclick="dirSortSet('${k}','rating')">التقييم ${dirSortMark(k,'rating')}</button></th>
      <th>بيانات إضافية</th><th>الإجراءات</th>
    </tr></thead><tbody>
    ${list.map((x,n)=>{let i=M.list.indexOf(x),ref=dirCandidateRef(k,i,x);return `<tr class="dircard">
      <td class="seq">${n+1}</td>
      <td class="entity-name"><button onclick="openDirectoryProfile('${k}',${i})">${esc(x.name)}</button></td>
      <td>${esc(k==='center'?'مركز / معهد تدريب':(x[M.sub]||'—'))}</td>
      <td>${esc(x.main||x.spec||'—')}</td>
      <td>${esc(x.sub||x.spec||'—')}</td>
      <td>${esc(x.country)}${x.city?`<br><small>${esc(x.city)}</small>`:''}</td>
      <td>${(x.langs||[]).map(l=>`<span class="tagb blue" style="margin:2px">${esc(l)}</span>`).join('')||'—'}</td>
      <td><span class="tagb ${x.verified?'green':'gray'}">${x.verified?'✓ موثق':'غير موثق'}</span></td>
      <td>${x.rating?`<span class="tagb gold">★ ${x.rating}</span>${x.reputationConfidence!==undefined?`<br><small>ثقة ${x.reputationConfidence}% · ${x.reputationSampleCount||0} مشروع</small>`:''}`:'<span class="tagb gray">العينة قيد التكوين</span>'}</td>
      <td><small>${esc(x.extra||'—')}</small></td>
      <td class="acts-cell"><button class="btn xs primary" onclick="openDirectoryProfile('${k}',${i})">عرض الملف</button><button class="btn xs ghost" onclick="dirProfile('${k}',${i})">نبذة</button><button class="btn xs soft" onclick="addCompare('${ref}')">مقارنة</button><button class="btn xs gold" onclick="addShortlist('${ref}')">مختصرة</button><button class="btn xs primary" onclick="requestService('${ref}')">طلب خدمة</button></td>
    </tr>`}).join('')}</tbody></table></div>`}
function dirRefresh(k){let el=$('dirlist');if(el){let lim=dirLimit(k),list=dirList(k);el.innerHTML=dirCards(k,lim>=list.length?list:list.slice(0,lim));let c=$('dircount');if(c)c.textContent=list.length+' نتيجة'}}
function rSearchDir(k){let M=SEARCH_DIRS[k];let f=(G.dirF||{})[k]||{};let list=dirList(k);
  let mains=Object.keys(TAX),subs=f.main?Object.keys(TAX[f.main]||{}):[];
  return pagehead({ctx:M.ctx,title:M.title,desc:M.desc},`<button class="btn ghost sm" onclick="dirSaveSearch('${k}')">حفظ البحث</button>${(G.savedDirectorySearches||{})[k]?`<button class="btn soft sm" onclick="dirLoadSearch('${k}')">استعادة المحفوظ</button>`:''}<button class="btn ghost sm" onclick="go(5)">البحث الموحد</button>`)+`
  ${activeNeed()?`<div class="statusband approved" style="margin-bottom:14px">${IC.check} نتائج البحث مرتبطة بالاحتياج: <b>${esc(activeNeed().title)}</b> · <button class="btn xs ghost" onclick="go(20)">تغيير الاحتياج</button></div>`:`<div class="statusband warning" style="margin-bottom:14px">للاستفادة من «طلب خدمة، مقارنة، قائمة مختصرة» اختر احتياجًا من <button class="btn xs primary" onclick="go(20)">إدارة العملاء</button>.</div>`}
  <div class="card filterbar">
    <input class="ctl" style="min-width:180px" placeholder="الاسم أو الكلمات المفتاحية…" value="${esc(f.q||'')}" oninput="dirSet('${k}','q',this.value);dirRefresh('${k}')">
    <select class="ctl" onchange="dirSet('${k}','main',this.value);dirSet('${k}','sub','');render()"><option value="">كل الاختصاصات</option>${mains.map(s=>`<option ${f.main===s?'selected':''}>${esc(s)}</option>`).join('')}</select>
    <select class="ctl" ${!f.main?'disabled':''} onchange="dirSet('${k}','sub',this.value);render()"><option value="">${f.main?'كل التخصصات الفرعية':'اختر الاختصاص أولًا'}</option>${subs.map(s=>`<option ${f.sub===s?'selected':''}>${esc(s)}</option>`).join('')}</select>
    <select class="ctl" onchange="dirSet('${k}','country',this.value);render()"><option value="">كل الدول</option>${countries.map(s=>`<option ${f.country===s?'selected':''}>${esc(s)}</option>`).join('')}</select>
    <select class="ctl" onchange="dirSet('${k}','lang',this.value);render()"><option value="">كل اللغات</option>${SEARCH_LANGS.map(s=>`<option ${f.lang===s?'selected':''}>${esc(s)}</option>`).join('')}</select>
    <select class="ctl" onchange="dirSet('${k}','min',this.value);render()"><option value="">أي تقييم</option>${[['4.5','4.5 فأعلى'],['4.7','4.7 فأعلى'],['4.8','4.8 فأعلى']].map(o=>`<option value="${o[0]}" ${f.min===o[0]?'selected':''}>★ ${o[1]}</option>`).join('')}</select>
    ${f.q||f.main||f.sub||f.country||f.lang||f.min?`<button class="btn xs danger" onclick="G.dirF['${k}']={};persist(true);render()">مسح الفلاتر ✕</button>`:''}
    <span class="tagb gold" id="dircount" aria-live="polite">${list.length} نتيجة</span>
    ${!G.user?`<span class="tagb gray">وضع الزائر — وصول محدود</span>`:`<span class="tagb ${pkgTier()===3?'gold':'blue'}">باقة ${esc(G.pkg||'الأساسية')}</span>`}</div>
  ${dirActiveChips(k,f)?`<div class="active-filters" aria-label="عوامل البحث المفعلة"><b>نطاق البحث الحالي</b>${dirActiveChips(k,f)}</div>`:''}
  ${(()=>{let lim=dirLimit(k),vis=lim>=list.length?list:list.slice(0,lim),hid=list.length-vis.length;
    return `<div class="table-note">↕ اضغط على عنوان العمود للفرز، واضغط على اسم العضو أو «عرض الملف» لفتح التفاصيل المنشورة.</div>
    <div id="dirlist">${vis.length?dirCards(k,vis):`<div class="empty improved-empty"><div class="ic">⌕</div><b>لا توجد نتائج مطابقة</b><p>جرّب إزالة أحد الفلاتر أو استخدام كلمة بحث أوسع.</p><button class="btn ghost sm" onclick="G.dirF['${k}']={};persist(true);render()">مسح الفلاتر</button></div>`}</div>
    ${hid>0?`<div class="lockwall">🔒 <b>${hid} نتيجة إضافية ضمن نطاق ${G.user?'باقتك':'الزوار'}</b>
      <p>${G.user?'رقِّ باقتك للوصول غير المحدود إلى كامل الدليل مع بيانات التوثيق والتواصل.':'أنشئ حسابًا مجانيًا لتوسيع النتائج، أو اشترك في باقة للوصول الكامل.'}</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn gold sm" onclick="go(65)">عرض الباقات ←</button>
        ${!G.user?`<button class="btn ghost sm" onclick="go(1)">تسجيل الدخول</button>`:''}</div></div>`:''}`})()}`}
function dirProfile(k,i){let x=SEARCH_DIRS[k].list[i];
  openModal(`<h3>${esc(x.name)} <button class="btn xs ghost x" onclick="closeOverlay()">✕</button></h3>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
    <span class="tagb ${x.verified?'green':'gray'}">${x.verified?'✓ موثق':'غير موثق'}</span>
    <span class="tagb gold">★ ${x.rating}</span>
    <span class="tagb blue">${DIR_KIND_LABEL[k]}</span></div>
  <div class="lrow"><b>${k==='researcher'?'المؤسسة':'الصفة'}</b><small>${esc(x[SEARCH_DIRS[k].sub]||'—')}</small></div>
  <div class="lrow"><b>${SEARCH_DIRS[k].specLabel}</b><small>${esc(x.spec)}</small></div>
  <div class="lrow"><b>الموقع</b><small>${esc(x.country)}${x.city?' — '+esc(x.city):''}</small></div>
  <div class="lrow"><b>لغات العمل</b><small>${(x.langs||[]).join('، ')}</small></div>
  <div class="lrow"><b>مزيد</b><small>${esc(x.extra||'')}</small></div>
  <div style="display:flex;gap:10px;margin-top:16px">
    <button class="btn primary" style="flex:1;justify-content:center" onclick="closeOverlay();openDirectoryProfile('${k}',${i})">فتح الملف الكامل ←</button>
    <button class="btn gold" style="flex:1;justify-content:center" onclick="closeOverlay();requestService('${dirCandidateRef(k,i,x)}')">طلب خدمة ←</button></div>`)}
function openDirectoryProfile(k,i){let x=SEARCH_DIRS[k].list[i];if(x?.partyId){window.open('/public-profile/'+encodeURIComponent(x.partyId),'_blank','noopener');return}G.publicProfile={kind:k,index:i,from:{expert:50,researcher:51,trainer:41,center:42,consultant:58}[k]||5};persist(true);go(57)}
function openLegacyCenterProfile(){
  if(G.memberEntityIds?.['مركز تدريب']&&G.memberData?.['مركز تدريب'])previewMembershipPublic('مركز تدريب');
  else openDirectoryProfile('center',0)
}

const PROFILE_ROLE={expert:'خبير',trainer:'مدرب',consultant:'مستشار',center:'مركز تدريب',researcher:'باحث / أكاديمي'};
function privacyAudit(type,field,hidden,scope='field'){G.privacyAudit.push({auditId:`PRV-${String(Date.now()).slice(-9)}-${G.privacyAudit.length+1}`,entityId:G.memberEntityIds[type]||G.primaryPersonEntityId||null,membership:type,field,scope,visibility:hidden?'private':'public',at:Date.now(),actor:G.user||'صاحب العضوية'})}
function memberPublicValue(type,key){if(G.memberPrivacy?.[type]?.[key])return undefined;let v=G.memberData?.[type]?.[key];if(Array.isArray(v)&&v.length&&typeof v[0]==='object')return v.length?'مستندات متاحة وفق الصلاحية':undefined;return v}
function memberPublicRecords(type,key){let rows=memberRecords(type,key);return rows.map((row,i)=>{let policy=G.memberRecordPrivacy?.[`${type}::${key}::${i}`]||{},out={};Object.keys(row).forEach(k=>{if(!policy[k]){let v=row[k];out[k]=Array.isArray(v)&&v.length&&typeof v[0]==='object'?'مستندات متاحة وفق الصلاحية':v}});return out}).filter(r=>Object.values(r).some(v=>Array.isArray(v)?v.length:String(v||'').trim()))}
function membershipPrivacyStats(type){let F=membershipForm(type),p=G.memberPrivacy?.[type]||{},total=F.fields.length,hidden=F.fields.filter(f=>p[f[0]]).length;
  let defs=MEMBER_REPEATABLE[type]||[];defs.forEach(d=>memberRecords(type,d.key).forEach((r,i)=>{Object.keys(r).forEach(k=>{total++;if(G.memberRecordPrivacy?.[`${type}::${d.key}::${i}`]?.[k])hidden++})}));
  return{total,hidden,visible:Math.max(0,total-hidden)}}
function previewMembershipPublic(type){type=dec(type);let e=syncUnifiedEntity(type);G.publicProfile={source:'membership',type,kind:{'خبير':'expert','مركز تدريب':'center','مدرب':'trainer','مستشار':'consultant','باحث / أكاديمي':'researcher'}[type]||'expert',entityId:e.entityId,preview:true,from:MEMBER_SCREENS[type]||59};persist(true);go(57)}
function publicText(parts,sep=' · '){return parts.filter(v=>Array.isArray(v)?v.length:String(v||'').trim()).map(v=>Array.isArray(v)?v.join('، '):v).join(sep)}
function expertPublicProjection(){let pv=k=>W._private?.[k]?undefined:W[k],spec=(W.specializationRecords||[])[0]||{},lm=lifeMeta('خبير'),entity=G.entities.find(e=>e.entityId===G.memberEntityIds['خبير']);
  let fields=S.flatMap(s=>s[2]).filter(f=>f[2]!=='specializationSave'),hidden=fields.filter(f=>W._private?.[f[0]]).length;
  let qs=!whid('qualifications')?(W.qualifications||[]):[],ac=!whid('accreditations')?(W.accreditations||[]):[],pr=!whid('projects')?(W.projects||[]):[],cr=!whid('trainerCourses')?(W.trainerCourses||[]):[],ex=!whid('experiences')?(W.experiences||[]):[];
  let x={entityId:entity?.entityId||G.memberEntityIds['خبير'],name:pv('fullName')||'خبير في الشبكة',nameEn:pv('englishName'),country:pv('country'),city:pv('city'),main:pv('domain')||spec.domain,sub:pv('specialty')||spec.specialty,title:publicText([pv('professionalRoles'),pv('expertise')]),langs:!whid('languageRecords')?(W.languageRecords||[]).map(l=>l.language).filter(Boolean):[],verified:lm.state==='approved'||G.verified,rating:0};
  let q=qs[0]||{},p={hidden:[],reviews:[],privacySummary:{total:fields.length,hidden,visible:Math.max(0,fields.length-hidden)},bio:ex[0]?.description||'خبير مسجل في شبكة الخبراء العرب.',services:pv('services')||[],sectors:pv('sectors')||spec.appliedAreas||[],modes:[pv('deliveryModes')].filter(Boolean),qualification:publicText([q.degree,q.specialization,q.institution]),accreditation:ac.length?publicText([ac[0].name,ac[0].issuer]):'',experience:pv('specialtyYears')?`${pv('specialtyYears')} سنوات في التخصص`:ex.length?`${ex.length} خبرات منشورة`:'',availability:publicText([pv('availableFrom')&&`من ${pv('availableFrom')}`,pv('availableTo')&&`إلى ${pv('availableTo')}`]),contact:{email:pv('email'),phone:publicText([pv('phoneCode'),pv('phone')],' '),website:pv('website')||pv('linkedin')},evidence:[],publicEnabled:true};
  p.projects=pr.map(r=>[r.name||'مشروع مهني',publicText([r.role,r.sector,r.country,r.year])]);p.courses=cr.map(r=>({title:r.course||'دورة تدريبية',level:r.level,duration:r.hours?`${r.hours} ساعة`:'',mode:r.rating||''}));
  if(pv('cv')||pv('certificates'))p.evidence.push('أدلة وسيرة ذاتية متاحة وفق الصلاحية');let prices=!whid('pricing')?(W.pricing||[]):[];p.price=prices.length?publicText([prices[0].hour&&`$${prices[0].hour} للساعة`,prices[0].day&&`$${prices[0].day} لليوم`]):'';
  return{x,p}}
function membershipPublicProjection(type){
  if(type==='خبير')return expertPublicProjection();
  let v=G.memberData[type]||{},pv=k=>memberPublicValue(type,k),rec=k=>memberPublicRecords(type,k),entity=G.entities.find(e=>e.entityId===G.memberEntityIds[type]),lm=lifeMeta(type),stats=membershipPrivacyStats(type);
  let x={entityId:entity?.entityId||G.memberEntityIds[type],verified:lm.state==='approved',rating:0,langs:[]},p={hidden:[],reviews:[],privacySummary:stats,evidence:[],services:[],sectors:[],modes:[]};
  if(type==='مركز تدريب'){let cr=rec('centerCourses'),r=cr[0]||{};
    x.name=pv('legalName')||'مركز تدريب في الشبكة';x.nameEn=pv('centerEnglishName');x.country=pv('regCountry');x.city=pv('hq');x.main=r.centerDomain||pv('centerDomain');x.sub=r.centerSpecialty||pv('centerSpecialty');x.title=pv('tradeName')||'مركز / معهد تدريب';
    p.bio=publicText([pv('tradeName'),pv('facilities')],' — ')||'مركز تدريب مسجل في شبكة الخبراء العرب.';p.services=['تدريب مؤسسي','برامج ودورات مهنية'];p.modes=pv('centerModes')||[];p.sectors=r.centerAppliedAreas||pv('centerAppliedAreas')||[];
    p.courses=cr.map(z=>({title:z.centerCourseName||'دورة تدريبية',level:z.courseLevel,duration:z.targetAudience?`الفئة: ${z.targetAudience}`:'',mode:(p.modes||[]).join('، ')}));
    p.qualification=publicText([pv('entityType'),pv('licenseAuthority'),pv('licenseNo')]);p.accreditation=Array.isArray(pv('accred'))?pv('accred').join('، '):pv('accred');p.experience=pv('capacity')?`الطاقة الاستيعابية: ${pv('capacity')}`:'';
    p.contact={email:pv('cemail'),phone:pv('cphone'),website:pv('site')};if(pv('centerEvidence')||pv('accredFile'))p.evidence.push('وثائق واعتمادات أتاحها المركز');
  }else if(type==='مدرب'){let qs=rec('trainerQualifications'),ss=rec('trainerSpecializations'),cs=rec('trainerCourseRecords'),r=ss[0]||{},q=qs[0]||{};
    x.name=pv('tname')||'مدرب في الشبكة';x.nameEn=pv('tenglish');x.country=pv('tcountry');x.main=r.trainerDomain||pv('trainerDomain')||pv('academy');x.sub=r.trainerSpecialty||pv('trainerSpecialty');x.title=pv('tlastTitle')||'مدرب';x.langs=pv('tlangs')||[];
    p.bio=pv('tbio')||'مدرب مسجل في شبكة الخبراء العرب.';p.services=pv('trainerServices')||[];p.modes=[pv('trainerDelivery'),...(pv('tmodes')||[])].filter(Boolean);p.sectors=r.trainerAppliedAreas||pv('trainerAppliedAreas')||pv('topics')||[];
    p.courses=cs.map(z=>({title:z.trainerCourseName||'دورة تدريبية',level:z.trainerCourseLevel,duration:z.trainerHours?`${z.trainerHours} ساعة`:'',mode:z.trainerRating||''}));
    p.qualification=publicText([q.tdegree,q.tqualification,q.tinstitution]);p.accreditation=qs.length>1?`${qs.length} مؤهلات واعتمادات منشورة`:'';p.experience=pv('texp')?`${pv('texp')} سنوات خبرة تدريبية`:'';
    p.availability=publicText([pv('trainerAvailableFrom')&&`من ${pv('trainerAvailableFrom')}`,pv('trainerAvailableTo')&&`إلى ${pv('trainerAvailableTo')}`]);p.price=publicText([pv('trainerHourPrice')&&`$${pv('trainerHourPrice')} للساعة`,pv('trainerDayPrice')&&`$${pv('trainerDayPrice')} لليوم`]);
    p.contact={email:pv('temail'),phone:pv('tphone'),website:undefined};if(pv('trainerEvidence')||pv('cv'))p.evidence.push('أدلة وسيرة تدريبية متاحة وفق الصلاحية');
  }else if(type==='مستشار'){let qs=rec('consultantQualifications'),ss=rec('consultantSpecializations'),sv=rec('consultantServiceRecords'),pr=rec('consultantProjectRecords'),r=ss[0]||{},q=qs[0]||{};
    x.name=pv('cname')||'مستشار في الشبكة';x.nameEn=pv('cenglish');x.country=pv('ccountry');x.main=r.consultantDomain||pv('consultantDomain')||pv('cdomain');x.sub=r.consultantSpecialty||pv('consultantSpecialty');x.title=pv('clastTitle')||'مستشار';x.langs=pv('clanguages')||[];
    p.bio=pv('cbio')||'مستشار مسجل في شبكة الخبراء العرب.';p.services=[...(pv('cservices')||[]),...sv.flatMap(z=>z.cservices||[])];p.modes=[pv('consultDelivery'),...sv.map(z=>z.consultingMode)].filter(Boolean);p.sectors=pv('consultingSectors')||[];
    p.projects=pr.map(z=>[z.consultingProjects||'مشروع استشاري',publicText([z.consultingRole,z.consultingDuration&&`${z.consultingDuration} يوم`,z.consultingResults])]);
    p.qualification=publicText([q.cdegree,q.cqualification,q.cinstitution]);p.experience=pv('cyears')?`${pv('cyears')} سنوات خبرة مهنية إجمالية`:'';p.availability=publicText([pv('consultAvailableFrom')&&`من ${pv('consultAvailableFrom')}`,pv('consultAvailableTo')&&`إلى ${pv('consultAvailableTo')}`]);p.price=publicText([pv('chour')&&`$${pv('chour')} للساعة`,pv('cday')&&`$${pv('cday')} لليوم`]);
    p.contact={email:pv('cemail2'),phone:pv('cphone2'),website:undefined};p.publicEnabled=v.consultConsent!=='لا';if(pv('consultEvidence')||pv('cvv'))p.evidence.push('أدلة ومراجع أتاحها المستشار');
  }else{let qs=rec('researchQualifications'),ss=rec('researchSpecializations'),pubs=rec('researchPublicationRecords'),pr=rec('researchProjectRecords'),r=ss[0]||{},q=qs[0]||{};
    x.name=pv('rname')||'باحث / أكاديمي في الشبكة';x.nameEn=pv('renglish');x.country=pv('rcountry');x.city=pv('rcity');x.main=r.researchDomain||pv('researchDomain');x.sub=r.researchSpecialty||pv('researchSpecialty');x.title=pv('rlastTitle')||pv('rinst')||'باحث / أكاديمي';x.langs=pv('rlanguages')||[];
    p.bio=pv('rbio')||'باحث أو أكاديمي مسجل في شبكة الخبراء العرب.';p.services=['بحث وتطوير','إعداد دراسات','تحكيم وتقييم'];p.modes=[pv('researchMode')].filter(Boolean);p.sectors=r.researchAppliedAreas||pv('researchAppliedAreas')||pv('rfields')||[];
    p.courses=pubs.map(z=>({title:z.publicationTitle||'منشور علمي',level:z.publicationType,duration:z.publicationYear||'',mode:z.publicationLink?'رابط متاح':''}));p.projects=pr.map(z=>[z.researchProject||'مشروع بحثي',publicText([z.researchRole,z.fundingBody,z.researchPeriod&&`${z.researchPeriod} يوم`])]);
    p.qualification=publicText([q.rdegree,q.rqualification,q.rinst]);p.experience=pv('ryears')?`${pv('ryears')} سنوات خبرة مهنية إجمالية`:'';p.availability=publicText([pv('researchAvailableFrom')&&`من ${pv('researchAvailableFrom')}`,pv('researchAvailableTo')&&`إلى ${pv('researchAvailableTo')}`]);p.price=publicText([pv('researchHourPrice')&&`$${pv('researchHourPrice')} للساعة`,pv('researchDayPrice')&&`$${pv('researchDayPrice')} لليوم`]);
    p.contact={email:pv('remail'),phone:pv('rphone'),website:pv('rscholar')||pv('rorcid')};p.publicEnabled=v.researchFileAccess!=='لا';if(pv('researchEvidence')||pv('rfile'))p.evidence.push('أدلة علمية أتاحها الباحث');
  }
  p.services=[...new Set(p.services.filter(Boolean))];p.modes=[...new Set(p.modes.filter(Boolean))];p.reviews=[];p.hidden=[];return{x,p}
}
function profileData(k,x,i){
  let common={
    bio:k==='center'?`جهة تدريبية متخصصة في ${x.sub}، تقدم برامج تطبيقية للأفراد والمؤسسات من خلال مدربين مرتبطين بالشبكة.`:`${x.title||x.inst||DIR_KIND_LABEL[k]} بخبرة تطبيقية في ${x.sub}، ويعرض هذا الملف المعلومات التي وافق صاحبها على نشرها.`,
    services:k==='center'?['تدريب مؤسسي','ورش عمل','برامج مهنية','تصميم حقائب تدريبية']:k==='trainer'?['تدريب','تصميم','تقييم','إعداد دراسات']:k==='consultant'?['استشارات','إعداد دراسات','تصميم','إدارة مشاريع','تدقيق وتقييم']:k==='researcher'?['بحث وتطوير','إعداد دراسات','تحكيم','تقييم']:['استشارات','تدريب','إدارة مشاريع','تحكيم','تقييم'],
    sectors:['الخدمات العامة والتعليم والتنمية','التكنولوجيا والاتصالات','الصناعة وسلاسل الإمداد'],
    modes:k==='center'?['حضوري','عن بعد','هجين']:['حضوري','عن بعد'],
    availability:'متاح ابتداءً من 15 أغسطس 2026',
    qualification:k==='center'?'ترخيص واعتماد تدريبي ساري':'دكتوراه / ماجستير في مجال ذي صلة',
    accreditation:k==='center'?'اعتماد مهني ومؤسسي':'اعتمادات مهنية موثقة في الشبكة',
    experience:k==='center'?'أكثر من 8 سنوات في تقديم البرامج المهنية':`${12+i} سنة خبرة مهنية إجمالية`,
    price:k==='trainer'?'من $120 للساعة · من $850 لليوم':k==='consultant'?'من $180 للساعة · من $1,200 لليوم':k==='expert'?'من $160 للساعة · من $1,100 لليوم':'حسب نطاق الطلب',
    contact:{email:`contact${i+1}@arabexperts.net`,phone:'+968 9000 '+String(1200+i),website:'www.arabexperts.net'},
    hidden:Array.isArray(x.publicHidden)?x.publicHidden:[],
    evidence:['الهوية موثقة','المؤهلات راجعتها المنصة','الاعتمادات مرتبطة بأدلة'],
    reviews:[['جهة مؤسسية','تعاون مهني منظم وتسليم واضح ضمن الوقت.'],['مستفيد موثق','خبرة عملية ومحتوى مناسب للاحتياج.']]
  };
  if(k==='center')common.courses=TRAINING_COURSES.filter(c=>c.specialty===x.sub||c.domain.includes((x.sub||'').split(' ')[0])).slice(0,4);
  if(k==='trainer')common.courses=TRAINING_COURSES.filter(c=>c.specialty===x.sub||c.domain.includes((x.sub||'').split(' ')[0])).slice(0,4);
  if(k==='consultant'||k==='expert')common.projects=[['تطوير نموذج تشغيلي مؤسسي','قيادة التشخيص والتصميم والتسليم'],['مراجعة جاهزية وتحسين الأداء','إعداد الدراسة وخارطة الطريق'],['دعم مشروع تحول متعدد الأطراف','مشاركة استشارية وإشراف']];
  if(k==='researcher')common.projects=[['دراسة تطبيقية محكمة','باحث رئيسي'],['مشروع بحث وتطوير مشترك','شريك بحثي'],['ورقة مؤتمر دولي','مؤلف مشارك']];
  return Object.assign({},x,common)
}
function pubVisible(p,key){return !(p.hidden||[]).includes(key)}
function pubRows(rows,p){let v=rows.filter(r=>r[1]!==undefined&&r[1]!==null&&String(r[1]).trim()&&pubVisible(p,r[2]||''));return v.length?`<div class="pubrows">${v.map(r=>`<div class="pubrow"><small>${esc(r[0])}</small><b>${esc(Array.isArray(r[1])?r[1].join('، '):r[1])}</b></div>`).join('')}</div>`:''}
function pubSection(title,body){return body?`<section class="pubsection"><h3>${title}</h3>${body}</section>`:''}
function pubItems(items){return (items||[]).map(x=>`<div class="pubitem"><b>${esc(Array.isArray(x)?x[0]:(x.title||x.name||x.code||''))}</b><p>${esc(Array.isArray(x)?x[1]:[x.level,x.duration,x.mode,x.lang].filter(Boolean).join(' · '))}</p></div>`).join('')}
function pubChips(items,cls='blue'){return items&&items.length?`<div class="pubchips">${items.map(x=>`<span class="tagb ${cls}">${esc(x)}</span>`).join('')}</div>`:''}
function rDirectoryPublicProfile(){
  let s=G.publicProfile||{kind:'center',index:0,from:42},memberSource=s.source==='membership',x,p;
  if(memberSource)({x,p}=membershipPublicProjection(s.type));else{let M=SEARCH_DIRS[s.kind]||SEARCH_DIRS.center;x=M.list[s.index]||M.list[0];p=profileData(s.kind,x,s.index||0)}
  let isCenter=s.kind==='center';
  if(memberSource&&p.publicEnabled===false&&!s.preview)return pagehead({ctx:'الخصوصية',title:'الملف غير متاح للعامة',desc:'اختار صاحب العضوية عدم إتاحة هذا الملف.'},`<button class="btn ghost sm" onclick="go(${s.from||5})">→ العودة</button>`)+`<div class="card empty"><div class="ic">${IC.lock}</div><b>هذا الملف خاص</b><p>لا تُعرض أي من بياناته العامة وفق موافقة صاحبها الحالية.</p></div>`;
  let courseBody=p.courses&&p.courses.length?pubItems(p.courses):'';
  let workBody=p.projects&&p.projects.length?pubItems(p.projects):'';
  let contactRows=pubRows([['البريد الإلكتروني',p.contact.email,'email'],['الهاتف',p.contact.phone,'phone'],['الموقع الإلكتروني',p.contact.website,'website']],p);
  return pagehead({ctx:'الدليل العام',title:s.preview?'معاينة الملف العام':'الملف العام',desc:'ملف تفصيلي ديناميكي مبني على صلاحيات النشر التي حددها صاحب البيانات.'},`<button class="btn ghost sm" onclick="go(${s.from||5})">→ ${s.preview?'العودة إلى بيانات العضوية':'العودة إلى نتائج البحث'}</button>`)+`
  ${s.preview?`<div class="statusband ${p.publicEnabled===false?'rejected':'approved'}" style="margin-bottom:14px">${IC.eye} <b>معاينة المالك:</b> هذه هي البيانات التي سيراها الزائر فعليًا.${p.publicEnabled===false?' الملف غير متاح للعامة حاليًا، والمعروض أدناه معاينة خاصة لك فقط.':''}</div>`:''}
  <div class="pubhero">
    <div class="pubavatar">${esc(x.name.trim()[2]||x.name.trim()[0])}</div>
    <div><div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:7px"><span class="tagb blue">${DIR_KIND_LABEL[s.kind]}</span>${x.verified?'<span class="tagb green">✓ ملف موثق</span>':'<span class="tagb gray">قيد التوثيق</span>'}${x.rating?`<span class="tagb gold">★ ${x.rating}${x.reputationConfidence!==undefined?` · ثقة ${x.reputationConfidence}%`:''}</span>`:''}${x.entityId?`<span class="tagb gray entity-id">${esc(x.entityId)}</span>`:''}</div>
      <h1>${esc(x.name)}</h1><p>${esc(x.title||x.inst||x.sub)} · ${esc(x.country)}${x.city?' — '+esc(x.city):''}</p></div>
    <div class="pubactions">${s.preview?`<button class="btn gold" onclick="go(${MEMBER_SCREENS[s.type]||33})">تعديل إعدادات الظهور</button>`:`<button class="btn gold" onclick="go(21)">طلب ${isCenter?'تدريب':'خدمة'} ←</button><button class="btn ghost" onclick="toast('تم فتح قناة الرسائل الآمنة')">إرسال رسالة</button>`}${(s.kind==='center'||s.kind==='trainer')?`<button class="btn ghost" onclick="G.catF=G.catF||{};G.catF.q='${esc(x.name)}';persist(true);go(35)">عرض الدورات</button>`:''}</div>
  </div>
  <div class="privacy-strip">🔒 يعرض هذا الملف البيانات التي وافق صاحبها على نشرها فقط؛ أما البيانات المخفية فلا تُرسل إلى مكوّن العرض.${p.privacySummary?` <b>${p.privacySummary.visible} بيان ظاهر · ${p.privacySummary.hidden} بيان مخفي</b>`:''}</div>
  <div class="pubgrid"><main class="pubmain">
    ${pubSection(isCenter?'نبذة عن المركز':'النبذة المهنية',`<p style="margin:0;line-height:1.9;color:var(--ink)">${esc(p.bio)}</p>`)}
    ${pubSection(isCenter?'المجالات والتخصصات التدريبية':'التخصصات ومجالات الممارسة',pubRows([['المجال الرئيسي',x.main],['التخصص',x.sub],['نوع الأعمال والممارسات',isCenter?'التأسيس، التصميم، التنفيذ، التطوير':'التصميم، التنفيذ، الرقابة، التطوير']],p))}
    ${pubSection(isCenter?'الخدمات وأنماط التدريب':'الخدمات المهنية',pubChips(p.services,'green')+pubRows([['أنماط التنفيذ',p.modes]],p))}
    ${courseBody?pubSection(isCenter?'الدورات والبرامج المنشورة':s.kind==='researcher'?'المنشورات والإنتاج العلمي':'الدورات التي يقدمها',courseBody):''}
    ${workBody?pubSection(s.kind==='researcher'?'الأبحاث والمشاريع':'الخبرات والمشاريع المختارة',workBody):''}
    ${pubSection(isCenter?'الاعتمادات والتراخيص':'المؤهلات والاعتمادات',pubRows([['المؤهل / الصفة',p.qualification],['الاعتمادات',p.accreditation],['الخبرة',p.experience]],p))}
    ${pubSection('التقييمات المنشورة',pubItems(p.reviews))}
  </main><aside class="pubside">
    ${pubSection('مؤشرات الملف',`<div class="pubkpis"><div class="pubkpi"><b>${x.rating||'—'}</b><small>السمعة</small></div><div class="pubkpi"><b>${x.reputationConfidence!==undefined?x.reputationConfidence+'%':(x.verified?'موثق':'مراجعة')}</b><small>${x.reputationConfidence!==undefined?'ثقة المؤشر':'الحالة'}</small></div><div class="pubkpi"><b>${x.reputationSampleCount!==undefined?x.reputationSampleCount:(p.privacySummary?p.privacySummary.visible:p.reviews.length)}</b><small>${x.reputationSampleCount!==undefined?'مشروع مقيّم':(p.privacySummary?'بيان ظاهر':'آراء ظاهرة')}</small></div></div>`)}
    ${pubSection('الموقع واللغات',pubRows([['الدولة',x.country],['المدينة',x.city],['لغات العمل',x.langs]],p))}
    ${pubSection('القطاعات',pubChips(p.sectors))}
    ${pubSection('التوفر والتسعير',pubRows([['التوفر',p.availability],['التسعير الاسترشادي',p.price]],p))}
    ${pubSection('الأدلة والتحقق',pubChips(p.evidence,'green'))}
    ${contactRows?pubSection('التواصل المسموح',contactRows):''}
  </aside></div>`}
function rUnifiedPublicProfile(){
  let roles=(G.memberships||[]).filter(t=>['خبير','مركز تدريب','مدرب','مستشار','باحث / أكاديمي'].includes(t));
  if(!G.publicProfile&&G.user&&roles.length){
    return pagehead(data[57],`<button class="btn ghost sm" onclick="go(2)">→ مساحة العمل</button>`)+`
    <div class="card"><div class="sect"><div><h3>اختر العضوية المراد معاينة ملفها العام</h3><p>كل العضويات تستخدم مكوّن العرض العام نفسه، مع محتوى وخصوصية مستقلين لكل عضوية.</p></div></div>
      <div class="action-grid">${roles.map(t=>`<button class="quick-action" onclick="previewMembershipPublic('${t}')"><span class="qa-ic">${IC.doc}</span><span><b>${esc(t)}</b><small>${esc(G.entities.find(e=>e.entityId===G.memberEntityIds?.[t])?.displayName||'معاينة البيانات المسموح بنشرها')}</small></span></button>`).join('')}</div>
    </div>`}
  return rDirectoryPublicProfile()
}
function rLegacyExpertPublic(){
  let e=syncUnifiedEntity('خبير');
  G.publicProfile={source:'membership',type:'خبير',kind:'expert',entityId:e.entityId,preview:true,from:33};
  persist(true);return rDirectoryPublicProfile()
}
function rLegacyCenterPublic(){
  if(G.memberEntityIds?.['مركز تدريب']&&G.memberData?.['مركز تدريب']){
    let e=syncUnifiedEntity('مركز تدريب');
    G.publicProfile={source:'membership',type:'مركز تدريب',kind:'center',entityId:e.entityId,preview:true,from:45}
  }else G.publicProfile={kind:'center',index:0,from:42};
  persist(true);return rDirectoryPublicProfile()
}
/* شريط البحث في الصفحة الرئيسية */
function goSearch(k){if(k==='course'){G.catF=G.catF||{};if(G.homeQ)G.catF.q=G.homeQ;persist(true);go(35);return}
  (G.dirF=G.dirF||{})[k]=G.dirF[k]||{};if(G.homeQ)G.dirF[k].q=G.homeQ;persist(true);go({expert:50,researcher:51,trainer:41,center:42,consultant:58}[k])}
function homeSearchBand(){return `<div class="home-search-band">
  <div class="home-search-row">
    <div class="home-search-input">
      ${IC.search.replace('<svg','<svg style="width:17px;height:17px;color:var(--muted)"')}
      <input aria-label="البحث في شبكة الخبراء العرب" placeholder="ابحث بالاسم أو الاختصاص أو الخدمة…" value="${esc(G.homeQ||'')}" oninput="G.homeQ=this.value" onkeydown="if(event.key==='Enter'){G.searchQ=G.homeQ||'';persist(true);go(5)}">
    </div>
    <button class="btn primary home-search-submit" onclick="G.searchQ=G.homeQ||'';persist(true);go(5)">ابدأ البحث ←</button>
  </div>
  <div class="home-search-scopes">
    <span class="hint">اختر نطاق البحث:</span>
    ${[['expert','🎖 خبير'],['consultant','💼 مستشار'],['researcher','🔬 باحث / أكاديمي'],['trainer','🎓 مدرب'],['center','🏛 مركز تدريب'],['course','📚 دورة تدريبية']].map(x=>`<button class="chip" onclick="goSearch('${x[0]}')">${x[1]}</button>`).join('')}
  </div></div>`}
/* =========================================================
   الموقع العام: الرئيسية، من نحن، البرامج، التسجيل، تواصل
   ========================================================= */
const BOARD=[['د. محمد منذر القادري','رئيس مجلس الإدارة'],['د. عمار حمد','نائب الرئيس'],['د. هشام الخياط','أمين السر'],['د. غيث ورقوزق','عضو'],['د. عمار جوخدار','عضو'],['د. مهلب الداوود','عضو'],['د. عماد المصري','عضو'],['د. محمد خالد شاهين','عضو'],['د. ماهر علاوي','عضو'],['د. أديب الحسيني','عضو'],['م. حسن نوفل','عضو']];
const WORK_FIELDS=['الهندسة والتصنيع','الطاقة والتعدين','التقنيات الرقمية والذكاء الاصطناعي','الزراعة والغذاء والمياه والبيئة','العمران والنقل والبنية التحتية','المهن الإدارية والمالية والقانونية التطبيقية','التعليم التطبيقي وبناء القدرات'];
const PROGRAMS=[
 ['🗂','منصة الخبراء العرب','قاعدة بيانات شاملة ديناميكية لتسهيل الوصول للخبراء محليًا وعالميًا.','gold'],
 ['🤝','ملتقيات الخبرة والابتكار','مؤتمرات وندوات تجمع العقول العربية لتبادل الخبرات وبناء الشراكات.','blue'],
 ['🌱','برنامج الأجيال القادمة من الخبراء','مبادرة لتمكين الشباب الباحثين وربطهم بالنخب العلمية والمهنية.','green'],
 ['🏛','بيت الخبرة','مراكز استشارية متخصصة لدعم المؤسسات في تطوير حلول قائمة على العلم والمعرفة.','violet'],
 ['🏆','جائزة تميز الخبرة والعطاء','تكريم الكفاءات التي تُحدث فرقًا ملموسًا في المجتمع.','gold'],
 ['🔬','حاضنات البحث الافتراضية','مشاريع بحث وتطوير مشتركة تقوم على حاضنات افتراضية عابرة للحدود.','blue'],
 ['💎','مبادرة كنز الخبرات — قامات وطن','استثمار القيمة واستمرارية العطاء؛ رسالة اعتزاز بالكفاءات ونقل الخبرة للأجيال.','green']];
const PARTNERS=[['المنظمات العربية والدولية','🌐','#175cd3'],['الوزارات والمؤسسات الحكومية','🏛','#0a2540'],['الجامعات ومراكز البحث','🎓','#6941c6'],['مراكز تمويل الابتكار','💡','#b54708'],['الجمعيات والنقابات المهنية','🤝','#157347'],['المؤسسات الصناعية والاستشارية','🏭','#43546b'],['مؤسسات الإعلام والنشر','📰','#b08a34']];
const OPPS=[
 ['قائد تحول رقمي لجهة حكومية','السعودية · 3–6 أشهر · هجين','$85K','gold'],
 ['مستشار جاهزية مدن ذكية','الإمارات · عقد سنوي','$120K','blue'],
 ['مدرب PMP لبرنامج مؤسسي','الرياض · 5 أيام','$4.5K','green'],
 ['باحث مشارك — حاضنة الطاقة المتجددة','عن بعد · 6 أشهر','منحة بحثية','violet'],
 ['خبير تدقيق منهجية ISO 21001','مسقط · شهر واحد','$9K','gold'],
 ['استشاري حوكمة بيانات لقطاع صحي','قطر · 4 أشهر','$60K','blue']];
const OFFERS=[
 ['خصم 20% على الباقة الاحترافية','للأعضاء الجدد خلال سبتمبر — وصول كامل للأدلة والمطابقة المتقدمة','linear-gradient(135deg,#0f3460,#0a2540)','الباقة الذهبية'],
 ['دورة PMP بسعر تفضيلي للأعضاء','خصم 30% على رسوم التسجيل عبر مراكز الشبكة المعتمدة','linear-gradient(135deg,#b08a34,#8f6f2a)','عرض تدريبي'],
 ['انشر ملفك المهني مجانًا','لأول 100 خبير مسجل هذا العام — توثيق أولي مجاني','linear-gradient(135deg,#157347,#0d5c38)','مبادرة التوثيق']];
const PKGS=[
 {name:'الأساسية',price:'مجانًا',per:'',feats:['ملف مهني أساسي في الدليل','نتيجتان لكل بحث في الأدلة','تصفح الدورات والتسجيل بها','التقدم على الفرص المفتوحة'],no:['المطابقة المتقدمة والتفسيرية','شارة التوثيق والأولوية','مراسلة العملاء مباشرة'],cta:'ابدأ مجانًا'},
 {name:'الفضية',price:'$49',per:'/سنويًا',feats:['كل مزايا الأساسية','حتى 3 نتائج موسعة لكل بحث','شارة توثيق أولية','تنبيهات الفرص المطابقة','دعم عبر البريد'],no:['الوصول الكامل للأدلة','لوحة تحليلات الأداء'],cta:'اشترك فضي',top:0},
 {name:'الذهبية — الاحترافية',price:'$129',per:'/سنويًا',feats:['وصول غير محدود لجميع أدلة البحث','مطابقة تفسيرية متقدمة وأولوية الظهور','شارة ✓ موثق كاملة','مراسلة مباشرة وعروض تفضيلية','لوحة تحليلات وتقارير'],no:[],cta:'اشترك ذهبي',top:1}];
const SUB_PRICING={
  'الفضية':{فرد:{month:5,year:49},مؤسسة:{month:20,year:199}},
  'الذهبية — الاحترافية':{فرد:{month:13,year:129},مؤسسة:{month:50,year:499}}
};
function pkgTier(){if(!G.user)return 0;return {'الأساسية':1,'الفضية':2,'الذهبية — الاحترافية':3,'الذهبية':3}[G.pkg||'الأساسية']||1}
function pubNav(){return `<div class="pubnav-strip">${[[60,'الرئيسية'],[63,'من نحن'],[61,'مجالات العمل'],[64,'البرامج والمبادرات'],[5,'البحث'],[65,'الدخول والتسجيل'],[66,'تواصل معنا']].map(x=>`<button class="${current===x[0]?'on':''}" onclick="go(${x[0]})">${x[1]}</button>`).join('')}</div>`}
function rHome(){return `
  <section class="home-showcase" aria-labelledby="home-title">
    <div class="home-network-art" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <div class="home-topline">
      <div class="home-brandline">
        <img src="./assets/nae-logo.svg" alt="شعار شبكة الخبراء العرب" width="104" height="104">
        <div><b>شبكة الخبراء العرب</b><span>عقول عربية… أثر عالمي</span></div>
      </div>
      <div class="home-brand-actions">
        <button class="btn gold sm" onclick="go(65)">انضم إلى الشبكة</button>
        <button class="btn ghost sm" onclick="go(50)">تصفح دليل الخبراء</button>
      </div>
    </div>
    <div class="home-copy">
      <span class="home-kicker">منظومة عربية موحدة للخبرة المهنية</span>
      <h1 id="home-title">الخبرة الموثقة في المكان الصحيح</h1>
      <p>منصة عربية تربط احتياجات المؤسسات بالخبراء والمدربين والمراكز والدورات المناسبة، من البحث والمقارنة حتى التعاقد والتسليم.</p>
    </div>
    ${homeSearchBand()}
    <div class="home-proof"><span>✓ ملفات وأدلة قابلة للتحقق</span><span>✓ مطابقة مفسرة وشفافة</span><span>✓ خصوصية على مستوى كل بيان</span></div>
    <div class="home-kpis" aria-label="مؤشرات بنية المنصة">
      ${[['7','مجالات رئيسية','⌘'],['49','تخصصًا تطبيقيًا','▦'],['343','ممارسة مهنية','◆'],['7','أنواع عضوية','◎']].map(s=>`<div class="home-kpi"><i>${s[2]}</i><div><b>${s[0]}</b><span>${s[1]}</span></div></div>`).join('')}
    </div>
  </section>
  <section class="home-help" aria-labelledby="home-help-title">
    <div class="home-section-title"><span>ابدأ من هدفك</span><h2 id="home-help-title">كيف تساعدك الشبكة؟</h2><p>اختر المسار الأقرب إلى احتياجك، وستقودك المنصة خطوة بخطوة.</p></div>
    <div class="home-help-grid">
      ${[
        ['⌕','أبحث عن خبير أو خدمة','اكتشف الخبراء والمستشارين، ثم قارن الأدلة والخبرة والتوفر والسعر.','استكشف الخبراء',50],
        ['▤','أبحث عن تدريب أو دورة','قارن الدورات والمدربين والمراكز وفق المجال واللغة والدولة ونمط التقديم.','استكشف التدريب',35],
        ['◎','لدي احتياج وأريد تكوين فريق','حوّل احتياج المؤسسة إلى بصمة مهمة، ثم احصل على خيارات مطابقة قابلة للتفسير.','أنشئ احتياجًا',21]
      ].map((x,i)=>`<button class="home-help-card home-help-${i+1}" onclick="go(${x[4]})"><span class="home-help-icon">${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small><em>${x[3]} ←</em></button>`).join('')}
    </div>
  </section>
  <div class="pub-sec domain-sec"><div class="head"><h2>استكشف مجالات الخبرة</h2><p>ابدأ من المجال ثم انتقل إلى التخصص والممارسة الدقيقة</p><span class="more" onclick="go(61)">الخريطة الكاملة ←</span></div>
    <div class="domain-grid">${Object.keys(TAX).map((name,i)=>`<button class="domain-card" onclick="G.workTax={main:dec('${enc(name)}'),sub:'',practice:''};persist(true);go(61)"><span>${['⌘','⚡','◈','◌','⌂','▣','✦'][i]||'•'}</span><b>${name}</b><small>7 تخصصات مترابطة</small></button>`).join('')}</div>
  </div>
  <div class="pub-sec"><div class="head"><h2>الخبراء المميزون</h2><p>نخبة موثقة من أعضاء الشبكة</p><span class="more" onclick="go(50)">الدليل الكامل ←</span></div>
    <div class="grid c3">${DIR_EXPERTS.slice(0,3).map(x=>`<div class="feat-card" onclick="go(50)">
      <div style="display:flex;gap:12px;align-items:center"><div class="av">${x.name.trim()[2]||x.name.trim()[0]}</div>
      <div><b>${x.name} <span class="tagb green" style="font-size:9.5px">✓ موثق</span></b><small>${x.title}</small></div></div>
      <div class="chips"><span class="chip static" style="font-size:10.5px">${x.spec}</span><span class="chip static" style="font-size:10.5px">📍 ${x.country}</span><span class="chip static" style="font-size:10.5px;color:var(--gold-2)">★ ${x.rating}</span></div>
    </div>`).join('')}</div></div>
  <div class="pub-sec"><div class="head"><h2>المراكز التدريبية المميزة</h2><p>مراكز تدريب معتمدة من الشبكة</p><span class="more" onclick="go(42)">كل المراكز ←</span></div>
    <div class="grid c3">${DIR_CENTERS.slice(0,3).map(x=>`<div class="feat-card" onclick="go(42)">
      <div style="display:flex;gap:12px;align-items:center"><div class="av" style="background:linear-gradient(135deg,var(--gold),#8f6f2a);color:#0a2540">${x.name.trim()[0]}</div>
      <div><b>${x.name} <span class="tagb green" style="font-size:9.5px">✓ معتمد</span></b><small>${x.spec} · ${x.city}</small></div></div>
      <small>${x.extra}</small></div>`).join('')}</div></div>
  <div class="pub-sec"><div class="head"><h2>الفرص والمشاريع المميزة</h2><p>أحدث الفرص المنشورة عبر المنصة</p><span class="more" onclick="toast('سجل دخولك لتصفح كل الفرص')">كل الفرص ←</span></div>
    <div class="grid c2">${OPPS.map(o=>`<div class="opp-card" onclick="go(21)">
      <div class="bdg2" style="background:var(--${o[3]}-soft)">${{gold:'🎯',blue:'🏙',green:'🎓',violet:'🔬'}[o[3]]}</div>
      <div style="flex:1;min-width:0"><b style="font-size:13.5px">${o[0]}</b><small style="color:var(--muted);font-size:11.3px;display:block">${o[1]}</small></div>
      <b style="color:var(--gold-2);font-size:14px;white-space:nowrap">${o[2]}</b></div>`).join('')}</div></div>
  <div class="pub-sec"><div class="head"><h2>أكثر الدورات طلبًا</h2><p>برامج تدريبية بأعلى معدلات تسجيل</p><span class="more" onclick="go(35)">دليل الدورات ←</span></div>
    <div class="grid c3">${courses.slice(0,3).map(c=>courseCard(c)).join('')}</div></div>
  <div class="pub-sec"><div class="head"><h2>عروض مميزة</h2><p>مزايا حصرية لأعضاء الشبكة</p></div>
    <div class="grid c3">${OFFERS.map(o=>`<div class="offer-card" style="background:${o[2]}">
      <span class="off-tag">${o[3]}</span><b>${o[0]}</b><small>${o[1]}</small>
      <button class="btn sm" style="background:rgba(255,255,255,.18);color:#fff;margin-top:10px;align-self:flex-start" onclick="go(65)">اغتنم العرض ←</button></div>`).join('')}</div></div>
  <div class="pub-sec"><div class="head"><h2>شركاؤنا</h2><p>تحالفات استراتيجية محلية ودولية</p></div>
    <div class="grid" style="grid-template-columns:repeat(7,1fr);gap:12px">${PARTNERS.map(p=>`<div class="partner-logo" onclick="go(63)"><div class="ic" style="background:${p[2]}">${p[1]}</div><b>${p[0]}</b></div>`).join('')}</div></div>
  <div class="pub-sec card" style="padding:26px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:linear-gradient(115deg,#fffdf6,var(--gold-soft));border-color:#eaddc2">
    <div style="flex:1;min-width:240px"><h2 style="font-size:17px;color:var(--navy)">جاهز لتحويل خبرتك إلى أثر عالمي؟</h2><p style="font-size:12.5px;color:#6d5c33;margin-top:5px">انضم إلى شبكة الخبراء العرب اليوم — عضوية خبير، مدرب، باحث، مركز تدريب، مستشار أو عميل.</p></div>
    <button class="btn gold" onclick="go(1)">سجّل عضويتك الآن ←</button>
    <button class="btn ghost" onclick="go(66)">تواصل معنا</button></div>`}
function rAbout(){let t=G.aboutTab||0;
  const TABS=['التعريف بالشبكة','الرؤية','الرسالة','القيم والمنطلقات','الأهداف الاستراتيجية','مجلس الإدارة','شبكة الشركاء'];
  let body='';
  if(t===0)body=`<div class="about-hero"><h2 style="font-size:20px">شبكة الخبراء العرب</h2>
    <p style="color:#b9cade;font-size:13px;margin-top:10px;max-width:720px;line-height:2">شبكة الخبراء العرب هي منصة دولية تجمع نخبة الخبراء الناطقين بالعربية من مختلف التخصصات العلمية، والتقنية، والإدارية، والمالية، والقانونية. تعمل الشبكة لتوفير منصة مرنة متكاملة لإدارة الخبرة والمعرفة تُمكّن الخبراء من التأثير في أوطانهم وفي محيطهم الإقليمي والدولي من خلال دعم وتعزيز وتكامل مساهماتهم في التنمية العلمية والاجتماعية والاقتصادية والبيئية.</p>
    <p style="color:#f2dfae;font-size:13px;margin-top:12px;font-weight:700">«عقول عربية… أثر عالمي» | "Arab Minds… Global Impact"</p></div>`;
  if(t===1)body=`<div class="grid c2"><div class="vvm-card"><h3>🎯 رؤيتنا</h3><p>أن تكون شبكة الخبراء العرب المنصة الأولى التي تحوّل الخبرة المكتسبة إلى تأثير ملموس، وتربط الخبراء المحليين بنظرائهم العرب والعالميين، لبناء مستقبل قائم على الابتكار والمسؤولية والتنمية المستدامة.</p></div>
    <div class="vvm-card"><h3>🧭 بوصلتنا</h3><p>قوة معرفية عربية عالمية فاعلة في التنمية والابتكار وريادة التغيير — على المستوى المحلي والإقليمي والدولي.</p></div></div>`;
  if(t===2)body=`<div class="vvm-card"><h3>📜 رسالتنا</h3><p style="margin-bottom:10px">تمكين الخبراء العرب من تحويل المعرفة والخبرة إلى مشاريع ومبادرات مؤثرة، والمساهمة في التطوير العلمي والتنموي للبلاد من خلال:</p>
    <ol><li>ربطهم بشبكة واحدة لتعزيز التعاون الإقليمي والدولي.</li><li>تقديم الاستشارات والدعم الفني للمؤسسات والأفراد.</li><li>نقل وتوطين الخبرة والعلوم والتكنولوجيا والمعرفة وتوظيفها لخدمة المجتمع.</li></ol></div>`;
  if(t===3)body=`<div class="grid c2"><div class="vvm-card"><h3>💠 منطلقاتنا</h3><p>ولدت الشبكة من إيمان عميق بأن الخبراء العرب يمتلكون قدرات هائلة، لكنها بحاجة لمنصة تجمعهم وتتيح لهم التأثير والتكامل — هكذا تصبح الشبكة قوة معرفية عالمية فاعلة في التنمية والابتكار وريادة التغيير.</p></div>
    <div class="vvm-card"><h3>⭐ قيم الشبكة الأساسية</h3><ol><li><b>التمكين المعرفي:</b> تحويل المعرفة إلى أدوات تأثير وتميّز.</li><li><b>الابتكار والإبداع:</b> التطور المستدام يقوم على الإبداع والابتكار.</li><li><b>الشفافية والمصداقية:</b> أساس الثقة والتعاون في العمل المؤسسي.</li><li><b>التنمية المستدامة:</b> استدامة الأثر في جميع الأنشطة والبرامج.</li><li><b>الأصالة والهوية الواعية:</b> التوازن بين التراث والحداثة.</li><li><b>الريادة والتميز والكفاءة:</b> معيار كل عمل نقوم به.</li><li><b>التشاركية:</b> التعاون والعمل بروح الفريق الواحد.</li></ol></div></div>`;
  if(t===4)body=`<div class="vvm-card"><h3>🗺 أهداف الشبكة الاستراتيجية</h3><ol>
    <li>بناء جسور تواصل فعّالة بين الخبراء العرب داخل الوطن وخارجه.</li>
    <li>تأسيس مجتمع مهني تفاعلي يدعم البحث والابتكار في مختلف المجالات.</li>
    <li>تمكين الخبراء العرب من التأثير في صناعة الخطط الاستراتيجية للتنمية الوطنية.</li>
    <li>تعزيز حضور الخبرة العربية في المحافل الدولية.</li>
    <li>دعم مبادرات ريادة المعرفة والمشروعات التنموية المستدامة.</li>
    <li>تبنّي أفكار مبتكرة ومشاريع جديدة للأعضاء وربطها بالجهات الممولة.</li>
    <li>المشاركة في نقل وتوطين التكنولوجيا والعلوم إلى الوطن الأم.</li></ol></div>`;
  if(t===5)body=`<div class="grid c4">${BOARD.map(b=>`<div class="board-card"><div class="av">${b[0].split(' ')[1]?.[0]||b[0][0]}</div><b>${b[0]}</b><small>${b[1]}</small></div>`).join('')}</div>`;
  if(t===6)body=`<div class="vvm-card" style="margin-bottom:16px"><h3>🌐 شبكة التأثير والشركاء</h3><p>تعمل الشبكة عبر تحالفات استراتيجية مع شركاء محليين ودوليين لتوسيع دائرة التعاون — هدفنا أن تكون الشبكة صوتًا معرفيًا موحدًا للخبراء العرب، وتساهم في إبراز القدرات الوطنية على المستوى العربي والدولي.</p></div>
    <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:12px">${PARTNERS.map(p=>`<div class="partner-logo"><div class="ic" style="background:${p[2]}">${p[1]}</div><b>${p[0]}</b></div>`).join('')}</div>`;
  return pagehead({ctx:'الموقع العام',title:'من نحن',desc:'شبكة الخبراء العرب — الهوية والرؤية والحوكمة.'})+`
  <div class="tabs" style="flex-wrap:wrap">${TABS.map((x,i)=>`<button class="${t===i?'on':''}" onclick="G.aboutTab=${i};persist(true);render()">${x}</button>`).join('')}</div>${body}`}
function workTaxSelect(level,value){G.workTax=G.workTax||{main:'',sub:'',practice:''};
  if(level==='main'){G.workTax.main=dec(value);G.workTax.sub='';G.workTax.practice=''}
  if(level==='sub'){G.workTax.sub=dec(value);G.workTax.practice=''}
  if(level==='practice')G.workTax.practice=dec(value);
  persist(true);render();window.scrollTo({top:0,behavior:'smooth'})}
function workTaxReset(level){G.workTax=G.workTax||{main:'',sub:'',practice:''};if(level<=0)G.workTax={main:'',sub:'',practice:''};else if(level===1){G.workTax.sub='';G.workTax.practice=''}else G.workTax.practice='';persist(true);render();window.scrollTo({top:0,behavior:'smooth'})}
function rWorkFields(){let s=G.workTax=G.workTax||{main:'',sub:'',practice:''};
  if(s.main&&!TAX[s.main])s={main:'',sub:'',practice:''};
  if(s.sub&&!TAX[s.main]?.[s.sub]){s.sub='';s.practice=''}
  if(s.practice&&!TAX[s.main]?.[s.sub]?.includes(s.practice))s.practice='';
  G.workTax=s;let level=!s.main?0:!s.sub?1:!s.practice?2:3;
  const labels=['المجالات الرئيسية','التخصصات الفرعية','نوع الأعمال والممارسات','المحتوى والممارسات التفصيلية'];
  let progress=`<div class="tax-progress">${labels.map((x,i)=>`<div class="stage ${i<level?'done':i===level?'current':''}"><i>${i<level?'✓':i+1}</i><span>${x}</span></div>`).join('')}</div>`;
  let crumbs=`<div class="tax-crumbs"><button onclick="workTaxReset(0)">مجالات العمل</button>${s.main?`<span>←</span><button onclick="workTaxReset(1)">${esc(s.main)}</button>`:''}${s.sub?`<span>←</span><button onclick="workTaxReset(2)">${esc(s.sub)}</button>`:''}${s.practice?`<span>←</span><b>${esc(s.practice)}</b>`:''}</div>`;
  let body='';
  if(level===0)body=`<div class="grid c3">${Object.keys(TAX).map((main,i)=>`<button class="tax-card" onclick="workTaxSelect('main','${enc(main)}')"><span class="no">${i+1}</span><span class="txt"><b>${esc(main)}</b><p>${Object.keys(TAX[main]).slice(0,3).join('، ')}…</p><small>عرض التخصصات الفرعية السبعة ←</small></span></button>`).join('')}</div>`;
  if(level===1){let subs=Object.keys(TAX[s.main]||{});body=`<div class="pagehead" style="margin-bottom:14px"><div><div class="kick">المجال الرئيسي</div><h1 style="font-size:19px">${esc(s.main)}</h1><p>اختر أحد التخصصات الفرعية السبعة للانتقال إلى أنواع الأعمال والممارسات.</p></div><div class="acts"><button class="btn ghost sm" onclick="workTaxReset(0)">→ المجالات الرئيسية</button></div></div><div class="grid c2">${subs.map((sub,i)=>`<button class="tax-card" onclick="workTaxSelect('sub','${enc(sub)}')"><span class="no">${i+1}</span><span class="txt"><b>${esc(sub)}</b><p>${(TAX[s.main][sub]||[]).join('، ')}</p><small>عرض أنواع الأعمال والممارسات ←</small></span></button>`).join('')}</div>`}
  if(level===2){let practices=TAX[s.main]?.[s.sub]||[];body=`<div class="pagehead" style="margin-bottom:14px"><div><div class="kick">التخصص الفرعي</div><h1 style="font-size:19px">${esc(s.sub)}</h1><p>اختر نوع العمل أو الممارسة للوصول إلى المحتوى والممارسات التفصيلية.</p></div><div class="acts"><button class="btn ghost sm" onclick="workTaxReset(1)">→ التخصصات الفرعية</button></div></div><h2 style="font-size:15px;color:var(--navy);margin-bottom:12px">نوع الأعمال والممارسات</h2><div class="grid c2">${practices.map((p,i)=>`<button class="tax-card practice-card" onclick="workTaxSelect('practice','${enc(p)}')"><span class="no">${i+1}</span><span class="txt"><b>${esc(p)}</b><small>عرض المحتوى والممارسات التفصيلية ←</small></span></button>`).join('')}</div>`}
  if(level===3){let details=TAX_DETAILS[s.main]?.[s.sub]?.[s.practice]||[],mi=Object.keys(TAX).indexOf(s.main)+1,si=Object.keys(TAX[s.main]||{}).indexOf(s.sub)+1,pi=(TAX[s.main]?.[s.sub]||[]).indexOf(s.practice)+1,code=`KD-${String(mi).padStart(2,'0')}-${String(si).padStart(2,'0')}-${String(pi).padStart(2,'0')}`;
    body=`<div class="card panel"><div class="pagehead" style="margin-bottom:8px"><div><div class="kick">المحتوى والممارسات التفصيلية</div><h1 style="font-size:19px">${esc(s.practice)}</h1><p>${esc(s.main)} ← ${esc(s.sub)}</p></div><div class="acts"><span class="tagb gold">${code}</span><button class="btn soft sm" onclick="startCrosswalkFromProfessional('${enc(s.main)}','${enc(s.sub)}','${enc(s.practice)}','')">ربط المسار بدورة</button><button class="btn ghost sm" onclick="workTaxReset(2)">→ أنواع الأعمال والممارسات</button></div></div><div class="detail-list">${details.map((x,i)=>{let linked=linkedCoursesForProfessional(s.main,s.sub,s.practice,x).length;return`<div class="detail-item"><i>${i+1}</i><span style="flex:1">${esc(x)}</span>${linked?`<span class="tagb green">${linked} دورة مرتبطة</span>`:''}<button class="btn xs soft" onclick="startCrosswalkFromProfessional('${enc(s.main)}','${enc(s.sub)}','${enc(s.practice)}','${enc(x)}')">ربط بالتدريب</button></div>`}).join('')}</div>${!details.length?'<div class="empty"><b>لا توجد تفاصيل مسجلة</b><p>راجع مصدر التصنيف أو اختر ممارسة أخرى.</p></div>':''}</div>`}
  return pagehead({ctx:'الموقع العام',title:'مجالات العمل',desc:'تصفح هرمي مبسط للوصول من المجالات السبعة إلى أدق محتوى وممارسة تطبيقية.'})+progress+crumbs+body+`
  <div class="note mt">يعتمد هذا المتصفح على التصنيف التطبيقي الكامل: <b>7 مجالات رئيسية × 7 تخصصات فرعية × 7 أنواع أعمال وممارسات = 343 مسارًا</b>. لا تُعرض التفاصيل دفعة واحدة لتبقى الشاشة واضحة وسهلة الاستخدام.</div>`}
function rPrograms(){return pagehead({ctx:'الموقع العام',title:'البرامج والمبادرات',desc:'برامج الشبكة ومبادراتها لتحويل الخبرة إلى أثر تنموي ملموس.'})+`
  <div class="grid c3">${PROGRAMS.map(p=>`<div class="prog-card">
    <div class="ic" style="background:var(--${p[3]}-soft)">${p[0]}</div>
    <b>${p[1]}</b><p>${p[2]}</p>
    <button class="btn xs soft" style="align-self:flex-start" onclick="toast('تفاصيل البرنامج — قريبًا في النسخة الكاملة')">التفاصيل ←</button></div>`).join('')}</div>
  <div class="card mt" style="padding:24px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:linear-gradient(115deg,#0a2540,#123a68);border:0;color:#fff">
    <div style="flex:1;min-width:240px"><b style="font-size:16px">لديك فكرة مبادرة أو مشروع؟</b><p style="font-size:12.5px;color:#b9cade;margin-top:4px">تتبنّى الشبكة الأفكار المبتكرة للأعضاء وتربطها بالجهات الممولة.</p></div>
    <button class="btn gold" onclick="go(66)">اقترح مبادرتك ←</button></div>`}
function rRegister(){let cur=G.pkg;let types=[['خبير','ملف مهني موثق ومطابقة للفرص'],['مدرب','ملف تدريبي ودورات مرتبطة'],['باحث / أكاديمي','ملف علمي وحاضنات بحث'],['مستشار','خدمات استشارية وعروض'],['مركز تدريب','ملف مؤسسي وطرح دورات'],['العميل','طلب خبراء واستشارات'],['مدير / مشغل المنصة','صلاحيات الإدارة والتحقق والاعتماد والمحتوى']];
  return pagehead({ctx:'الموقع العام',title:'التسجيل والاشتراكات',desc:'اختر نوع عضويتك ثم باقة الاشتراك المناسبة — يمكن الترقية في أي وقت.'})+`
  ${cur?`<div class="statusband approved" style="margin-bottom:16px">${IC.check} باقتك الحالية: <b>${cur}</b> — يمكنك الترقية أدناه.</div>`:''}
  ${G.subscription?`<div class="statusband approved" style="margin-bottom:16px">${IC.shield} الاشتراك <b>${esc(G.subscription.status)}</b> — ${esc(G.subscription.package)} · ${G.subscription.period==='year'?'سنوي':'شهري'} · ${G.subscription.membershipCount} عضوية · الإيصال ${esc(G.subscription.receipt)}</div>`:''}
  <h2 style="font-size:16px;color:var(--navy);margin-bottom:4px">أولًا — اختر نوع عضويتك</h2>
  <p style="font-size:12px;color:var(--muted);margin-bottom:12px">اختر عضوية واحدة أو أكثر — بعد اختيار الباقة تُفتح لك نماذج بياناتها بالتسلسل مباشرة دون إعادة الاختيار.</p>
  <div class="grid c3">${types.map(t=>{let done=G.completed.includes(t[0]),sel=G.memberships.includes(t[0]);
    return `<div class="rolecard ${sel?'sel':''} ${done?'done':''}" onclick="toggleRole('${enc(t[0])}')"><span class="ck">${done||sel?'✓':''}</span><b>${t[0]}</b><small>${t[1]}</small>${done?'<span class="tagb green" style="margin-top:6px">مكتملة</span>':''}</div>`}).join('')}</div>
  <h2 style="font-size:16px;color:var(--navy);margin:26px 0 4px">ثانيًا — باقات الاشتراك</h2>
  <p style="font-size:12px;color:var(--muted);margin-bottom:16px">تتحكم الباقة في نطاق الوصول لأدلة البحث (الخبراء، الباحثون، المدربون، المراكز، الدورات) ومزايا المطابقة والتوثيق.</p>
  <div class="grid c3">${PKGS.map(p=>`<div class="pkg-card ${p.top?'top':''}">
    ${p.top?'<span class="ribbon">الأكثر اختيارًا ★</span>':''}
    <h3>${p.name}</h3><div class="price">${p.price}<small> ${p.per}</small></div>
    <ul>${p.feats.map(f=>`<li>${f}</li>`).join('')}${p.no.map(f=>`<li class="no">${f}</li>`).join('')}</ul>
    <button class="btn ${p.top?'gold':cur===p.name?'success':'primary'}" style="justify-content:center" onclick="choosePkg('${enc(p.name)}')">${cur===p.name?'✓ باقتك الحالية':G.memberships.length?(p.name==='الأساسية'?'تفعيل وبدء إدخال البيانات ←':'متابعة إلى الدفع ←'):p.cta}</button></div>`).join('')}</div>
  <div class="card panel mt"><h3>ضوابط الوصول للبحث حسب الباقة <span class="line"></span></h3>
    <table class="tbl mt"><thead><tr><th>الدليل</th><th>زائر</th><th>الأساسية</th><th>الفضية</th><th>الذهبية</th></tr></thead><tbody>
    ${[['الخبراء','نتيجة واحدة','نتيجتان','3 نتائج','غير محدود'],['الباحثون','نتيجة واحدة','نتيجة واحدة','نتيجتان','غير محدود'],['المدربون','نتيجة واحدة','نتيجة واحدة','3 نتائج','غير محدود'],['مراكز التدريب','نتيجة واحدة','نتيجتان','3 نتائج','غير محدود'],['الدورات التدريبية','دورتان','كامل الدليل','كامل الدليل','كامل الدليل']].map(r=>`<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td><span class="tagb gold">${r[4]}</span></td></tr>`).join('')}
    </tbody></table></div>`}
function rEntry(){return rLogin()}
function choosePkg(p){p=dec(p);
  if(!G.user){toast('سجّل دخولك أو أنشئ حسابك أولًا');go(1);return}
  if(!G.memberships.length){go(44);toast('اختر نوع عضوية واحدًا على الأقل قبل تحديد الباقة');return}
  if(p!=='الأساسية'){
    G.checkout={package:p,step:0,subscriberType:'فرد',period:'year',billingName:'',billingEmail:'',billingCountry:'',taxNo:'',paymentMethod:'بوابة دفع إلكترونية آمنة',accepted:false};
    persist(true);go(55);return
  }
  G.pkg=p;G.subscription=null;persist(true);
  let next=G.memberships.find(r=>!G.completed.includes(r));
  if(next){G.ctx=next==='العميل'?'عميل':next;persist(true);go(MEMBER_SCREENS[next]);toast('فعّلت باقة «'+p+'» — أكمل بيانات عضوية «'+next+'»')}
  else if(G.completed.length){render();toast('فعّلت باقة «'+p+'» — كل عضوياتك مكتملة')}
  else{go(44);toast('فعّلت باقة «'+p+'» — اختر نوع عضويتك للمتابعة')}}
function checkoutState(){
  if(!G.checkout||!SUB_PRICING[G.checkout.package])G.checkout={package:'الفضية',step:0,subscriberType:'فرد',period:'year',billingName:'',billingEmail:'',billingCountry:'',taxNo:'',paymentMethod:'بوابة دفع إلكترونية آمنة',accepted:false};
  return G.checkout
}
function checkoutPrice(){
  let c=checkoutState(),count=Math.max(1,G.memberships.length),unit=SUB_PRICING[c.package][c.subscriberType][c.period];
  return{unit,count,total:unit*count,currency:'USD'}
}
function checkoutSet(k,v){let c=checkoutState();c[k]=v;if(k==='subscriberType'&&v==='فرد')c.taxNo='';persist(true);render()}
function checkoutInput(k,v){let c=checkoutState();c[k]=v;persist(true)}
function checkoutValid(stepNo){
  let c=checkoutState();
  if(stepNo===0&&!G.memberships.length){toast('لا توجد عضويات مختارة');go(44);return false}
  if(stepNo===1){
    if(!c.billingName.trim()){toast('أدخل اسم صاحب الفاتورة');return false}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.billingEmail)){toast('أدخل إيميل فوترة صحيحًا');return false}
    if(!c.billingCountry){toast('اختر دولة الفوترة');return false}
    if(c.subscriberType==='مؤسسة'&&!c.taxNo.trim()){toast('أدخل الرقم الضريبي أو رقم التسجيل للمؤسسة');return false}
  }
  if(stepNo===2&&!c.accepted){toast('يلزم تأكيد الموافقة على شروط الاشتراك');return false}
  return true
}
function checkoutMove(delta){
  let c=checkoutState();
  if(delta>0&&!checkoutValid(c.step))return;
  c.step=Math.max(0,Math.min(2,c.step+delta));persist(true);render();window.scrollTo({top:0})
}
function continueToMemberData(msg){
  let next=G.memberships.find(r=>!G.completed.includes(r));
  if(next){G.activeMembership=next;G.ctx=next==='العميل'?'عميل':next;if(ensureLife(next).state==='not_started')lifeTransition(next,'draft','المستخدم','بدء إدخال البيانات بعد تفعيل الاشتراك');persist(true);go(MEMBER_SCREENS[next]);toast(msg+' — ابدأ بيانات «'+next+'»')}
  else{go(2);toast(msg+' — جميع بيانات العضويات مكتملة')}
}
function completePayment(){
  let c=checkoutState();if(!checkoutValid(2))return;let p=checkoutPrice(),now=Date.now();
  let result=financeCompleteSubscriptionPayment(c,p);
  if(result.activated)continueToMemberData('اكتملت عملية الدفع وتفعّل الاشتراك');
  else{go(81);toast('أُصدرت الفاتورة وتعليمات التحويل — يُفعّل الاشتراك بعد تأكيد الاستلام')}
}
function rSubscriptionCheckout(){
  let c=checkoutState(),p=checkoutPrice(),labels=['تفاصيل الاشتراك','بيانات الفوترة','المراجعة والتأكيد'];
  let main='';
  if(c.step===0)main=`<h2>تفاصيل الاشتراك</h2><p>حدد صفة المشترك ومدة الاشتراك. عدد العضويات محسوب تلقائيًا من اختياراتك السابقة.</p>
    <div class="field wide"><label>الباقة المختارة</label><div class="statusband draft">${IC.check}<b>${esc(c.package)}</b></div></div>
    <div class="field wide mt"><label>صفة المشترك <em>*</em></label><div class="choice-grid">
      ${[['فرد','اشتراك شخصي باسم العضو'],['مؤسسة','اشتراك باسم مؤسسة أو جهة']].map(x=>`<button class="choice ${c.subscriberType===x[0]?'on':''}" onclick="checkoutSet('subscriberType','${x[0]}')"><b>${x[0]}</b><small>${x[1]}</small></button>`).join('')}</div></div>
    <div class="field wide mt"><label>مدة الاشتراك <em>*</em></label><div class="choice-grid">
      ${[['month','شهري','يتجدد كل شهر'],['year','سنوي','يتجدد كل سنة']].map(x=>`<button class="choice ${c.period===x[0]?'on':''}" onclick="checkoutSet('period','${x[0]}')"><b>${x[1]}</b><small>${x[2]}</small></button>`).join('')}</div></div>
    <div class="note mt">الأسعار المعروضة في هذا النموذج تجريبية وقابلة للتعديل عند اعتماد سياسة الاشتراكات.</div>`;
  if(c.step===1)main=`<h2>بيانات الفوترة</h2><p>تُستخدم لإصدار الفاتورة وإشعار نجاح الاشتراك.</p><div class="fields">
    <div class="field"><label>اسم صاحب الفاتورة <em>*</em></label><input class="ctl" value="${esc(c.billingName)}" oninput="checkoutInput('billingName',this.value)"></div>
    <div class="field"><label>إيميل الفوترة <em>*</em></label><input class="ctl" type="email" value="${esc(c.billingEmail)}" oninput="checkoutInput('billingEmail',this.value)"></div>
    <div class="field"><label>دولة الفوترة <em>*</em></label><select class="ctl" onchange="checkoutSet('billingCountry',this.value)"><option value="">اختر الدولة…</option>${countries.map(x=>`<option ${c.billingCountry===x?'selected':''}>${x}</option>`).join('')}</select></div>
    ${c.subscriberType==='مؤسسة'?`<div class="field"><label>الرقم الضريبي أو رقم التسجيل <em>*</em></label><input class="ctl" value="${esc(c.taxNo)}" oninput="checkoutInput('taxNo',this.value)"></div>`:''}
    <div class="field wide"><label>طريقة الدفع <em>*</em></label><select class="ctl" onchange="checkoutSet('paymentMethod',this.value)">${['بوابة دفع إلكترونية آمنة','تحويل مصرفي'].map(x=>`<option ${c.paymentMethod===x?'selected':''}>${x}</option>`).join('')}</select></div></div>
    <div class="secure-note mt">${IC.shield}<span>لن تُدخل أرقام البطاقات في هذا الملف. في النسخة التشغيلية تُحوّل العملية إلى بوابة دفع متوافقة أمنيًا، وتعود للمنصة نتيجة العملية ورقمها المرجعي فقط.</span></div>`;
  if(c.step===2)main=`<h2>المراجعة والتأكيد</h2><p>راجع تفاصيل الاشتراك قبل تنفيذ عملية الدفع التجريبية.</p>
    <div class="grid c2">
      <div class="card panel"><h3>المشترك</h3><div class="lrow"><b>الصفة</b><small>${c.subscriberType}</small></div><div class="lrow"><b>صاحب الفاتورة</b><small>${esc(c.billingName)}</small></div><div class="lrow"><b>الإيميل</b><small>${esc(c.billingEmail)}</small></div><div class="lrow"><b>الدولة</b><small>${esc(c.billingCountry)}</small></div></div>
      <div class="card panel"><h3>الاشتراك</h3><div class="lrow"><b>الباقة</b><small>${esc(c.package)}</small></div><div class="lrow"><b>المدة</b><small>${c.period==='year'?'سنة':'شهر'}</small></div><div class="lrow"><b>العضويات</b><small>${p.count}</small></div><div class="lrow"><b>طريقة الدفع</b><small>${esc(c.paymentMethod)}</small></div></div></div>
    <label class="choice mt ${c.accepted?'on':''}" style="display:flex;gap:10px;align-items:center"><input type="checkbox" ${c.accepted?'checked':''} onchange="checkoutSet('accepted',this.checked)"><span><b>أوافق على شروط الاشتراك والفوترة</b><small>أؤكد صحة البيانات وأفهم أن هذه العملية تجريبية في النموذج الحالي.</small></span></label>`;
  return pagehead(data[55])+`<div class="checkout-steps">${labels.map((x,i)=>`<div class="checkout-step ${i===c.step?'on':i<c.step?'done':''}">${i<c.step?'✓ ':''}${i+1}. ${x}</div>`).join('')}</div>
    <div class="checkout-layout"><div class="card checkout-card">${main}<div class="wizfoot"><button class="btn ghost" onclick="${c.step?'checkoutMove(-1)':'go(65)'}">→ ${c.step?'الخطوة السابقة':'باقات الاشتراك'}</button><span class="sp"></span>${c.step<2?`<button class="btn primary" onclick="checkoutMove(1)">حفظ ومتابعة ←</button>`:`<button class="btn gold" onclick="completePayment()">إتمام الدفع التجريبي والمتابعة ←</button>`}</div></div>
    <aside class="card checkout-summary"><h3>ملخص السعر</h3><div class="price-line"><span>سعر العضوية</span><b>$${p.unit}</b></div><div class="price-line"><span>عدد العضويات</span><b>× ${p.count}</b></div><div class="price-line"><span>دورة الفوترة</span><b>${c.period==='year'?'سنوية':'شهرية'}</b></div><div class="price-line total"><span>الإجمالي</span><b>$${p.total} <small>USD</small></b></div><div class="checkout-members">${G.memberships.map(x=>`<span class="tagb blue">${esc(x)}</span>`).join('')}</div></aside></div>`}
function rContact(){return pagehead({ctx:'الموقع العام',title:'تواصل معنا',desc:'فريق الشبكة جاهز للرد على استفساراتك وشراكاتك المقترحة.'})+`
  <div class="grid" style="grid-template-columns:1.5fr 1fr;gap:18px;align-items:start">
    <div class="card formcard" style="min-height:0">
      <div class="fields">
        <div class="field"><label>الاسم الكامل <em>*</em></label><input class="ctl" id="ct-name"></div>
        <div class="field"><label>البريد الإلكتروني <em>*</em></label><input class="ctl" type="email" id="ct-email"></div>
        <div class="field"><label>نوع الاستفسار</label><select class="ctl" id="ct-type"><option>استفسار عام</option><option>عضوية واشتراكات</option><option>شراكة استراتيجية</option><option>برامج ومبادرات</option><option>دعم فني</option></select></div>
        <div class="field"><label>الدولة</label><select class="ctl" id="ct-country"><option value="" selected>اختر الدولة…</option>${countries.map(c=>`<option>${c}</option>`).join('')}</select></div>
        <div class="field wide"><label>رسالتك <em>*</em></label><textarea class="ctl" rows="4" id="ct-msg"></textarea></div>
      </div>
      <div class="wizfoot"><span class="sp"></span><button class="btn primary" onclick="sendContact()">إرسال الرسالة ✈</button></div></div>
    <div>
      <div class="card panel"><h3>قنوات التواصل</h3>
        <div class="lrow"><b>📧 البريد الإلكتروني</b><small><a href="mailto:info@arabexperts.net" dir="ltr">info@arabexperts.net</a></small></div>
        <div class="lrow"><b>📱 الهاتف</b><small><a href="tel:0096893569971" dir="ltr">0096893569971</a></small></div>
        <div class="lrow"><b>📍 المقر</b><small>سلطنة عُمان</small></div>
        <div class="lrow"><b>🕐 ساعات العمل</b><small>الأحد–الخميس · 9ص–5م</small></div></div>
      <div class="card panel mt"><h3>تابع الشبكة</h3>
        <div class="chips" style="margin-top:10px">
          <a class="chip" href="https://www.linkedin.com/groups/4146994/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a class="chip" href="https://x.com/AEN01373298" target="_blank" rel="noopener noreferrer">X</a>
        </div></div>
    </div></div>`}
function sendContact(){let n=$('ct-name').value.trim(),e=$('ct-email').value.trim(),m=$('ct-msg').value.trim();
  if(!n||!e||!m){toast('أكمل الحقول الإلزامية');return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){toast('أدخل بريدًا صحيحًا');return}
  ['ct-name','ct-email','ct-msg'].forEach(i=>$(i).value='');toast('وصلت رسالتك — سنرد خلال يومي عمل ✓')}
