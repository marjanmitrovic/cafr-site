(() => {
  'use strict';
  function isAndroid(){ return /Android/i.test(navigator.userAgent || ''); }
  function relabel(){
    if (!isAndroid()) return;
    document.querySelectorAll('[data-card-action="print"]').forEach((button) => {
      button.textContent = 'Stáhnout PDF pro tisk';
      button.title = 'PDF 85,60 × 53,98 mm pro systémový tisk';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', relabel, {once:true});
  else relabel();
  new MutationObserver(relabel).observe(document.documentElement, {childList:true, subtree:true});
})();
