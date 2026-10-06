import { migrateHarness } from '@momentum/kb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scratchDatabase } from '../../../packages/kb/test/database.ts';
import { Auth } from '../src/auth.ts';

let db: Awaited<ReturnType<typeof scratchDatabase>>;
let auth: Auth;
beforeAll(async () => {
  db = await scratchDatabase('auth');
  await migrateHarness(db.sql);
  auth = new Auth(db.sql);
});
afterAll(() => db?.drop());

describe('the password and sessions', () => {
  it('has no password until one is set, then accepts that one alone', async () => {
    expect(await auth.hasPassword()).toBe(false);
    expect(await auth.verify('anything')).toBe(false);
    await auth.setPassword('correct horse');
    expect(await auth.hasPassword()).toBe(true);
    expect(await auth.verify('correct horse')).toBe(true);
    expect(await auth.verify('correct horsE')).toBe(false);
    expect(await auth.verify('')).toBe(false);
  });

  it('keeps a session for thirty days, until it ends or expires', async () => {
    const { token, expiresAt } = await auth.createSession();
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(29.9 * 86_400_000);
    expect(await auth.check(token)).toBe(true);
    expect(await auth.check(undefined)).toBe(false);
    expect(await auth.check(`${token}x`)).toBe(false);
    await db.sql`update harness.session set expires_at = now() - interval '1 second'`;
    expect(await auth.check(token)).toBe(false);
    const next = await auth.createSession();
    await auth.endSession(next.token);
    expect(await auth.check(next.token)).toBe(false);
  });

  it('ends every session when the password changes', async () => {
    const { token } = await auth.createSession();
    await auth.setPassword('another one');
    expect(await auth.check(token)).toBe(false);
  });

  it('stores neither the password nor a session token', async () => {
    const { token } = await auth.createSession();
    const [credential] = await db.sql<{ password_hash: string }[]>`select password_hash from harness.credential`;
    expect(credential!.password_hash).not.toContain('another one');
    const sessions = await db.sql<{ token_hash: string }[]>`select token_hash from harness.session`;
    expect(sessions.map((s) => s.token_hash)).not.toContain(token);
    expect(await auth.check(token)).toBe(true);
  });
});
