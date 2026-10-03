import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { cpSync, createWriteStream, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import postgres from 'postgres';
import type { AutomationName, GraphBuildState, Settings } from '@momentum/contract';
import { breakScenario } from './usage.ts';

export const REPO = resolve(import.meta.dirname, '../../../..');
const BACKEND = join(REPO, 'apps', 'backend');
const TSX = join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');
if (!process.env.DATABASE_URL) process.loadEnvFile(join(REPO, '.env'));

export type Project = 'todo-cli' | 'bookshelf-api' | 'handbook';
export const PASSWORD = 'e2e-password';
/** Runs start on this model unless a scenario sets another; keeps the suite inside its share of the 5-hour limit */
export const MODEL = (process.env.E2E_MODEL ?? 'sonnet') as Settings['models']['single'];

export interface EnvOptions {
  /** Projects enabled before the scenario starts; the rest stay disabled for the scenario to enable */
  enabled?: (Project | 'momentum')[];
  /** Triggers approved before the scenario starts; an approved schedule fires at the first tick */
  triggers?: AutomationName[];
  /** The graph build of the enabled projects; stopped unless the scenario builds the graph */
  graphBuild?: GraphBuildState;
  settings?: Partial<Omit<Settings, 'projects'>>;
  /** A fake command stream for voice; the scenario says what is heard */
  voice?: boolean;
}

export const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();

function put(dir: string, file: string, text: string) {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), text);
}

function initRepo(dir: string, message: string) {
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'e2e@momentum.test');
  git(dir, 'config', 'user.name', 'Momentum e2e');
  git(dir, 'config', 'core.autocrlf', 'false');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '--allow-empty', '-m', message);
}

/** The harness workspace: this repository's automation definitions, every one approved */
function harnessRepo(dir: string) {
  cpSync(join(REPO, 'automations'), join(dir, 'automations'), { recursive: true });
  const defs = join(REPO, 'knowledge-graph', 'Harness', 'Automation');
  for (const f of readdirSync(defs)) {
    const text = readFileSync(join(defs, f), 'utf8').replace(/^verification: unverified$/m, 'verification: verified');
    put(dir, `knowledge-graph/Harness/Automation/${f}`, text);
  }
  initRepo(dir, 'Add the automation definitions');
}

function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    });
    s.on('error', fail);
  });
}

