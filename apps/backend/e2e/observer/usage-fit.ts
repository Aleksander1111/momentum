/**
 * How much of the 5-hour limit a scenario takes, measured in its own run and nothing else. The API reports the limit on
 * every answer (anthropic-ratelimit-unified-5h-utilization); the rise from the run's first answer to its last is what the
 * run took. It is shared among the run's scenarios by the tokens each used, every kind of token weighed as Anthropic's
 * price list weighs it. Set once, when the run ends: nothing before or after the run counts, and it stays until the
 * scenario runs again.
 */

export const KINDS = ['input', 'cacheWrite', 'cacheRead', 'output'] as const;
export type Kind = (typeof KINDS)[number];
export const GROUPS = ['opus', 'sonnet', 'haiku'] as const;
export type Group = (typeof GROUPS)[number];
/** Tokens by model group and kind */
export type Tokens = Record<`${Group}.${Kind}`, number>;
const FEATURES = GROUPS.flatMap((g) => KINDS.map((k) => `${g}.${k}` as const));

/** The price list, per million tokens: input and output by model; cache writes cost 1.25 times input, reads 0.1 times */
const PRICE: Record<Group, { input: number; output: number }> = {
  opus: { input: 5, output: 25 },
  sonnet: { input: 3, output: 15 },
  haiku: { input: 1, output: 5 },
};

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

/** Tokens weighed as the price list weighs them: what shares a run's rise among its scenarios */
export function weightOf(t: Partial<Tokens>): number {
  return GROUPS.reduce((w, g) => {
    const p = PRICE[g];
    return w + (t[`${g}.input`] ?? 0) * p.input + (t[`${g}.cacheWrite`] ?? 0) * p.input * 1.25 + (t[`${g}.cacheRead`] ?? 0) * p.input * 0.1 + (t[`${g}.output`] ?? 0) * p.output;
  }, 0);
}

/** A test answer as the stand-in passed it on: whose, when, the limit after it, the tokens it used */
export interface Answer {
  scenario: string;
  t: number;
  /** The 5-hour limit used, percent, right after it; null when the API did not say */
  u: number | null;
  /** When the 5-hour window it counted in resets, epoch seconds */
  resets: number | null;
  tokens: Tokens;
}

/**
 * What each scenario of a run took of the 5-hour limit, percent: the run's rise, window by window should a window reset
 * during it, shared by each scenario's weighed tokens. Also the run's whole rise.
 */
export function splitRun(answers: Answer[]): { rise: number; share: Record<string, number> } {
  const sorted = [...answers].sort((a, b) => a.t - b.t);
  // The rise within each window: from its first reading to its last
  const windows = new Map<number, { first: number; last: number }>();
  for (const a of sorted) {
    if (a.u === null || a.resets === null) continue;
    const key = Math.round(a.resets / 60);
    const w = windows.get(key);
    if (!w) windows.set(key, { first: a.u, last: a.u });
    else w.last = a.u;
  }
  const rise = [...windows.values()].reduce((s, w) => s + Math.max(0, w.last - w.first), 0);
  const weight = new Map<string, number>();
  for (const a of sorted) weight.set(a.scenario, (weight.get(a.scenario) ?? 0) + weightOf(a.tokens));
  const total = [...weight.values()].reduce((s, w) => s + w, 0);
  const share = Object.fromEntries([...weight].map(([id, w]) => [id, total ? (rise * w) / total : 0]));
  return { rise, share };
}
