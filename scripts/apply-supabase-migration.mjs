import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), '');
if (!env.SUPABASE_DB_URL) {
  console.error('Add SUPABASE_DB_URL to the ignored .env file, or run supabase/migrations/202610250001_private_wardrobe.sql in the Supabase SQL Editor.');
  process.exitCode = 1;
} else {
  let client;
  try {
    const connection = new URL(env.SUPABASE_DB_URL);
    // Keep certificate verification enabled regardless of URL query options.
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) connection.searchParams.delete(key);
    client = new pg.Client({ connectionString: connection.href, ssl: { rejectUnauthorized: true, ...(env.SUPABASE_DB_SSL_CA ? { ca: await readFile(env.SUPABASE_DB_SSL_CA, 'utf8') } : {}) }, connectionTimeoutMillis: 15000 });
    await client.connect();
    await client.query(await readFile(new URL('../supabase/migrations/202610250001_private_wardrobe.sql', import.meta.url), 'utf8'));
    const { rows } = await client.query("select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('wardrobe_garments','wardrobe_fits','wardrobe_settings')");
    const bucket = await client.query("select id, public from storage.buckets where id='wardrobe-private'");
    console.log(JSON.stringify({ tables: rows, bucket: bucket.rows }));
  } catch (error) {
    // Database errors can include connection credentials; never print the URL or raw error.
    console.error(`Migration failed (${error.code || 'connection error'}). No credentials were logged.`);
    process.exitCode = 1;
  } finally { if (client) await client.end().catch(() => {}); }
}
