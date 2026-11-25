import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from './prisma.js';

const bcryptHash = /^\$2[aby]\$(0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$/;

// Neon roles cannot change statement logging. Keep the password out of SQL and
// bind parameters. The one-use key comes back as a result on the TLS connection,
// and expires with the same transaction that performs bcrypt.
async function databaseBcrypt(password, salt) {
  return prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw`
      SELECT set_config('ucfr.bcrypt_key', encode(public.gen_random_bytes(32), 'hex'), true) AS key`;
    const key = await crypto.subtle.importKey('raw', Buffer.from(row.key, 'hex'), 'AES-CBC', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(16));
    // bcrypt consumes at most 72 UTF-8 bytes. Two extra UTF-16 units keep any
    // character crossing that boundary intact while bounding the database input.
    const bytes = new TextEncoder().encode(password.slice(0, 74));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-CBC', iv}, key, bytes));
    const [result] = await tx.$queryRaw`
      SELECT public.crypt(convert_from(public.decrypt_iv(${ciphertext},
        decode(current_setting('ucfr.bcrypt_key'), 'hex'), ${iv}, 'aes-cbc/pad:pkcs'), 'UTF8'), ${salt}) AS hash`;
    return result.hash;
  }, {timeout: 15000});
}

// PostgreSQL text cannot represent NUL or unpaired UTF-16 surrogates. Preserve
// bcryptjs semantics for passwords that the original application accepted.
function databaseCanHash(password) {
  return typeof password === 'string' && !password.includes('\0') && password.isWellFormed();
}

export default {
  async hash(password, cost) {
    if (process.env.UCFR_DB_BCRYPT !== 'true' || !databaseCanHash(password)) return bcrypt.hash(password, cost);
    if (cost !== 12) throw new Error('Unsupported bcrypt cost');
    try {
      const hash = await databaseBcrypt(password, Prisma.sql`public.gen_salt('bf', 12)`);
      if (!bcryptHash.test(hash) || hash.slice(4, 6) !== '12') throw new Error();
      return hash;
    } catch {
      throw new Error('Password hashing unavailable');
    }
  },
  async compare(password, hash) {
    if (process.env.UCFR_DB_BCRYPT !== 'true' || !databaseCanHash(password)) return bcrypt.compare(password, hash);
    if (typeof hash !== 'string' || !bcryptHash.test(hash)) return false;
    // pgcrypto accepts 2a salts for the corrected Blowfish implementation.
    const normalized = '$2a$' + hash.slice(4);
    try {
      const computed = await databaseBcrypt(password, normalized);
      return bcryptHash.test(computed) && timingSafeEqual(Buffer.from(computed), Buffer.from(normalized));
    } catch {
      throw new Error('Password verification unavailable');
    }
  },
};
