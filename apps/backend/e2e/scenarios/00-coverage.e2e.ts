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
