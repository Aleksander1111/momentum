import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { cpSync, createWriteStream, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import postgres from 'postgres';
import type { AutomationName, GraphBuildState, Settings } from '@momentum/contract';
import { post } from '../observer/post.ts';
import { breakScenario } from './usage.ts';

export const REPO = resolve(import.meta.dirname, '../../../..');
/** The embedding model, downloaded once for every world rather than once per world */
export const MODELS = join(REPO, '.e2e-models');
const BACKEND = join(REPO, 'apps', 'backend');
const TSX = join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');
if (!process.env.DATABASE_URL) process.loadEnvFile(join(REPO, '.env'));

export type Project = 'todo-cli' | 'bookshelf-api' | 'handbook' | 'notes-api';

/**
 * The commits an example project's repository is made of, oldest first, each the paths it adds: a project with a
 * history rather than one initial commit. Paths left by every commit go in a last one. The others get one commit.
 */
export const HISTORY: Partial<Record<Project, { message: string; paths: string[] }[]>> = {
  'notes-api': [
    { message: 'Start the notes API: the domain, an in-memory store and the configuration', paths: ['package.json', 'package-lock.json', 'tsconfig.json', '.gitignore', 'README.md', 'src/config.ts', 'src/domain', 'src/store', 'src/lib/id.ts'] },
    { message: 'Route requests with a small router over node:http', paths: ['src/router.ts', 'src/lib/http.ts'] },
    { message: 'Serve notes, tags, search, health and a markdown export', paths: ['src/routes', 'src/server.ts', 'src/index.ts', 'src/search.ts', 'src/lib/markdown.ts'] },
    { message: 'Cover every route with tests', paths: ['test'] },
    { message: 'Document the API and the decisions behind it', paths: ['docs', 'CHANGELOG.md'] },
  ],
};
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
  execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function put(dir: string, file: string, text: string) {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), text);
}

function initRepo(dir: string, message: string, history: { message: string; paths: string[] }[] = []) {
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'e2e@momentum.test');
  git(dir, 'config', 'user.name', 'Momentum e2e');
  git(dir, 'config', 'core.autocrlf', 'false');
  for (const commit of history) {
    git(dir, 'add', '-A', '--', ...commit.paths);
    git(dir, 'commit', '-q', '-m', commit.message);
  }
  git(dir, 'add', '-A');
  // Whatever the history left: for a project without one, everything
  if (!history.length || git(dir, 'status', '--porcelain') !== '') git(dir, 'commit', '-q', '--allow-empty', '-m', message);
}

/** The harness workspace: this repository's automation definitions, every one approved */
function harnessRepo(dir: string) {
  cpSync(join(REPO, 'automations'), join(dir, 'automations'), { recursive: true });
  const defs = join(REPO, 'knowledge-graph', 'Harness', 'Automation');
  for (const f of readdirSync(defs)) {
    const text = readFileSync(join(defs, f), 'utf8').replace(/^verification: unverified$/m, 'verification: verified');
    put(dir, `knowledge-graph/Harness/Automation/${f}`, text);
  }
  // The entity types, the other configuration the settings lead to; the repository it belongs to is not in this copy
  cpSync(join(REPO, 'docs', 'entity-types.tsv'), join(dir, 'docs', 'entity-types.tsv'));
  const types = readFileSync(join(REPO, 'knowledge-graph', 'Code', 'ConfigSetting', 'entity-types.md'), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/^references:\n(?: {2}.*\n)+/m, 'references: []\n')
    .replace(/^verification: unverified$/m, 'verification: verified');
  put(dir, 'knowledge-graph/Code/ConfigSetting/entity-types.md', types);
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

/** Every process under `pid`, by the parent links Windows keeps */
function descendants(pid: number): { pid: number; name: string }[] {
  let rows: { ProcessId: number; ParentProcessId: number; Name: string }[] = [];
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress'], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    rows = JSON.parse(out);
  } catch {
    return [];
  }
  const found: { pid: number; name: string }[] = [];
  const queue = [pid];
  while (queue.length) {
    const parent = queue.shift()!;
    for (const r of rows) {
      if (r.ParentProcessId !== parent || r.ProcessId === parent || found.some((f) => f.pid === r.ProcessId)) continue;
      found.push({ pid: r.ProcessId, name: r.Name });
      queue.push(r.ProcessId);
    }
  }
  return found;
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Worlds whose folder Windows still held when their scenario ended: the next suite deletes them first */
export const STALE_MARK = '.e2e-delete-me';

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
      MOMENTUM_MODELS: MODELS,
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
      // With its installed dependencies, as the user's checkout has them; they are not in its repository
      cpSync(join(REPO, 'examples', p), this.path(p), { recursive: true });
      initRepo(this.path(p), 'Initial commit', HISTORY[p]);
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
    // Whatever the back-end started must end with it: a run process left behind is the harness's leak
    const tree = this.backend?.pid ? descendants(this.backend.pid) : [];
    this.stop();
    await this.sql?.end().catch(() => {});
    // Killed processes take a moment to go; the console host Windows gives each console goes with its console
    const own = tree.filter((p) => p.name.toLowerCase() !== 'conhost.exe');
    for (let waited = 0; waited < 10_000 && own.some((p) => alive(p.pid)); waited += 500) await new Promise((r) => setTimeout(r, 500));
    const leaked = own.filter((p) => alive(p.pid));
    for (const p of leaked) {
      try {
        execFileSync('taskkill', ['/pid', String(p.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
      } catch {
        // gone meanwhile
      }
    }
    if (leaked.length) throw new Error(`Processes outlived the back-end that started them: ${leaked.map((p) => `${p.name} (${p.pid})`).join(', ')}`);
    if (keep) return;
    // The run processes just killed let go of their checkouts a moment later: Windows refuses until then
    try {
      rmSync(this.dir, { recursive: true, force: true, maxRetries: 25, retryDelay: 100 });
    } catch (e) {
      if (!['EPERM', 'EBUSY', 'ENOTEMPTY'].includes((e as NodeJS.ErrnoException).code ?? '')) throw e;
      // No process of the world is left (checked above): Windows itself holds the folder for now
      writeFileSync(join(this.dir, STALE_MARK), '', { flag: 'w' });
      void post({ type: 'note', text: `${this.id}: Windows still holds ${this.dir}; the next run deletes it` }).catch(() => {});
    }
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
