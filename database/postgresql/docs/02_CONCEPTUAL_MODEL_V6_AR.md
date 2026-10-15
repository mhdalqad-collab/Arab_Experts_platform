# النموذج المفاهيمي المتكامل V6

## النواة

`Party` هو الأصل الذي يمثل شخصًا أو منظمة. يرتبط الشخص بحساب دخول واحد،
وتنشأ له عضوية أو أكثر. المنظمة Party أيضًا، وتدار علاقاتها دون نسخ بياناتها.

## السلاسل المفاهيمية

1. **الهوية:** Party ← Person/Organization ← Account ← Membership.
2. **المهنة:** Professional Profile ← Qualifications/Experience/Capabilities ← Evidence.
3. **السوق:** Client Need ← Service Request ← Match Run ← Proposal/Team.
4. **التنفيذ:** Engagement ← Milestone/Task ← Deliverable/Acceptance ← Lessons Learned.
5. **التدريب:** Course Canonical ← Course Version ← Offering ← Registration/Attendance.
6. **المعرفة:** Research Project ← Publication Version ← Knowledge Asset Version.
7. **الحوكمة:** Role ← Permission ← Assignment/Delegation ← Review/Approval.
8. **الخصوصية:** Data Field ← Classification/Purpose ← Consent/Preference/Override.
9. **التكامل:** External System ← Connection ← Data Contract/Mapping ← Sync/Event.

## حدود الملكية

- بيانات الهوية ملك للنواة، ولا تنسخ في التدريب أو CRM.
- اسم الدورة القياسي مستقل عن الإصدار والطرح.
- الملف العام إسقاط Read Model تحكمه الخصوصية، وليس نسخة ثانية قابلة للتحرير.
- التصنيف مرجعي مؤرّخ بالإصدار؛ لا تحفظ التسميات الحرة بديلاً عن مفاتيحه.
- سجل التدقيق دليل مستقل لا يعدل بعد الإدراج.

