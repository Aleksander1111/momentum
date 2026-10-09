import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { commitsOf, filesOf } from '../support/landed.ts';
import { entityText, move } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const HARNESS = 'momentum';
const CORRECTION = 'Never answer with a table; use short bullet points.';
const RULE = '- Answer in short bullet points, never in a table.';
const UNREVIEWED = '- Always answer in French.';
const CHAT_AGENT = 'automations/chat/agents/momentum-chat.md';
const CHECK_AGENT = 'automations/consistency-check/agents/momentum-consistency-check.md';
const task = (title: string, card: string) =>
  entityText({ type: 'Product/DevTask', origin: 'user', title, card, impact: [2, 1, 0] });

// Optimization runs in the harness workspace, where the definitions live, over every enabled project
scenario('harness-tuning', { enabled: [WS, HARNESS], triggers: ['implementation'] }, async ({ env, api, app, model, step }) => {
  const latest = async (ws: string, automation: Parameters<typeof api.runs>[1], since: Date) =>
    until(`a ${automation} run with its model`, async () => (await api.runs(ws, automation)).find((r) => r.created_at >= since && r.model), 2 * 60_000);
  /** The lines a file gained on the harness main line since a commit */
  const added = (file: string, since: string) =>
    env
      .git(HARNESS, 'diff', '--ignore-cr-at-eol', since, 'main', '--', file)
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => l.slice(1).trim())
      .filter(Boolean);
  let proposed: string[] = [];

  model.on('chats answer', { automation: 'chat' }, (t) => (t.kind === 'prompt' || t.kind === 'message' ? [move.say(/table/.test(t.input) ? '| route |\n| --- |\n| /books |' : '- /books')] : undefined));
  // Only the model each implementation starts on matters here: the API never answers them, a hang injected live too
  model.on('implementation waits', { automation: 'implementation', kind: 'prompt' }, () => [move.hang()]);

  await step(0, async () => {
    await app.tab('Settings');
    await app.frame().getByRole('radio', { name: 'Per automation' }).click();
    await until('per automation saved', async () => (await api.settings()).models.mode === 'per_automation');
    const { models } = await api.settings();
    await api.putSettings({ models: { ...models, perAutomation: { ...models.perAutomation, chat: 'haiku', 'consistency-check': 'opus' } } });
    const since = new Date();
    const chat = await app.chat(WS, 'Which routes are there?');
    await api.runEnded(chat, 2 * 60_000);
    expect((await api.runs(WS, 'chat')).find((r) => r.id === chat)?.model).toBe('haiku');
    await env.trigger(WS, 'consistency-check');
    expect((await latest(WS, 'consistency-check', since)).model).toBe('opus');
  });

  await step(1, async () => {
    await app.tab('Settings');
    await app.frame().getByRole('radio', { name: 'By risk' }).click();
    await until('risk mode saved', async () => (await api.settings()).models.mode === 'risk');
    model.risk = (prompt) => (/typo/i.test(prompt) ? 'low' : /database|schema/i.test(prompt) ? 'high' : 'medium');
    env.commit(
      WS,
      {
        'knowledge-graph/Product/DevTask/fix-readme-typo.md': task('Fix a typo in the README', 'The README says "libary" once; it should say "library".'),
        'knowledge-graph/Product/DevTask/persistent-store.md': task('Keep books in a database', 'Move every book into a new SQLite schema and migrate the data.'),
      },
      'Plan two tasks',
    );
    for (const [path, expected] of [['Product/DevTask/fix-readme-typo', 'haiku'], ['Product/DevTask/persistent-store', 'opus']] as const) {
      const since = new Date();
      await app.approve(WS, path);
      const run = await until(`the implementation of ${path}`, async () => (await api.runs(WS, 'implementation')).find((r) => r.created_at >= since && r.target_path === path && r.model), 3 * 60_000);
      expect(run.model).toBe(expected);
      await api.mcp('kill_run', { id: run.id });
      await api.runEnded(run.id);
    }
    // The estimator was asked with the user's rules
    const asked = model.side.filter((s) => /estimate the risk/.test(s.system));
    expect(asked).toHaveLength(2);
    expect(asked[0]!.system).toContain('Data at rest: migrations, schema');
    await api.putSettings({ models: { ...(await api.settings()).models, mode: 'single' } });
  });

  model.on('optimization proposes', { automation: 'optimization', kind: 'prompt' }, (t) => {
    const agent = readFileSync(t.file(CHAT_AGENT), 'utf8');
    const entity = readFileSync(t.file('knowledge-graph/Harness/Automation/chat.md'), 'utf8')
      .replace('verification: verified', 'verification: unverified')
      .replace(/^artifacts:/m, 'variant: bullets\nartifacts:')
      .replace(/\r?\n$/, `\n\nProposed by optimization: in ${WS}, 3 of 3 chats were corrected to drop tables; answers come in bullet points.\n`);
    return [
      move.metric(3, 1),
      move.write(t, CHAT_AGENT, `${agent.trimEnd()}\n${RULE}\n`),
      move.write(t, 'knowledge-graph/Harness/Automation/chat.md', entity),
      move.say('Proposed one change to the chat definition.'),
    ];
  });
  // A chat in the harness changes an agent file and nothing else
  model.on('an unreviewed edit', (t) => t.automation === 'chat' && t.kind === 'prompt' && /French/.test(t.input), (t) => [
    move.write(t, CHECK_AGENT, `${readFileSync(t.file(CHECK_AGENT), 'utf8').trimEnd()}\n${UNREVIEWED}\n`),
    move.say('Done.'),
  ]);

  await step(2, async () => {
    // Three times: a change waits for three sightings
    for (const q of ['Give me an overview of the routes, as a table.', 'Compare the routes, as a table.', 'List the routes with what each returns, as a table.']) {
      const chat = await app.chat(WS, q);
      await api.runEnded(chat, 5 * 60_000);
      await app.reply(chat, CORRECTION);
      expect((await api.answered(chat, 2)).status).toBe('finished');
    }
    const before = env.head(HARNESS);
    const since = new Date();
    await env.trigger(HARNESS, 'optimization');
    const run = await api.automationRan(HARNESS, 'optimization', since, 20 * 60_000);
    expect(run.status).toBe('finished');
    // It was told where the projects are
    expect(model.instructions.get(run.id)).toContain(`- ${WS}: ${env.path(WS)}`);
    // It counted the corrections
    const [m] = await env.sql<{ misalignments: number }[]>`select misalignments from ${env.sql('ws_momentum.agent_metric')} where run_id = ${run.id} and misalignments is not null`;
    expect(m!.misalignments).toBeGreaterThanOrEqual(1);
    // and proposed a change to the chat definition that answers them: bullet points, no tables
    const proposal = await until('the proposal in the feed', async () => (await api.feed()).items.find((i) => i.workspace === HARNESS && i.path === 'Harness/Automation/chat'));
    expect(proposal.diff).not.toBeNull();
    proposed = added(CHAT_AGENT, before);
    expect(proposed.some((l) => /table|bullet/i.test(l)), `a rule against tables among ${JSON.stringify(proposed)}`).toBe(true);
    // In effect as it lands, before anyone has reviewed it: verification is the user's, not a switch
    const live = join(env.path(WS), '.claude', 'agents', 'momentum-chat.md');
    await until('the proposal in effect in the project', async () => proposed.every((l) => readFileSync(live, 'utf8').includes(l)));
  });

  await step(3, async () => {
    const before = env.head(HARNESS);
    // An agent file of an automation that has no definition
    const orphan = join(env.path(WS), '.claude', 'agents', 'momentum-unknown.md');
    writeFileSync(orphan, '---\nname: momentum-unknown\n---\nBuild the knowledge graph.\n');
    const chat = await api.chat(HARNESS, 'Make the consistency check write its issues in French.');
    expect((await api.runEnded(chat.runId, 10 * 60_000)).status).toBe('finished');
    const french = added(CHECK_AGENT, before).filter((l) => /french/i.test(l));
    expect(french.length, 'a French rule in the consistency check').toBeGreaterThan(0);
    // In effect as it lands, in the projects and the harness alike; the definitions written again leave no orphan
    for (const ws of [WS, HARNESS]) {
      const check = join(env.path(ws), '.claude', 'agents', 'momentum-consistency-check.md');
      await until(`the changed definition in ${ws}`, async () => french.every((l) => readFileSync(check, 'utf8').includes(l)));
    }
    await until('the agent file no definition produces removed', async () => !existsSync(orphan), 30_000);
    // and it waits in the feed for the user's review like any other change
    await until('the changed definition waiting for review', async () => (await api.entity(HARNESS, 'Harness/Automation/consistency-check')).verification === 'unverified');

    // The proposal shapes the next chat, and its variant is recorded on it
    const variant = (await api.entities(HARNESS, 'Harness/Automation')).find((e) => e.path === 'Harness/Automation/chat')!.frontmatter.variant;
    expect(typeof variant, 'the proposal names its variant').toBe('string');
    const next = await app.chat(WS, 'Name one route.');
    await api.runEnded(next, 5 * 60_000);
    for (const l of proposed.filter((x) => /table|bullet/i.test(x))) expect(model.instructions.get(next)).toContain(l);
    const [v] = await env.sql<{ variant: string | null }[]>`select variant from ${env.sql('ws_bookshelf_api.agent_metric')} where run_id = ${next}`;
    expect(v!.variant).toBe(variant);
  });

  await step(4, async () => {
    const file = 'knowledge-graph/Harness/Trigger/consistency-check.md';
    env.commit(WS, { [file]: env.show(WS, file)!.replace('on_demand: true', 'on_demand: false') }, 'Run the consistency check on its schedule only');
    await until('the trigger re-indexed', async () => (await api.entities(WS, 'Harness/Trigger')).find((t) => t.path === 'Harness/Trigger/consistency-check')?.frontmatter.on_demand === false, 60_000);
    await expect(api.runAutomation(WS, 'consistency-check')).rejects.toThrow(/does not start on demand/);
    // Every minute: the next due time comes within the minute
    const since = new Date();
    env.commit(WS, { [file]: env.show(WS, file)!.replace(/^schedule: .*$/m, 'schedule: "* * * * *"') }, 'Check every minute');
    const run = await until('the check on its new schedule', async () => (await api.runs(WS, 'consistency-check')).find((r) => r.created_at >= since && r.trigger === 'schedule'), 2 * 60_000);
    expect(run.trigger).toBe('schedule');
  });

  await step(5, async () => {
    // The harness serves from its own main line: an exploration there writes the knowledge graph, never the code
    const code = 'apps/backend/src/explored.ts';
    const research = 'Harness/Research/next-tuning';
    model.on('exploration reaches into the code', { automation: 'exploration', kind: 'prompt' }, (t) => [
      move.write(t, code, 'export const explored = true;\n'),
      move.entity(t, research, { type: 'Harness/Research', title: 'Next tuning', card: 'Tune the chat definition next: answers still come as tables.' }),
      move.say('Explored.'),
    ]);
    const since = new Date();
    await env.trigger(HARNESS, 'exploration');
    const run = await api.automationRan(HARNESS, 'exploration', since, 10 * 60_000);
    expect(run.status).toBe('finished');
    expect(env.show(HARNESS, code)).toBeNull();
    // Live, the exploration decides what it writes: whatever landed of it is the knowledge graph's, never the code
    if (model.live) {
      const files = filesOf(env, HARNESS, await commitsOf(env, HARNESS, run.id));
      expect(files.filter((f) => !f.startsWith('knowledge-graph/') && !f.startsWith('chats/')), 'only the knowledge graph landed').toEqual([]);
      return;
    }
    expect(env.show(HARNESS, `knowledge-graph/${research}.md`)).toContain('# Next tuning');
    const issue = await api.entity(HARNESS, `Harness/Issue/guard-${run.id}`);
    expect(issue.markdown).toContain(code);
    expect(issue.markdown).toMatch(/may not change this in the harness's repository/);
  });
});
