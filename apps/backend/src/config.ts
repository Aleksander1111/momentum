import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '../../..');
if (existsSync(join(REPO, '.env'))) process.loadEnvFile(join(REPO, '.env'));

function tailnetAddress(): string {
  try {
    const ip = execFileSync('tailscale', ['ip', '-4'], { encoding: 'utf8', windowsHide: true }).trim().split('\n')[0];
    if (ip) return ip;
  } catch {
    // reported below
  }
  throw new Error('No tailnet address: the API listens only on the Tailscale interface and `tailscale ip -4` returned nothing');
}

export interface Config {
  /** Root of the workspaces: every git repository directly under it is a workspace */
  root: string;
  /** Where run checkouts live: <runs>\<workspace>\<run-id> */
  runs: string;
  /** This repository: the harness workspace */
  harness: string;
  harnessName: string;
  entityTypes: string;
  appDist: string;
  databaseUrl: string;
  host: () => string;
  port: number;
  procgov: string;
  limits: { maxMemory: string; cpuCores: number };
  /** How often the orchestrator looks at triggers */
  tickMs: number;
  /** The command stream of voice-commands on this machine: speech in, commands and questions out */
  commandStream: string;
  /** The audio sources whose items Momentum acts on: remote is the app's own devices streaming through it */
  voiceSources: string[];
}

const root = process.env.MOMENTUM_ROOT ?? 'C:\\Projects';

export const config: Config = {
  root,
  runs: process.env.MOMENTUM_RUNS ?? join(root, '.runs'),
  harness: REPO,
  harnessName: 'momentum',
  entityTypes: join(REPO, 'docs', 'entity-types.tsv'),
  // MOMENTUM_APP_DIST serves another build of the web app: the end-to-end suite keeps its own
  appDist: process.env.MOMENTUM_APP_DIST ?? join(REPO, 'apps', 'app', 'dist'),
  databaseUrl: process.env.DATABASE_URL ?? '',
  // MOMENTUM_HOST overrides the Tailscale interface for development on this machine only
  host: () => process.env.MOMENTUM_HOST ?? tailnetAddress(),
  port: Number(process.env.MOMENTUM_PORT ?? 7300),
  procgov: process.env.MOMENTUM_PROCGOV ?? 'procgov',
  limits: {
    maxMemory: process.env.MOMENTUM_RUN_MEMORY ?? '4G',
    cpuCores: Number(process.env.MOMENTUM_RUN_CPUS ?? 4),
  },
  tickMs: Number(process.env.MOMENTUM_TICK_MS ?? 30_000),
  commandStream: process.env.MOMENTUM_COMMAND_STREAM ?? 'http://127.0.0.1:8780',
  voiceSources: (process.env.MOMENTUM_VOICE_SOURCES ?? 'remote').split(',').map((s) => s.trim()).filter(Boolean),
};
