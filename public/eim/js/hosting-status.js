fetch('/health/live', { cache: 'no-store' }).then(response => response.json()).then(status => {
  if (status.mode !== 'preview') return;
  const notice = document.createElement('div');
  notice.setAttribute('role', 'status');
  notice.textContent = 'نسخة معاينة — تسجيل الدخول والحفظ في الحساب غير مفعّلين. لا تُدخل بيانات حقيقية.';
  Object.assign(notice.style, { position:'fixed', bottom:'12px', left:'12px', right:'12px', zIndex:'9999', background:'#fff3cd', color:'#664d03', padding:'12px', border:'1px solid #ffecb5', borderRadius:'8px', textAlign:'center' });
  document.body.appendChild(notice);
}).catch(() => {});
