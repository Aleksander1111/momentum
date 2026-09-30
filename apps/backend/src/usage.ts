import type { Usage } from '@momentum/contract';

export type Rise = { fiveHour: number; week: number };

/**
 * How much each limit rose from one account reading to the next. A limit not in the next reading did not move, and a
 * fall (usage rolling out of the window) is no rise.
 */
export function rise(prev: Usage, next: Usage): Rise {
  const up = (a: number | null, b: number | null) => (a !== null && b !== null ? Math.max(0, b - a) : 0);
  return { fiveHour: up(prev.fiveHour, next.fiveHour), week: up(prev.week, next.week) };
}

/** The reading after `u`: what `u` reports, the rest as before */
export function merge(prev: Usage, u: Usage): Usage {
  return { fiveHour: u.fiveHour ?? prev.fiveHour, week: u.week ?? prev.week };
}
