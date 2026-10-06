import { describe, expect, it } from 'vitest';
import { usageOfRateLimit } from '../src/session.ts';

describe('rate limit events', () => {
  it('reads both windows Claude Code reports, as percentage points', () => {
    const info = { rateLimitType: 'five_hour', unifiedWindows: { five_hour: { utilization: 0.3 }, seven_day: { utilization: 0.155 } } };
    expect(usageOfRateLimit(info)).toEqual({ fiveHour: 30, week: 15.5 });
  });

  it('reads the one limit an older event is about', () => {
    expect(usageOfRateLimit({ rateLimitType: 'five_hour', utilization: 0.42 })).toEqual({ fiveHour: 42, week: null });
    expect(usageOfRateLimit({ rateLimitType: 'seven_day', utilization: 0.07 })).toEqual({ fiveHour: null, week: 7 });
  });

  it('reads nothing from an event without a use', () => {
    expect(usageOfRateLimit({ rateLimitType: 'overage' })).toEqual({ fiveHour: null, week: null });
    expect(usageOfRateLimit({ unifiedWindows: { five_hour: { utilization: null } } })).toEqual({ fiveHour: null, week: null });
  });
});
