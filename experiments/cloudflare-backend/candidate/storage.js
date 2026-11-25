import { randomUUID } from 'node:crypto';
import { prisma } from './prisma.js';
export const STORAGE_LIMIT=128*1024*1024;
export const MAX_FILE=8*1024*1024;
const MIME=new Set(['application/pdf','image/png','image/jpeg','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','text/plain']);
const PREFIX='/uploads/objects/';
const roles=new Set(['ADMIN','BOARD','QUESTION_EDITOR']);
export async function saveStoredFile({decoded,originalName}){
 const buffer=decoded?.buffer,mime=decoded?.mime;
 if(!buffer||buffer.length<1||buffer.length>MAX_FILE||!MIME.has(mime))throw Error('Invalid file');
 const name=String(originalName||'file').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,120)||'file';
 const id=randomUUID();
 await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(24417513)::text AS lock`;
  const rows=await tx.$queryRaw`SELECT COALESCE(sum("sizeBytes"),0)::bigint AS total FROM "UcfrStoredFile"`;
  if(BigInt(rows[0].total)+BigInt(buffer.length)>BigInt(STORAGE_LIMIT))throw Error('Storage capacity reached');
  await tx.$executeRaw`INSERT INTO "UcfrStoredFile" (id,name,mime,content,"sizeBytes") VALUES (${id}::uuid,${name},${mime},${new Uint8Array(buffer)},${buffer.length})`;
 });
 return {url:PREFIX+id,sizeBytes:buffer.length};
}
export async function serveStoredFile(req,res){
 const id=String(req.params.id||'');
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return res.status(404).end();
 const url=PREFIX+id;
 const user=req.user;
 const admin=user?.isActive&&roles.has(user.role);
 const active=user?.isActive;
 const docs=await prisma.document.findMany({where:{url},select:{status:true,visibility:true}});
 const docAllowed=docs.some(d=>admin||(d.status==='PUBLISHED'&&(d.visibility==='PUBLIC'||(active&&(d.visibility==='MEMBERS'||(d.visibility==='APPROVED_MEMBERS'&&user.membershipStatus==='APPROVED'))))));
 let allowed=docAllowed;
 if(!allowed&&active){
  const [incident,legal]=await Promise.all([
   prisma.incidentAttachment.findFirst({where:{fileUrl:url,...(admin?{}:{incident:{userId:user.id}})},select:{id:true}}),
   prisma.legalRequestAttachment.findFirst({where:{fileUrl:url,...(admin?{}:{legalRequest:{userId:user.id}})},select:{id:true}})
  ]);
  allowed=Boolean(incident||legal);
 }
 // An unlinked object is inaccessible even to administrators.
 if(!allowed)return res.status(404).end();
 const rows=await prisma.$queryRaw`SELECT name,mime,content,"sizeBytes" FROM "UcfrStoredFile" WHERE id=${id}::uuid`;
 const f=rows[0];if(!f||!MIME.has(f.mime))return res.status(404).end();
 res.set('Cache-Control','private, no-store');
 res.set('X-Content-Type-Options','nosniff');
 res.set('Content-Security-Policy',"default-src 'none'; sandbox");
 res.set('Content-Type',f.mime);
 res.set('Content-Disposition',(f.mime.startsWith('image/')?'inline':'attachment')+'; filename="'+String(f.name).replace(/[^a-zA-Z0-9._-]/g,'-')+'"');
 return res.send(Buffer.from(f.content));
}
