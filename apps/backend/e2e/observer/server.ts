// The observer: one page wrapping the app and, beside it, the app's timeline, with the scenario list, the progress of
// each scenario's steps, the runs of the scenario under way and the account's 5-hour and weekly limits. The reporter and
// the scenarios post what happens; the page follows it over server-sent events. Where the last run got to is kept in a
// file, so a run stopped by a used-up limit, or by closing the runner, can be continued later.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { createWriteStream, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import postgres from 'postgres';
import { schemaOf } from '@momentum/kb';
import { FEATURES } from '../features.ts';
import { SCENARIOS } from '../scenarios.ts';

type Status = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

interface RunView {
  id: string;
  workspace: string;
  automation: string;
  status: string;
  title: string;
  model: string | null;
  created_at: string;
  ended_at: string | null;
  usage: number | null;
}

const state = {
  features: Object.keys(FEATURES).length,
  scenarios: SCENARIOS.map((s) => ({
    id: s.id,
    title: s.title,
    real: s.real,
    scripted: s.scripted ?? false,
    projects: s.projects,
    covers: s.covers,
    status: 'pending' as Status,
    selected: true,
    reason: null as string | null,
    steps: s.steps.map((title) => ({ title, status: 'pending' as Status })),
  })),
  current: null as null | { id: string; appUrl: string; workspaces: string[]; dir: string },
  usage: { fiveHour: null as number | null, week: null as number | null, fiveHourResets: null as string | null, weekResets: null as string | null },
  runs: [] as RunView[],
  messages: [] as { run: string; role: string; text: string; at: string }[],
  notes: [] as { at: string; text: string }[],
  finished: false,
  /** A run started from this page: which scenarios, whether it is still going, and whether it continues the last one */
  runner: { available: Boolean(process.env.E2E_RUNNER), running: false, ids: [] as string[], exit: null as number | null, continuing: false },
  /** How the scenarios pace their actions in the app: a pause, one action at a time, a delay before each */
  control: {
    paused: false,
    pauseBeforeStep: false,
    delayMs: Number(process.env.E2E_DELAY_MS ?? 1500),
    /** Actions let through one at a time while paused */
    next: 0,
    /** What the scenario waits to do while paused */
    waiting: null as string | null,
  },
};

const clients = new Set<ServerResponse>();
let pending: NodeJS.Timeout | null = null;
function publish() {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    const data = `data: ${JSON.stringify(state)}\n\n`;
    for (const c of clients) c.write(data);
  }, 200);
}

const scenario = (id: string) => state.scenarios.find((s) => s.id === id);
const note = (text: string) => {
  state.notes.push({ at: new Date().toISOString(), text });
  if (state.notes.length > 200) state.notes.shift();
};

type Event =
  | { type: 'begin'; ids: string[] }
  | { type: 'test'; id: string; status: Status; reason?: string }
  | { type: 'step'; id: string; title: string; status: Status }
  | { type: 'env'; id: string; appUrl: string; databaseUrl: string; workspaces: string[]; dir: string }
  | { type: 'env-end' }
  | { type: 'usage'; fiveHour: number | null; week: number | null; fiveHourResets: string | null; weekResets: string | null }
  | { type: 'note'; text: string }
  | { type: 'end' };

let sql: postgres.Sql | null = null;

function onEvent(e: Event) {
  switch (e.type) {
    case 'begin':
      state.finished = false;
      for (const s of state.scenarios) {
        // Continuing keeps the whole run in view: what finished before stays as it was
        if (!state.runner.continuing) s.selected = e.ids.includes(s.id);
        if (!e.ids.includes(s.id)) continue;
        s.status = 'pending';
        s.reason = null;
        for (const st of s.steps) st.status = 'pending';
      }
      break;
    case 'test': {
      const s = scenario(e.id);
      if (!s) break;
      s.status = e.status;
      s.reason = e.reason ?? null;
      if (e.status === 'running') for (const st of s.steps) st.status = 'pending';
      note(`${s.title}: ${e.status}${e.reason ? ` (${e.reason})` : ''}`);
      break;
    }
    case 'step': {
      const st = scenario(e.id)?.steps.find((x) => x.title === e.title);
      if (st) st.status = e.status;
      break;
    }
    case 'env':
      state.current = { id: e.id, appUrl: e.appUrl, workspaces: e.workspaces, dir: e.dir };
      state.runs = [];
      state.messages = [];
      void sql?.end();
      sql = postgres(e.databaseUrl, { max: 1, onnotice: () => {} });
      break;
    case 'env-end':
      void sql?.end();
      sql = null;
      break;
    case 'usage':
      state.usage = { fiveHour: e.fiveHour, week: e.week, fiveHourResets: e.fiveHourResets, weekResets: e.weekResets };
      break;
    case 'note':
      note(e.text);
      break;
    case 'end':
      state.finished = true;
      note(remaining().length ? `Suite finished; ${remaining().length} left to continue` : 'Suite finished');
      break;
  }
  if (e.type === 'begin' || e.type === 'test' || e.type === 'step' || e.type === 'end') saveProgress();
  publish();
}

