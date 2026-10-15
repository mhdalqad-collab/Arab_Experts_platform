/* ===== التوجيه ===== */
const MEMBER_SCREENS={'خبير':33,'مركز تدريب':45,'مدرب':46,'مستشار':47,'باحث / أكاديمي':48,'العميل':49,'مدير / مشغل المنصة':52};
let current=0,navStack=[];
function go(id){recEdit=null;if(current&&current!==id)navStack.push(current);location.hash='#/'+id;render()}
function goBack(){let id;while(navStack.length&&!id){let x=navStack.pop();if(x!==current)id=x}
  if(!id)id=G.user?2:60;
  if(id===current){toast('أنت في بداية مسار التنقل');return}
  recEdit=null;location.hash='#/'+id;render()}
window.addEventListener('hashchange',render);
function toggleSidebar(force){let s=$('sidebar'),b=$('menubtn'),open=typeof force==='boolean'?force:!s.classList.contains('open');s.classList.toggle('open',open);if(b){b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?'إغلاق قائمة التنقل':'فتح قائمة التنقل')}}
function applyTheme(theme,announce=false){
  theme=theme==='dark'?'dark':'light';document.documentElement.dataset.theme=theme;
  try{localStorage.setItem('eimTheme',theme)}catch(e){}
  let b=$('themebtn');if(b){let dark=theme==='dark';b.setAttribute('aria-pressed',String(dark));b.setAttribute('aria-label',dark?'تفعيل الوضع النهاري':'تفعيل الوضع الداكن');b.title=dark?'تفعيل الوضع النهاري':'تفعيل الوضع الداكن'}
  if(announce)toast(theme==='dark'?'تم تفعيل الوضع الداكن':'تم تفعيل الوضع النهاري')}
