/* =========================================================
   نماذج بيانات العضويات + الموجّه الرئيسي
   ========================================================= */
const MEMBER_FORMS={
'مركز تدريب':{icon:'🏛',steps:['الكيان القانوني','الاعتماد','التواصل'],fields:[
  ['legalName','اسم المركز القانوني','text',1],['entityType','نوع الكيان القانوني','select',1,'trainingCenterLegalEntityTypes'],['regNo','رقم السجل التجاري','text',1],['regCountry','دولة التسجيل','select',1,'countries'],
  ['accred','الاعتمادات التدريبية الحاصلة','multi',0,['اعتماد تدريب مهني','شريك اختبار معتمد','اعتماد ISO 21001','اعتماد جهة مانحة دولية','لا يوجد بعد']],['accredFile','وثائق الاعتماد','file',0],
  ['hq','المقر الرئيسي (المدينة)','text',1],['cphone','هاتف التواصل','tel',1],['cemail','البريد المؤسسي','email',1],['site','الموقع الإلكتروني','url',0]]},
'مدرب':{icon:'🎓',steps:['الملف الشخصي','الملف التدريبي'],fields:[
  ['tname','الاسم الكامل','text',1],['temail','البريد الإلكتروني','email',1],['tphone','رقم الهاتف','tel',0],['tcountry','دولة الإقامة','select',1,'countries'],
  ['academy','الأكاديمية / المجال التدريبي','select',1,'trainingAcademies'],['topics','الموضوعات التي يدربها','multi',1,['إدارة المشاريع','التحول الرقمي','الحوكمة والمخاطر','القيادة','الطاقة المتجددة','البيانات والذكاء الاصطناعي']],['texp','سنوات الخبرة التدريبية','number',1],['tlangs','لغات التقديم','multi',1,['العربية','الإنجليزية','الفرنسية']],['tmodes','أنماط التقديم','multi',1,['حضوري','عن بعد','هجين']],['cv','السيرة التدريبية','file',1]]},
'مستشار':{icon:'💼',steps:['الملف الشخصي','نطاق الاستشارة'],fields:[
  ['cname','الاسم الكامل','text',1],['cemail2','البريد الإلكتروني','email',1],['ccountry','دولة الإقامة','select',1,'countries'],
  ['cdomain','مجال الاستشارة الرئيسي','select',1,'domains'],['cservices','الخدمات الاستشارية','multi',1,'serviceTypes'],['cclients','أنواع العملاء المستهدفون','multi',1,'clientTypes'],['chour','سعر الساعة ($)','number',0],['cday','سعر اليوم ($)','number',0],['cvv','السيرة الذاتية الاستشارية','file',1]]},
'باحث / أكاديمي':{icon:'🔬',steps:['الملف الأكاديمي','الإنتاج العلمي'],fields:[
  ['rname','الاسم الكامل','text',1],['rinst','المؤسسة الأكاديمية','text',1],['rdegree','الدرجة العلمية','select',1,['دكتوراه','ماجستير','بكالوريوس']],['rorcid','معرف ORCID','text',0],['rscholar','رابط Google Scholar','url',0],
  ['rfields','مجالات البحث','multi',1,'domains'],['rpubs','أنواع الإنتاج العلمي','multi',0,'publicationTypes'],['rcollab','أنماط التعاون المقبولة','multi',0,'collaborationTypes'],['rfile','السيرة الأكاديمية','file',0]]},
'العميل':{icon:'🤝',steps:['بيانات الحساب','أغراض الاستخدام'],fields:[
  ['clname','اسم المسؤول / الجهة','text',1],['cltype','تصنيف الحساب','select',1,'clientTypes'],['clcountry','الدولة','select',1,'countries'],['clcity','المدينة','text',0],
  ['clpurpose','أغراض التسجيل','multi',1,'clientRegistrationPurposes'],['clservices','الخدمات المتوقع طلبها','multi',0,'clientRequestedServices'],['clcontact','قناة التواصل المفضلة','select',0,'preferredContactMethods'],['clemail','البريد الإلكتروني','email',1]]},
'مدير / مشغل المنصة':{icon:'🛠',steps:['بيانات المسؤول','نطاق الصلاحيات'],fields:[
  ['aname','الاسم الكامل','text',1],['aemail','البريد الإداري','email',1],['ajob','المسمى الوظيفي','text',1],['acountry','الدولة','select',0,'countries'],
  ['ascope','نطاق الصلاحيات المطلوب','multi',1,['إدارة الأعضاء والعضويات','قضايا التحقق والاعتماد','إدارة الدورات والمراكز','إدارة الفرص والمطابقة','إدارة المحتوى والصفحات العامة','إدارة الباقات والاشتراكات','التقارير والتحليلات']],
  ['alevel','مستوى الصلاحية','select',1,['مشغل تنفيذي','مشرف قسم','مدير منصة','مدير عام']],
  ['anotes','مبررات منح الصلاحية','textarea',1],['aidoc','وثيقة التكليف','file',0]]}};
const OPTS_MAP={countries,trainingCenterLegalEntityTypes,clientTypes,clientRegistrationPurposes,clientRequestedServices,preferredContactMethods,publicationTypes,collaborationTypes,serviceTypes,
  domains:Object.keys(TAX),trainingAcademies:[...new Set(courses.map(c=>c.academy))]};
