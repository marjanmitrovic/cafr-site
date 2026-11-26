import { Buffer } from 'node:buffer';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';

const cookieName = '__Host-ucfr-preview';
const lifetimeSeconds = 15 * 60;
const issuer = 'ucfr-worker-preview';

function previewKey(env) {
  const key = env.UCFR_PREVIEW_TOKEN;
  if (typeof key !== 'string' || key.length < 32 || key.length > 256) return null;
  const otherKeys = [env.TOKEN_SECRET, env.LAB_TOKEN, env.CANDIDATE_ACCESS_TOKEN, env.CANDIDATE_SESSION_SECRET, env.BREVO_API_KEY, env.DATABASE_URL];
  return otherKeys.includes(key) ? null : key;
}

export function missingPreviewSettings(env) {
  const missing = [];
  if (!env.DATABASE_URL?.trim()) missing.push('DATABASE_URL');
  const otherSecrets = [env.LAB_TOKEN, env.CANDIDATE_SESSION_SECRET, env.CANDIDATE_ACCESS_TOKEN, env.BREVO_API_KEY, env.UCFR_PREVIEW_TOKEN];
  if (typeof env.TOKEN_SECRET !== 'string' || env.TOKEN_SECRET.length < 32 ||
      otherSecrets.includes(env.TOKEN_SECRET)) missing.push('TOKEN_SECRET');
  if (!env.BREVO_API_KEY?.trim()) missing.push('BREVO_API_KEY');
  if (!previewKey(env)) missing.push('UCFR_PREVIEW_TOKEN');
  return missing;
}

export function isPreviewOrigin(url) {
  return (url.protocol === 'https:' && url.hostname.endsWith('.workers.dev')) ||
    ['localhost', '127.0.0.1'].includes(url.hostname);
}

function correctHeader(request, key) {
  const supplied = Buffer.from(request.headers.get('X-UCFR-Preview-Token') || '');
  const expected = Buffer.from(key);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function hasPreviewAccess(request, env, origin) {
  const key = previewKey(env);
  if (!key) return false;
  if (correctHeader(request, key)) return true;
  const cookies = (request.headers.get('Cookie') || '').split(';').map(c => c.trim());
  const grant = cookies.find(c => c.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  if (!grant || grant.length > 1024) return false;
  try {
    jwt.verify(grant, key, { algorithms: ['HS256'], issuer, audience: origin, subject: 'preview', maxAge: lifetimeSeconds });
    return true;
  } catch {
    return false;
  }
}

export function removePreviewCredentials(headers) {
  headers.delete('X-UCFR-Preview-Token');
  const cookies = (headers.get('Cookie') || '').split(';').map(c => c.trim())
    .filter(c => c && !c.startsWith(cookieName + '='));
  if (cookies.length) headers.set('Cookie', cookies.join('; '));
  else headers.delete('Cookie');
}

function page(missing, headers) {
  const nonce = randomUUID();
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Content-Security-Policy', "default-src 'none'; script-src 'nonce-" + nonce + "'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  const status = missing.length
    ? '<p>U Cloudflare panelu za ovaj Worker podesi sledeće vrednosti kao <strong>Secret</strong>.</p><ul>' +
      missing.map(name => '<li><code>' + name + '</code></li>').join('') + '</ul>'
    : '<p>Otvori probnu verziju, pa se prijavi kroz članski deo sajta.</p>';
  const form = missing.length ? '' : '<form id="open" method="post" action="/preview"><label for="access">UCFR_PREVIEW_TOKEN</label><input id="access" type="password" autocomplete="current-password" maxlength="256" required><button type="submit">Otvori probni sajt</button></form>';
  const generator = missing.includes('UCFR_PREVIEW_TOKEN') ? '<button type="button" id="generate">Generiši i kopiraj probni ključ</button><input id="generated" type="password" aria-label="Generisani probni ključ" autocomplete="off" readonly hidden>' : '';
  return new Response(`<!doctype html><html lang="sr-Latn"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>UČFR – provera migracije</title><style>body{font:17px/1.55 system-ui;max-width:34rem;margin:3rem auto;padding:0 1rem;color:#16243d}h1{font-size:1.6rem}input,button{box-sizing:border-box;width:100%;padding:.7rem;font:inherit;margin:.4rem 0}button{cursor:pointer}code{font-size:1rem}</style>
<h1>UČFR – provera migracije</h1>${status}${form}${generator}<p id="message" role="status"></p>
<script nonce="${nonce}">
const message=document.getElementById('message');
document.getElementById('generate')?.addEventListener('click',async()=>{
  const field=document.getElementById('generated');
  if(!field.value) field.value=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  try{await navigator.clipboard.writeText(field.value);message.textContent='Ključ je kopiran. Sačuvaj ga u Cloudflare-u kao UCFR_PREVIEW_TOKEN i u svom menadžeru lozinki.';}
  catch{field.hidden=false;field.type='text';field.select();message.textContent='Kopiraj označeni ključ i sačuvaj ga kao UCFR_PREVIEW_TOKEN.';}
});
document.getElementById('open')?.addEventListener('submit',async(event)=>{
  event.preventDefault();
  const field=document.getElementById('access');
  try{const result=await fetch('/preview',{method:'POST',headers:{'X-UCFR-Preview-Token':field.value},cache:'no-store',redirect:'error'});
    if(result.status===204){field.value='';location.replace('/');return;}
    message.textContent=result.status===401?'Probni ključ nije prihvaćen.':'Provera trenutno nije dostupna.';}
  catch{message.textContent='Veza nije uspela. Pokušaj ponovo.';}
});
</script></html>`, { headers });
}

export function servePreviewPage(request, env, url) {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' });
  const missing = missingPreviewSettings(env);
  if (request.method === 'GET') return page(missing, headers);
  if (request.method !== 'POST') { headers.set('Allow', 'GET, POST'); return new Response(null, { status: 405, headers }); }
  if (request.headers.get('Origin') !== url.origin) return new Response(null, { status: 403, headers });
  const key = previewKey(env);
  if (!key || !correctHeader(request, key)) return new Response(null, { status: 401, headers });
  if (missing.length) return new Response(null, { status: 503, headers });
  const grant = jwt.sign({}, key, { algorithm: 'HS256', issuer, audience: url.origin, subject: 'preview', expiresIn: lifetimeSeconds });
  headers.set('Set-Cookie', cookieName + '=' + grant + '; Path=/; Max-Age=' + lifetimeSeconds + '; Secure; HttpOnly; SameSite=Strict');
  return new Response(null, { status: 204, headers });
}
