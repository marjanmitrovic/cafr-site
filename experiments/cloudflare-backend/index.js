import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { makeWorker } from './worker.js';

export default makeWorker({
  checkDatabase: async (connectionString) => {
    const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(15000) } });
    const rows = await sql`SELECT 1 AS ok, to_regclass('public."User"') IS NOT NULL AS schema_ok`;
    return rows.length === 1 && Number(rows[0].ok) === 1 && rows[0].schema_ok === true;
  },
  benchmarkBcrypt: async () => {
    // Synthetic input only. Keep the production work factor of 12 unchanged.
    const hash = await bcrypt.hash('ucfr-lab-fixture-not-a-password', 12);
    return bcrypt.getRounds(hash) === 12;
  },
});
