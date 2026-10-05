import { query } from '@anthropic-ai/claude-agent-sdk';
import { appendFileSync, closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync, type Dirent } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * How much of the 5-hour limit a scenario takes, measured: no prices, no assumed rates. The API reports the limit on
 * every answer (anthropic-ratelimit-unified-5h-utilization, in whole percents) and the runner reads it every minute
 * besides. Every answer's tokens are known: the test runs' from the stand-in that passes them on, everything else on this
 * PC (this chat, any other Claude Code session) from Claude Code's own records. A least-squares fit, no weight below
 * zero, of the limit's rise since each window's first reading against the tokens used since gives what each model group
 * takes. Within a group, the kinds of token are weighed as Anthropic's published price list weighs them (input 1, cache
 * write 1.25, cache read 0.1, output 5): over a run every kind grows in step with the others, so the readings cannot
 * tell them apart, but they do tell the groups apart, which is where the limit departs from the prices. A scenario takes
 * what its own tokens take. The fit's error against the readings is kept with it.
 */

export const KINDS = ['input', 'cacheWrite', 'cacheRead', 'output'] as const;
export type Kind = (typeof KINDS)[number];
export const GROUPS = ['opus', 'sonnet', 'haiku'] as const;
export type Group = (typeof GROUPS)[number];
/** Tokens by model group and kind, as one vector: the fit's variables */
export type Tokens = Record<`${Group}.${Kind}`, number>;
const FEATURES = GROUPS.flatMap((g) => KINDS.map((k) => `${g}.${k}` as const));
/** Each kind of token relative to an input token, as the price list has it, the same for every model */
const KIND_WEIGHT: Record<Kind, number> = { input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 };
/** A group's tokens as input-token equivalents, in millions: the fit's variable for that group */
const massOf = (t: Partial<Tokens>, g: Group) => KINDS.reduce((m, k) => m + ((t[`${g}.${k}`] ?? 0) * KIND_WEIGHT[k]) / 1e6, 0);

export const groupOf = (model: string): Group => (/opus/i.test(model) ? 'opus' : /haiku/i.test(model) ? 'haiku' : 'sonnet');

export function emptyTokens(): Tokens {
  return Object.fromEntries(FEATURES.map((f) => [f, 0])) as Tokens;
}

/** One answer's usage fields as tokens of its model group */
export function tokensOf(model: string, u: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }): Tokens {
  const t = emptyTokens();
  const g = groupOf(model);
  t[`${g}.input`] = u.input_tokens ?? 0;
  t[`${g}.cacheWrite`] = u.cache_creation_input_tokens ?? 0;
  t[`${g}.cacheRead`] = u.cache_read_input_tokens ?? 0;
  t[`${g}.output`] = u.output_tokens ?? 0;
  return t;
}

export function addTokens(into: Tokens, t: Partial<Tokens>): Tokens {
  for (const f of FEATURES) into[f] += t[f] ?? 0;
  return into;
}

/** The account's limits, read without sending a prompt */
export async function readFiveHour(): Promise<{ fiveHour: number | null; resets: string | null; week: number | null; weekResets: string | null }> {
  const abort = new AbortController();
  const prompt = (async function* () {
    await new Promise(() => {});
  })();
  const q = query({ prompt: prompt as never, options: { abortController: abort, settingSources: [], persistSession: false, tools: [] } });
  try {
    const r = (await q.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true })).rate_limits;
    return {
      fiveHour: r?.five_hour?.utilization ?? null,
      resets: r?.five_hour?.resets_at ?? null,
      week: r?.seven_day?.utilization ?? null,
      weekResets: r?.seven_day?.resets_at ?? null,
    };
  } finally {
    abort.abort();
  }
}

/** Every Claude Code answer on this PC outside the test runs, read from the transcripts as they grow */
class OtherAnswers {
  private readonly root = join(homedir(), '.claude', 'projects');
  private offsets = new Map<string, number>();
  private seen = new Set<string>();
  readonly list: { t: number; tokens: Tokens }[] = [];

