import { query } from '@anthropic-ai/claude-agent-sdk';
import { test } from '@playwright/test';

/** Percentage points of the 5-hour limit the suite may use, from where it stood when the suite started */
export const BUDGET = Number(process.env.E2E_FIVE_HOUR_BUDGET ?? 20);

export interface Reading {
  fiveHour: number | null;
  week: number | null;
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
    return { fiveHour: u.rate_limits?.five_hour?.utilization ?? null, week: u.rate_limits?.seven_day?.utilization ?? null };
  } finally {
    abort.abort();
  }
}

/** The 5-hour reading at which real runs stop: the reading at the start of the suite plus the budget */
export function cap(): number {
  const baseline = Number(process.env.E2E_FIVE_HOUR_BASELINE ?? NaN);
  return Number.isFinite(baseline) ? Math.min(100, baseline + BUDGET) : BUDGET;
}

let reached: string | null = null;
let broken: string | null = null;
let abort: (e: Error) => void = () => {};
/** Rejects the moment the scenario is broken or capped: every step races it, so nothing waits past that */
export let aborted: Promise<never> = Promise.reject(new Error('no scenario'));
aborted.catch(() => {});

export class CapReached extends Error {}

export function capReached(reason: string): void {
  reached ??= reason;
  abort(new CapReached(reason));
}

/** What the scenario waits for can no longer happen: its back-end died, or nothing moved for too long */
export function breakScenario(reason: string): void {
  broken ??= reason;
  abort(Object.assign(new Error(reason), { fatal: true }));
}

export function resetCap(): void {
  reached = null;
  broken = null;
  aborted = new Promise<never>((_, reject) => (abort = reject));
  aborted.catch(() => {});
}

/** Fails the running scenario once it is broken, skips it once the cap is reached; every wait and action calls it */
export function guarded(): void {
  if (broken) throw Object.assign(new Error(broken), { fatal: true });
  if (reached) test.skip(true, reached);
}
