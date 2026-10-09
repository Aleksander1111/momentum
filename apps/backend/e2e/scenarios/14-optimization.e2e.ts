import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';

const WS = 'bookshelf-api';
const HARNESS = 'momentum';
const CORRECTION = 'Never answer with a table; use short bullet points.';

// Optimization runs in the harness workspace, where the definitions live, over every enabled project
scenario('optimization', { enabled: [WS, HARNESS] }, async ({ env, api, app, step, note }) => {
  await step(0, async () => {
    expect((await api.entities(WS, 'Harness/Trigger')).map((t) => t.path)).not.toContain('Harness/Trigger/optimization');
    const correctedChat = async (q: string) => {
      const chat = await app.chat(WS, q);
      expect((await api.runEnded(chat)).status).toBe('finished');
      await app.reply(chat, CORRECTION);
      await until('the corrected answer', async () => {
        const r = await api.run(chat);
        return r.messages.filter((m) => m.role === 'assistant').length >= 2 && r.status === 'finished';
      }, 15 * 60_000);
    };
    for (const q of ['Give me an overview of the routes, as a table.', 'Compare the routes by method and path, as a table.']) await correctedChat(q);
    // Twice is not enough: no change is proposed, a pattern at most stands from its first sighting, counted below three
    let since = new Date();
    // Switched on now: its schedule is due at once
    await env.trigger(HARNESS, 'optimization');
    const first = await api.automationRan(HARNESS, 'optimization', since, 60 * 60_000);
    expect(first.status).toBe('finished');
    const early = (await api.feed()).items.filter((i) => i.workspace === HARNESS && i.type === 'Harness/Automation');
    expect(early.map((i) => i.path), 'no change proposed from two chats').toEqual([]);
    for (const p of await api.entities(HARNESS, 'Harness/Pattern')) expect(Number(p.frontmatter.seen), `${p.path} seen`).toBeLessThan(3);
    // The third time it is
    await correctedChat('List the routes with what each returns, as a table.');
    since = new Date();
    await api.runAutomation(HARNESS, 'optimization');
    const run = await api.automationRan(HARNESS, 'optimization', since, 60 * 60_000);
    expect(run.status).toBe('finished');
    const patterns = (await api.feed()).items.filter((i) => i.workspace === HARNESS && i.type === 'Harness/Pattern');
    expect(patterns.length, 'the pattern proposed with its evidence').toBeGreaterThan(0);
    const [m] = await env.sql<{ misalignments: number | null }[]>`
      select misalignments from ${env.sql('ws_momentum.agent_metric')} where run_id = ${run.id} and misalignments is not null`;
    expect(m!.misalignments).toBeGreaterThan(0);
    const proposals = (await api.feed()).items.filter((i) => i.workspace === HARNESS && i.type === 'Harness/Automation');
    expect(proposals.length, 'a definition change proposed in the harness').toBeGreaterThan(0);
    const card = (await api.entity(HARNESS, proposals[0]!.path)).markdown;
    await note(`Proposed: ${proposals.map((p) => p.path).join(', ')}`);
    expect(card.length).toBeGreaterThan(0);
  });

  await step(1, async () => {
    const proposal = (await api.feed()).items.find((i) => i.workspace === HARNESS && i.type === 'Harness/Automation')!;
    const name = proposal.path.split('/').pop()!;
    // In effect as it landed: the user's approval is their review, not what puts it to work
    const agents = (await api.entity(HARNESS, proposal.path)).artifacts.map((a) => a.path).filter((p) => p.startsWith(`automations/${name}/agents/`));
    for (const a of agents) {
      const target = join(env.path(WS), '.claude', a.slice(`automations/${name}/`.length));
      await until(`${a} materialized in ${WS}`, async () => readFileSync(target, 'utf8').trim() === env.show(HARNESS, a));
    }
    await app.approve(HARNESS, proposal.path);

    // A variant on the chat definition is recorded on the next chat's metrics
    const file = 'knowledge-graph/Harness/Automation/chat.md';
    // The user names a variant of their own, in place of any the approved proposal set
    const definition = env.show(HARNESS, file)!.replace(/^variant: .*\r?\n/m, '');
    env.commit(HARNESS, { [file]: definition.replace(/^artifacts:/m, 'variant: concise\nartifacts:') }, 'Try a concise chat');
    const chat = await app.chat(WS, 'Name one route. One word.');
    expect((await api.runEnded(chat)).status).toBe('finished');
    const [v] = await env.sql<{ variant: string | null }[]>`select variant from ${env.sql('ws_bookshelf_api.agent_metric')} where run_id = ${chat}`;
    expect(v!.variant).toBe('concise');
  });
});
