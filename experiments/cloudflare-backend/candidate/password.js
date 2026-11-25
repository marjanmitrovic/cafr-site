// Candidate-only adapter: preserve bcrypt semantics and cost. No plaintext password is persisted.
import { prisma } from './prisma.js';
import bcrypt from 'bcryptjs';
const validHash=/^\$2[aby]\$(0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$/;
async function protectedQuery(fn){
 return prisma.$transaction(async tx=>{
  // Disable logging of bound parameters for this transaction, including errors.
  // If the DB role cannot set these options, fail closed.
  await tx.$executeRaw`SET LOCAL log_parameter_max_length = 0`;
  await tx.$executeRaw`SET LOCAL log_parameter_max_length_on_error = 0`;
  return fn(tx);
 },{timeout:15000});
}
function supported(password){
 return typeof password==='string'&&!password.includes('\0')&&new TextEncoder().encode(password).length<=72;
}
export default {
 async hash(password,cost){
  if(process.env.UCFR_DB_BCRYPT!=='true')return bcrypt.hash(password,cost);
  if(!supported(password)||cost!==12)throw Error('Unsupported password input');
  try{
    const result=await protectedQuery(tx=>tx.$queryRaw`SELECT public.crypt(${password},public.gen_salt('bf',12)) AS hash`);
    const hash=result[0]?.hash;
    if(!validHash.test(hash)||hash.slice(4,6)!=='12')throw Error('Invalid hash result');
    return hash;
  }catch{throw Error('Password hashing unavailable');}
 },
 async compare(password,hash){
  if(process.env.UCFR_DB_BCRYPT!=='true')return bcrypt.compare(password,hash);
  if(!supported(password)||typeof hash!=='string'||!validHash.test(hash))return false;
  // PostgreSQL's Blowfish implementation accepts 2a. Modern bcryptjs 2b/2y
  // use equivalent corrected semantics for these bounded, NUL-free inputs.
  const normalized='$2a$'+hash.slice(4);
  try{
    const result=await protectedQuery(tx=>tx.$queryRaw`SELECT public.crypt(${password},${normalized})=${normalized} AS ok`);
    return result[0]?.ok===true;
  }catch{throw Error('Password verification unavailable');}
 }
};
