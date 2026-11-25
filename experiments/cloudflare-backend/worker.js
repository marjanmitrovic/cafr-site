import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

const service = 'ucfr-api-lab';
const reply = (body, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
function authorized(request, env) {
  const secret = env.LAB_TOKEN;
  if (typeof secret !== 'string' || secret.length < 32 || secret.length > 256) return false;
  const supplied = request.headers.get('Authorization') || '';
  const expected = 'Bearer ' + secret;
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function makeWorker({ checkDatabase, benchmarkBcrypt }) {
  return {
    async fetch(request, env = {}) {
      const { pathname } = new URL(request.url);
      if (request.method === 'GET' && pathname === '/health') {
        return reply({ ok: true, service, experimental: true });
      }
      if (request.method === 'GET' && pathname === '/diagnostics') {
        return new Response("<!doctype html><html lang=\"sr\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>UCFR – probni backend</title><style>body{font:16px system-ui;max-width:35rem;margin:2rem auto;padding:1rem;line-height:1.5}input,button{font:inherit;padding:.75rem;box-sizing:border-box;margin:.4rem 0;width:100%}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eee;padding:1rem;color:#222}</style><h1>UCFR – dijagnostika</h1><p>Test nije povezan sa produkcijskom prijavom. Koristi samo poseban LAB_TOKEN.</p><label for=\"token\">LAB_TOKEN</label><input id=\"token\" type=\"password\" autocomplete=\"off\" maxlength=\"256\"><button id=\"generate\">Generiši novi probni token</button><button id=\"copy\">Kopiraj token za Cloudflare Settings</button><button id=\"bcrypt\">Testiraj bcrypt (faktor 12)</button><button id=\"db\">Testiraj Neon (samo čitanje)</button><button id=\"auth\">Testiraj prijavu i sesiju (probni član)</button><pre id=\"output\" aria-live=\"polite\">Spremno.</pre><script>const token=document.querySelector('#token'),output=document.querySelector('#output');document.querySelector('#generate').onclick=()=>{token.value=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');output.textContent='Token generisan. Sačuvaj ga kao LAB_TOKEN u probnom Workeru.'};document.querySelector('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(token.value);output.textContent='Token kopiran.'}catch{output.textContent='Kopiraj token ručno.'}};let busy=false;async function run(path){if(busy)return;if(token.value.length<32){output.textContent='Unesi LAB_TOKEN.';return}busy=true;output.textContent='Test u toku…';try{const res=await fetch('/diagnostics/'+path,{method:'POST',headers:{Authorization:'Bearer '+token.value},cache:'no-store',redirect:'error'});const type=res.headers.get('content-type')||'';output.textContent='HTTP '+res.status+'\\n'+(type.includes('application/json')?JSON.stringify(await res.json(),null,2):'Odgovor platforme; proveri Observability za CPU limit.')}catch{output.textContent='Mrežna greška.'}finally{busy=false}}document.querySelector('#auth').onclick=async()=>{if(busy)return;if(token.value.length<32){output.textContent='Unesi LAB_TOKEN.';return}busy=true;output.textContent='Test prijave i sesije…';try{const h={'X-UCFR-Lab-Token':token.value,'Content-Type':'application/json'};const login=await fetch('/lab/api/auth/login',{method:'POST',headers:h,body:JSON.stringify({email:'ucfr-lab@example.invalid',password:'ucfr-lab-fixture-not-a-password'}),redirect:'error',cache:'no-store'});if(!login.ok){output.textContent='Login HTTP '+login.status;return}const data=await login.json();const me=await fetch('/lab/api/auth/me',{headers:{'X-UCFR-Lab-Token':token.value,Authorization:'Bearer '+data.token},redirect:'error',cache:'no-store'});output.textContent='Login HTTP '+login.status+' / Profil HTTP '+me.status+'\\n'+(me.ok?'Probna prijava i provera sesije uspešne.':'Provera sesije neuspešna.')}catch{output.textContent='Test nije završen.'}finally{busy=false}};document.querySelector('#bcrypt').onclick=()=>run('bcrypt');document.querySelector('#db').onclick=()=>run('database');</script></html>", { headers: {
          'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
          'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        } });
      }
      const isDb = request.method === 'POST' && pathname === '/diagnostics/database';
      const isBcrypt = request.method === 'POST' && pathname === '/diagnostics/bcrypt';
      if (!isDb && !isBcrypt) return reply({ error: 'Not found' }, 404);
      if (!authorized(request, env)) return reply({ error: 'Unauthorized' }, 401);
      if (isDb && !env.LAB_DATABASE_URL) return reply({ ok: false, error: 'Not configured' }, 503);
      try {
        const ok = isDb ? await checkDatabase(env.LAB_DATABASE_URL) : await benchmarkBcrypt();
        return reply({ ok: ok === true, service, check: isDb ? 'read-only-schema' : 'synthetic-bcrypt-cost-12' }, ok === true ? 200 : 503);
      } catch {
        // Never echo connection strings, passwords, database rows or raw errors.
        return reply({ ok: false, service, error: 'Diagnostic failed' }, 503);
      }
    },
  };
}
