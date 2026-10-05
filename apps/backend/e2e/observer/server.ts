// The observer: one page wrapping the app and, beside it, the app's timeline, with the scenario list, the progress of
// each scenario's steps, the screen of each scenario under way, the suite log and the account's limits. The reporter and
// the scenarios post what happens; the page follows it over server-sent events. It is the one place tests run: runs
// are asked for here or with `pnpm e2e`, wait their turn, and each shows who asked for it. Where the last run got to is kept in a
// file, so a run stopped by a used-up limit, or by closing the runner, can be continued later.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, watch as watchFile, writeFileSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FEATURES } from '../features.ts';
import { splitRun, type Answer, type Tokens } from './usage-fit.ts';
import { SCENARIOS, type Scenario } from '../scenarios.ts';

// The runner has no console: what would end it goes to its log, with the time, and the run under way goes on
const CRASH_LOG = join(tmpdir(), 'momentum-tests.log');
for (const event of ['uncaughtException', 'unhandledRejection'] as const) {
  process.on(event, (e: unknown) => {
    try {
      appendFileSync(CRASH_LOG, `${new Date().toISOString()} runner error (${event}): ${(e as Error)?.stack ?? String(e)}\n`);
    } catch {
      // nowhere to write it
    }
  });
}

/** Where a scenario runs in the suite: the number its file starts with */
const runOrder = (files: string[], id: string) => {
  const file = files.find((f) => f.replace(/^\d+-/, '') === `${id}.e2e.ts`);
  return file ? Number(file.split('-')[0]) : Infinity;
};

/** The scenarios as the list shows them, in the order they run: Playwright takes the files by name, numbered */
function views(list: Scenario[]) {
  const files = readdirSync(join(import.meta.dirname, '..', 'scenarios'));
  return [...list]
    .sort((a, b) => runOrder(files, a.id) - runOrder(files, b.id))
    .map((s) => ({
      id: s.id,
      title: s.title,
      real: s.real,
      scripted: s.scripted ?? false,
      projects: s.projects,
      covers: s.covers,
      status: 'pending' as Status,
      selected: true,
      reason: null as string | null,
      /** Whether its last result came from the real model or the scripted one */
      model: null as 'real' | 'scripted' | null,
      /** Its last finished result: kept through runs started, stopped or continued until it finishes again */
      last: null as Last | null,
      steps: s.steps.map((title, i) => ({ title, status: 'pending' as Status, checks: s.checks[i] ?? [] })),
      /** When it started, while it runs: what the estimate counts down from */
      startedAt: null as number | null,
    }));
}

type Status = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/** The features by the area features.ts files them under, in its order: the areas are its comments */
function featureGroups(features: Record<string, string>): { area: string; features: { id: string; text: string }[] }[] {
  const groups: { area: string; features: { id: string; text: string }[] }[] = [];
  const source = readFileSync(join(import.meta.dirname, '..', 'features.ts'), 'utf8');
  for (const line of source.split('\n')) {
    const area = /^\s*\/\/\s*(.+?)\s*$/.exec(line);
    if (area) groups.push({ area: area[1]!, features: [] });
    const f = /^\s*'([^']+)':/.exec(line);
    if (f && features[f[1]!] !== undefined) {
      if (!groups.length) groups.push({ area: 'Other', features: [] });
      groups.at(-1)!.features.push({ id: f[1]!, text: features[f[1]!]! });
    }
  }
  // One the file lays out some other way still shows
  const listed = new Set(groups.flatMap((g) => g.features.map((f) => f.id)));
  const rest = Object.keys(features).filter((id) => !listed.has(id));
  if (rest.length) groups.push({ area: 'Other', features: rest.map((id) => ({ id, text: features[id]! })) });
  return groups.filter((g) => g.features.length);
}