/** The runs of the scenario under way, and what the newest open one said last */
async function poll() {
  const db = sql;
  const current = state.current;
  if (!db || !current) return;
  try {
    const runs: RunView[] = [];
    for (const ws of current.workspaces) {
      const t = db(`${schemaOf(ws)}.run`);
      const rows = await db<RunView[]>`select id, automation, status, title, model, created_at, ended_at, usage_five_hour as usage
        from ${t} order by created_at desc limit 30`.catch(() => [] as RunView[]);
      runs.push(...rows.map((r) => ({ ...r, workspace: ws })));
    }
    runs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const focus = runs.find((r) => r.status === 'running') ?? runs[0];
    let messages: typeof state.messages = [];
    if (focus) {
      const t = db(`${schemaOf(focus.workspace)}.run_message`);
      const rows = await db<{ role: string; text: string; at: string }[]>`select role, text, at from ${t}
        where run_id = ${focus.id} order by seq desc limit 12`.catch(() => []);
      messages = rows.reverse().map((m) => ({ run: focus.id, ...m }));
    }
    if (sql !== db) return;
    state.runs = runs;
    state.messages = messages;
    publish();
  } catch {
    // the scenario's database went away; the next env replaces it
  }
}
setInterval(() => void poll(), 2000);

const page = () => readFileSync(join(import.meta.dirname, 'index.html'), 'utf8');

function body(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((ok) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => ok(b));
  });
}

function json(res: ServerResponse, v: unknown) {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(v));
}

/**
 * A scenario asks before each action in the app and before each step. Paused, it is held until resumed or let through
 * once with Next; with "pause before each step" every step boundary pauses first.
 */
function gate(kind: 'action' | 'step', label: string): { go: boolean; delayMs: number } {
  const c = state.control;
  if (kind === 'step' && c.pauseBeforeStep && c.waiting !== label) c.paused = true;
  if (c.paused && c.next === 0) {
    if (c.waiting !== label) {
      c.waiting = label;
      publish();
    }
    return { go: false, delayMs: 0 };
  }
  if (c.paused) c.next--;
  c.waiting = null;
  publish();
  return { go: true, delayMs: kind === 'action' ? c.delayMs : 0 };
}

const BACKEND = join(import.meta.dirname, '..', '..');
const REPO = join(BACKEND, '..', '..');
const SCENARIO_FILES = join(import.meta.dirname, '..', 'scenarios');
let run: ChildProcess | null = null;

/** Where the last run got to, kept across runner restarts */
const PROGRESS = join(REPO, '.e2e-progress.json');
type Saved = Record<string, { selected: boolean; status: Status; reason: string | null; steps: Status[] }>;

function saveProgress(): void {
  const saved: Saved = Object.fromEntries(
    state.scenarios.map((s) => [s.id, { selected: s.selected, status: s.status, reason: s.reason, steps: s.steps.map((st) => st.status) }]),
  );
  try {
    writeFileSync(PROGRESS, JSON.stringify(saved, null, 2));
  } catch {
    // the next event writes it again
  }
}

function loadProgress(): void {
  if (!existsSync(PROGRESS)) return;
  try {
    const saved = JSON.parse(readFileSync(PROGRESS, 'utf8')) as Saved;
    for (const s of state.scenarios) {
      const x = saved[s.id];
      if (!x) continue;
      // A scenario under way when the last run ended did not finish
      const status = x.status === 'running' ? 'pending' : x.status;
      Object.assign(s, { selected: x.selected, status, reason: x.reason });
      s.steps.forEach((st, i) => (st.status = status === 'pending' || !x.steps[i] || x.steps[i] === 'running' ? 'pending' : x.steps[i]));
    }
  } catch {
    // unreadable: start from nothing
  }
}
loadProgress();

