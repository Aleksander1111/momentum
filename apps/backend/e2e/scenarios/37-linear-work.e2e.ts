import type { TimelineResponse } from '@momentum/contract';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entitiesOf } from '../support/landed.ts';
import { entityText, move } from '../support/scripted.ts';

const WS = 'todo-cli';
const FEATURE = 'Product/Feature/due-dates';

// Momentum works on one line, one change after another: the harness refuses anything else
scenario('linear-work', {}, async ({ env, api, app, model, step }) => {
  const enable = () => api.call('PUT', '/settings', { projects: [{ name: WS, enabled: true }] });
  const enabled = async () => (await api.settings()).projects.find((p) => p.name === WS)?.enabled === true;
  const switchedOff = async (why: RegExp) => {
    await until('the project switched off', async () => !(await enabled()), 60_000);
    const { events } = await api.call<TimelineResponse>('GET', `/timeline?workspace=${WS}&actor=harness&limit=20`);
    const off = events.find((e) => e.kind === 'project_disabled');
    expect(off?.title).toBe(`Disabled ${WS}: it is not one straight line`);
    expect(off?.detail).toMatch(why);
  };
  const branches = () => env.git(WS, 'for-each-ref', '--format=%(refname:short)', 'refs/heads').split('\n').filter(Boolean);

  model.on('a chat writes a feature', (t) => t.automation === 'chat' && t.kind === 'prompt' && /due dates/.test(t.input), (t) => [
    move.write(t, `knowledge-graph/${FEATURE}.md`, entityText({ type: 'Product/Feature', origin: 'requested', title: 'Due dates', card: 'A to-do can carry a due date; `list` shows overdue ones first.' })),
    move.say('Added.'),
  ]);
  model.on('a chat answers', (t) => t.automation === 'chat' && t.kind === 'prompt' && /todo list/.test(t.input), () => [move.say('It prints "Nothing to do."')]);

  await step(0, async () => {
    env.git(WS, 'branch', 'experiment');
    await expect(enable()).rejects.toMatchObject({ status: 409, message: expect.stringContaining('experiment') });
    expect(await enabled()).toBe(false);
    env.git(WS, 'branch', '-D', 'experiment');
    await app.setProject(WS, true);
    await api.call('PUT', `/workspaces/${WS}/graph-build`, { building: false });
  });

  await step(1, async () => {
    env.git(WS, 'branch', 'hotfix');
    await switchedOff(/a branch besides main: hotfix/);
    // Nothing of it runs while it is not one line
    const { runId } = await api.chat(WS, 'What does `todo list` print when there are no to-dos?');
    await new Promise((r) => setTimeout(r, 8000));
    expect((await api.run(runId)).status).toBe('queued');
    expect((await api.feed()).items.some((i) => i.workspace === WS)).toBe(false);
    env.git(WS, 'branch', '-D', 'hotfix');
    await enable();
    expect((await api.runEnded(runId, 10 * 60_000)).status).toBe('finished');
    // The build the user stopped stays stopped through the switch off and on
    expect((await api.graphBuild(WS)).state).toBe('stopped');

    env.git(WS, 'checkout', '-q', '--detach');
    await switchedOff(/HEAD is detached/);
    await expect(enable()).rejects.toMatchObject({ status: 409, message: expect.stringContaining('detached') });
    env.git(WS, 'checkout', '-q', 'main');
    await enable();
  });

  await step(2, async () => {
    // A merge commit, made without any branch: two parents on the line
    const tree = env.git(WS, 'rev-parse', 'main^{tree}');
    const merge = env.git(WS, 'commit-tree', tree, '-p', 'main', '-p', 'main~1', '-m', 'Merge something');
    env.git(WS, 'update-ref', 'refs/heads/main', merge);
    await switchedOff(/merge commits landed on main/);
    // The merge is history now: enabled again, the project goes on from here
    await enable();
    await new Promise((r) => setTimeout(r, 8000));
    expect(await enabled()).toBe(true);
  });

  await step(3, async () => {
    const since = env.head(WS);
    const { runId } = await api.chat(WS, 'Write down a Product/Feature entity for due dates on to-dos: a to-do can carry a due date and `list` shows overdue ones first. Do not implement it.');
    expect((await api.runEnded(runId, 10 * 60_000)).status).toBe('finished');
    const features = (await entitiesOf(env, WS, runId)).filter((p) => p.startsWith('Product/Feature/'));
    expect(features, 'the feature the chat wrote').toHaveLength(1);
    await app.approve(WS, features[0]!);
    await api.idle(WS, 10 * 60_000);
    expect(branches()).toEqual(['main']);
    expect(env.git(WS, 'rev-list', '--merges', `${since}..main`)).toBe('');
    expect(env.git(WS, 'worktree', 'list').split('\n')).toHaveLength(1);
    expect(await enabled()).toBe(true);
  });
});