const state = {
  features: Object.keys(FEATURES).length,
  featureGroups: featureGroups(FEATURES),
  scenarios: views(SCENARIOS),
  /** The scenario the page shows, one of those under way; scenarios run side by side, each in its own world */
  current: null as null | { id: string; appUrl: string; workspaces: string[]; dir: string },
  /** Every scenario under way */
  active: [] as string[],
  usage: { fiveHour: null as number | null, week: null as number | null, fiveHourResets: null as string | null, weekResets: null as string | null },
  notes: [] as { at: string; text: string }[],
  finished: false,
  /** The run under way: which scenarios, when chosen here, and whether it continues the last one */
  runner: { available: Boolean(process.env.E2E_RUNNER), running: false, live: false, workers: 1, ids: [] as string[], exit: null as number | null, continuing: false },
  /** How long each scenario took lately, live and scripted, in ms: the page estimates what is left of a run from them */
  durations: {} as Durations,
  /** What each scenario's runs used on the real API, its last real run, and the 5-hour limit's rise per dollar of it */
  spent: { scenarios: {}, share: {} } as Spent,
  /** The runs asked for: the one under way first, then those waiting, then the last ones done */
  requests: [] as Omit<RunRequest, 'env'>[],
  /** How the scenarios pace their actions in the app: a pause, one action at a time, a delay before each */
  control: {
    paused: false,
    pauseBeforeStep: false,
    // Full speed unless a person watching slows it down here
    delayMs: Number(process.env.E2E_DELAY_MS ?? 0),
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
  | { type: 'env'; id: string; appUrl: string; databaseUrl: string; workspaces: string[]; dir: string; token: string }
  | { type: 'env-end'; id?: string }
  | { type: 'usage'; fiveHour: number | null; week: number | null; fiveHourResets: string | null; weekResets: string | null }
  | { type: 'note'; text: string }
  | { type: 'spent'; id: string; requests: number; usd: number; tokens: Tokens }
  | ({ type: 'answer' } & Answer)
  | { type: 'end' };

/** The worlds of the scenarios under way, by scenario */
const envs = new Map<string, Extract<Event, { type: 'env' }>>();
/** The last frame of each scenario's window, as its run sees it: the page shows the one watched */
const frames = new Map<string, Buffer>();
/** Pages watching a scenario's window: each new frame goes to them as it comes, a motion JPEG stream */
const streams = new Map<string, Set<ServerResponse>>();
const BOUNDARY = 'momentum-frame';

function sendFrame(res: ServerResponse, frame: Buffer): void {
  res.write(`--${BOUNDARY}\r\ncontent-type: image/jpeg\r\ncontent-length: ${frame.length}\r\n\r\n`);
  res.write(frame);
  res.write('\r\n');
}

/** The scenario's window is gone: its streams end on the last frame they showed */
function endStreams(id: string): void {
  for (const res of streams.get(id) ?? []) res.end();
  streams.delete(id);
}

/** Shows a scenario under way on the page, or none */
function watch(id: string | null): void {
  const e = id ? envs.get(id) : undefined;
  if (state.current?.id === e?.id) return;
  state.current = e ? { id: e.id, appUrl: e.appUrl, workspaces: e.workspaces, dir: e.dir } : null;
}

function onEvent(e: Event) {
  switch (e.type) {
    case 'begin':
      state.finished = false;
      for (const s of state.scenarios) {
        // Continuing keeps the whole run in view: what finished before stays as it was
        // A run of no scenario, such as the coverage check alone, leaves the choice as it was
        if (!state.runner.continuing && e.ids.length) s.selected = e.ids.includes(s.id);
        if (!e.ids.includes(s.id)) continue;
        s.status = 'pending';
        s.reason = null;
        for (const st of s.steps) st.status = 'pending';
      }
      break;
    case 'test': {
      const s = scenario(e.id);
      if (!s) break;
      // A scenario that ran to its end, passed or failed, says how long it takes
      if ((e.status === 'passed' || e.status === 'failed') && s.startedAt) recordDuration(s, Date.now() - s.startedAt);
      s.startedAt = e.status === 'running' ? Date.now() : null;
      s.status = e.status;
      s.reason = e.reason ?? null;
      s.model = e.status === 'running' || e.status === 'pending' ? null : s.real || state.runner.live ? 'real' : 'scripted';
      // Every step as this run left it: the failed one, those before it passed, those after it never ran
      if (e.status === 'passed' || e.status === 'failed') s.last = { status: e.status, model: s.model!, at: new Date().toISOString(), steps: s.steps.map((st) => st.status) };
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
      envs.set(e.id, e);
      state.active = [...envs.keys()];
      // The page keeps showing the scenario it shows while that one runs
      if (!state.current) watch(e.id);
      break;
    case 'env-end': {
      const id = e.id ?? state.current?.id;
      if (id) envs.delete(id);
      if (id) frames.delete(id);
      if (id) endStreams(id);
      state.active = [...envs.keys()];
      if (state.current?.id === id) watch(state.active.at(-1) ?? null);
      break;
    }
    case 'usage':
      state.usage = { fiveHour: e.fiveHour, week: e.week, fiveHourResets: e.fiveHourResets, weekResets: e.weekResets };
      break;
    case 'spent':
      state.spent.scenarios[e.id] = { usd: e.usd, requests: e.requests, tokens: e.tokens };
      saveSpent();
      break;
    case 'answer':
      runAnswers.push(e);
      break;
    case 'note':
      note(e.text);
      break;
    case 'end':
      settleUsage();
      state.finished = true;
      note(remaining().length ? `Suite finished; ${remaining().length} left to continue` : 'Suite finished');
      break;
  }
  if (e.type === 'begin' || e.type === 'test' || e.type === 'step' || e.type === 'end') saveProgress();
  publish();
}


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
/** Each request's output, by its id: a detached request is followed here */
const RUN_LOGS = join(REPO, '.e2e-runs');

/** How long each scenario takes, live and scripted; kept across runner restarts */
type Durations = Record<string, { live?: number; scripted?: number }>;
const DURATIONS = join(REPO, '.e2e-durations.json');

/** What scenarios used of the account, kept across runner restarts */
type Spent = {
  /** The tokens of each scenario's last run with real models, by model group and kind */
  scenarios: Record<string, { usd: number; requests: number; tokens: Tokens }>;
  /** Each scenario's share of the 5-hour limit in its last run with real models, percent, and that run's whole rise */
  share: Record<string, { pct: number; runRise: number; at: string }>;
};
const SPENT = join(REPO, '.e2e-usage.json');
try {
  if (existsSync(SPENT)) {
    const saved = JSON.parse(readFileSync(SPENT, 'utf8')) as Spent;
    for (const [id, x] of Object.entries(saved.scenarios ?? {})) if (x.tokens && typeof x.tokens === 'object') state.spent.scenarios[id] = x;
    // Only shares measured within their run: what an earlier way of estimating left is measured again
    for (const [id, x] of Object.entries(saved.share ?? {})) if (x && typeof x === 'object' && 'runRise' in x) state.spent.share[id] = x;
  }
} catch {
  // unreadable: measured again
}
function saveSpent(): void {
  try {
    writeFileSync(SPENT, JSON.stringify(state.spent, null, 2));
  } catch {
    // written again with the next one
  }
}

/** The answers of the run under way, as the stand-ins passed them on */
let runAnswers: Answer[] = [];

/** The run is over: each of its scenarios gets its share of what the run took, kept until it runs again */
function settleUsage(): void {
  const answers = runAnswers;
  runAnswers = [];
  if (!answers.length) return;
  const { rise, share } = splitRun(answers);
  const at = new Date().toISOString();
  for (const [id, pct] of Object.entries(share)) state.spent.share[id] = { pct, runRise: rise, at };
  saveSpent();
  note(`The run took ${rise}% of the 5-hour limit, shared among ${Object.keys(share).length} scenarios by their tokens`);
}
try {
  if (existsSync(DURATIONS)) state.durations = JSON.parse(readFileSync(DURATIONS, 'utf8')) as Durations;
} catch {
  // unreadable: estimates start from the defaults
}

/** A scenario's real runs, and every scenario of a live run, reach the real model: those take their live time */
function recordDuration(s: { id: string; real: boolean }, ms: number): void {
  const mode = s.real || state.runner.live ? 'live' : 'scripted';
  const last = state.durations[s.id]?.[mode];
  // The newest run counts most, the ones before still a little: one slow run does not throw the estimate off
  state.durations[s.id] = { ...state.durations[s.id], [mode]: Math.round(last ? last * 0.4 + ms * 0.6 : ms) };
  try {
    writeFileSync(DURATIONS, JSON.stringify(state.durations, null, 2));
  } catch {
    // written again with the next one
  }
}
type Last = { status: 'passed' | 'failed'; model: 'real' | 'scripted'; at: string; steps: Status[] };
type Saved = Record<string, { selected: boolean; status: Status; reason: string | null; model?: 'real' | 'scripted' | null; last?: Last | null; steps: Status[] }>;

function saveProgress(): void {
  const saved: Saved = Object.fromEntries(
    state.scenarios.map((s) => [s.id, { selected: s.selected, status: s.status, reason: s.reason, model: s.model, last: s.last, steps: s.steps.map((st) => st.status) }]),
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
      // Results kept from before results said which model they came from: today's runs were all real
      const model = status === 'pending' ? null : (x.model ?? 'real');
      const last = x.last ?? (status === 'passed' || status === 'failed' ? { status, model: model!, at: new Date().toISOString(), steps: x.steps } : null);
      // Kept before steps were kept with it: a pass passed every step, a failure left them as saved
      if (last && !last.steps) last.steps = last.status === 'passed' ? s.steps.map(() => 'passed' as Status) : x.steps;
      Object.assign(s, { selected: x.selected, status, reason: x.reason, model, last });
      s.steps.forEach((st, i) => (st.status = status === 'pending' || !x.steps[i] || x.steps[i] === 'running' ? 'pending' : x.steps[i]));
    }
  } catch {
    // unreadable: start from nothing
  }
}
loadProgress();

/**
 * The scenario list follows the files while the runner stays open: a scenario added, changed or removed shows as it
 * is now, never as it was when the runner started. A result stays with a scenario whose steps are unchanged.
 */
async function reloadScenarios(): Promise<void> {
  if (state.runner.running) return void (reloadAfterRun = true);
  const root = join(import.meta.dirname, '..');
  const v = Date.now();
  const fresh = ((await import(`${pathToFileURL(join(root, 'scenarios.ts')).href}?v=${v}`)) as { SCENARIOS: Scenario[] }).SCENARIOS;
  const features = ((await import(`${pathToFileURL(join(root, 'features.ts')).href}?v=${v}`)) as { FEATURES: Record<string, string> }).FEATURES;
  const before = new Map(state.scenarios.map((s) => [s.id, s]));
  state.scenarios = views(fresh).map((s) => {
    const old = before.get(s.id);
    const same = old && old.steps.map((st) => st.title).join('\n') === s.steps.map((st) => st.title).join('\n');
    return same ? { ...s, status: old.status, selected: old.selected, reason: old.reason, model: old.model, last: old.last, steps: old.steps } : { ...s, last: old?.last ?? null };
  });
  state.features = Object.keys(features).length;
  state.featureGroups = featureGroups(features);
  saveProgress();
  publish();
}
let reloadAfterRun = false;
let reloading: NodeJS.Timeout | null = null;
const scheduleReload = () => {
  if (reloading) clearTimeout(reloading);
  reloading = setTimeout(() => void reloadScenarios().catch((e) => console.error('reload scenarios:', e)), 500);
};
for (const target of [join(import.meta.dirname, '..', 'scenarios.ts'), join(import.meta.dirname, '..', 'features.ts'), join(import.meta.dirname, '..', 'scenarios')]) {
  try {
    watchFile(target, scheduleReload);
  } catch {
    // a missing path is not watched
  }
}

/** The scenarios of the last run that did not pass or fail: skipped once the limit ran out, or never reached */
function remaining(): string[] {
  return state.scenarios.filter((s) => s.selected && s.status !== 'passed' && s.status !== 'failed').map((s) => s.id);
}

/** The scenario files of the chosen ids; the coverage check goes along with any run */
function filesOf(ids: string[]): string[] {
  return readdirSync(SCENARIO_FILES).filter((f) => f.startsWith('00-') || ids.some((id) => f.replace(/^\d+-/, '') === `${id}.e2e.ts`));
}

/** A run asked for, from this page or with `pnpm e2e`: who asked, what it runs, and how it went */
interface RunRequest {
  id: string;
  by: { label: string; session: string | null };
  /** What Playwright is given: the scenario files chosen here, or the arguments of `pnpm e2e` */
  args: string[];
  /** The E2E_ settings of `pnpm e2e` for this run */
  env: Record<string, string>;
  /** The scenarios chosen here; null for `pnpm e2e`, whose scenarios Playwright picks */
  ids: string[] | null;
  continuing: boolean;
  at: string;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'stopped' | 'cancelled';
  exit: number | null;
}
const queue: RunRequest[] = [];
/** Where a `pnpm e2e` request waits for its run's output */
const outputs = new Map<string, ServerResponse>();
let current: RunRequest | null = null;
const done: RunRequest[] = [];
// Request numbers go on from the last run log, so a runner restart never overwrites one
let seq = (() => {
  try {
    return Math.max(0, ...readdirSync(RUN_LOGS).map((f) => Number.parseInt(f, 10)).filter(Number.isFinite));
  } catch {
    return 0;
  }
})();

const describe = (r: RunRequest) => r.ids ? `${r.ids.length} ${r.ids.length === 1 ? 'scenario' : 'scenarios'}` : r.args.join(' ') || 'every scenario';

/** The requests shown on the page: the one running, those waiting, and the last ones done */
function showRequests(): void {
  state.requests = [...(current ? [current] : []), ...queue, ...done].map(({ env: _env, ...r }) => r);
  state.runner = {
    ...state.runner,
    running: Boolean(current),
    // Whether the run under way reaches the real model everywhere, whatever the page's checkbox says
    live: current?.env.E2E_LIVE === '1',
    workers: Number(current?.env.E2E_WORKERS ?? 6),
    ids: current?.ids ?? [],
    continuing: current?.continuing ?? false,
  };
  publish();
}

function request(
  by: RunRequest['by'],
  args: string[],
  env: Record<string, string>,
  ids: string[] | null,
  continuing = false,
  out?: ServerResponse,
): RunRequest {
  const r: RunRequest = { id: String(++seq), by, args, env, ids, continuing, at: new Date().toISOString(), status: 'queued', exit: null };
  queue.push(r);
  if (out) {
    outputs.set(r.id, out);
    if (current) out.write('Waiting for the run under way to finish…\n');
  }
  note(`${by.label} asked for a run: ${describe(r)}${current ? ' (waits for the run under way)' : ''}`);
  runNext();
  showRequests();
  return r;
}

function finish(r: RunRequest, status: RunRequest['status'], exit: number | null): void {
  Object.assign(r, { status, exit });
  done.unshift(r);
  done.splice(20);
  const out = outputs.get(r.id);
  outputs.delete(r.id);
  if (out && !out.writableEnded) out.end(`\n\u0000exit ${exit ?? 1}\n`);
}

/**
 * Runs the next request: the test run opens this page in a Firefox of its own, out of sight, and drives it there; the
 * page is watched in any browser. Continuing runs what the last run left, keeping what it finished.
 */
function runNext(): void {
  if (run) return;
  const r = queue.shift();
  if (!r) return showRequests();
  current = r;
  r.status = 'running';
  spawnRun(r);
}

function spawnRun(r: RunRequest): void {
  // Outside the results folder, which each run empties when it starts: the last run's, and each request's own
  const log = createWriteStream(join(REPO, '.e2e-runner.log'));
  mkdirSync(RUN_LOGS, { recursive: true });
  const own = createWriteStream(join(RUN_LOGS, `${r.id}.log`));
  run = spawn(process.execPath, [join(REPO, 'node_modules', 'playwright', 'cli.js'), 'test', ...r.args], {
    cwd: BACKEND,
    // E2E_FROM_RUNNER: Playwright started any other way refuses to run
    env: { ...process.env, ...r.env, E2E_EXTERNAL_OBSERVER: '1', E2E_FROM_RUNNER: '1' },
    windowsHide: true,
  });
  const out = outputs.get(r.id);
  for (const stream of [run.stdout, run.stderr]) {
    stream?.pipe(log, { end: false });
    stream?.pipe(own, { end: false });
    if (out) stream?.on('data', (c: Buffer) => out.writableEnded || out.write(c));
  }
  // Only this run's answers count to it
  runAnswers = [];
  note(`${r.continuing ? 'Run continued' : 'Run started'} for ${r.by.label}: ${describe(r)}`);
  run.on('exit', (code) => {
    run = null;
    log.end();
    own.end(`\nexit ${code ?? 1}\n`);
    ended(r, code);
  });
  showRequests();
}

function ended(r: RunRequest, code: number | null): void {
  current = null;
  const stopped = r.status === 'stopped';
  // A scenario the run did not finish, stopped or crashed, is not running any more
  for (const s of state.scenarios.filter((x) => x.status === 'running')) {
    s.status = 'pending';
    s.reason = stopped ? 'Stopped before it finished' : 'The run ended before it finished';
    for (const st of s.steps) if (st.status === 'running') st.status = 'pending';
  }
  envs.clear();
  frames.clear();
  for (const id of [...streams.keys()]) endStreams(id);
  state.active = [];
  watch(null);
  saveProgress();
  finish(r, stopped ? 'stopped' : code ? 'failed' : 'passed', code);
  state.runner = { ...state.runner, exit: code };
  note(stopped ? 'Run stopped' : code ? `Run ended with failures (exit ${code}); log: .e2e-runner.log` : 'Run ended');
  // Scenario files changed during the run: the list shows them now
  if (reloadAfterRun) {
    reloadAfterRun = false;
    scheduleReload();
  }
  runNext();
}

function stopRun(): void {
  if (!current) return;
  current.status = 'stopped';
  if (!run?.pid) return;
  try {
    execFileSync('taskkill', ['/pid', String(run.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
  } catch {
    // already gone
  }
}

function cancel(id: string): void {
  const i = queue.findIndex((r) => r.id === id);
  if (i >= 0) {
    const r = queue.splice(i, 1)[0]!;
    finish(r, 'cancelled', null);
    note(`Request of ${r.by.label} cancelled: ${describe(r)}`);
    showRequests();
  } else if (current?.id === id) stopRun();
}

const HERE = { label: 'Runner page', session: null };

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/run') {
    const { ids, live } = JSON.parse(await body(req)) as { ids: string[]; live?: boolean };
    const chosen = ids.filter((id) => state.scenarios.some((s) => s.id === id));
    if (chosen.length) request(HERE, filesOf(chosen), { E2E_BUILD: '0', ...(live ? { E2E_LIVE: '1' } : {}) }, chosen);
    return json(res, state.runner);
  }
  if (req.method === 'POST' && req.url === '/continue') {
    const { live } = JSON.parse((await body(req)) || '{}') as { live?: boolean };
    const left = remaining();
    if (left.length) request(HERE, filesOf(left), { E2E_BUILD: '0', ...(live ? { E2E_LIVE: '1' } : {}) }, left, true);
    return json(res, state.runner);
  }
  // `pnpm e2e`: the run's output streams back on this response, ending with its exit code; the requester going away
  // takes its run with it
  if (req.method === 'POST' && req.url === '/request') {
    const { args, env, by, detach } = JSON.parse(await body(req)) as { args: string[]; env: Record<string, string>; by: RunRequest['by']; detach?: boolean };
    // Detached: queued and left to run whatever happens to the requester; its output goes to its log only
    if (detach) {
      const r = request(by, args, env, null);
      return json(res, { id: r.id, log: join(RUN_LOGS, `${r.id}.log`) });
    }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' });
    const r = request(by, args, env, null, false, res);
    // A line now and then, so the requester's connection is not dropped as idle while the run waits or goes quiet
    const beat = setInterval(() => {
      if (!res.writableEnded) res.write('\u0000beat\n');
    }, 30_000);
    res.on('close', () => {
      clearInterval(beat);
      if (res.writableEnded || !outputs.has(r.id)) return;
      outputs.delete(r.id);
      note(`${r.by.label} went away`);
      cancel(r.id);
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/stop') {
    stopRun();
    return json(res, state.runner);
  }
  if (req.method === 'POST' && req.url === '/cancel') {
    const { id } = JSON.parse(await body(req)) as { id: string };
    cancel(id);
    return json(res, state.runner);
  }
  if (req.method === 'GET' && req.url === '/state') return json(res, state);
  // A scenario's window, a frame at a time: posted by the run, shown by the page
  if (req.method === 'POST' && req.url?.startsWith('/frame?')) {
    const id = new URL(req.url, 'http://x').searchParams.get('id') ?? '';
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    if (envs.has(id)) {
      const frame = Buffer.concat(chunks);
      frames.set(id, frame);
      for (const r of streams.get(id) ?? []) sendFrame(r, frame);
    }
    // The run sends frames fast only while a page watches its window
    return json(res, { watched: (streams.get(id)?.size ?? 0) > 0 });
  }
  // The frames of a scenario's window as they come: one long answer the page shows as a moving image
  if (req.method === 'GET' && req.url?.startsWith('/stream/')) {
    const id = decodeURIComponent(req.url.slice('/stream/'.length).split('?')[0]!);
    res.writeHead(200, { 'content-type': `multipart/x-mixed-replace; boundary=${BOUNDARY}`, 'cache-control': 'no-store', connection: 'close' });
    const watching = streams.get(id) ?? new Set<ServerResponse>();
    watching.add(res);
    streams.set(id, watching);
    req.on('close', () => {
      watching.delete(res);
      if (watching.size === 0 && streams.get(id) === watching) streams.delete(id);
    });
    const last = frames.get(id);
    if (last) sendFrame(res, last);
    return;
  }
  if (req.method === 'GET' && req.url?.startsWith('/frame/')) {
    const frame = frames.get(decodeURIComponent(req.url.slice('/frame/'.length).split('?')[0]!));
    if (!frame) {
      res.statusCode = 404;
      return res.end();
    }
    res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store' });
    return res.end(frame);
  }
  // The page shows another scenario under way
  if (req.method === 'POST' && req.url === '/watch') {
    const { id } = JSON.parse(await body(req)) as { id: string };
    if (envs.has(id)) watch(id);
    publish();
    return json(res, { watching: state.current?.id ?? null });
  }
  // The one way the runner ends: its run stopped
  if (req.method === 'POST' && req.url === '/quit') {
    stopRun();
    note('Runner quit');
    json(res, { quit: true });
    setTimeout(() => process.exit(0), 300);
    return;
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
  if (req.method === 'GET' && ['/', '/index.html'].includes(new URL(req.url ?? '/', 'http://x').pathname)) {
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