/** The scenarios of the last run that did not pass or fail: skipped once the limit ran out, or never reached */
function remaining(): string[] {
  return state.scenarios.filter((s) => s.selected && s.status !== 'passed' && s.status !== 'failed').map((s) => s.id);
}

/** The scenario files of the chosen ids; the coverage check goes along with any run */
function filesOf(ids: string[]): string[] {
  return readdirSync(SCENARIO_FILES).filter((f) => f.startsWith('00-') || ids.some((id) => f.replace(/^\d+-/, '') === `${id}.e2e.ts`));
}

/**
 * Runs the chosen scenarios in this window: the test run connects to the runner's browser and drives this page.
 * Continuing runs what the last run left, keeping what it finished.
 */
function startRun(ids: string[], continuing = false): void {
  if (run || ids.length === 0) return;
  // Outside the results folder, which each run empties when it starts
  const log = createWriteStream(join(REPO, '.e2e-runner.log'));
  // Playwright matches its arguments against the file paths, which have backslashes here: the file names alone
  run = spawn(process.execPath, [join(REPO, 'node_modules', 'playwright', 'cli.js'), 'test', ...filesOf(ids)], {
    cwd: BACKEND,
    env: { ...process.env, E2E_EXTERNAL_OBSERVER: '1' },
    windowsHide: true,
  });
  run.stdout?.pipe(log);
  run.stderr?.pipe(log);
  state.runner = { ...state.runner, running: true, ids, exit: null, continuing };
  note(`${continuing ? 'Run continued' : 'Run started'}: ${ids.length} ${ids.length === 1 ? 'scenario' : 'scenarios'}`);
  run.on('exit', (code) => {
    run = null;
    state.runner = { ...state.runner, running: false, exit: code, continuing: false };
    note(code ? `Run ended with failures (exit ${code}); log: .e2e-runner.log` : 'Run ended');
    publish();
  });
  publish();
}

function stopRun(): void {
  if (!run?.pid) return;
  try {
    execFileSync('taskkill', ['/pid', String(run.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
  } catch {
    // already gone
  }
  note('Run stopped');
}

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/run') {
    if (!state.runner.available) {
      res.statusCode = 409;
      return json(res, { error: 'Open the test runner to start runs from here: pnpm.cmd e2e:runner' });
    }
    const { ids } = JSON.parse(await body(req)) as { ids: string[] };
    startRun(ids.filter((id) => state.scenarios.some((s) => s.id === id)));
    return json(res, state.runner);
  }
  if (req.method === 'POST' && req.url === '/continue') {
    if (!state.runner.available) {
      res.statusCode = 409;
      return json(res, { error: 'Open the test runner to continue runs from here: pnpm.cmd e2e:runner' });
    }
    startRun(remaining(), true);
    return json(res, state.runner);
  }
  if (req.method === 'POST' && req.url === '/stop') {
    stopRun();
    return json(res, state.runner);
  }
  if (req.method === 'POST' && req.url === '/gate') {
    const { kind, label } = JSON.parse(await body(req)) as { kind: 'action' | 'step'; label: string };
    return json(res, gate(kind, label));
  }
  if (req.method === 'POST' && req.url === '/control') {
    const change = JSON.parse(await body(req)) as { paused?: boolean; pauseBeforeStep?: boolean; delayMs?: number; next?: boolean };
    const c = state.control;
    if (change.paused !== undefined) c.paused = change.paused;
    if (change.pauseBeforeStep !== undefined) c.pauseBeforeStep = change.pauseBeforeStep;
    if (change.delayMs !== undefined) c.delayMs = Math.max(0, Math.min(10_000, change.delayMs));
    if (change.next) c.next++;
    if (!c.paused) c.next = 0;
    publish();
    return json(res, c);
  }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    return res.end(page());
  }
  if (req.method === 'GET' && req.url === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(state)}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (req.method === 'POST' && req.url === '/event') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        onEvent(JSON.parse(body) as Event);
        res.statusCode = 204;
      } catch {
        res.statusCode = 400;
      }
      res.end();
    });
    return;
  }
  res.statusCode = 404;
  res.end();
});

const port = Number(process.env.E2E_OBSERVER_PORT ?? 7400);
server.listen(port, '127.0.0.1', () => console.log(`observer on http://127.0.0.1:${port}`));
