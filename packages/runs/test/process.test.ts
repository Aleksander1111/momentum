import { describe, expect, it } from 'vitest';
import { runEnvironment } from '../src/process.ts';

describe('run environment', () => {
  const harness = {
    PATH: 'C:/Windows',
    SystemRoot: 'C:/Windows',
    ANTHROPIC_BASE_URL: 'http://127.0.0.1:9000',
    CLAUDE_CONFIG_DIR: 'C:/claude',
    CLAUDE_CODE_ENTRYPOINT: 'sdk-ts',
    DATABASE_URL: 'postgres://momentum:secret@127.0.0.1/momentum',
    MOMENTUM_ROOT: 'C:/Projects',
    Momentum_Host: '127.0.0.1',
    PGPASSWORD: 'secret',
    PGSSLMODE: 'disable',
    UNSET: undefined,
  };

  it('keeps what Claude Code and the commands it runs need', () => {
    expect(runEnvironment(harness)).toEqual({
      PATH: 'C:/Windows',
      SystemRoot: 'C:/Windows',
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:9000',
      CLAUDE_CONFIG_DIR: 'C:/claude',
      CLAUDE_CODE_ENTRYPOINT: 'sdk-ts',
    });
  });

  it('gives runs a database of their own only when one is set for them', () => {
    const env = runEnvironment({ ...harness, MOMENTUM_RUN_DATABASE_URL: 'postgres://runs@127.0.0.1/runs' });
    expect(env.DATABASE_URL).toBe('postgres://runs@127.0.0.1/runs');
    expect(Object.keys(env).filter((k) => /momentum|^pg/i.test(k))).toEqual([]);
  });
});