const DEGREE_OPTIONS=['دكتوراه','ماجستير','دبلوم عالٍ','بكالوريوس / دبلوم'];
const JOB_LEVEL_OPTIONS=['إدارة تنفيذية','إدارة عليا','إدارة وسطى','إدارة تشغيلية','إدارة مشاريع وبرامج','خبير / مستشار / باحث','مدرب / مهندس / اختصاصي'];
const EXPERT_LEVEL_OPTIONS=['خبير متمرن','خبير ممارس','خبير استشاري'];
const LANG7=['العربية','الإنجليزية','الفرنسية','الألمانية','الإسبانية','الصينية','الهندية'];
const DELIVERY3=['حضوري','عن بعد','هجين'];
const SECRECY_OPTIONS=['جميع المعلومات متاحة للجميع','إظهار المعلومات المسموحة فقط','إظهار المعلومات المخفية لمدير المنصة فقط والمسموحة للعموم'];
const MEMBERSHIP_UPGRADES={
'مركز تدريب':{steps:['الهوية القانونية','العنوان والتواصل','التراخيص والاعتمادات','المجالات والدورات','المرافق وأنماط التدريب','الإدارة والمدربون','الأدلة والخصوصية'],add:[
 ['centerEnglishName','اسم المركز باللغة الإنجليزية','text',1],['tradeName','الاسم التجاري','text',0],['centerAddress','العنوان التفصيلي','textarea',1],
 ['licenseAuthority','جهة الترخيص','text',1],['licenseNo','رقم الترخيص','text',1],['licenseExpiry','تاريخ انتهاء الترخيص','date',0],
 ['centerDomain','مجال التدريب','select',1,'linkedDomain'],['centerSpecialty','التخصص التدريبي','select',1,'linkedSpecialty'],['centerPhase','مرحلة ممارسة المهارة','select',1,'linkedPhase'],['centerAppliedAreas','مجالات التدريب التطبيقية','multi',1,'linkedApplied'],['centerCourseName','اسم الدورة','text',1],['targetAudience','الفئة المستهدفة المرتبطة بالدورة','text',1],['courseLevel','مستوى الدورة','select',1,['تأسيسي','متوسط','متقدم','تخصصي','قيادي','تحضيري لشهادة مهنية']],
 ['centerModes','أنماط التقديم','multi',1,DELIVERY3],['capacity','الطاقة الاستيعابية','number',1],['facilities','المرافق والتجهيزات','textarea',1],
 ['managerName','اسم المسؤول','text',1],['managerJobLevel','المستوى الوظيفي للمسؤول','select',1,JOB_LEVEL_OPTIONS],['linkedTrainers','المدربون المرتبطون من أعضاء الشبكة','textarea',0],
 ['centerEvidence','مستندات التسجيل والترخيص','file',1],['centerConsent','الموافقة على التحقق','select',1,['نعم','لا']],['centerSecrecy','مستوى السرية','select',1,SECRECY_OPTIONS]],
 map:[['legalName','centerEnglishName','tradeName','entityType','regNo','regCountry'],['hq','centerAddress','cphone','cemail','site'],['licenseAuthority','licenseNo','licenseExpiry','accred','accredFile'],['centerDomain','centerSpecialty','centerPhase','centerAppliedAreas','centerCourseName','targetAudience','courseLevel'],['centerModes','capacity','facilities'],['managerName','managerJobLevel','linkedTrainers'],['centerEvidence','centerConsent','centerSecrecy']]},
'مدرب':{steps:['الهوية والتواصل','المؤهلات والاعتمادات','النبذة التدريبية','التخصصات','الخبرة والدورات','الأدوار والخدمات','التوفر والتسعير','الأدلة والخصوصية'],add:[
 ['tenglish','الاسم باللغة الإنجليزية','text',1],['tdegree','المؤهل العلمي','select',1,DEGREE_OPTIONS],['tqualification','اسم المؤهل','text',1],['tinstitution','الجهة التعليمية','text',1],['tgraduation','تاريخ التخرج','date',1],['tqualFiles','ملفات المؤهلات والاعتمادات','file',0],
 ['tlastTitle','آخر مسمى مهني','text',1],['tjobLevel','المستوى الوظيفي','select',1,JOB_LEVEL_OPTIONS],['texpertLevel','مستوى الخبرة','select',1,EXPERT_LEVEL_OPTIONS],['tbio','النبذة التدريبية','textarea',1],
 ['trainerDomain','الاختصاص الرئيسي','select',1,'linkedDomain'],['trainerSpecialty','التخصص الفرعي','select',1,'linkedSpecialty'],['trainerPhase','ممارسة المهارة في مرحلة','select',1,'linkedPhase'],['trainerAppliedAreas','مجالات الخبرة التطبيقية','multi',1,'linkedApplied'],
 ['trainerCourseName','اسم الدورة المقدمة','text',1],['trainerCourseLevel','مستوى الدورة المقدمة','select',1,['تأسيسي','متوسط','متقدم','تخصصي','قيادي','تحضيري لشهادة مهنية']],['trainerHours','عدد الساعات التدريبية','number',1],['trainerClients','الجهات التي دُرّبت','textarea',0],['trainerRating','تقييم الدورة','select',0,['★☆☆☆☆','★★☆☆☆','★★★☆☆','★★★★☆','★★★★★']],
 ['trainerServices','الخدمات المقدمة','multi',1,serviceTypes],['trainerDelivery','نمط التسليم','select',1,DELIVERY3],
 ['trainerAvailableFrom','متاح من','date',1],['trainerAvailableTo','متاح إلى','date',1],['trainerHourPrice','سعر الساعة ($)','number',0],['trainerDayPrice','سعر يوم العمل ($)','number',0],
 ['trainerEvidence','الأدلة والمستندات','file',1],['trainerSecrecy','مستوى السرية','select',1,SECRECY_OPTIONS],['trainerConsent','الموافقة على التحقق','select',1,['نعم','لا']]],
 map:[['tname','tenglish','temail','tphone','tcountry'],['tdegree','tqualification','tinstitution','tgraduation','tqualFiles'],['tlastTitle','tjobLevel','texpertLevel','tbio','texp','tlangs'],['academy','topics','trainerDomain','trainerSpecialty','trainerPhase','trainerAppliedAreas'],['trainerCourseName','trainerCourseLevel','trainerHours','trainerClients','trainerRating'],['trainerServices','trainerDelivery','tmodes'],['trainerAvailableFrom','trainerAvailableTo','trainerHourPrice','trainerDayPrice'],['cv','trainerEvidence','trainerSecrecy','trainerConsent']]},
'مستشار':{steps:['الهوية والتواصل','المؤهلات العلمية','النبذة المهنية','مجالات الاستشارة','الخدمات','الخبرات والمشاريع','القطاعات والعملاء','التوفر والتسعير','الأدلة والخصوصية'],add:[
 ['cenglish','الاسم باللغة الإنجليزية','text',1],['cphone2','رقم الهاتف','tel',0],['cdegree','المؤهل العلمي','select',1,DEGREE_OPTIONS],['cqualification','اسم المؤهل','text',1],['cinstitution','الجهة التعليمية','text',1],['cgraduation','تاريخ الحصول على المؤهل','date',1],
 ['clastTitle','آخر مسمى مهني','text',1],['cjobLevel','المستوى الوظيفي','select',1,JOB_LEVEL_OPTIONS],['cexpertLevel','مستوى الخبرة','select',1,EXPERT_LEVEL_OPTIONS],['cbio','النبذة الاستشارية','textarea',1],['cyears','سنوات الخبرة المهنية الإجمالية','number',1],['clanguages','لغات العمل','multi',1,LANG7],
 ['consultantDomain','الاختصاص الرئيسي','select',1,'linkedDomain'],['consultantSpecialty','التخصص الفرعي','select',1,'linkedSpecialty'],['consultantPhase','ممارسة المهارة في مرحلة','select',1,'linkedPhase'],['consultantAppliedAreas','مجالات الخبرة التطبيقية','multi',1,'linkedApplied'],
 ['serviceScope','نطاق الخدمة','textarea',1],['serviceOutputs','المخرجات المتوقعة','textarea',1],['consultingMode','نمط التنفيذ','select',1,DELIVERY3],
 ['consultingProjects','المشاريع السابقة','textarea',1],['consultingRole','دور المستشار','select',1,['مسؤولية كاملة','مسؤولية جزئية','مسؤولية فعالة','مشاركة محدودة','مشاركة استشارية']],['consultingDuration','المدة (أيام)','number',1],['consultingResults','النتائج','textarea',0],
 ['consultingSectors','قطاع العمل الحالي','multi',1,workSectors],['consultingCountries','دول تقديم الخدمة','multi',1,'countries'],['disclosureLimits','قيود الإفصاح','textarea',0],
 ['consultAvailableFrom','متاح من','date',1],['consultAvailableTo','متاح إلى','date',1],['consultDelivery','نمط العمل','select',1,DELIVERY3],
 ['consultEvidence','الأدلة والمراجع','file',1],['consultSecrecy','مستوى السرية','select',1,SECRECY_OPTIONS],['consultConsent','إتاحة الملف','select',1,['نعم','لا']]],
 map:[['cname','cenglish','cemail2','cphone2','ccountry','cvv'],['cdegree','cqualification','cinstitution','cgraduation'],['clastTitle','cjobLevel','cexpertLevel','cbio','cyears','clanguages'],['cdomain','consultantDomain','consultantSpecialty','consultantPhase','consultantAppliedAreas'],['cservices','serviceScope','serviceOutputs','consultingMode'],['consultingProjects','consultingRole','consultingDuration','consultingResults'],['consultingSectors','cclients','consultingCountries','disclosureLimits'],['consultAvailableFrom','consultAvailableTo','consultDelivery','chour','cday'],['consultEvidence','consultSecrecy','consultConsent']]},
'باحث / أكاديمي':{steps:['الهوية والتواصل','الانتماء والمؤهلات','النبذة البحثية','التخصصات البحثية','المنشورات','المشاريع والمنح','التعاون والتوفر','الأدلة والخصوصية'],add:[
 ['renglish','الاسم باللغة الإنجليزية','text',1],['remail','الإيميل','email',1],['rphone','رقم الهاتف','tel',0],['rcountry','دولة الإقامة','select',1,'countries'],['rcity','المدينة','text',0],
 ['rfaculty','الكلية أو القسم','text',0],['rqualification','اسم المؤهل','text',1],['rgraduation','تاريخ الحصول على المؤهل','date',1],
 ['rlastTitle','آخر مسمى مهني','text',1],['rjobLevel','المستوى الوظيفي','select',1,JOB_LEVEL_OPTIONS],['rexpertLevel','مستوى الخبرة','select',1,EXPERT_LEVEL_OPTIONS],['rbio','النبذة البحثية','textarea',1],['ryears','سنوات الخبرة المهنية الإجمالية','number',1],['rlanguages','لغات البحث','multi',1,LANG7],
 ['researchDomain','الاختصاص الرئيسي','select',1,'linkedDomain'],['researchSpecialty','التخصص الفرعي','select',1,'linkedSpecialty'],['researchPhase','ممارسة المهارة في مرحلة','select',1,'linkedPhase'],['researchAppliedAreas','مجالات الخبرة التطبيقية','multi',1,'linkedApplied'],
 ['publicationTitle','عنوان المنشور','text',1],['publicationType','نوع المنشور','select',1,'publicationTypes'],['publicationYear','سنة النشر','date',0],['publicationLink','الرابط أو DOI','url',0],
 ['researchProject','المشروع البحثي أو المنحة','text',1],['researchRole','دور الباحث','text',1],['fundingBody','الجهة الممولة','text',0],['researchPeriod','الفترة (أيام)','number',1],
 ['researchAvailableFrom','متاح من','date',1],['researchAvailableTo','متاح إلى','date',1],['researchMode','نمط التعاون','select',1,DELIVERY3],['researchHourPrice','سعر الساعة ($)','number',0],['researchDayPrice','سعر يوم العمل ($)','number',0],
 ['researchEvidence','أدلة الانتماء والإنتاج العلمي','file',1],['researchSecrecy','مستوى السرية','select',1,SECRECY_OPTIONS],['researchFileAccess','إتاحة الملف','select',1,['نعم','لا']]],
 map:[['rname','renglish','remail','rphone','rcountry','rcity'],['rinst','rfaculty','rdegree','rqualification','rgraduation'],['rlastTitle','rjobLevel','rexpertLevel','rbio','ryears','rlanguages'],['rfields','researchDomain','researchSpecialty','researchPhase','researchAppliedAreas'],['rpubs','publicationTitle','publicationType','publicationYear','publicationLink'],['researchProject','researchRole','fundingBody','researchPeriod'],['rcollab','researchAvailableFrom','researchAvailableTo','researchMode','researchHourPrice','researchDayPrice'],['rorcid','rscholar','rfile','researchEvidence','researchSecrecy','researchFileAccess']]},
'العميل':{steps:['تصنيف العميل','الهوية القانونية','الممثل المخول','العنوان والتواصل','مجالات الاحتياج','الفوترة','التحقق والخصوصية'],add:[
 ['clientLegalName','الاسم القانوني للجهة','text',0],['clientRegNo','رقم التسجيل أو السجل','text',0],['clientRegistrationCapacity','صفة التسجيل','select',1,'clientRegistrationPurposes'],
 ['authorizedName','اسم الممثل المخول','text',1],['authorizedJob','المسمى الوظيفي للممثل','text',1],['authorizedPhone','رقم الهاتف','tel',1],
 ['clientAddress','العنوان التفصيلي','textarea',1],
 ['needTitle','عنوان الاحتياج','text',1],['needDescription','وصف الاحتياج','textarea',1],['needBudget','الميزانية ($)','number',1],
 ['billingName','اسم جهة الفوترة','text',1],['billingAddress','عنوان الفوترة','textarea',1],['billingCurrency','العملة','select',1,['دولار','يورو']],['taxNo','الرقم الضريبي','text',0],
 ['clientDocuments','وثائق التحقق','file',1],['clientSecrecy','درجة السرية','select',1,SECRECY_OPTIONS],['clientConsent','الموافقة على التحقق','select',1,['نعم','لا']]],
 map:[['cltype'],['clname','clientLegalName','clientRegNo','clientRegistrationCapacity'],['authorizedName','authorizedJob','authorizedPhone','clcontact'],['clcountry','clcity','clientAddress','clemail'],['clpurpose','clservices','needTitle','needDescription','needBudget'],['billingName','billingAddress','billingCurrency','taxNo'],['clientDocuments','clientSecrecy','clientConsent']]},
'مدير / مشغل المنصة':{steps:['بيانات المسؤول','الدور والصلاحيات','التفويض','الأمن والتدقيق'],add:[
 ['aphone','رقم الهاتف','tel',1],['operatorRole','دور المشغل','select',1,['مدير منصة','مدير مستخدمين','مدقق محتوى','مسؤول تحقق','مسؤول مالي','دعم فني','مراقب جودة']],
 ['approvalRef','مرجع قرار التفويض','text',1],['approvalDate','تاريخ التفويض','date',1],
 ['mfaMethod','وسيلة التحقق متعدد العوامل','select',1,['تطبيق مصادقة','رسالة نصية','إيميل مؤسسي']],['auditConsent','الإقرار بتسجيل العمليات في سجل التدقيق','select',1,['نعم','لا']],['securityConsent','الإقرار بسياسات الأمن والخصوصية','select',1,['نعم','لا']]],
 map:[['aname','aemail','aphone','ajob','acountry'],['operatorRole','ascope','alevel'],['approvalRef','approvalDate','anotes','aidoc'],['mfaMethod','auditConsent','securityConsent']]}
};
function membershipForm(type){let b=MEMBER_FORMS[type],u=MEMBERSHIP_UPGRADES[type];if(!b||!u)return b;
  let seen=new Set(b.fields.map(f=>f[0])),fields=[...b.fields];u.add.forEach(f=>{if(!seen.has(f[0])){fields.push(f);seen.add(f[0])}});
  return{...b,steps:u.steps,fields,stepMap:u.map}}
