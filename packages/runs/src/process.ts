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

/**
 * Starts the Claude Code process of a run and places it in a Windows job object with CPU and memory limits (procgov).
 * Children the process starts afterwards inherit the job.
 */
export function spawnLimited(options: LimitedProcessOptions): (spawnOptions: SpawnOptions) => SpawnedProcess {
  return ({ command, args, cwd, env, signal }) => {
    const child = spawn(command, args, {
      cwd,
      env: env as NodeJS.ProcessEnv,
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
        ['--nowait', '-q', '--maxjobmem', options.limits.maxMemory, '--cpu', String(options.limits.cpuCores), '--pid', String(pid)],
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
