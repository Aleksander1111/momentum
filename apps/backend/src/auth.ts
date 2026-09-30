import type { Sql } from '@momentum/kb';
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const SESSION_DAYS = 30;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Single user: the password is set at install; sessions are tokens stored hashed */
export class Auth {
  constructor(private readonly sql: Sql) {}

  async setPassword(password: string): Promise<void> {
    const salt = randomBytes(16);
    const hash = await scrypt(password, salt, 64);
    const value = `${salt.toString('hex')}:${hash.toString('hex')}`;
    await this.sql`insert into harness.credential (id, password_hash) values (1, ${value})
      on conflict (id) do update set password_hash = excluded.password_hash`;
    await this.sql`delete from harness.session`;
  }

  async hasPassword(): Promise<boolean> {
    const [r] = await this.sql`select 1 from harness.credential where id = 1`;
    return !!r;
  }

  async verify(password: string): Promise<boolean> {
    const [r] = await this.sql<{ password_hash: string }[]>`select password_hash from harness.credential where id = 1`;
    if (!r) return false;
    const [salt, hash] = r.password_hash.split(':');
    const expected = Buffer.from(hash!, 'hex');
    const actual = await scrypt(password, Buffer.from(salt!, 'hex'), expected.length);
    return timingSafeEqual(expected, actual);
  }

  async createSession(): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    await this.sql`insert into harness.session ${this.sql({ token_hash: sha256(token), expires_at: expiresAt })}`;
    return { token, expiresAt };
  }

  async check(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    const [r] = await this.sql`select 1 from harness.session where token_hash = ${sha256(token)} and expires_at > now()`;
    return !!r;
  }

  async endSession(token: string): Promise<void> {
    await this.sql`delete from harness.session where token_hash = ${sha256(token)}`;
  }
}
