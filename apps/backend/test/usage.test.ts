import { describe, expect, it } from 'vitest';
import { merge, rise } from '../src/usage.ts';

describe('usage readings', () => {
  it('treats a fall as no rise and a missing limit as unchanged', () => {
    expect(rise({ fiveHour: 40, week: 10 }, { fiveHour: 30, week: 12 })).toEqual({ fiveHour: 0, week: 2 });
    expect(rise({ fiveHour: null, week: 10 }, { fiveHour: 30, week: 10 })).toEqual({ fiveHour: 0, week: 0 });
  });

  it('keeps the limit a reading does not report', () => {
    expect(merge({ fiveHour: 40, week: 10 }, { fiveHour: null, week: 12 })).toEqual({ fiveHour: 40, week: 12 });
  });
});