const MEMBER_REPEATABLE={
'مركز تدريب':[
 {step:3,key:'centerCourses',label:'الدورات والمجالات التدريبية',fields:['centerDomain','centerSpecialty','centerPhase','centerAppliedAreas','centerCourseName','targetAudience','courseLevel'],required:true}],
'مدرب':[
 {step:1,key:'trainerQualifications',label:'المؤهلات والاعتمادات',fields:['tdegree','tqualification','tinstitution','tgraduation','tqualFiles'],required:true},
 {step:3,key:'trainerSpecializations',label:'التخصصات والخبرات التطبيقية',fields:['academy','topics','trainerDomain','trainerSpecialty','trainerPhase','trainerAppliedAreas'],required:true},
 {step:4,key:'trainerCourseRecords',label:'الدورات المقدمة',fields:['trainerCourseName','trainerCourseLevel','trainerHours','trainerClients','trainerRating'],required:true}],
'مستشار':[
 {step:1,key:'consultantQualifications',label:'المؤهلات العلمية',fields:['cdegree','cqualification','cinstitution','cgraduation'],required:true},
 {step:3,key:'consultantSpecializations',label:'مجالات الاستشارة والتخصصات',fields:['cdomain','consultantDomain','consultantSpecialty','consultantPhase','consultantAppliedAreas'],required:true},
 {step:4,key:'consultantServiceRecords',label:'الخدمات الاستشارية',fields:['cservices','serviceScope','serviceOutputs','consultingMode'],required:true},
 {step:5,key:'consultantProjectRecords',label:'الخبرات والمشاريع',fields:['consultingProjects','consultingRole','consultingDuration','consultingResults'],required:true}],
'باحث / أكاديمي':[
 {step:1,key:'researchQualifications',label:'المؤهلات والانتماءات العلمية',fields:['rinst','rfaculty','rdegree','rqualification','rgraduation'],required:true},
 {step:3,key:'researchSpecializations',label:'التخصصات البحثية',fields:['rfields','researchDomain','researchSpecialty','researchPhase','researchAppliedAreas'],required:true},
 {step:4,key:'researchPublicationRecords',label:'المنشورات والإنتاج العلمي',fields:['rpubs','publicationTitle','publicationType','publicationYear','publicationLink'],required:true},
 {step:5,key:'researchProjectRecords',label:'المشاريع والمنح',fields:['researchProject','researchRole','fundingBody','researchPeriod'],required:true}],
'العميل':[
 {step:4,key:'clientNeedRecords',label:'الاحتياجات والخدمات المطلوبة',fields:['clpurpose','clservices','needTitle','needDescription','needBudget'],required:true}]
};
function repeatAt(type,step){return(MEMBER_REPEATABLE[type]||[]).filter(r=>r.step===step)}
function repeatFieldKeys(type,step){return new Set(repeatAt(type,step).flatMap(r=>r.fields))}
function memberRecords(type,key){G.memberRecords=G.memberRecords||{};G.memberRecords[type]=G.memberRecords[type]||{};return G.memberRecords[type][key]=G.memberRecords[type][key]||[]}
function migrateLegacyRecord(type,def){G.memberRecordMigration=G.memberRecordMigration||{};let mk=type+'::'+def.key;if(G.memberRecordMigration[mk])return;
  let src=G.memberData[type]||{},row={};def.fields.forEach(k=>{let v=src[k];if(Array.isArray(v)?v.length:String(v||'').trim())row[k]=Array.isArray(v)?[...v]:v});
  if(Object.keys(row).length)memberRecords(type,def.key).push(row);
  G.memberRecordMigration[mk]=true;persist(true)}
function mlinked(type,k,v,src){let prefix=k.replace(/(Domain|Specialty|Phase|AppliedAreas)$/,'');
  let dk=prefix+'Domain',sk=prefix+'Specialty',pk=prefix+'Phase';
  if(src==='linkedDomain')return Object.keys(TAX);
  if(src==='linkedSpecialty')return Object.keys(TAX[v[dk]]||{});
  if(src==='linkedPhase')return (TAX[v[dk]]||{})[v[sk]]||[];
  if(src==='linkedApplied')return (TAX_DETAILS[v[dk]]||{})[v[sk]]?.[v[pk]]||[];
  return typeof src==='string'?OPTS_MAP[src]||[]:src||[]}
function mrDraftId(type,key){return type+'::'+key}
function mrOpen(type,key,idx){type=dec(type);let id=mrDraftId(type,key);G.memberRecordDrafts=G.memberRecordDrafts||{};G.memberRecordEdits=G.memberRecordEdits||{};
  G.memberRecordEdits[id]=idx;G.memberRecordDrafts[id]=idx<0?{}:JSON.parse(JSON.stringify(memberRecords(type,key)[idx]||{}));persist(true);render()}
