(function(){
  const main=document.getElementById('main-content');
  const nav=document.getElementById('nav');
  const crumb=document.getElementById('crumb');
  const view=document.getElementById('view');

  function enhanceNavigation(){
    if(!nav)return;
    nav.querySelectorAll('button').forEach(button=>{
      if(button.classList.contains('on'))button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
  }

  function announceRoute(){
    const title=(crumb&&crumb.textContent||'').trim();
    if(title&&title!=='…')document.title=title+' | شبكة الخبراء العرب';
  }

  function enhanceRequiredFields(){
    document.querySelectorAll('#view .field label em').forEach(mark=>{
      const field=mark.closest('.field');
      const control=field&&field.querySelector('input,select,textarea');
      if(control){control.required=true;control.setAttribute('aria-required','true')}
    });
  }

  function enhance(){enhanceNavigation();announceRoute();enhanceRequiredFields()}
  if(nav)new MutationObserver(enhanceNavigation).observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  if(crumb)new MutationObserver(announceRoute).observe(crumb,{childList:true,subtree:true,characterData:true});
  if(view)new MutationObserver(enhanceRequiredFields).observe(view,{childList:true,subtree:true});

  if(typeof window.go==='function'){
    const originalGo=window.go;
    window.go=function(id){
      const result=originalGo.apply(this,arguments);
      requestAnimationFrame(()=>{enhance();if(main)main.focus({preventScroll:true})});
      return result;
    };
  }
  enhance();
})();
