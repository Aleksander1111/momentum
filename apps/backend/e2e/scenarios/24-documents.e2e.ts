import { readFileSync } from 'node:fs';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { move, type Turn } from '../support/scripted.ts';

const WS = 'handbook';
const LEAVE = 'Governance/Policy/leave-policy';
const REMOTE = 'Governance/Policy/remote-work';
const MEETING = 'Knowledge/HowToGuide/weekly-meeting';
const ARCHIVE = 'archive/2019-remote-policy.md';

/** The card a summarization writes: the document's bullet points, as the sub-agent would condense them */
function summarized(t: Turn, entity: string, doc: string): string {
  const file = readFileSync(t.file(`knowledge-graph/${entity}.md`), 'utf8');
  const [, front, title] = /^(---[\s\S]*?---)\r?\n# (.+)/.exec(file)!;
  const lines = readFileSync(t.file(doc), 'utf8').split(/\r?\n/);
  const opening = lines.filter((l) => l.trim() && !l.startsWith('#') && !l.startsWith('- ')).slice(0, 2);
  const bullets = lines.filter((l) => l.startsWith('- ')).slice(0, 6);
  return `${front!.replace('verification: verified', 'verification: unverified')}\n# ${title}\n\n${[...opening, ...bullets].join('\n').slice(0, 600)}\n`;
}

