// Only intercept new database-backed object links. Existing external files are unchanged.
export function installStoredFileLinks(getToken){
 document.addEventListener('click',async event=>{
   if(event.defaultPrevented||event.button!==0)return;
   const anchor=event.target.closest?.('a[href]');
   if(!anchor)return;
   let url;try{url=new URL(anchor.href,location.href)}catch{return}
   if(url.origin!==location.origin||!/^\/uploads\/objects\/[a-f0-9-]{36}(?:\.(?:png|jpg|webp))?$/.test(url.pathname))return;
   event.preventDefault();
   try{
     const token=getToken();
     const res=await fetch(url.pathname,{headers:token?{Authorization:'Bearer '+token}:{},credentials:'same-origin',redirect:'error',cache:'no-store'});
     if(!res.ok)throw Error('Download unavailable');
     const filename=(res.headers.get('content-disposition')||'').match(/filename="([a-zA-Z0-9._-]+)"/)?.[1]||'ucfr-file';
     const objectUrl=URL.createObjectURL(await res.blob());
     const link=document.createElement('a');link.href=objectUrl;link.download=filename;
     document.body.append(link);link.click();link.remove();
     setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
   }catch{alert('Soubor nelze stáhnout. Zkontrolujte přihlášení a oprávnění.');}
 });
}
