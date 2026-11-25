import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';

export const TEST_EMAIL = 'ucfr-lab@example.invalid';
const ISSUER = 'ucfr-api-lab', AUDIENCE = 'ucfr-lab-only';
const TTL = 600;
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const decode = value => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
const response = (body, status = 200) => Response.json(body, {status, headers: {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
}});
function labAuthorized(request, secret) {
  if (typeof secret !== 'string' || secret.length < 32 || secret.length > 256) return false;
  const a = Buffer.from(request.headers.get('X-UCFR-Lab-Token') || '');
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
const key = secret => crypto.subtle.importKey('raw', new TextEncoder().encode('UCFR-LAB-SESSION-v1:' + secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify']);
async function sign(user, secret, now) {
  const data = encode({alg:'HS256',typ:'JWT'}) + '.' + encode({iss:ISSUER,aud:AUDIENCE,sub:user.id,iat:now,exp:now+TTL,role:user.role,membershipStatus:user.membershipStatus});
  const signature = await crypto.subtle.sign('HMAC', await key(secret), new TextEncoder().encode(data));
  return data + '.' + Buffer.from(signature).toString('base64url');
}
async function verify(token, secret, now) {
  try {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = decode(parts[0]);
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;
    const ok = await crypto.subtle.verify('HMAC',await key(secret),Buffer.from(parts[2],'base64url'),new TextEncoder().encode(parts[0]+'.'+parts[1]));
    if (!ok) return null;
    const p = decode(parts[1]);
    if(p.iss !== ISSUER || p.aud !== AUDIENCE || typeof p.sub !== 'string' ||
      !Number.isInteger(p.iat) || !Number.isInteger(p.exp) || p.iat > now || p.exp <= now || p.exp-p.iat !== TTL) return null;
    return p;
  } catch { return null; }
}
const fields = ['id','email','firstName','lastName','phone','region','refereeStatus','role','membershipStatus','language','isActive','approvedAt','createdAt'];
const publicUser = user => Object.fromEntries(fields.map(k=>[k,user[k] ?? null]));
// Pilot only: no real member login, no production JWT, and no database writes.
export function createAuthPilot({findFixture, comparePassword, now=()=>Math.floor(Date.now()/1000)}) {
  return async function handle(request, env) {
    const path = new URL(request.url).pathname;
    if (!['/lab/api/auth/login','/lab/api/auth/me'].includes(path)) return null;
    if (!labAuthorized(request, env.LAB_TOKEN)) return response({error:'Unauthorized'},401);
    if (!env.LAB_DATABASE_URL) return response({error:'Lab database not configured'},503);
    try {
      if (path.endsWith('/login') && request.method === 'POST') {
        const raw = await request.text();
        if(raw.length>2048) return response({error:'Invalid request'},400);
        let body; try {body=JSON.parse(raw);} catch {return response({error:'Invalid request'},400);}
        const email = String(body?.email || '').trim().toLowerCase();
        const password = body?.password;
        if(email!==TEST_EMAIL || typeof password!=='string' || new TextEncoder().encode(password).length>72) return response({error:'Invalid email or password'},401);
        const user = await findFixture(env.LAB_DATABASE_URL);
        if(!user || user.email!==TEST_EMAIL || !user.isActive || user.role!=='MEMBER' || !(await comparePassword(password,user.passwordHash))) return response({error:'Invalid email or password'},401);
        return response({token:await sign(user,env.LAB_TOKEN,now()),user:publicUser(user)});
      }
      if (path.endsWith('/me') && request.method === 'GET') {
        const bearer = request.headers.get('Authorization') || '';
        const p = bearer.startsWith('Bearer ') ? await verify(bearer.slice(7),env.LAB_TOKEN,now()) : null;
        if(!p) return response({error:'Unauthorized'},401);
        const user = await findFixture(env.LAB_DATABASE_URL);
        if(!user || user.id!==p.sub || user.email!==TEST_EMAIL || !user.isActive || user.role!=='MEMBER') return response({error:'Unauthorized'},401);
        return response({user:publicUser(user)});
      }
      return response({error:'Method not allowed'},405);
    } catch {return response({error:'Lab authentication unavailable'},503);}
  };
}