scenario('documents', { enabled: [WS], settings: { summarization: { exclude: ['archive/**'] } } }, async ({ env, api, model, step }) => {
  let mode: 'rewrite' | 'unchanged' | 'fail' = 'rewrite';
  let gate: Promise<void> | null = null;
  const listed = (t: Turn) => [...t.input.matchAll(/^- (\S+): (.+)$/gm)].map((m) => ({ entity: m[1]!, docs: m[2]!.split(', ') }));
  const summaries = () => api.runs(WS, 'summarization');
  const sync = async (path: string) => (await api.entity(WS, path)).sync;

  model.on('summarization of the main line', { automation: 'summarization', kind: 'prompt' }, (t) => {
    // The API refusing the run: an outage, injected at the network, live too
    if (mode === 'fail') return [move.error(400, 'Injected: the request was refused')];
    const wait = gate ? [move.gate(gate)] : [];
    if (mode === 'unchanged') return [...wait, move.say('The cards still hold.')];
    return [...wait, ...listed(t).map((e) => move.write(t, `knowledge-graph/${e.entity}.md`, summarized(t, e.entity, e.docs[0]!))), move.say('Rewritten.')];
  });

  await step(0, async () => {
    const since = new Date();
    env.commit(
      WS,
      {
        'docs/leave-policy.md': env.show(WS, 'docs/leave-policy.md')!.replace('26 days of paid holiday', '28 days of paid holiday'),
        'docs/remote-work.md': `${env.show(WS, 'docs/remote-work.md')!}\n- Remote days are agreed in the team calendar.\n`,
      },
      'Update the leave and remote work documents',
    );
    const run = await api.automationRan(WS, 'summarization', since, 10 * 60_000);
    expect(run.status).toBe('finished');
    expect(run.trigger).toBe('event');
    expect((await summaries()).filter((r) => r.created_at >= since)).toHaveLength(1);
    await until('both synced', async () => (await sync(LEAVE)) === 'synced' && (await sync(REMOTE)) === 'synced');
    // Both cards say what their documents say now, each under its title once
    const leave = (await api.entity(WS, LEAVE)).markdown;
    expect(leave).toMatch(/\b28 days\b/);
    expect(leave).not.toMatch(/\b26 days\b/);
    const remote = (await api.entity(WS, REMOTE)).markdown;
    expect(remote).toMatch(/calendar/i);
    for (const p of [LEAVE, REMOTE]) expect(env.show(WS, `knowledge-graph/${p}.md`)!.match(/^# /gm)).toHaveLength(1);
    const states = await env.sql<{ sync: string }[]>`select sync from ${env.sql('ws_handbook.entity_state')} where path = ${LEAVE} and at >= ${since} order by at`;
    expect(states.map((s) => s.sync)).toEqual(expect.arrayContaining(['artifact_ahead', 'updating', 'synced']));
  });

  await step(1, async () => {
    mode = 'unchanged';
    const since = new Date();
    env.commit(WS, { 'docs/meetings.md': `${env.show(WS, 'docs/meetings.md')!}\n\n` }, 'Tidy the meetings document');
    const run = await api.automationRan(WS, 'summarization', since, 10 * 60_000);
    expect(run.status).toBe('finished');
    await until('the guide synced', async () => (await sync(MEETING)) === 'synced', 30_000);
  });

  await step(2, async () => {
    mode = 'fail';
    const since = new Date();
    env.commit(WS, { 'docs/meetings.md': env.show(WS, 'docs/meetings.md')!.replace(/Tuesday/g, 'Wednesday') }, 'Move the meeting to Wednesday');
    const failed = await api.automationRan(WS, 'summarization', since, 5 * 60_000);
    expect(failed.status).toBe('failed');
    await until('the guide behind its document', async () => (await sync(MEETING)) === 'artifact_ahead', 30_000);
    mode = 'rewrite';
    const again = new Date();
    env.commit(WS, { 'docs/meetings.md': `${env.show(WS, 'docs/meetings.md')!}\n- Notes go in the shared folder.\n` }, 'Say where the notes go');
    expect((await api.automationRan(WS, 'summarization', again, 10 * 60_000)).status).toBe('finished');
    await until('the guide synced', async () => (await sync(MEETING)) === 'synced', 30_000);
    // Both edits reached the card: the day it failed over, and the one after
    const guide = (await api.entity(WS, MEETING)).markdown;
    expect(guide).toMatch(/shared folder/i);
    expect(guide).toMatch(/Wednesday/);
  });

  await step(3, async () => {
    let open!: () => void;
    gate = new Promise<void>((r) => (open = r));
    const since = new Date();
    const doc = () => env.show(WS, 'docs/leave-policy.md')!;
    env.commit(WS, { 'docs/leave-policy.md': doc().replace('28 days of paid holiday', '29 days of paid holiday') }, 'Raise holidays to 29 days');
    const first = await until('the first rewrite under way', async () => (await summaries()).find((r) => r.created_at >= since && model.turns(r.id).length > 0), 2 * 60_000);
    env.commit(WS, { 'docs/leave-policy.md': doc().replace('29 days of paid holiday', '30 days of paid holiday') }, 'Raise holidays to 30 days');
    await until('the second edit noticed', async () => (await summaries()).filter((r) => r.created_at >= since).length === 2, 60_000);
    gate = null;
    open();
    await until('both rewrites done', async () => (await summaries()).filter((r) => r.created_at >= since).every((r) => r.status === 'finished'), 15 * 60_000);
    const [second] = (await summaries()).filter((r) => r.created_at >= since && r.id !== first.id);
    // One at a time: the second started once the first had landed
    expect(+second!.started_at!).toBeGreaterThanOrEqual(+(await summaries()).find((r) => r.id === first.id)!.ended_at!);
    await until('the card on the latest', async () => /\b30 days\b/.test((await api.entity(WS, LEAVE)).markdown) && (await sync(LEAVE)) === 'synced', 60_000);
    expect((await api.entity(WS, LEAVE)).markdown).not.toMatch(/\b29 days\b/);
  });

  await step(4, async () => {
    model.on('a chat edits two documents', (t) => t.automation === 'chat' && t.kind === 'prompt' && /archive/.test(t.input), (t) => [
      move.write(t, ARCHIVE, `${readFileSync(t.file(ARCHIVE), 'utf8')}\nNote: superseded in 2021.\n`),
      move.write(t, 'docs/onboarding.md', `${readFileSync(t.file('docs/onboarding.md'), 'utf8')}\n- Bring an ID on day one.\n`),
      move.say('Edited.'),
    ]);
    const { runId } = await api.chat(
      WS,
      `Edit these two files and nothing else: append the line "Note: superseded in 2021." to ${ARCHIVE}, and append the bullet "- Bring an ID on day one." to docs/onboarding.md.`,
    );
    expect((await api.runEnded(runId, 10 * 60_000)).status).toBe('finished');
    const asked = model.turns(runId).find((t) => t.kind === 'summarize')!.input;
    expect(asked).toMatch(/^- docs\/onboarding\.md \(changed/m);
    expect(asked).not.toContain(ARCHIVE);
    expect(env.show(WS, ARCHIVE)).toMatch(/superseded/i);
    expect(env.show(WS, 'docs/onboarding.md')).toMatch(/bring an ID/i);
  });

  await step(5, async () => {
    // A run that stops without its summarization step leaves the document it changed to be summarized after it lands
    model.on('a chat that skips summarizing', (t) => t.automation === 'chat' && /calendar invite/.test(t.inputs[0] ?? ''), (t) => {
      if (t.kind === 'prompt') {
        const doc = readFileSync(t.file('docs/remote-work.md'), 'utf8');
        return [move.write(t, 'docs/remote-work.md', `${doc}\n- A remote day needs a calendar invite.\n`), move.say('Edited.')];
      }
      return t.kind === 'summarize' ? [move.say('Done.')] : undefined;
    });
    const since = new Date();
    const { runId } = await api.chat(WS, 'Add to docs/remote-work.md that a remote day needs a calendar invite.');
    expect((await api.runEnded(runId, 10 * 60_000)).status).toBe('finished');
    expect(env.show(WS, 'docs/remote-work.md')).toMatch(/calendar invite/);
    const run = await api.automationRan(WS, 'summarization', since, 10 * 60_000);
    expect(run.status).toBe('finished');
    expect(model.turns(run.id)[0]!.input).toMatch(/^- Governance\/Policy\/remote-work: docs\/remote-work\.md/m);
    await until('the policy synced', async () => (await sync(REMOTE)) === 'synced', 60_000);
    const states = await env.sql<{ sync: string }[]>`select sync from ${env.sql('ws_handbook.entity_state')} where path = ${REMOTE} and at >= ${since} order by at`;
    expect(states.map((s) => s.sync)).toEqual(expect.arrayContaining(['artifact_ahead', 'synced']));
  });
});
