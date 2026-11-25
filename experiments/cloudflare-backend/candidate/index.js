import { handleAsNodeRequest } from 'cloudflare:node';
import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function authorized(request, secret){
 if(typeof secret!=='string'||secret.length<32||secret.length>256)return false;
 const a=Buffer.from(request.headers.get('X-UCFR-Candidate-Token')||''),b=Buffer.from(secret);
 return a.length===b.length&&timingSafeEqual(a,b);
}
function candidateDatabase(env){
 try {
   const u=new URL(env.CANDIDATE_DATABASE_URL);
   const host=String(env.CANDIDATE_DATABASE_HOST||'').toLowerCase();
   if(!['postgresql:','postgres:'].includes(u.protocol)||!host||u.hostname!==host||!u.username||!u.password)return null;
   // Reject the current production Neon endpoint, including its pooler alias.
   if(/^ep-super-sound-astudi34(?:-pooler)?\./i.test(u.hostname))return null;
   return u.toString();
 } catch {return null}
}
let boot;
async function load(env){
 if(!boot){
   // Separate secrets and disabled external effects. No production fallback.
   process.env.TOKEN_SECRET=env.CANDIDATE_SESSION_SECRET;
   process.env.EMAIL_DISABLED='true';
   process.env.UCFR_DB_BCRYPT=env.CANDIDATE_DB_BCRYPT==='true'?'true':'false';
   process.env.FILE_STORAGE='disabled';
   process.env.WEB_ORIGIN='https://candidate.invalid';
   delete process.env.BREVO_API_KEY;
   delete process.env.RESEND_API_KEY;
   delete process.env.CLOUDINARY_CLOUD_NAME;
   delete process.env.CLOUDINARY_UPLOAD_PRESET;
   const ciMail=env.CANDIDATE_CI_MAIL==='true' && candidateDatabase(env)==='postgresql://ucfr_test:ucfr_test@127.0.0.1:5432/ucfr_test';
   process.env.UCFR_CI_MAIL=ciMail?'true':'false';
   if(ciMail){process.env.BREVO_API_KEY='synthetic-ci-key';process.env.BREVO_SENDER_EMAIL='sender@example.invalid';}
   boot=import('./generated/boot.js');
 }
 return boot;
}
export default {
 async fetch(request,env){
  const p=new URL(request.url).pathname;
  if(p==='/health'&&request.method==='GET')return json({ok:true,service:'ucfr-api-candidate',production:false});
  if(!p.startsWith('/api/')&&!p.startsWith('/uploads/objects/'))return json({error:'Not found'},404);
  if(!authorized(request,env.CANDIDATE_ACCESS_TOKEN))return json({error:'Unauthorized'},401);
  const db=candidateDatabase(env);
  // Write integration tests are confined to the disposable CI PostgreSQL service.
  // This cannot enable writes against any remote Neon endpoint.
  const ciWrites=env.CANDIDATE_CI_WRITES==='true' &&
    db==='postgresql://ucfr_test:ucfr_test@127.0.0.1:5432/ucfr_test';
  const permittedWrite=(request.method==='PATCH' &&
    (p==='/api/auth/me'||p==='/api/auth/password'||/^\/api\/admin\/users\/[^/]+\/(status|role)$/.test(p))) ||
    (request.method==='POST' && ['/api/admin/documents/upload','/api/incidents','/api/legal-requests','/api/auth/forgot-password','/api/auth/reset-password'].includes(p));
  if(!['GET','HEAD'].includes(request.method)&&!(request.method==='POST'&&p==='/api/auth/login')&&!(ciWrites&&permittedWrite))return json({error:'Candidate writes disabled'},405);
  if(!db||typeof env.CANDIDATE_SESSION_SECRET!=='string'||env.CANDIDATE_SESSION_SECRET.length<32||
     env.CANDIDATE_SESSION_SECRET===env.CANDIDATE_ACCESS_TOKEN)return json({error:'Candidate not configured'},503);
  try {
   const {withDatabase}=await load(env);
   return await withDatabase(db,async()=>{
     const headers=new Headers(request.headers);
     headers.delete('X-UCFR-Candidate-Token');
     const result=await handleAsNodeRequest(3001,new Request(request,{headers}));
     const h=new Headers(result.headers);
     h.set('Cache-Control','no-store');
     h.set('X-Content-Type-Options','nosniff');
     return new Response(result.body,{status:result.status,headers:h});
   });
  }catch{
   return json({error:'Candidate runtime unavailable'},503);
  }
 }
};
