import type { SpawnedProcess, SpawnOptions } from '@anthropic-ai/claude-agent-sdk';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface ResourceLimits {
  /** Memory limit of the run's job object, e.g. "4G" */
  maxMemory: string;
  /** CPU cores the job may use */
  cpuCores: number;
}

export interface LimitedProcessOptions {
  limits: ResourceLimits;
  /** procgov executable; the run is refused when it is missing */
  procgov: string;
  onPid?: (pid: number) => void;
}

/** The harness's own settings and the database it keeps sessions, the password hash and every index in */
const HIDDEN = /^(DATABASE_URL|MOMENTUM_.*|PG[A-Z_]*)$/i;

/**
 * What a run's process sees of the harness's environment: all of it but the harness's settings and its database. A run
 * works with its permissions bypassed, on what the model reads; given the database's address it could sign itself in
 * or rewrite any workspace's index. MOMENTUM_RUN_DATABASE_URL, when set, reaches runs as their DATABASE_URL: a
 * database of their own, such as one for the tests they run.
 */
export function runEnvironment(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) if (value !== undefined && !HIDDEN.test(key)) out[key] = value;
  const own = Object.entries(env).find(([key]) => key.toUpperCase() === 'MOMENTUM_RUN_DATABASE_URL')?.[1];
  if (own) out.DATABASE_URL = own;
  return out;
}

/**
 * Starts the Claude Code process of a run and places it in a Windows job object with CPU and memory limits (procgov).
 * The commands the run starts stay in the job: without -r, procgov's job lets processes break away, and the commands
 * Claude Code runs were measured outside it. The memory limit is the whole job's: a command that would pass it is
 * refused, or the run ends, rather than the machine running short.
 */
export function spawnLimited(options: LimitedProcessOptions): (spawnOptions: SpawnOptions) => SpawnedProcess {
  return ({ command, args, cwd, env, signal }) => {
    const child = spawn(command, args, {
      cwd,
      env: runEnvironment(env),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    child.stderr?.resume();
    signal?.addEventListener('abort', () => void killTree(child.pid));
    if (child.pid) {
      options.onPid?.(child.pid);
      const pid = child.pid;
      exec(
        options.procgov,
        ['--nowait', '-q', '-r', '--maxjobmem', options.limits.maxMemory, '--cpu', String(options.limits.cpuCores), '--pid', String(pid)],
        { windowsHide: true },
      ).catch((e: Error) => {
        child.emit('error', new Error(`procgov could not limit run process ${pid}: ${e.message}`));
        void killTree(pid);
      });
    }
    return child as unknown as SpawnedProcess;
  };
}

/** Kills a run process and everything it started */
export async function killTree(pid: number | undefined): Promise<void> {
  if (!pid) return;
  await exec('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }).catch(() => {});
}

export async function procgovAvailable(procgov: string): Promise<boolean> {
  try {
    await exec(procgov, ['--help'], { windowsHide: true });
    return true;
  } catch (e) {
    return (e as { code?: unknown }).code !== 'ENOENT';
  }
}
