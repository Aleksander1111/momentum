import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entityText, type Move, move, type Turn } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const HARNESS = 'momentum';
const FEATURE = 'Product/Feature/reading-lists';
const LIMIT = 300;
const RULE = 'Start every card with one sentence saying what the entity is.';
const RISK_RULES = 'automations/implementation/risk.md';
const README_RULE = '- Anything that touches the README, however small (Knowledge/*)';
const TASK = 'Product/DevTask/fix-readme-typo';
const SHORT = 'A reading list is a named set of books a reader keeps apart from the shelf, to read next.';
const LONG = `${SHORT} ${'Lists are kept per reader and may hold any book of the shelf. '.repeat(6)}`;

const write = (body: string): Move => ({
  tool: 'mcp__momentum-kb__write',
  input: {
    path: FEATURE,
    title: 'Reading lists',
    body,
    frontmatter: { type: 'Product/Feature', origin: 'requested', verification: 'unverified', sync: 'synced', product_impact: 3, timeline_impact: 1, unlocks: 2, references: [], artifacts: [] },
  },
});

// Implementation runs on approved tasks; optimization's harness workspace holds the rules
scenario('card-rules', { enabled: [WS, HARNESS], triggers: ['implementation'] }, async ({ env, api, app, model, step }) => {
  /** A field of the Settings page holds the value, once the page has read the settings */
  const shown = (value: string) =>
    until(`a field showing "${value}"`, () => app.frame().locator('input, textarea').evaluateAll((els, v) => els.some((e) => (e as HTMLInputElement).value === v), value), 15_000, 500);
  let seen: Turn['results'] = [];
  model.on('writes within the rules', (t) => t.automation === 'chat' && t.kind === 'prompt' && /reading lists/i.test(t.input), (t) => {
    seen = t.results;
    return [write(LONG), write(SHORT), move.say('Written.')];
  });
  // Only the model an implementation starts on matters here: the API never answers it, a hang injected live too
  model.on('implementation waits', { automation: 'implementation', kind: 'prompt' }, () => [move.hang()]);

  await step(0, async () => {
    await app.tab('Settings');
    await api.putSettings({ cards: { characterLimit: LIMIT, presentationRules: RULE } });
    // Shown as set, once the page reads the settings again
    await app.tab('Feed');
    await app.tab('Settings');
    await shown(String(LIMIT));
    // The rules show once their row is opened
    await app.text('Presentation rules').click();
    await shown(RULE);
    const chat = await app.chat(WS, 'Write a Product/Feature entity for reading lists with the momentum-kb write tool.');
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    // The run was told both
    const instructions = model.instructions.get(chat)!;
    expect(instructions).toContain(`within ${LIMIT} characters`);
    expect(instructions).toContain(RULE);
    // The long card was refused by the tool and flagged by the guard; the short one went through
    const [refused, accepted] = seen;
    const issues = (JSON.parse(refused!.text) as { issues: { code: string; message: string }[] }).issues;
    expect(issues.map((i) => i.code)).toEqual(['card_limit']);
    expect(issues[0]!.message).toContain(String(LIMIT));
    expect(accepted!.text).toBe(`Wrote knowledge-graph/${FEATURE}.md`);
    expect(model.turns(chat).some((t) => t.flagged)).toBe(true);
    expect(env.show(WS, `knowledge-graph/${FEATURE}.md`)).toContain(SHORT);
    // Within the new limit; the cards the project shipped were written under the old one and stand as they are
    expect(graphIssues(env, WS, LIMIT).filter((i) => i.path === FEATURE)).toEqual([]);
  });

  await step(1, async () => {
    // The risk rules are configuration in the harness knowledge graph: an artifact of the implementation definition
    expect((await api.entity(HARNESS, 'Harness/Automation/implementation')).artifacts.map((a) => a.path)).toContain(RISK_RULES);
    const rules = env.show(HARNESS, RISK_RULES)!;
    expect(rules).toMatch(/^## High/m);
    env.commit(HARNESS, { [RISK_RULES]: rules.replace(/^## High\r?\n/m, `## High\n\n${README_RULE}\n`) }, 'Treat README changes as high risk');
    await app.tab('Settings');
    await app.frame().getByRole('radio', { name: 'By risk' }).click();
    await until('risk mode saved', async () => (await api.settings()).models.mode === 'risk');
    const { risk } = (await api.settings()).models;
    model.risk = () => 'high';
    env.commit(WS, { [`knowledge-graph/${TASK}.md`]: entityText({ type: 'Product/DevTask', origin: 'user', title: 'Fix a typo in the README', card: 'The README says "libary" once; it should say "library".', impact: [1, 0, 0] }) }, 'Plan a README fix');
    const since = new Date();
    await app.approve(WS, TASK);
    const run = await until('the implementation on its model', async () => (await api.runs(WS, 'implementation')).find((r) => r.created_at >= since && r.target_path === TASK && r.model), 3 * 60_000);
    // Asked with the rules as the user left them, and started on the model the answer maps to
    const asked = model.side.filter((s) => /estimate the risk/.test(s.system));
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.at(-1)!.system).toContain(README_RULE);
    expect(run.risk).toBe('high');
    expect(run.model).toBe(risk.high);
    await api.mcp('kill_run', { id: run.id });
    await api.runEnded(run.id);
  });

  await step(2, async () => {
    const lifetimes = [{ type: 'Harness/Research', rule: '30 days after delivered, unless referenced' }];
    const before = await api.putSettings({ feedSize: 17, summarization: { exclude: ['archive/**', '**/*.lock'] }, lifetimes, agents: { concurrentTotal: 2 } });
    expect(before.feedSize).toBe(17);
    env.stop();
    await env.start();
    await app.open();
    const after = await api.settings();
    expect(after.feedSize).toBe(17);
    expect(after.cards).toEqual({ characterLimit: LIMIT, presentationRules: RULE });
    expect(after.summarization.exclude).toEqual(['archive/**', '**/*.lock']);
    expect(after.lifetimes).toEqual(before.lifetimes);
    expect(after.agents.concurrentTotal).toBe(2);
    expect(after.models).toEqual(before.models);
    expect(after.models.mode).toBe('risk');
    expect(after.projects.map((p) => [p.name, p.enabled])).toEqual(before.projects.map((p) => [p.name, p.enabled]));
    await app.tab('Settings');
    await shown('17');
    await expect(app.frame().getByRole('radio', { name: 'By risk' })).toBeVisible();
  });
});
