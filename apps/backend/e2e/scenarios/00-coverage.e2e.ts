import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { FEATURES } from '../features.ts';
import { SCENARIOS } from '../scenarios.ts';

test('every feature is covered by a scenario, and every scenario has its file', () => {
  const covered = new Set(SCENARIOS.flatMap((s) => s.covers));
  expect(Object.keys(FEATURES).filter((f) => !covered.has(f as keyof typeof FEATURES))).toEqual([]);
  const files = readdirSync(import.meta.dirname).map((f) => f.replace(/^\d+-/, '').replace(/\.e2e\.ts$/, ''));
  expect(SCENARIOS.map((s) => s.id).filter((id) => !files.includes(id))).toEqual([]);
});

test('every step says which features it checks, and the steps check exactly what the scenario covers', () => {
  for (const s of SCENARIOS) {
    expect(s.checks, `${s.id}: one list of features per step`).toHaveLength(s.steps.length);
    s.checks.forEach((list, i) => expect(list.length, `${s.id} step ${i}: checks some feature`).toBeGreaterThan(0));
    const checked = new Set(s.checks.flat());
    expect([...s.covers].filter((f) => !checked.has(f)), `${s.id}: covered but checked by no step`).toEqual([]);
    expect([...checked].filter((f) => !s.covers.includes(f)), `${s.id}: checked but not covered`).toEqual([]);
  }
});
