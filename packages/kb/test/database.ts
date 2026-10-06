import { join } from 'node:path';
import postgres from 'postgres';
import { connect, type Sql } from '../src/db.ts';

/**
 * A database of the test's own, on the server DATABASE_URL names, dropped when the test is done: tests never read or
 * write the harness's own data, and two test runs never share one
 */
export async function scratchDatabase(label: string): Promise<{ sql: Sql; url: string; drop: () => Promise<void> }> {
  if (!process.env.DATABASE_URL) process.loadEnvFile(join(import.meta.dirname, '../../../.env'));
  const url = new URL(process.env.DATABASE_URL!);
  const name = `momentum_${label}_${process.pid}`;
  const admin = postgres(new URL('/postgres', url).toString(), { onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${name} with (force)`);
  await admin.unsafe(`create database ${name}`);
  url.pathname = `/${name}`;
  const sql = connect(url.toString());
  return {
    sql,
    url: url.toString(),
    drop: async () => {
      await sql.end();
      await admin.unsafe(`drop database if exists ${name} with (force)`);
      await admin.end();
    },
  };
}