function killTree(p: ChildProcess | null) {
  if (!p?.pid || p.exitCode !== null) return;
  try {
    execFileSync('taskkill', ['/pid', String(p.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
  } catch {
    // already gone
  }
}

function tsx(script: string, env: NodeJS.ProcessEnv, args: string[] = [], log?: string): ChildProcess {
  const child = spawn(process.execPath, [TSX, script, ...args], { cwd: BACKEND, env, windowsHide: true });
  if (log) {
    const out = createWriteStream(log, { flags: 'a' });
    child.stdout?.pipe(out);
    child.stderr?.pipe(out);
  }
  return child;
}

const exited = (p: ChildProcess) => new Promise<number>((ok) => p.on('exit', (code) => ok(code ?? 1)));

/**
 * One scenario's world: a workspaces root with fresh copies of the example projects and the harness definitions, its
 * own database, and its own back-end serving the web app on a free port. Nothing is shared with another scenario or
 * with the real settings.
 */
export class Env {
  readonly dir: string;
  readonly root: string;
  readonly databaseUrl: string;
  backend: ChildProcess | null = null;
  port = 0;
  token = '';
  sql!: postgres.Sql;
  voicePort = 0;
  /** Where the runs' Claude Code sends its requests; unset for real runs */
  apiBase: string | null = null;

  constructor(
    readonly id: string,
    readonly projects: Project[],
  ) {
    this.dir = mkdtempSync(join(tmpdir(), `momentum-e2e-${id}-`));
    this.root = join(this.dir, 'root');
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/momentum_e2e_${id.replace(/[^a-z0-9]/g, '_')}`;
    this.databaseUrl = url.toString();
  }

  get url() {
    return `http://127.0.0.1:${this.port}`;
  }

  path(project: string) {
    return join(this.root, project);
  }

  get log() {
    return join(this.dir, 'backend.log');
  }

  private envVars(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      DATABASE_URL: this.databaseUrl,
      MOMENTUM_ROOT: this.root,
      MOMENTUM_RUNS: join(this.dir, 'runs'),
      MOMENTUM_HOST: '127.0.0.1',
      MOMENTUM_PORT: String(this.port),
      MOMENTUM_TICK_MS: process.env.E2E_TICK_MS ?? '3000',
      MOMENTUM_COMMAND_STREAM: `http://127.0.0.1:${this.voicePort || 9}`,
      LOG_LEVEL: 'warn',
      ...(this.apiBase ? { ANTHROPIC_BASE_URL: this.apiBase } : {}),
    };
  }

  async setUp(opts: EnvOptions, voicePort = 0, apiBase: string | null = null): Promise<void> {
    this.voicePort = voicePort;
    this.apiBase = apiBase;
    mkdirSync(this.root);
    for (const p of this.projects) {
      cpSync(join(REPO, 'examples', p), this.path(p), { recursive: true });
      initRepo(this.path(p), 'Initial commit');
    }
    mkdirSync(join(this.root, 'momentum'));
    harnessRepo(join(this.root, 'momentum'));

    const admin = postgres(new URL('/postgres', this.databaseUrl).toString(), { onnotice: () => {} });
    const name = new URL(this.databaseUrl).pathname.slice(1);
    await admin.unsafe(`drop database if exists ${name} with (force)`);
    await admin.unsafe(`create database ${name}`);
    await admin.end();
    this.sql = postgres(this.databaseUrl, { onnotice: () => {}, max: 2 });

    this.port = await freePort();
    const settings = { models: { mode: 'single', single: MODEL }, ...opts.settings };
    const prep = tsx(
      'e2e/support/prepare.ts',
      this.envVars(),
      [
        JSON.stringify({
          password: PASSWORD,
          enabled: opts.enabled ?? [],
          triggers: opts.triggers ?? [],
          graphBuild: opts.graphBuild ?? 'stopped',
          settings,
        }),
      ],
      this.log,
    );
    if ((await exited(prep)) !== 0) throw new Error(`Preparing the scenario failed; see ${this.log}`);
    await this.start();
  }

  /** Starts the back-end and waits until it answers */
  async start(): Promise<void> {
    const backend = tsx('src/server.ts', this.envVars(), [], this.log);
    this.backend = backend;
    // Only the back-end in use, exiting when nobody stopped it
    backend.on('exit', (code) => {
      if (this.backend === backend) breakScenario(`The back-end exited with code ${code}; see ${this.log}`);
    });
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (this.backend.exitCode !== null) throw new Error(`The back-end exited; see ${this.log}`);
      const ok = await fetch(`${this.url}/openapi.json`).then((r) => r.ok).catch(() => false);
      if (ok) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    const r = await fetch(`${this.url}/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: PASSWORD }) });
    if (!r.ok) throw new Error(`Signing in to the back-end failed: ${r.status}`);
    this.token = ((await r.json()) as { token: string }).token;
  }

  /** Stops the back-end and every run process under it */
  stop(): void {
    const backend = this.backend;
    this.backend = null;
    killTree(backend);
  }

  async tearDown(keep: boolean): Promise<void> {
    this.stop();
    await this.sql?.end().catch(() => {});
    if (keep) return;
    rmSync(this.dir, { recursive: true, force: true, maxRetries: 5 });
    const admin = postgres(new URL('/postgres', this.databaseUrl).toString(), { onnotice: () => {} });
    await admin.unsafe(`drop database if exists ${new URL(this.databaseUrl).pathname.slice(1)} with (force)`).catch(() => {});
    await admin.end();
  }

  /** A commit the user makes on a project's main line */
  commit(project: string, files: Record<string, string | null>, message: string): string {
    const dir = this.path(project);
    for (const [f, text] of Object.entries(files)) {
      if (text === null) rmSync(join(dir, f), { force: true });
      else put(dir, f, text);
    }
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', message);
    return git(dir, 'rev-parse', 'HEAD');
  }

  git(project: string, ...args: string[]): string {
    return git(this.path(project), ...args);
  }

  head(project: string): string {
    return git(this.path(project), 'rev-parse', 'main');
  }

  show(project: string, file: string): string | null {
    try {
      return git(this.path(project), 'show', `main:${file}`);
    } catch {
      return null;
    }
  }

  files(project: string, under = 'knowledge-graph'): string[] {
    const out = git(this.path(project), 'ls-tree', '-r', '--name-only', 'main', '--', under);
    return out ? out.split('\n') : [];
  }
}
