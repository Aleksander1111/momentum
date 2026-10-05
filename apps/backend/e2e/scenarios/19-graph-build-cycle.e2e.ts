import type { TimelineResponse } from '@momentum/contract';
import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { move } from '../support/scripted.ts';

const WS = 'todo-cli';
// Every default trigger but optimization's waits in the feed once the project is enabled: one item of room is left
const TRIGGERS = 8;
const FEED = TRIGGERS + 1;

const component = (name: string, title: string, card: string, artifacts: string[]) => ({
  type: 'Architecture/Component',
  title,
  card,
  artifacts,
  impact: [2, 1, 1] as [number, number, number],
});

scenario('graph-build-cycle', { settings: { feedSize: FEED } }, async ({ env, api, app, model, step }) => {
  const builds = () => api.runs(WS, 'graph-build');
  /** What the build wrote that waits for the user: the feed shows as many items as its size, so the index says */
  const written = async () => (await api.entities(WS)).filter((e) => e.type !== 'Harness/Trigger' && e.verification === 'unverified').map((e) => e.path);
  /**
   * Approves what the build wrote so far, one item at a time as the feed shows it: a full feed shows as many items as its
   * size, so an item may come into it only once another left
   */
  const approveWritten = async () => {
    const pending = await written();
    while (pending.length) {
      const next = await until('a written item in the feed', async () => {
        const feed = (await api.feed()).items.map((i) => i.path);
        return pending.find((p) => feed.includes(p));
      }, 60_000);
      await app.approve(WS, next);
      pending.splice(pending.indexOf(next), 1);
    }
  };
  // The API refusing every request, or never answering: faults at the network, injected live too
  let failing = false;
  let hanging = false;
  let progress = '';

  model.on('graph build', { automation: 'graph-build', kind: 'prompt' }, (t) => {
    if (failing) return [move.error(400, 'Injected: the request was refused')];
    if (hanging) return [move.hang()];
    if (/first graph build run/.test(t.input)) {
      return [
        move.entity(t, 'Architecture/Component/store', component('store', 'Store', 'Reads and writes the to-dos in one JSON file.', ['src/store.js'])),
        move.graphBuild({ complete: false, progress: 'Covered src/store.js; next: the CLI.', coverage: 0.4, documents: ['README.md'] }),
        move.say('Mapped the store.'),
      ];
    }
    if (/Covered src\/store\.js; next: the CLI/.test(t.input)) {
      return [
        move.entity(t, 'Architecture/Component/cli', component('cli', 'Command line', 'Parses `add`, `list`, `done` and `remove` and calls the store.', ['src/cli.js'])),
        move.graphBuild({ complete: false, progress: 'Covered the store and the CLI; next: the tests.', coverage: 0.7 }),
        move.say('Mapped the CLI.'),
      ];
    }
    return [
      move.entity(t, 'Knowledge/HowToGuide/run-the-tests', { type: 'Knowledge/HowToGuide', title: 'Run the tests', card: '`node --test` runs `test/store.test.js`.', artifacts: ['test/store.test.js'] }),
      move.graphBuild({ complete: true, progress: 'Covered the whole repository.', coverage: 1 }),
      move.say('Done mapping.'),
    ];
  });
  model.on('summarizes what the build listed', { automation: 'graph-build', kind: 'summarize' }, (t) =>
    /README\.md \(to map\)/.test(t.input)
      ? [
          move.entity(t, 'Product/Product/todo-cli', { type: 'Product/Product', title: 'todo-cli', card: 'A to-do list kept from the terminal.', artifacts: ['README.md'] }),
          move.say('Summarized.'),
        ]
      : undefined,
  );

  await step(0, async () => {
    await app.setProject(WS, true);
    const first = await api.automationRan(WS, 'graph-build', new Date(0), 15 * 60_000);
    expect(first.status).toBe('finished');
    expect(model.turns(first.id)[0]!.input).toContain('room for 1 more items');
    expect((await written()).length).toBeGreaterThan(0);
    expect(graphIssues(env, WS)).toEqual([]);
    // The documents the run listed were handed to summarization, and are artifacts of entities on the main line
    const asked = model.turns(first.id).find((t) => t.kind === 'summarize')?.input ?? '';
    const documents = [...asked.matchAll(/^- (\S+) \(to map/gm)].map((m) => m[1]!);
    expect(documents.length, 'documents listed by the build').toBeGreaterThan(0);
    const artifacts = (await env.sql<{ artifact_path: string }[]>`select artifact_path from ${env.sql('ws_todo_cli.entity_artifact')}`).map((a) => a.artifact_path);
    expect(artifacts).toEqual(expect.arrayContaining(documents));
    // Partly covered, with the progress the next run starts from
    const status = await api.graphBuild(WS);
    expect(status.state).toBe('building');
    expect(status.coverage).toBeGreaterThan(0);
    expect(status.coverage).toBeLessThan(1);
    expect(status.progress).toBeTruthy();
    progress = status.progress!;
  });

  await step(1, async () => {
    expect((await api.feed()).items.length).toBeGreaterThanOrEqual(FEED);
    await new Promise((r) => setTimeout(r, 10_000));
    expect(await builds()).toHaveLength(1);
    await approveWritten();
    const [second] = await until('the next build run', async () => ((await builds()).length === 2 ? builds() : null), 2 * 60_000);
    const ended = await api.runEnded(second!.id, 15 * 60_000);
    expect(ended.status).toBe('finished');
    const prompt = model.turns(second!.id)[0]!.input;
    expect(prompt).toContain('Progress reported by the previous graph build run');
    expect(prompt).toContain(progress);
    expect(prompt).toContain('room for 1 more items');
    // Still more to map: the build goes on once there is room again
    expect((await api.graphBuild(WS)).state).toBe('building');
  });

  await step(2, async () => {
    hanging = true;
    await approveWritten();
    const run = await until('a build run in progress', async () => (await builds()).find((r) => r.status === 'running' && model.turns(r.id).length > 0), 2 * 60_000);
    await app.tab('Settings');
    await app.text('Stop').click();
    expect((await api.runEnded(run.id, 60_000)).status).toBe('killed');
    expect((await api.graphBuild(WS)).state).toBe('stopped');
    await new Promise((r) => setTimeout(r, 8000));
    expect((await builds()).filter((r) => r.status === 'queued' || r.status === 'running')).toEqual([]);
    hanging = false;
    failing = true;
    await app.text('Resume').click();
    await until('building again', async () => (await api.graphBuild(WS)).state === 'building');
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&actor=user`);
    expect(events.map((e) => e.kind)).toEqual(expect.arrayContaining(['graph_build_stopped', 'graph_build_started']));
  });

  await step(3, async () => {
    await until('the build to give up', async () => (await api.graphBuild(WS)).state === 'stopped', 3 * 60_000);
    await new Promise((r) => setTimeout(r, 8000));
    const failed = (await builds()).filter((r) => r.status === 'failed');
    expect(failed).toHaveLength(3);
    expect((await builds()).filter((r) => r.status === 'queued' || r.status === 'running')).toEqual([]);
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&limit=50`);
    const stopped = events.find((e) => e.kind === 'graph_build_stopped' && e.actor !== 'user');
    expect(stopped?.title).toMatch(/3 runs .*failed/i);
  });

  await step(4, async () => {
    failing = false;
    // Room for the rest of the build
    await api.putSettings({ feedSize: 40 });
    await api.call('PUT', `/workspaces/${WS}/graph-build`, { building: true });
    await until('the build to complete', async () => (await api.graphBuild(WS)).state === 'complete', 20 * 60_000, 5000);
    const status = await api.graphBuild(WS);
    expect(status.coverage).toBe(1);
    expect(status.estimate).not.toBeNull();
    // At least one entity from each run that got to write
    expect(status.entities).toBeGreaterThanOrEqual(3);
    expect(status.activeRunId).toBeNull();
    await new Promise((r) => setTimeout(r, 8000));
    expect((await builds()).filter((r) => r.status === 'queued' || r.status === 'running')).toEqual([]);
    expect(graphIssues(env, WS)).toEqual([]);
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&limit=50`);
    expect(events.some((e) => e.kind === 'graph_build_complete')).toBe(true);
    const m = await api.metrics(WS);
    expect(m.agents.automations.find((a) => a.automation === 'graph-build')?.runs.value).toBe((await builds()).length);
  });
});
