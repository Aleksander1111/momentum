import { query } from '@anthropic-ai/claude-agent-sdk';
import { test } from '@playwright/test';

export interface Reading {
  fiveHour: number | null;
  week: number | null;
  /** When each window resets, ISO */
  fiveHourResets: string | null;
  weekResets: string | null;
}

/** The account's limits, read without sending a prompt: it uses nothing */
export async function readUsage(): Promise<Reading> {
  const abort = new AbortController();
  const prompt = (async function* () {
    await new Promise(() => {});
  })();
  const q = query({ prompt: prompt as never, options: { abortController: abort, settingSources: [], persistSession: false, tools: [] } });
  try {
    const u = await q.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true });
    const r = u.rate_limits;
    return {
      fiveHour: r?.five_hour?.utilization ?? null,
      week: r?.seven_day?.utilization ?? null,
      fiveHourResets: r?.five_hour?.resets_at ?? null,
      weekResets: r?.seven_day?.resets_at ?? null,
    };
  } finally {
    abort.abort();
  }
}

const at = (iso: string | null) =>
  iso ? ` until ${new Date(iso).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : '';

/** Why real runs cannot go on: the 5-hour or weekly limit used up, with when it resets; null while there is room */
export function limitOf(u: Reading | null): string | null {
  if (!u) return null;
  if ((u.week ?? 0) >= 100) return `Weekly limit reached${at(u.weekResets)}`;
  if ((u.fiveHour ?? 0) >= 100) return `5-hour limit reached${at(u.fiveHourResets)}`;
  return null;
}

let reached: string | null = null;
let broken: string | null = null;
let abort: (e: Error) => void = () => {};
/** Rejects the moment the scenario is broken or out of usage: every step races it, so nothing waits past that */
export let aborted: Promise<never> = Promise.reject(new Error('no scenario'));
aborted.catch(() => {});

export class LimitReached extends Error {}

export function limitReached(reason: string): void {
  reached ??= reason;
  abort(new LimitReached(reason));
}

/** What the scenario waits for can no longer happen: its back-end died, or nothing moved for too long */
export function breakScenario(reason: string): void {
  broken ??= reason;
  abort(Object.assign(new Error(reason), { fatal: true }));
}

export function resetScenario(): void {
  reached = null;
  broken = null;
  aborted = new Promise<never>((_, reject) => (abort = reject));
  aborted.catch(() => {});
}

/** Fails the running scenario once it is broken, skips it once the limit is reached; every wait and action calls it */
export function guarded(): void {
  if (broken) throw Object.assign(new Error(broken), { fatal: true });
  if (reached) test.skip(true, reached);
}
