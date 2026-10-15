# تشغيل EIM V113 R5 بالحاويات

## المتطلبات

- Docker Engine حديث مع Docker Compose v2.
- خادم Linux موثوق.
- DNS وTLS عبر Reverse Proxy أو Load Balancer.
- خدمات OIDC وObject Storage والفحص الأمني والإشعارات.

## الإعداد

```bash
cp deployment/.env.example deployment/.env
# حرر deployment/.env ولا تترك أي replace_ أو example.invalid
npm run deploy:preflight -- deployment/.env
```

لا تحفظ `deployment/.env` في Git ولا ترسله بالبريد. استخدم Secret Manager في الإنتاج.

## تشغيل قاعدة البيانات والترحيلات

```bash
docker compose --env-file deployment/.env -f deployment/docker-compose.yml up -d postgres
docker compose --env-file deployment/.env -f deployment/docker-compose.yml --profile migrate run --rm migrate
```

خدمة `migrate` تنتهي بعد تطبيق الترحيلات والبذور ولا تعمل مع التطبيق بصورة دائمة. في الإنتاج المُدار يجب استخدام مستخدم ترحيل مستقل، ثم منح Backend مستخدم تشغيل محدود الصلاحيات بدل مالك القاعدة المستخدم في Compose المحلي.

## تشغيل التطبيق

```bash
docker compose --env-file deployment/.env -f deployment/docker-compose.yml up -d --build backend frontend
docker compose --env-file deployment/.env -f deployment/docker-compose.yml ps
npm run deploy:smoke
```

## التحقق والتشخيص

```bash
curl -fsS http://127.0.0.1:8788/health/live
curl -fsS http://127.0.0.1:8788/health/ready
curl -fsS http://127.0.0.1:8788/v1/meta
docker compose --env-file deployment/.env -f deployment/docker-compose.yml logs --tail=200 backend
```

لا تنشر منفذ PostgreSQL للإنترنت. منفذ Backend مربوط افتراضيًا بـ`127.0.0.1`، بينما يُنشر Frontend عبر Reverse Proxy مع HTTPS.

## الإيقاف

```bash
docker compose --env-file deployment/.env -f deployment/docker-compose.yml down
```

لا تستخدم `down -v` في بيئة تحتوي بيانات؛ لأنه يحذف Volume قاعدة البيانات.

## قبل الإنتاج

- نفّذ Backup واستعادة تجريبية قبل أول ترحيل.
- احتفظ بصورة الحاوية السابقة وخطة Rollback.
- شغّل UAT واختبارات الصلاحيات والملفات والإشعارات.
- فعّل المراقبة والتنبيهات وتدوير الأسرار.
- أبقِ `POSTGRES_OPERATIONS_ACTIONS_ENABLED=false` حتى اكتمال موافقات التشغيل وStep-up.