  scan(): void {
    const since = Date.now() - 6 * 3600_000;
    let dirs: Dirent[];
    try {
      dirs = readdirSync(this.root, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of dirs) {
      // The test runs' own sessions: their answers come from the stand-in, every one with the limit's reading
      if (!d.isDirectory() || d.name.includes('momentum-e2e-')) continue;
      this.walk(join(this.root, d.name), since);
    }
    while (this.list.length && this.list[0]!.t < since) this.list.shift();
  }

  private walk(dir: string, since: number): void {
    let names: Dirent[];
    try {
      names = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of names) {
      const p = join(dir, d.name);
      if (d.isDirectory()) this.walk(p, since);
      else if (d.name.endsWith('.jsonl')) this.read(p, since);
    }
  }

  private read(file: string, since: number): void {
    let size: number;
    try {
      const s = statSync(file);
      if (s.mtimeMs < since && !this.offsets.has(file)) return;
      size = s.size;
    } catch {
      return;
    }
    const from = this.offsets.get(file) ?? 0;
    if (size <= from) return;
    const buf = Buffer.alloc(size - from);
    let fd: number;
    try {
      fd = openSync(file, 'r');
    } catch {
      return;
    }
    try {
      readSync(fd, buf, 0, buf.length, from);
    } finally {
      closeSync(fd);
    }
    const text = buf.toString('utf8');
    // Up to the last whole line: the rest is read once it is written out
    const end = text.lastIndexOf('\n');
    if (end < 0) return;
    this.offsets.set(file, from + Buffer.byteLength(text.slice(0, end + 1)));
    for (const line of text.slice(0, end).split('\n')) {
      if (!line.includes('"usage"')) continue;
      let j: { timestamp?: string; requestId?: string; message?: { id?: string; model?: string; usage?: Record<string, number> } };
      try {
        j = JSON.parse(line);
      } catch {
        continue;
      }
      const m = j.message;
      const t = Date.parse(j.timestamp ?? '');
      if (!m?.usage || !m.model || m.model.startsWith('<') || !(t >= since)) continue;
      // One answer of several content blocks is written once per block, with the same usage
      const key = `${m.id ?? ''}:${j.requestId ?? ''}`;
      if (m.id && this.seen.has(key)) continue;
      this.seen.add(key);
      this.list.push({ t, tokens: tokensOf(m.model, m.usage) });
    }
    this.list.sort((a, b) => a.t - b.t);
  }
}

/** A test answer, or a reading alone: when, the limit after it when known, and the tokens it used */
interface Point {
  t: number;
  /** The window, as its reset time to the minute */
  window: string;
  /** The 5-hour limit used, percent, right after it */
  u: number | null;
  tokens?: Partial<Tokens>;
}

/** Least squares with every coefficient at or above zero (Lawson and Hanson's active set) */
function nnls(rows: number[][], y: number[]): number[] {
  const n = rows[0]?.length ?? 0;
  // Normal equations: AᵀA and Aᵀy, small since there are few variables
  const ata = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const aty = new Array<number>(n).fill(0);
  rows.forEach((r, k) => {
    for (let i = 0; i < n; i++) {
      aty[i]! += r[i]! * y[k]!;
      for (let j = 0; j < n; j++) ata[i]![j]! += r[i]! * r[j]!;
    }
  });
  const solve = (set: number[]): number[] => {
    // Gaussian elimination on the free variables
    const m = set.map((i) => [...set.map((j) => ata[i]![j]!), aty[i]!]);
    for (let c = 0; c < set.length; c++) {
      let p = c;
      for (let r = c + 1; r < set.length; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[p]![c]!)) p = r;
      [m[c], m[p]] = [m[p]!, m[c]!];
      const d = m[c]![c]!;
      if (Math.abs(d) < 1e-12) continue;
      for (let r = 0; r < set.length; r++) {
        if (r === c) continue;
        const f = m[r]![c]! / d;
        for (let k = c; k <= set.length; k++) m[r]![k]! -= f * m[c]![k]!;
      }
    }
    const z = new Array<number>(n).fill(0);
    set.forEach((i, c) => (z[i] = Math.abs(m[c]![c]!) < 1e-12 ? 0 : m[c]![set.length]! / m[c]![c]!));
    return z;
  };
  let x = new Array<number>(n).fill(0);
  const passive = new Set<number>();
  for (let iter = 0; iter < 3 * n; iter++) {
    const grad = aty.map((v, i) => v - ata[i]!.reduce((s, a, j) => s + a * x[j]!, 0));
    const candidates = [...Array(n).keys()].filter((i) => !passive.has(i) && grad[i]! > 1e-9);
    if (!candidates.length) break;
    passive.add(candidates.reduce((a, b) => (grad[a]! > grad[b]! ? a : b)));
    for (let inner = 0; inner < 3 * n; inner++) {
      const z = solve([...passive]);
      if ([...passive].every((i) => z[i]! > 0)) {
        x = z;
        break;
      }
      let alpha = 1;
      for (const i of passive) if (z[i]! <= 0) alpha = Math.min(alpha, x[i]! / (x[i]! - z[i]!));
      x = x.map((v, i) => v + alpha * (z[i]! - v));
      for (const i of [...passive]) if (x[i]! <= 1e-12) passive.delete(i), (x[i] = 0);
    }
  }
  return x;
}