function toggleTheme(){applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',true)}
/* يستطيع الزائر فتح أدلة البحث والملفات العامة؛ تبقى بيانات الإدارة والتحرير محمية */
const GUEST_OK=[1,5,44,60,61,63,64,65,66,67,84,87,50,51,41,42,35,57,58,99,101,102,103];
function currentId(){let h=location.hash.replace('#/','');let n=parseInt(h);
  if(n===79&&(!G.user||G.ctx!=='مدير / مشغل المنصة'))return G.user?2:60;
  if(n===86&&(!G.user||G.ctx!=='مدير / مشغل المنصة'))return G.user?85:60;
  if(n>=93&&n<=98&&(!G.user||G.ctx!=='مدير / مشغل المنصة'))return G.user?2:60;
  if([105,106,108].includes(n)&&(!G.user||G.ctx!=='مدير / مشغل المنصة'))return G.user?2:60;
  if([100,104,107].includes(n)&&!G.user)return 65;
  if(n>=1&&n<=112)return(G.user||GUEST_OK.includes(n))?n:(G.user?2:60);
  return G.user?2:60}
function tab(id,idx){G.tab[id]=idx;persist(true);render()}
/* ===== القائمة الجانبية ===== */
function toggleNavGroup(i){G.navClosed=G.navClosed||{};G.navClosed[i]=!G.navClosed[i];persist(true);buildNav()}
function navIcon(id){return({60:'⌂',63:'◉',61:'⌘',64:'✦',5:'⌕',65:'＋',66:'✉',50:'★',58:'◆',51:'▣',35:'▤',2:'▦',20:'◎',34:'▥',59:'◇',99:'◫',100:'⌁',101:'▧',102:'◷',103:'▥',105:'⚖',106:'⌗',107:'◉',108:'⇄'}[id]||'•')}
const ACCOUNT_GROUP={name:'حسابي',items:[[2,'لوحة حسابي'],[4,'أعمالي'],[3,'تبديل مساحة العمل'],[53,'عضوياتي وحالاتها'],[54,'وثائقي وأدلتي'],[112,'السمعة والجودة'],[32,'الشكاوى والمراجعات'],[107,'الخصوصية والموافقات'],[80,'المدفوعات والفواتير'],[85,'الأمان واستعادة الحساب']]};
function membershipProfileItem(){
  let contextType=G.ctx==='عميل'?'العميل':G.ctx==='مدرب'?'مدرب':G.ctx==='مركز تدريب'?'مركز تدريب':G.ctx==='مدير / مشغل المنصة'?'مدير / مشغل المنصة':null;
  let type=contextType||G.activeMembership||G.memberships?.[0];
  let id=MEMBER_SCREENS[type];return id?[id,'بيانات عضوية '+type]:null
}
function contextNavGroup(){
  if(G.ctx==='عميل')return{name:'إدارة العميل والمطابقة',items:[[20,'مركز العميل'],[88,'إدارة العلاقة'],[89,'الفرص'],[90,'المتابعات'],[91,'المخاطر ومستوى الخدمة'],[92,'تحليلات العملاء'],[74,'ملف الجهة'],[75,'الممثلون والصلاحيات'],[76,'محفظة العميل'],[77,'سجل التواصل'],[78,'الفوترة والحوكمة'],[80,'المحفظة المالية'],[21,'إنشاء احتياج'],[25,'نتائج المطابقة'],[27,'مقارنة المرشحين'],[28,'القائمة المختصرة'],[29,'قرار الاختيار'],[71,'طلبات الخدمة'],[30,'العروض'],[110,'العقود'],[111,'المشاريع والتسليمات']]};
  if(G.ctx==='مركز تدريب')return{name:'إدارة مركز التدريب',items:[[40,'لوحة مركز التدريب'],[109,'طلبات الخدمة الواردة'],[30,'العروض'],[110,'العقود'],[111,'المشاريع والتسليمات'],[45,'بيانات المركز'],[56,'إنشاء دورة'],[68,'الدورات والطروحات'],[70,'إصدارات الدورات'],[102,'فعاليات المركز'],[103,'محتوى المركز']]};
  if(G.ctx==='مدرب')return{name:'مساحة المدرب',items:[[39,'لوحة المدرب'],[109,'طلبات الخدمة الواردة'],[30,'العروض'],[110,'العقود'],[111,'المشاريع والتسليمات'],[46,'بيانات المدرب'],[56,'إنشاء دورة'],[68,'الطروحات التدريبية'],[102,'فعالياتي'],[103,'مكتبتي المعرفية']]};
  if(G.ctx==='متعلم')return{name:'مساحة المتعلم',items:[[38,'لوحة المتعلم'],[35,'دليل الدورات']]};
  if(G.ctx==='متحقق')return{name:'التحقق والاعتماد',items:[[15,'مساحة المتحقق'],[14,'قضية التحقق'],[16,'قرار التحقق']]};
  if(G.ctx==='باحث / أكاديمي')return{name:'البحث وإدارة المعرفة',items:[[109,'طلبات الخدمة الواردة'],[30,'العروض'],[110,'العقود'],[111,'المشاريع والتسليمات'],[100,'المشاريع البحثية'],[101,'المنشورات'],[102,'الفعاليات'],[103,'المكتبة المعرفية'],[48,'بيانات الباحث']]};
  if(G.ctx==='مدير / مشغل المنصة')return{name:'إدارة المنصة',items:[[93,'مركز القيادة'],[105,'الحوكمة والامتثال'],[106,'مصفوفة الصلاحيات'],[108,'التكاملات'],[94,'الأعمال والموافقات'],[95,'المشغلون والصلاحيات'],[96,'سجل التدقيق'],[97,'قضايا التدقيق'],[98,'السياسات والتغيير'],[100,'إدارة البحث والمعرفة'],[101,'حوكمة النشر'],[102,'إدارة الفعاليات'],[52,'بيانات المشغل'],[59,'سجل الأعضاء والكيانات'],[86,'مراقبة الحماية'],[79,'هيكل قاعدة البيانات'],[15,'قضايا التحقق'],[69,'ربط التصنيفات'],[70,'حوكمة الدورات'],[68,'إدارة الطروحات']]};
  return{name:'ملفي المهني',items:[[6,'مركز الخبير'],[109,'طلبات الخدمة الواردة'],[7,'السجل المهني'],[11,'الأدلة والتحقق'],[17,'محفظة البصمات'],[30,'العروض'],[110,'العقود'],[111,'المشاريع والتسليمات'],[100,'البحث والمعرفة'],[101,'منشوراتي'],[102,'فعالياتي']]}
}
function navGroupsForContext(){
  if(!G.user)return[SITE_GROUP];
  let account={...ACCOUNT_GROUP,items:[...ACCOUNT_GROUP.items]},profile=membershipProfileItem();
  if(profile&&!account.items.some(x=>x[0]===profile[0]))account.items.splice(4,0,profile);
  return[SITE_GROUP,account,contextNavGroup()]
}
function buildNav(){let gs=navGroupsForContext();G.navClosed=G.navClosed||{};
  $('nav').innerHTML=gs.map((g,i)=>{let active=g.items.some(x=>x[0]===current),closed=!!G.navClosed[i]&&!active;return`<section class="navsection ${closed?'closed':''}">
  <div class="grp" role="button" tabindex="0" aria-expanded="${!closed}" onclick="toggleNavGroup(${i})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleNavGroup(${i})}"><span>${g.name}</span><span class="gchev">⌄</span></div>
  <div class="navitems"><div>${g.items.map(([id,n])=>`<button class="${current===id?'on':''}" onclick="go(${id})" title="${esc(n)}"><span class="navico" aria-hidden="true">${navIcon(id)}</span><span>${n}</span></button>`).join('')}</div></div></section>`}).join('')}
