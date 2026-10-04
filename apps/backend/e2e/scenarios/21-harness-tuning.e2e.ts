import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
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

  model.on('chats answer', { automation: 'chat' }, (t) => (t.kind === 'prompt' || t.kind === 'message' ? [move.say(/table/.test(t.input) ? '| route |\n| --- |\n| /books |' : '- /books')] : undefined));
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
    await app.approve(WS, 'Harness/Trigger/consistency-check');
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
      .replace(/\r?\n$/, `\n\nProposed by optimization: in ${WS}, 2 of 2 chats were corrected to drop tables; answers come in bullet points.\n`);
    return [
      move.metric(2, 1),
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
    for (const q of ['Give me an overview of the routes, as a table.', 'Compare the routes, as a table.']) {
      const chat = await app.chat(WS, q);
      await api.runEnded(chat, 2 * 60_000);
      await app.reply(chat, CORRECTION);
      await until('the corrected answer', async () => (await api.run(chat)).status === 'finished' && (await api.run(chat)).messages.length >= 4, 2 * 60_000);
    }
    const since = new Date();
    await app.approve(HARNESS, 'Harness/Trigger/optimization');
    const run = await api.automationRan(HARNESS, 'optimization', since, 3 * 60_000);
    expect(run.status).toBe('finished');
    // It was told where the projects are
    expect(model.instructions.get(run.id)).toContain(`- ${WS}: ${env.path(WS)}`);
    const [m] = await env.sql<{ misalignments: number }[]>`select misalignments from ${env.sql('ws_momentum.agent_metric')} where run_id = ${run.id} and misalignments is not null`;
    expect(m!.misalignments).toBe(2);
    const proposal = await until('the proposal in the feed', async () => (await api.feed()).items.find((i) => i.workspace === HARNESS && i.path === 'Harness/Automation/chat'));
    expect(proposal.diff).not.toBeNull();
    // Not live before it is approved
    expect(readFileSync(join(env.path(WS), '.claude', 'agents', 'momentum-chat.md'), 'utf8')).not.toContain(RULE);
  });

  await step(3, async () => {
    const chat = await api.chat(HARNESS, 'Make the consistency check answer in French.');
    await api.runEnded(chat.runId, 2 * 60_000);
    expect(env.show(HARNESS, CHECK_AGENT)).toContain(UNREVIEWED);

    await app.approve(HARNESS, 'Harness/Automation/chat');
    const materialized = join(env.path(WS), '.claude', 'agents', 'momentum-chat.md');
    await until('the approved definition in the project', async () => readFileSync(materialized, 'utf8').includes(RULE));
    await new Promise((r) => setTimeout(r, 3000));
    // Approving one definition writes every approved one again, but never a change nobody approved
    expect(readFileSync(join(env.path(WS), '.claude', 'agents', 'momentum-consistency-check.md'), 'utf8')).not.toContain(UNREVIEWED);
    expect(readFileSync(join(env.path(HARNESS), '.claude', 'agents', 'momentum-consistency-check.md'), 'utf8')).not.toContain(UNREVIEWED);
    // The unreviewed change waits for the user like any other
    expect((await api.entity(HARNESS, 'Harness/Automation/consistency-check')).verification).toBe('unverified');

    const next = await app.chat(WS, 'Name one route.');
    await api.runEnded(next, 2 * 60_000);
    expect(model.instructions.get(next)).toContain(RULE);
    const [v] = await env.sql<{ variant: string | null }[]>`select variant from ${env.sql('ws_bookshelf_api.agent_metric')} where run_id = ${next}`;
    expect(v!.variant).toBe('bullets');
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
});
