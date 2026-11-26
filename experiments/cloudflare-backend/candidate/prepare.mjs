import { cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../..');
const generated=path.join(here,'generated');
const src=path.join(generated,'server');
await rm(generated,{recursive:true,force:true});
await mkdir(generated,{recursive:true});
await cp(path.join(repo,'server'),src,{recursive:true});
await cp(path.join(here,'storage.js'),path.join(src,'lib/storage.js'));
await cp(path.join(here,'password.js'),path.join(src,'lib/password.js'));
const edit=async(name,fn)=>{
 const p=path.join(src,name),original=await readFile(p,'utf8'),next=fn(original);
 if(next===original)throw Error('Expected adaptation not found: '+name);
 await writeFile(p,next);
};
function replaceExact(s,a,b){
 if(s.split(a).length!==2)throw Error('Expected exactly one source marker: '+a.slice(0,100));
 return s.replace(a,()=>b);
}
// Request-scoped Prisma; never reuse a network connection across invocations.
await writeFile(path.join(src,'lib/prisma.js'),`import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
const context=new AsyncLocalStorage();
export const prisma=new Proxy({}, {get(_,key){
 const client=context.getStore()?.client;
 if(!client)throw Error('Database outside request scope');
 const value=client[key];
 return typeof value==='function'?value.bind(client):value;
}});
export function withFileRecord(work){
 const {client}=context.getStore();
 return client.$transaction(tx=>context.run({client:tx,fileWrite:true},work),{timeout:30000});
}
export function fileTransaction(){
 const scope=context.getStore();
 if(!scope?.fileWrite)throw Error('File write outside parent transaction');
 return scope.client;
}
export async function withDatabase(url,fn){
 const adapter=new PrismaPg({connectionString:url,max:1,connectionTimeoutMillis:15000});
 const client=new PrismaClient({adapter});
 try{return await context.run({client},fn)}finally{await client.$disconnect()}
}
`);
// Do not allow any startup DB repair or seeding on an isolate cold start.
// Keep the actual administrator and membership route protection middleware.
await edit('admin-status-guard-preload.js',s=>{
 const from=s.indexOf('try {\n  const owner =');
 const to=s.indexOf('if (!express.application.__ucfrAdminStatusGuardInstalled)',from);
 if(from<0||to<0)throw Error('Owner repair markers changed');
 return s.slice(0,from)+'// Startup owner repair excluded from request runtime.\n'+s.slice(to);
});
await edit('local-units-preload.js',s=>{
 const from=s.indexOf('    // Do not block Express startup');
 const to=s.indexOf('    return server;',from);
 if(from<0||to<0)throw Error('Local units startup markers changed');
 return s.slice(0,from)+s.slice(to);
});
await edit('server.js',s=>{
 s=replaceExact(s,"import bcrypt from 'bcryptjs';","import bcrypt from './lib/password.js';");
 s=replaceExact(s,"import { prisma, withFileRecord } from './lib/prisma.js';","import { prisma, withFileRecord } from './lib/prisma.js';\nimport { saveStoredFile, serveStoredFile } from './lib/storage.js';");
 s=replaceExact(s,"const __filename = fileURLToPath(import.meta.url);\nconst __dirname = path.dirname(__filename);","const __dirname = '/tmp/ucfr-candidate/server';");
 s=replaceExact(s,"const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.JWT_SECRET || 'replace-this-secret-before-production';","const TOKEN_SECRET = process.env.TOKEN_SECRET;\nif (!TOKEN_SECRET || TOKEN_SECRET.length < 32) throw Error('Candidate token secret missing');");
 s=replaceExact(s,"app.use('/uploads', express.static(path.join(PUBLIC_DIR, 'uploads')));","// Stored files are served by the authorized route below.");
 s=replaceExact(s,"const publicQuestion = (q, lang) => (",`app.get('/uploads/objects/:id', async (req,res)=>{
   const bearer=req.headers.authorization||'';
   if(bearer){
     try{
       if(!bearer.startsWith('Bearer '))return res.status(401).end();
       const p=jwt.verify(bearer.slice(7),TOKEN_SECRET,{algorithms:['HS256']});
       req.user=await prisma.user.findUnique({where:{id:p.sub}});
       if(!req.user?.isActive)return res.status(401).end();
     }catch{return res.status(401).end();}
   }
   return serveStoredFile(req,res);
 });
 const publicQuestion = (q, lang) => (`);
 const start=s.indexOf("if (process.env.NODE_ENV === 'production') {\n  // HTML must revalidate");
 const end=s.indexOf("app.use((error, _req, res, _next)",start);
 if(start<0||end<0)throw Error('Static serving markers changed');
 s=s.slice(0,start)+s.slice(end);
 const boot=s.indexOf('const server = app.listen(PORT, async () => {');
 if(boot<0)throw Error('Boot marker changed');
 s=s.slice(0,boot)+'export const server = app.listen(3001);\n';
 const local=s.indexOf("  await fs.mkdir(path.join(localBaseDir");
 const localEnd=s.indexOf('\n}\n',local);
 if(local<0||localEnd<0)throw Error('Local upload markers changed');
 s=s.slice(0,local)+"  return saveStoredFile({decoded,originalName});"+s.slice(localEnd);
 s=replaceExact(s,"storage: cloudUploadsEnabled() ? 'cloudinary' : 'local'","storage: 'postgresql'");
 return s;
});
await edit('news-preload.js',s=>{
 s=replaceExact(s,"import { prisma, withFileRecord } from './lib/prisma.js';","import { prisma, withFileRecord } from './lib/prisma.js';\nimport { saveStoredFile } from './lib/storage.js';");
 const from=s.indexOf('  await fs.mkdir(NEWS_UPLOAD_DIR');
 const end=s.indexOf('\n}',from);
 if(from<0||end<0)throw Error('News upload markers changed');
 s=s.slice(0,from)+"  return (await saveStoredFile({decoded,originalName:storedName})).url;"+s.slice(end);
 // In-flight DB requests must not be shared across Worker request contexts.
 const a=s.indexOf('async function getPublicNews() {'), b=s.indexOf('\n}',a);
 if(a<0||b<0)throw Error('News cache markers changed');
 return s.slice(0,a)+`async function getPublicNews() {
 const rows=await prisma.document.findMany({where:{category:'NEWS',status:'PUBLISHED',visibility:'PUBLIC'},orderBy:{createdAt:'desc'},take:24});
 return rows.map(articleResponse);
}`+s.slice(b+2);
});
await edit('public-member-count-preload.js',s=>{
 const a=s.indexOf('async function getApprovedMemberCount() {'),b=s.indexOf('\n}',a);
 if(a<0||b<0)throw Error('Member count cache markers changed');
 return s.slice(0,a)+`async function getApprovedMemberCount() {
 return prisma.user.count({where:{membershipStatus:'APPROVED'}});
}`+s.slice(b+2);
});
await edit('brevo-password-reset-preload.js',s=>{
 s=s.replaceAll('v Renderu','v nastavení serveru');
 return replaceExact(s,"const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';","const BREVO_ENDPOINT = process.env.UCFR_CI_MAIL === 'true' ? 'http://127.0.0.1:8790/v3/smtp/email' : 'https://api.brevo.com/v3/smtp/email';");
});
// Do not import startup-only data migrations/question seeding modules in the edge entry.
// Keep the same order of all remaining production middleware.
const preloads=['admin-status-guard-preload','rejected-user-delete-preload','facr-registration-guard-preload','ucfr-details-preload','brevo-password-reset-preload','public-member-count-preload','admin-users-pagination-preload','local-units-preload','news-preload'];
await writeFile(path.join(generated,'boot.js'),preloads.map(n=>"import './server/"+n+".js';").join('\n')+"\nimport './server/server.js';\nexport {withDatabase} from './server/lib/prisma.js';\n");
console.log('Generated candidate from current production server and nine route preloads; no database access.');
