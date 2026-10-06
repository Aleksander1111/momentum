import { addedSince } from '../support/check.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'todo-cli';
const GOAL = `---
type: Product/Goal
origin: user
verification: verified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 0
references: []
artifacts: []
---
# Manage a to-do list from the terminal

Met. The CLI adds, lists, completes and removes to-dos, stored in one JSON file; every command is covered by the tests in test/store.test.js.
`;

scenario('exploration-idle', { enabled: [WS] }, async ({ env, api, app, step }) => {
  await step(0, async () => {
    env.commit(WS, { 'knowledge-graph/Product/Goal/manage-todos.md': GOAL }, 'Add the goal');
    const before = env.head(WS);
    const since = new Date();
    // Switched on now: its schedule is due at once
    await env.trigger(WS, 'exploration');
    const run = await api.automationRan(WS, 'exploration', since);
    expect(run.status).toBe('finished');
    expect(addedSince(env, WS, before)).toEqual([]);
    expect(env.git(WS, 'diff', '--name-only', before, 'main', '--', 'knowledge-graph').split('\n').filter((f) => f && !f.includes('Harness/Trigger/'))).toEqual([]);
  });
});