export interface Fit {
  /** Percent of the 5-hour limit per million input-token equivalents of each model group */
  weights: Record<string, number>;
  /** How far the fit's limit is from the readings, root mean square, in percent of the limit */
  error: number;
  rows: number;
  /** The largest rise in one window it was fitted on, percent */
  span: number;
}

/** Collects test answers, other answers and readings, and fits what a token takes of the 5-hour limit */
export class UsageFit {
  private others = new OtherAnswers();
  private points: Point[] = [];
  fit: Fit | null = null;

  constructor(private readonly file: string) {
    if (existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        try {
          if (line) this.points.push(JSON.parse(line) as Point);
        } catch {
          // a line cut short
        }
      }
    }
    // Only what the transcripts still hold can be set against the readings: the last hours
    const since = Date.now() - 6 * 3600_000;
    this.points = this.points.filter((p) => p.t >= since);
    this.refit();
  }

  /** A test answer through the stand-in, with the limit it reported; or a reading alone, with no tokens */
  add(p: { t: number; u: number | null; resets: string | number | null; tokens?: Partial<Tokens> }): void {
    if (p.resets === null || p.resets === undefined) return;
    const ms = typeof p.resets === 'number' ? p.resets * 1000 : Date.parse(p.resets);
    if (!Number.isFinite(ms)) return;
    const point: Point = { t: p.t, window: new Date(Math.round(ms / 60_000) * 60_000).toISOString(), u: p.u, tokens: p.tokens };
    this.points.push(point);
    appendFileSync(this.file, `${JSON.stringify(point)}\n`);
  }

  /** Fits again over every window still in reach */
  refit(): void {
    this.others.scan();
    const rows: number[][] = [];
    const ys: number[] = [];
    const windows = new Map<string, Point[]>();
    for (const p of this.points) windows.set(p.window, [...(windows.get(p.window) ?? []), p]);
    let span = 0;
    for (const list of windows.values()) {
      list.sort((a, b) => a.t - b.t);
      const first = list.find((p) => p.u !== null);
      if (!first) continue;
      const others = this.others.list.filter((a) => a.t > first.t);
      const used = emptyTokens();
      let o = 0;
      for (const p of list) {
        if (p.t <= first.t) continue;
        if (p.tokens) addTokens(used, p.tokens);
        while (o < others.length && others[o]!.t <= p.t) addTokens(used, others[o++]!.tokens);
        if (p.u === null) continue;
        rows.push(GROUPS.map((g) => massOf(used, g)));
        ys.push(p.u - first.u!);
        span = Math.max(span, p.u - first.u!);
      }
    }
    if (rows.length < 2 || span <= 0) return;
    const w = nnls(rows, ys);
    const err = Math.sqrt(rows.reduce((s, r, k) => s + (r.reduce((t, v, i) => t + v * w[i]!, 0) - ys[k]!) ** 2, 0) / rows.length);
    this.fit = { weights: Object.fromEntries(GROUPS.map((g, i) => [g, w[i]!])), error: err, rows: rows.length, span };
  }

  /** Percent of the 5-hour limit these tokens take, by the fit; null before there is one */
  share(t: Partial<Tokens>): number | null {
    if (!this.fit) return null;
    return GROUPS.reduce((s, g) => s + massOf(t, g) * this.fit!.weights[g]!, 0);
  }
}