function mrCancel(type,key){type=dec(type);let id=mrDraftId(type,key);delete G.memberRecordEdits[id];delete G.memberRecordDrafts[id];persist(true);render()}
function mrSet(type,key,k,v){type=dec(type);let id=mrDraftId(type,key),d=G.memberRecordDrafts[id]=G.memberRecordDrafts[id]||{};d[k]=v;
  if(/Domain$/.test(k)){let p=k.replace(/Domain$/,'');d[p+'Specialty']='';d[p+'Phase']='';d[p+'AppliedAreas']=[];persist(true);render();return}
  if(/Specialty$/.test(k)){let p=k.replace(/Specialty$/,'');d[p+'Phase']='';d[p+'AppliedAreas']=[];persist(true);render();return}
  if(/Phase$/.test(k)){let p=k.replace(/Phase$/,'');d[p+'AppliedAreas']=[];persist(true);render();return}
  persist(true)}
function mrToggle(type,key,k,o){type=dec(type);let id=mrDraftId(type,key),d=G.memberRecordDrafts[id]=G.memberRecordDrafts[id]||{},a=d[k]||[],sel=a.includes(o);d[k]=sel?a.filter(x=>x!==o):[...a,o];persist(true);render()}
function mrFiles(type,key,k,inp){type=dec(type);let id=mrDraftId(type,key),d=G.memberRecordDrafts[id]=G.memberRecordDrafts[id]||{},old=Array.isArray(d[k])?d[k]:[];d[k]=[...old,...[...inp.files].map(f=>f.name)];persist(true);render();toast('أُرفقت الملفات بالسجل دون حذف الملفات السابقة')}
function mrPrivacy(type,key,idx,k){type=dec(type);G.memberRecordPrivacy=G.memberRecordPrivacy||{};let id=type+'::'+key+'::'+idx;G.memberRecordPrivacy[id]=G.memberRecordPrivacy[id]||{};G.memberRecordPrivacy[id][k]=!G.memberRecordPrivacy[id][k];privacyAudit(type,key+'['+idx+'].'+k,G.memberRecordPrivacy[id][k],'record_field');persist(true);render()}
function mrControl(type,def,fd,idx){let[k,l,t,req,src]=fd,id=mrDraftId(type,def.key),d=G.memberRecordDrafts[id]||{},v=d[k]??'',opts=mlinked(type,k,d,src),c='';
  if(t==='select')c=`<select class="ctl" onchange="mrSet('${enc(type)}','${def.key}','${k}',this.value)"><option value="">اختر…</option>${opts.map(o=>`<option ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  else if(t==='multi')c=`<div class="chips">${opts.map(o=>`<button type="button" class="chip ${(v||[]).includes(o)?'sel':''}" onclick="mrToggle('${enc(type)}','${def.key}','${k}',dec('${enc(o)}'))">${(v||[]).includes(o)?'✓ ':''}${esc(o)}</button>`).join('')}</div>`;
  else if(t==='file')c=`<label class="filebox"><input type="file" multiple style="display:none" onchange="mrFiles('${enc(type)}','${def.key}','${k}',this)"><b>⭱ رفع عدة ملفات</b></label><div>${(Array.isArray(v)?v:[]).map(n=>`<span class="filetag">${esc(n)}</span>`).join('')}</div>`;
  else if(t==='textarea')c=`<textarea class="ctl" rows="3" oninput="mrSet('${enc(type)}','${def.key}','${k}',this.value)">${esc(v)}</textarea>`;
  else c=`<input class="ctl" type="${t}" ${t==='number'?'min="0" step="1"':''} value="${esc(v)}" oninput="mrSet('${enc(type)}','${def.key}','${k}',this.value)">`;
  let pid=type+'::'+def.key+'::'+idx,hidden=!!G.memberRecordPrivacy?.[pid]?.[k];
  return `<div class="f ${['multi','file','textarea'].includes(t)?'full':''}"><label><span>${l} ${req?'<em>*</em>':''}</span><button type="button" class="pv ${hidden?'off':''}" onclick="mrPrivacy('${enc(type)}','${def.key}',${idx},'${k}')">${hidden?'◉ مخفي':'◎ ظاهر'}</button></label>${c}</div>`}
function mrSave(type,key){type=dec(type);let F=membershipForm(type),def=(MEMBER_REPEATABLE[type]||[]).find(x=>x.key===key),id=mrDraftId(type,key),d=G.memberRecordDrafts?.[id]||{},idx=G.memberRecordEdits?.[id]??-1;
  let fds=def.fields.map(k=>F.fields.find(f=>f[0]===k)).filter(Boolean),missing=fds.find(f=>f[3]&&(!d[f[0]]||(Array.isArray(d[f[0]])&&!d[f[0]].length)));
  if(missing){toast('أكمل في السجل: '+missing[1]);return}
  let badNum=fds.find(f=>f[2]==='number'&&d[f[0]]&&!/^\d+$/.test(d[f[0]]));if(badNum){toast('أدخل رقمًا صحيحًا في: '+badNum[1]);return}
  let rows=memberRecords(type,key),finalIdx=idx;if(idx<0){rows.push(JSON.parse(JSON.stringify(d)));finalIdx=rows.length-1}else rows[idx]=JSON.parse(JSON.stringify(d));
  if(idx<0&&G.memberRecordPrivacy?.[type+'::'+key+'::-1']){G.memberRecordPrivacy[type+'::'+key+'::'+finalIdx]=G.memberRecordPrivacy[type+'::'+key+'::-1'];delete G.memberRecordPrivacy[type+'::'+key+'::-1']}
  delete G.memberRecordEdits[id];delete G.memberRecordDrafts[id];markMembershipDirty(type);render();toast('حُفظ السجل — يمكنك إضافة سجل جديد')}
function mrDelete(type,key,idx){type=dec(type);if(!confirm('هل تريد حذف هذا السجل؟ لن تتأثر الحقول أو السجلات الأخرى.'))return;memberRecords(type,key).splice(idx,1);markMembershipDirty(type);render();toast('حُذف السجل المحدد فقط')}
function mrSummary(F,def,row){let vals=def.fields.map(k=>{let f=F.fields.find(x=>x[0]===k),v=row[k];if(!v||(Array.isArray(v)&&!v.length))return'';return(Array.isArray(v)?v.slice(0,2).join('، '):String(v))}).filter(Boolean);return[vals[0]||def.label,vals.slice(1,4).join(' · ')]}
function mrecords(type,def){migrateLegacyRecord(type,def);let F=membershipForm(type),rows=memberRecords(type,def.key),id=mrDraftId(type,def.key),edit=G.memberRecordEdits?.[id];
  let html=`<div class="field wide"><label><span>${def.label} ${def.required?'<em>*</em>':''}</span></label><div class="recs">`;
  rows.forEach((row,i)=>{if(edit===i){html+=`<div class="recform"><div class="fh2">تعديل سجل ${def.label}</div>${def.fields.map(k=>mrControl(type,def,F.fields.find(f=>f[0]===k),i)).join('')}<div class="f full" style="flex-direction:row"><button class="btn primary sm" onclick="mrSave('${enc(type)}','${def.key}')">حفظ التعديل ✓</button><button class="btn ghost sm" onclick="mrCancel('${enc(type)}','${def.key}')">إلغاء</button></div></div>`;return}
    let[t,s]=mrSummary(F,def,row);html+=`<div class="reccard"><span class="idx">${i+1}</span><div class="inf"><b>${esc(t)}</b><small>${esc(s)}</small></div><div class="ops"><button class="icbtn" title="تعديل" onclick="mrOpen('${enc(type)}','${def.key}',${i})">${IC.edit}</button><button class="icbtn del" title="حذف" onclick="mrDelete('${enc(type)}','${def.key}',${i})">${IC.trash}</button></div></div>`});
  if(edit===-1)html+=`<div class="recform"><div class="fh2">إضافة سجل جديد — ${def.label}</div>${def.fields.map(k=>mrControl(type,def,F.fields.find(f=>f[0]===k),-1)).join('')}<div class="f full" style="flex-direction:row"><button class="btn primary sm" onclick="mrSave('${enc(type)}','${def.key}')">حفظ السجل وإضافة سجل جديد ✓</button><button class="btn ghost sm" onclick="mrCancel('${enc(type)}','${def.key}')">إلغاء</button></div></div>`;
  else html+=`<button type="button" class="addrec" onclick="mrOpen('${enc(type)}','${def.key}',-1)">＋ إضافة سجل جديد — ${def.label}</button>`;
  return html+`<small class="hint">يمكن حفظ أكثر من سجل. لا تُحذف البيانات السابقة عند إنشاء سجل جديد.</small></div></div>`}

/* =========================================================
   EIM 5.6 — مركز الوثائق والأدلة
   ========================================================= */
const DOC_CATEGORIES=['هوية','سيرة ذاتية','مؤهل علمي','شهادة مهنية','ترخيص أو اعتماد','عقد أو تفويض','دليل خبرة','تسليم أو نتيجة','مستند داعم','أخرى'];
const DOC_CONFIDENTIALITY=['عام','مقيد للأعضاء المخولين','سري — مدير المنصة والمتحقق فقط'];
const DOC_RIGHTS=['للتحقق فقط','عرض عام','عرض مقيد','استخدام داخلي فقط'];
const DOC_VERIFY=['جديد','بانتظار التحقق','قيد التحقق','مقبول','مرفوض','منتهي الصلاحية'];
const DOC_CONTENT_LIMIT=350*1024;
function docId(){return'DOC-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,7).toUpperCase()}
function docNorm(d,owner='',field=''){if(typeof d==='string')return{id:docId(),name:d,legacy:true,owner,field,category:'',confidentiality:'مقيد للأعضاء المخولين',rights:'للتحقق فقط',verify:'جديد',versions:[],uploadedAt:new Date().toISOString()};
  d=d||{};d.id=d.id||docId();d.name=d.name||'مستند';d.owner=d.owner||owner;d.field=d.field||field;d.category=d.category||'';d.confidentiality=d.confidentiality||'مقيد للأعضاء المخولين';d.rights=d.rights||'للتحقق فقط';d.verify=d.verify||'جديد';d.versions=Array.isArray(d.versions)?d.versions:[];d.uploadedAt=d.uploadedAt||new Date().toISOString();return d}
function docSize(n){if(!n)return'';return n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB'}
function docLog(action,doc,note=''){G.documentAudit=G.documentAudit||[];G.documentAudit.unshift({at:new Date().toISOString(),actor:typeof G.user==='string'?G.user:'المستخدم',action,docId:doc.id,name:doc.name,note});if(G.documentAudit.length>300)G.documentAudit.length=300}
function readDocumentFile(f,owner,field){return new Promise(resolve=>{let d=docNorm({name:f.name,size:f.size,type:f.type||'',owner,field,uploadedAt:new Date().toISOString(),verify:'جديد'},owner,field);
  if(f.size<=DOC_CONTENT_LIMIT){let r=new FileReader();r.onload=()=>{d.dataUrl=r.result;resolve(d)};r.onerror=()=>resolve(d);r.readAsDataURL(f)}else{d.metadataOnly=true;resolve(d)}})}
function docFieldHtml(type,key,val){let docs=(Array.isArray(val)?val:[]).map(d=>docNorm(d,type,key));G.memberData[type][key]=docs;
  return `<label class="filebox"><input type="file" multiple style="display:none" onchange="mfiles('${enc(type)}','${key}',this)"><b>⭱ رفع عدة مستندات</b><small>يمكن ضبط التصنيف والسرية والحقوق وربط كل مستند بكيان مستقل</small></label>
  <div class="doclist" style="margin-top:10px">${docs.filter(d=>!d.archived).map((d,i)=>docMembershipCard(type,key,d,i)).join('')}</div>`}
function docMembershipCard(type,key,d,i){let exp=d.expiry&&new Date(d.expiry)<new Date().setHours(0,0,0,0);
  return `<div class="doccard"><div class="dochead"><span class="docicon">${IC.doc}</span><span class="docname"><b>${esc(d.name)}</b><small>${esc(d.id)}${d.size?' · '+docSize(d.size):''}${d.legacy?' · سجل قديم محفوظ':''}</small></span><span class="tagb ${exp?'red':d.verify==='مقبول'?'green':d.verify==='مرفوض'?'red':'blue'}">${exp?'منتهي الصلاحية':esc(d.verify)}</span></div>
  <div class="docmeta">
    <label>التصنيف<select class="ctl" onchange="docSet('${enc(type)}','${key}',${i},'category',this.value)"><option value="">اختر…</option>${DOC_CATEGORIES.map(x=>`<option ${d.category===x?'selected':''}>${x}</option>`).join('')}</select></label>
    <label>السرية<select class="ctl" onchange="docSet('${enc(type)}','${key}',${i},'confidentiality',this.value)">${DOC_CONFIDENTIALITY.map(x=>`<option ${d.confidentiality===x?'selected':''}>${x}</option>`).join('')}</select></label>
    <label>حقوق الاستخدام<select class="ctl" onchange="docSet('${enc(type)}','${key}',${i},'rights',this.value)">${DOC_RIGHTS.map(x=>`<option ${d.rights===x?'selected':''}>${x}</option>`).join('')}</select></label>
    <label>انتهاء الصلاحية<input type="date" class="ctl" value="${esc(d.expiry||'')}" onchange="docSet('${enc(type)}','${key}',${i},'expiry',this.value)"></label>
    <label>الجهة المصدرة<input class="ctl" value="${esc(d.issuer||'')}" oninput="docSet('${enc(type)}','${key}',${i},'issuer',this.value,true)"></label>
    <label>رقم الوثيقة<input class="ctl" value="${esc(d.documentNo||'')}" oninput="docSet('${enc(type)}','${key}',${i},'documentNo',this.value,true)"></label>
    <label>تاريخ الإصدار<input type="date" class="ctl" value="${esc(d.issueDate||'')}" onchange="docSet('${enc(type)}','${key}',${i},'issueDate',this.value)"></label>
    <label>الكيان/السجل المرتبط<input class="ctl" value="${esc(d.linkedEntity||'')}" oninput="docSet('${enc(type)}','${key}',${i},'linkedEntity',this.value,true)" placeholder="مؤهل، خبرة، مشروع…"></label>
  </div><div class="docops">
    ${d.dataUrl?`<button class="btn xs soft" onclick="docPreview('${enc(type)}','${key}',${i})">معاينة</button><button class="btn xs soft" onclick="docDownload('${enc(type)}','${key}',${i})">تنزيل</button>`:`<span class="hint">${d.metadataOnly?'حُفظت البيانات الوصفية؛ المحتوى أكبر من حد النموذج التجريبي':'أعد رفع الملف لتفعيل المعاينة والتنزيل'}</span>`}
    <button class="btn xs ghost" onclick="document.getElementById('docrep-${d.id}').click()">استبدال بإصدار جديد</button><input id="docrep-${d.id}" type="file" style="display:none" onchange="docReplace('${enc(type)}','${key}',${i},this)">
    <button class="btn xs danger" onclick="docArchive('${enc(type)}','${key}',${i})">أرشفة</button>
    ${d.versions.length?`<span class="tagb gray">${d.versions.length+1} إصدارات</span>`:''}
  </div></div>`}
function docSet(t,key,i,prop,val,silent){t=dec(t);let docs=G.memberData[t][key]||[],d=docs[i]=docNorm(docs[i],t,key);d[prop]=val;if(!silent)docLog('تحديث بيانات وصفية',d,prop);markMembershipDirty(t);if(!silent)render()}
function docArchive(t,key,i){t=dec(t);let d=docNorm(G.memberData[t][key][i],t,key);if(!confirm('أرشفة المستند «'+d.name+'»؟ سيبقى محفوظًا ويمكن استعادته.'))return;d.archived=true;d.archivedAt=new Date().toISOString();docLog('أرشفة مستند',d);markMembershipDirty(t);render();toast('أُرشف المستند دون حذفه')}
function docReplace(t,key,i,inp){t=dec(t);let f=inp.files[0];if(!f)return;let old=docNorm(G.memberData[t][key][i],t,key);
  readDocumentFile(f,t,key).then(nw=>{nw.id=old.id;nw.category=old.category;nw.confidentiality=old.confidentiality;nw.rights=old.rights;nw.expiry=old.expiry;nw.issuer=old.issuer;nw.documentNo=old.documentNo;nw.issueDate=old.issueDate;nw.linkedEntity=old.linkedEntity;nw.versions=[...(old.versions||[]),{name:old.name,size:old.size,type:old.type,uploadedAt:old.uploadedAt,replacedAt:new Date().toISOString()}];G.memberData[t][key][i]=nw;docLog('استبدال مستند بإصدار جديد',nw,old.name+' ← '+nw.name);markMembershipDirty(t);render();toast('حُفظ الإصدار الجديد مع سجل الإصدارات')})}
function docPreview(t,key,i){t=dec(t);let d=docNorm(G.memberData[t][key][i],t,key);if(!d.dataUrl){toast('لا توجد نسخة محتوى محفوظة للمعاينة');return}let img=(d.type||'').startsWith('image/');
  openModal(`<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><b style="flex:1">${esc(d.name)}</b><button class="btn xs ghost" onclick="closeOverlay()">إغلاق</button></div>${img?`<img alt="${esc(d.name)}" src="${d.dataUrl}" style="display:block;max-width:100%;max-height:65vh;margin:auto;border-radius:9px">`:`<iframe sandbox="" title="${esc(d.name)}" src="${d.dataUrl}" style="width:100%;height:65vh;border:0;border-radius:9px;background:#fff"></iframe>`}`)}
function docDownload(t,key,i){t=dec(t);let d=docNorm(G.memberData[t][key][i],t,key);if(!d.dataUrl){toast('لا توجد نسخة محتوى محفوظة للتنزيل');return}let a=document.createElement('a');a.href=d.dataUrl;a.download=d.name;a.click();docLog('تنزيل مستند',d);persist(true)}
function documentRows(){let out=[],types=[...new Set([...Object.keys(G.memberData||{}),...(G.memberships||[])])];
  types.forEach(type=>{let v=G.memberData[type]||{},F=membershipForm(type),fileKeys=new Set([...(F?.fields||[]).filter(f=>f[2]==='file').map(f=>f[0]),'_documentCenter']);fileKeys.forEach(key=>{if(!Array.isArray(v[key]))return;v[key]=v[key].map(d=>docNorm(d,type,key));v[key].forEach((doc,index)=>out.push({type,key,index,doc,source:'membership'}))});
    let defs=MEMBER_REPEATABLE[type]||[],recordMap=G.memberRecords?.[type]||{};defs.forEach(def=>{let fileKeys=def.fields.filter(k=>(F?.fields||[]).find(f=>f[0]===k)?.[2]==='file');(recordMap[def.key]||[]).forEach((row,ri)=>fileKeys.forEach(key=>{if(!Array.isArray(row[key]))return;row[key]=row[key].map(d=>docNorm(d,type,def.key+' / '+key));row[key].forEach((doc,index)=>out.push({type,key,index,doc,source:'record',record:def.key,recordIndex:ri}))}))})});
  let wizardFiles=S.flatMap(s=>s[2]).filter(f=>f[2]==='file').map(f=>f[0]);wizardFiles.forEach(key=>{if(!Array.isArray(W[key]))return;W[key]=W[key].map(d=>docNorm(d,'خبير','الملف المهني / '+key));W[key].forEach((doc,index)=>out.push({type:'خبير',key,index,doc,source:'wizard'}))});
  Object.keys(REC).forEach(recKey=>{let fileKeys=REC[recKey].filter(f=>f[2]==='file').map(f=>f[0]);(W[recKey]||[]).forEach((row,ri)=>fileKeys.forEach(key=>{if(!Array.isArray(row[key]))return;row[key]=row[key].map(d=>docNorm(d,'خبير',recKey+' / '+key));row[key].forEach((doc,index)=>out.push({type:'خبير',key,index,doc,source:'wizardRecord',record:recKey,recordIndex:ri}))}))});
  return out}
function docById(id){return documentRows().find(r=>r.doc.id===id)}
function docSetId(id,prop,val){let r=docById(id);if(!r)return;if(['verify','verificationNote'].includes(prop)&&!isPlatformOperator()){toast('قرار التحقق متاح فقط لمشغل منصة معتمد');return}r.doc[prop]=val;docLog(prop==='verify'?'تحديث حالة تحقق المستند':'تحديث بيانات وصفية',r.doc,prop);markMembershipDirty(r.type);render()}
function docToggleArchiveId(id){let r=docById(id);if(!r)return;r.doc.archived=!r.doc.archived;r.doc.archivedAt=r.doc.archived?new Date().toISOString():null;docLog(r.doc.archived?'أرشفة مستند':'استعادة مستند',r.doc);markMembershipDirty(r.type);render();toast(r.doc.archived?'أُرشف المستند':'استُعيد المستند')}
function docPreviewId(id){let r=docById(id);if(!r||!r.doc.dataUrl){toast('لا توجد نسخة محتوى محفوظة للمعاينة');return}let d=r.doc,img=(d.type||'').startsWith('image/');openModal(`<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><b style="flex:1">${esc(d.name)}</b><button class="btn xs ghost" onclick="closeOverlay()">إغلاق</button></div>${img?`<img alt="${esc(d.name)}" src="${d.dataUrl}" style="display:block;max-width:100%;max-height:65vh;margin:auto;border-radius:9px">`:`<iframe sandbox="" title="${esc(d.name)}" src="${d.dataUrl}" style="width:100%;height:65vh;border:0;border-radius:9px;background:#fff"></iframe>`}`)}
function docDownloadId(id){let r=docById(id);if(!r||!r.doc.dataUrl){toast('لا توجد نسخة محتوى محفوظة للتنزيل');return}let a=document.createElement('a');a.href=r.doc.dataUrl;a.download=r.doc.name;a.click();docLog('تنزيل مستند',r.doc);persist(true)}
function docReplaceId(id,inp){let r=docById(id),f=inp.files[0];if(!r||!f)return;let old=r.doc;readDocumentFile(f,old.owner,old.field).then(nw=>{let history=[...(old.versions||[]),{name:old.name,size:old.size,type:old.type,uploadedAt:old.uploadedAt,replacedAt:new Date().toISOString()}];['id','category','confidentiality','rights','expiry','issuer','documentNo','issueDate','linkedEntity','owner','field'].forEach(p=>{if(old[p])nw[p]=old[p]});nw.versions=history;Object.keys(old).forEach(k=>delete old[k]);Object.assign(old,nw);docLog('استبدال مستند بإصدار جديد',old);markMembershipDirty(r.type);render();toast('حُفظ الإصدار الجديد مع سجل الإصدارات')})}
function docGeneralUpload(inp){let type=$('docOwner')?.value||G.activeMembership||(G.memberships||[])[0];if(!type){toast('اختر عضوية أولًا');return}G.memberData[type]=G.memberData[type]||{};let key='_documentCenter',files=[...inp.files];G.memberData[type][key]=G.memberData[type][key]||[];
  Promise.all(files.map(f=>readDocumentFile(f,type,key))).then(docs=>{G.memberData[type][key].push(...docs);docs.forEach(d=>docLog('رفع مستند',d));markMembershipDirty(type);render();toast('أُضيفت المستندات إلى المركز')})}
function rDocumentCenter(){let rows=documentRows(),f=G.docFilters=G.docFilters||{q:'',owner:'',category:'',verify:'',archive:'active'},today=new Date().setHours(0,0,0,0),soon=Date.now()+30*86400000,canVerify=isPlatformOperator();
  let active=rows.filter(r=>!r.doc.archived),expired=active.filter(r=>r.doc.expiry&&new Date(r.doc.expiry)<today).length,expiring=active.filter(r=>r.doc.expiry&&new Date(r.doc.expiry)>=today&&new Date(r.doc.expiry)<=soon).length,pending=active.filter(r=>['جديد','بانتظار التحقق','قيد التحقق'].includes(r.doc.verify)).length;
  let shown=rows.filter(r=>{let d=r.doc,text=[d.name,d.id,d.issuer,d.documentNo,d.linkedEntity,r.type].join(' ');return(!f.q||text.includes(f.q))&&(!f.owner||r.type===f.owner)&&(!f.category||d.category===f.category)&&(!f.verify||d.verify===f.verify)&&(f.archive==='all'||(f.archive==='archived'?d.archived:!d.archived))});
  let cards=shown.map(({type,doc})=>`<div class="doccard ${doc.archived?'archived':''}"><div class="dochead"><span class="docicon">${IC.doc}</span><span class="docname"><b>${esc(doc.name)}</b><small>${esc(doc.id)} · عضوية ${esc(type)}${doc.size?' · '+docSize(doc.size):''}</small></span><span class="tagb ${doc.verify==='مقبول'?'green':doc.verify==='مرفوض'?'red':'blue'}">${esc(doc.verify)}</span>${doc.archived?'<span class="tagb gray">مؤرشف</span>':''}</div>
    <div class="docmeta"><label>التصنيف<select class="ctl" onchange="docSetId('${doc.id}','category',this.value)"><option value="">اختر…</option>${DOC_CATEGORIES.map(x=>`<option ${doc.category===x?'selected':''}>${x}</option>`).join('')}</select></label><label>السرية<select class="ctl" onchange="docSetId('${doc.id}','confidentiality',this.value)">${DOC_CONFIDENTIALITY.map(x=>`<option ${doc.confidentiality===x?'selected':''}>${x}</option>`).join('')}</select></label><label>حقوق الاستخدام<select class="ctl" onchange="docSetId('${doc.id}','rights',this.value)">${DOC_RIGHTS.map(x=>`<option ${doc.rights===x?'selected':''}>${x}</option>`).join('')}</select></label><label>حالة التحقق${canVerify?`<select class="ctl" onchange="docSetId('${doc.id}','verify',this.value)">${DOC_VERIFY.map(x=>`<option ${doc.verify===x?'selected':''}>${x}</option>`).join('')}</select>`:`<span class="ctl" style="display:block;background:#f4f6f8">${esc(doc.verify)}</span>`}</label><label>الجهة المصدرة<input class="ctl" value="${esc(doc.issuer||'')}" onchange="docSetId('${doc.id}','issuer',this.value)"></label><label>رقم الوثيقة<input class="ctl" value="${esc(doc.documentNo||'')}" onchange="docSetId('${doc.id}','documentNo',this.value)"></label><label>الكيان المرتبط<input class="ctl" value="${esc(doc.linkedEntity||'')}" onchange="docSetId('${doc.id}','linkedEntity',this.value)"></label><label>انتهاء الصلاحية<input type="date" class="ctl" value="${esc(doc.expiry||'')}" onchange="docSetId('${doc.id}','expiry',this.value)"></label>${canVerify?`<label style="grid-column:1/-1">ملاحظات التحقق<input class="ctl" value="${esc(doc.verificationNote||'')}" onchange="docSetId('${doc.id}','verificationNote',this.value)" placeholder="سبب القبول أو الرفض أو طلب الاستكمال"></label>`:''}</div>
    <div class="docops">${doc.dataUrl?`<button class="btn xs soft" onclick="docPreviewId('${doc.id}')">معاينة</button><button class="btn xs soft" onclick="docDownloadId('${doc.id}')">تنزيل</button>`:''}<button class="btn xs ghost" onclick="document.getElementById('center-rep-${doc.id}').click()">استبدال بإصدار جديد</button><input id="center-rep-${doc.id}" type="file" style="display:none" onchange="docReplaceId('${doc.id}',this)"><button class="btn xs ${doc.archived?'success':'danger'}" onclick="docToggleArchiveId('${doc.id}')">${doc.archived?'استعادة':'أرشفة'}</button>${doc.versions.length?`<span class="tagb gray">${doc.versions.length+1} إصدارات محفوظة</span>`:''}<span class="hint">${esc(doc.rights)} · ${esc(doc.confidentiality)}</span></div></div>`).join('');
  return pagehead(data[54],`<button class="btn ghost sm" onclick="go(11)">مركز الأدلة</button>`)+`
  <div class="grid c4"><div class="card metric blue"><div class="k">المستندات النشطة</div><div class="v">${active.length}</div></div><div class="card metric amber"><div class="k">بانتظار التحقق</div><div class="v">${pending}</div></div><div class="card metric red"><div class="k">منتهية الصلاحية</div><div class="v">${expired}</div></div><div class="card metric gold"><div class="k">تنتهي خلال 30 يومًا</div><div class="v">${expiring}</div></div></div>
  <div class="card panel mt"><h3>إضافة مستندات <span class="line"></span></h3><div class="fields" style="margin-top:12px"><div class="field"><label>العضوية المالكة</label><select id="docOwner" class="ctl">${(G.memberships||[]).map(x=>`<option ${x===G.activeMembership?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>الملفات</label><label class="filebox" style="padding:9px"><input type="file" multiple style="display:none" onchange="docGeneralUpload(this)"><b>⭱ اختيار عدة ملفات</b><small>تُحفظ البيانات الوصفية دائمًا</small></label></div></div></div>
  <div class="card panel mt"><div class="docfilters"><label>البحث<input class="ctl" value="${esc(f.q)}" oninput="G.docFilters.q=this.value;persist(true)" onchange="render()" placeholder="الاسم، الرقم، الجهة، الكيان…"></label><label>العضوية<select class="ctl" onchange="G.docFilters.owner=this.value;persist(true);render()"><option value="">الكل</option>${[...new Set(rows.map(r=>r.type))].map(x=>`<option ${f.owner===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>التصنيف<select class="ctl" onchange="G.docFilters.category=this.value;persist(true);render()"><option value="">الكل</option>${DOC_CATEGORIES.map(x=>`<option ${f.category===x?'selected':''}>${x}</option>`).join('')}</select></label><label>التحقق<select class="ctl" onchange="G.docFilters.verify=this.value;persist(true);render()"><option value="">الكل</option>${DOC_VERIFY.map(x=>`<option ${f.verify===x?'selected':''}>${x}</option>`).join('')}</select></label><label>الأرشيف<select class="ctl" onchange="G.docFilters.archive=this.value;persist(true);render()"><option value="active" ${f.archive==='active'?'selected':''}>النشطة</option><option value="archived" ${f.archive==='archived'?'selected':''}>المؤرشفة</option><option value="all" ${f.archive==='all'?'selected':''}>الكل</option></select></label></div></div>
  <div class="doclist mt">${cards||`<div class="card empty"><b>لا توجد مستندات مطابقة</b><p>ارفع مستندًا جديدًا أو عدّل عوامل التصفية.</p></div>`}</div>`}

function membershipCompletion(type,F,v){
  let repeatKeys=new Set((MEMBER_REPEATABLE[type]||[]).flatMap(d=>d.fields)),required=F.fields.filter(f=>f[3]&&!repeatKeys.has(f[0])),filled=required.filter(f=>Array.isArray(v[f[0]])?v[f[0]].length:String(v[f[0]]??'').trim()).length;
  let requiredRecords=(MEMBER_REPEATABLE[type]||[]).filter(d=>d.required),filledRecords=requiredRecords.filter(d=>memberRecords(type,d.key).length).length,total=required.length+requiredRecords.length,done=filled+filledRecords;
  return{done,total,pct:total?Math.round(done*100/total):100}
}
function membershipStepMissing(type,F,v,ms){
  let recordKeys=repeatFieldKeys(type,ms),fields=(F.stepMap[ms]||[]).filter(k=>!recordKeys.has(k)).map(k=>F.fields.find(f=>f[0]===k)).filter(f=>f&&f[3]);
  let missing=fields.filter(f=>!(Array.isArray(v[f[0]])?v[f[0]].length:String(v[f[0]]??'').trim())).map(f=>f[1]);
  repeatAt(type,ms).filter(d=>d.required&&!memberRecords(type,d.key).length).forEach(d=>missing.push('سجل واحد على الأقل: '+d.label));return missing
}
function rMembershipForm(type){let F=membershipForm(type);if(!F)return'';
  let MD=G.memberData=G.memberData||{};let v=MD[type]=MD[type]||{};
  G.memberStep=G.memberStep||{};G.memberPrivacy=G.memberPrivacy||{};G.memberPrivacy[type]=G.memberPrivacy[type]||{};
  let ms=Math.max(0,Math.min(G.memberStep[type]||0,F.steps.length-1));G.memberStep[type]=ms;
  let recordDefs=repeatAt(type,ms),recordKeys=repeatFieldKeys(type,ms);
  let keys=F.stepMap[ms]||[],stepFields=keys.filter(k=>!recordKeys.has(k)).map(k=>F.fields.find(f=>f[0]===k)).filter(Boolean);
  let done=G.completed.includes(type),lm=lifeMeta(type),completion=membershipCompletion(type,F,v),stepMissing=membershipStepMissing(type,F,v,ms);
  let fieldsHtml=stepFields.map(f=>{let[k,l,t,req,src]=f,val=v[k]??'',opts=mlinked(type,k,v,src);
    let wide=t==='multi'||t==='file';let c='';
    if(t==='select')c=`<select class="ctl" onchange="mset('${enc(type)}','${k}',this.value)"><option value="">اختر…</option>${opts.map(o=>`<option ${val===o?'selected':''}>${o}</option>`).join('')}</select>`;
    else if(t==='multi')c=`<div class="chips">${opts.map(o=>`<button type="button" class="chip ${(val||[]).includes(o)?'sel':''}" onclick="mtoggle('${enc(type)}','${k}',dec('${enc(o)}'))">${(val||[]).includes(o)?'✓ ':''}${o}</button>`).join('')}</div>`;
    else if(t==='file')c=docFieldHtml(type,k,val);
    else if(t==='textarea')c=`<textarea class="ctl" rows="4" oninput="mset('${enc(type)}','${k}',this.value)">${esc(val)}</textarea>`;
    else c=`<input class="ctl" type="${t}" ${t==='number'?'min="0" step="1"':''} value="${esc(val)}" oninput="mset('${enc(type)}','${k}',this.value)">`;
    let hidden=G.memberPrivacy[type][k];
    return `<div class="field ${wide?'wide':''}"><label><span>${l} ${req?'<em>*</em>':''}</span><button type="button" class="pv ${hidden?'off':''}" onclick="mprivacy('${enc(type)}','${k}')" title="تحديد ظهور هذا البيان">${hidden?'◉ مخفي':'◎ ظاهر'}</button></label>${c}</div>`}).join('');
  fieldsHtml+=recordDefs.map(def=>mrecords(type,def)).join('');
  return pagehead({ctx:'عضوية '+type,title:'إدخال بيانات '+type,desc:'تُستخدم هذه البيانات لإنشاء ملفك في سياق «'+type+'» وتُحفظ تلقائيًا.'})+`
  <div class="statusband ${lm.state==='approved'?'approved':lm.state==='rejected'||lm.state==='needs_changes'?'rejected':lm.state==='submitted'||lm.state==='under_review'?'pending':'draft'}" style="margin-bottom:16px">
    ${lm.state==='approved'?IC.check:lm.state==='submitted'||lm.state==='under_review'?IC.clock:IC.doc} حالة العضوية: <b>${lm.label}</b>${lm.dirty?' — توجد تعديلات غير مرسلة':''}
    <span style="margin-inline-start:auto;display:flex;gap:7px">${lifecycleActions(type)}</span>
  </div>
  <div class="card formcard" style="min-height:0">
    <div class="fh"><div class="kick">الخطوة ${ms+1} من ${F.steps.length} — عضوية ${type}</div><h2>${F.steps[ms]}</h2><p>تُحفظ المدخلات تلقائيًا، ويمكن العودة إلى أي خطوة دون فقد البيانات.</p></div>
    <div class="form-progress" aria-label="اكتمال البيانات الإلزامية"><div><b>اكتمال البيانات الإلزامية</b><span>${completion.done} من ${completion.total} · ${completion.pct}%</span></div><div class="progress-track"><i style="width:${completion.pct}%"></i></div><small>${stepMissing.length?'المتبقي في هذه الخطوة: '+stepMissing.join('، '):'اكتملت المتطلبات الإلزامية لهذه الخطوة ✓'}</small></div>
    <div class="chips" style="margin-bottom:18px">${F.steps.map((s,i)=>`<button type="button" class="chip ${i===ms?'sel':''}" onclick="mjump('${enc(type)}',${i})">${i+1}. ${s}</button>`).join('')}</div>
    <div class="fields">${fieldsHtml}</div>
    <div class="wizfoot"><button class="btn ghost" onclick="mprev('${enc(type)}')">→ ${ms?'الخطوة السابقة':'أنواع العضويات'}</button><span class="sp"></span>
      ${['مركز تدريب','مدرب','مستشار','باحث / أكاديمي'].includes(type)?`<button class="btn ghost" onclick="previewMembershipPublic('${enc(type)}')">${IC.eye} معاينة الملف العام</button>`:''}
      <button class="btn soft" onclick="persist()">حفظ مسودة</button>
      <button class="btn ${ms===F.steps.length-1?'gold':'primary'}" onclick="mnext('${enc(type)}')">${ms===F.steps.length-1?(done?'تحديث البيانات ✓':'إكمال بيانات العضوية ✓'):'حفظ ومتابعة ←'}</button></div></div>`}
function mset(t,k,v){t=dec(t);let d=G.memberData[t];d[k]=v;
  if(/Domain$/.test(k)){let p=k.replace(/Domain$/,'');d[p+'Specialty']='';d[p+'Phase']='';d[p+'AppliedAreas']=[];markMembershipDirty(t);render();return}
  if(/Specialty$/.test(k)){let p=k.replace(/Specialty$/,'');d[p+'Phase']='';d[p+'AppliedAreas']=[];markMembershipDirty(t);render();return}
  if(/Phase$/.test(k)){let p=k.replace(/Phase$/,'');d[p+'AppliedAreas']=[];markMembershipDirty(t);render();return}
  markMembershipDirty(t)}
function mtoggle(t,k,o){t=dec(t);let a=G.memberData[t][k]||[],sel=a.includes(o);G.memberData[t][k]=sel?a.filter(x=>x!==o):[...a,o];markMembershipDirty(t);render()}
function mfiles(t,k,inp){t=dec(t);let files=[...inp.files],v=G.memberData[t],existing=(Array.isArray(v[k])?v[k]:[]).map(d=>docNorm(d,t,k));
  Promise.all(files.map(f=>readDocumentFile(f,t,k))).then(docs=>{v[k]=[...existing,...docs];docs.forEach(d=>docLog('رفع مستند',d));markMembershipDirty(t);render();toast('أُرفقت الملفات دون حذف المستندات السابقة')})}
function mprivacy(t,k){t=dec(t);G.memberPrivacy=G.memberPrivacy||{};G.memberPrivacy[t]=G.memberPrivacy[t]||{};G.memberPrivacy[t][k]=!G.memberPrivacy[t][k];privacyAudit(t,k,G.memberPrivacy[t][k]);persist(true);render();toast(G.memberPrivacy[t][k]?'أُخفي البيان عن الملف العام':'أصبح البيان ظاهرًا في الملف العام')}
function mstepValid(t,idx){let F=membershipForm(t),v=G.memberData[t]||{},rdefs=repeatAt(t,idx),rkeys=repeatFieldKeys(t,idx);rdefs.forEach(d=>migrateLegacyRecord(t,d));
  let missingRecord=rdefs.find(d=>d.required&&!memberRecords(t,d.key).length);if(missingRecord){toast('أضف سجلًا واحدًا على الأقل في: '+missingRecord.label);return false}
  let fs=(F.stepMap[idx]||[]).filter(k=>!rkeys.has(k)).map(k=>F.fields.find(f=>f[0]===k)).filter(Boolean);
  let missing=fs.find(f=>f[3]&&(!v[f[0]]||(Array.isArray(v[f[0]])&&!v[f[0]].length)));if(missing){toast('أكمل: '+missing[1]);return false}
  let badMail=fs.find(f=>f[2]==='email'&&v[f[0]]&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v[f[0]]));if(badMail){toast('أدخل إيميلًا صحيحًا في: '+badMail[1]);return false}
  let badNum=fs.find(f=>f[2]==='number'&&v[f[0]]&&!/^\d+$/.test(v[f[0]]));if(badNum){toast('أدخل رقمًا صحيحًا في: '+badNum[1]);return false}
  return true}
function mjump(t,i){t=dec(t);G.memberStep=G.memberStep||{};G.memberStep[t]=i;persist(true);render();window.scrollTo({top:0})}
function mprev(t){t=dec(t);let i=G.memberStep[t]||0;if(i===0){go(44);return}mback(enc(t))}
function mback(t){t=dec(t);G.memberStep[t]=Math.max(0,(G.memberStep[t]||0)-1);persist(true);render();window.scrollTo({top:0})}
function mnext(t){t=dec(t);let F=membershipForm(t),i=G.memberStep[t]||0;if(!mstepValid(t,i))return;
  if(i<F.steps.length-1){G.memberStep[t]=i+1;G.membershipStatus[t]='قيد الإدخال';persist(true);render();window.scrollTo({top:0});return}
  finishMembership(enc(t))}
function finishMembership(t){t=dec(t);let F=membershipForm(t);let v=G.memberData[t]||{};
  let defs=MEMBER_REPEATABLE[t]||[],allRecordKeys=new Set(defs.flatMap(d=>d.fields));defs.forEach(d=>migrateLegacyRecord(t,d));
  let missingRecord=defs.find(d=>d.required&&!memberRecords(t,d.key).length);if(missingRecord){toast('أضف سجلًا واحدًا على الأقل في: '+missingRecord.label);return}
  let missing=F.fields.filter(f=>!allRecordKeys.has(f[0])&&f[3]&&!String(v[f[0]]||'').trim()&&!(Array.isArray(v[f[0]])&&v[f[0]].length));
  if(missing.length){toast('أكمل: '+missing[0][1]);return}
  if(!G.completed.includes(t))G.completed.push(t);
  G.activeMembership=t;let L=ensureLife(t);
  if(['not_started','needs_changes','rejected','expired'].includes(L.state)){
    L.state='draft';L.dirty=true;L.history.push({state:'draft',at:Date.now(),actor:'صاحب العضوية',note:'استكمال إدخال بيانات العضوية'});G.membershipStatus[t]=LIFE_STATES.draft.label
  }
  if(L.state==='draft')lifeTransition(t,'data_complete','صاحب العضوية','اكتملت جميع البيانات الإلزامية');
  else if(L.state==='data_complete'){L.dirty=false;L.updatedAt=Date.now();G.membershipStatus[t]=LIFE_STATES.data_complete.label}
  G.memberships=[...new Set([...G.memberships,t])];
  syncUnifiedEntity(t);
  let next=G.memberships.find(r=>!G.completed.includes(r));
  persist(true);
  if(next){G.activeMembership=next;if(ensureLife(next).state==='not_started')lifeTransition(next,'draft','المستخدم','بدء إدخال بيانات العضوية');persist(true);go(MEMBER_SCREENS[next]);toast('اكتملت بيانات «'+t+'» — تابع إدخال بيانات «'+next+'»')}
  else{G.ctx=t==='العميل'?'عميل':t;go(2);toast('اكتملت بيانات العضويات المختارة — مرحبًا بك في مساحة العمل 🎉')}}
