import type { TimelineResponse } from '@momentum/contract';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entityText, move, type Entity } from '../support/scripted.ts';

const HANDBOOK = 'handbook';
const TODO = 'todo-cli';
const kg = (p: string) => `knowledge-graph/${p}.md`;

const task = (title: string, impact: [number, number, number]): Entity => ({ type: 'Product/DevTask', origin: 'user', title, card: `${title}.`, impact });
const issue = (title: string, impact: [number, number, number]): Entity => ({
  type: 'Harness/Issue',
  title,
  card: `${title}: the documents disagree.`,
  impact,
  extra: {
    source: 'consistency-check',
    category: 'contradiction',
    severity: 'medium',
    options: [
      { label: 'Follow the policy', change: 'Make the guide say what the policy says.' },
      { label: 'Follow the guide', change: 'Make the policy say what the guide says.' },
    ],
    recommended: 0,
  },
});

/** The morning's cards, top first: two of equal rank in two projects, three issues, then a task to send back */
const CARDS = [
  { ws: HANDBOOK, path: 'Product/DevTask/update-the-holiday-table', entity: task('Update the holiday table', [5, 5, 3]) },
  { ws: TODO, path: 'Product/DevTask/release-1-2', entity: task('Release 1.2', [4, 5, 4]) },
  { ws: HANDBOOK, path: 'Harness/Issue/remote-days-disagree', entity: issue('Remote days disagree', [5, 4, 3]) },
  { ws: TODO, path: 'Harness/Issue/usage-text-disagrees', entity: issue('The usage text disagrees with the README', [4, 4, 3]) },
  { ws: HANDBOOK, path: 'Harness/Issue/meeting-day-disagrees', entity: issue('The meeting day disagrees', [4, 3, 3]) },
  { ws: TODO, path: 'Product/DevTask/rename-the-list-command', entity: task('Rename the list command', [3, 3, 3]) },
] as const;
const [HOLIDAYS, RELEASE, REMOTE, USAGE, MEETING, RENAME] = CARDS;
const OWN = 'Keep both: the README shows the short form, the usage text the long one. Say so in both.';
const WONT = 'The meeting moved last week; the guide is being rewritten anyway.';
const COMMENT = 'Too vague: say which command and what it becomes.';

// The user goes through the feed on the phone: every reaction is made on the card, none through the API
scenario('feed-in-the-app', { enabled: [HANDBOOK, TODO] }, async ({ env, api, app, model, step }) => {
  app.strict = true;
  const inFeed = async (c: (typeof CARDS)[number]) => (await api.feed()).items.some((i) => i.workspace === c.ws && i.path === c.path);
  const gone = (c: (typeof CARDS)[number]) => until(`${c.path} out of the feed`, async () => !(await inFeed(c)), 5 * 60_000);
  // Chats resolving an issue apply the resolution and retire the issue, as the chat definition says
  model.on('resolves the issue', (t) => t.automation === 'chat' && t.kind === 'prompt' && !!t.target?.startsWith('Harness/Issue/'), (t) => [
    move.remove(t, kg(t.target!)),
    move.say('Applied; the issue is retired.'),
  ]);

  await step(0, async () => {
    // Each card comes in on its own commit, in this order: equal ranks keep it
    for (const c of CARDS) {
      env.commit(c.ws, { [kg(c.path)]: entityText(c.entity) }, `Add ${c.entity.title}`);
      await until(`${c.path} in the feed`, () => inFeed(c), 60_000, 500);
    }
    const items = (await api.feed()).items;
    const order = items.map((i) => `${i.workspace}:${i.path}`);
    expect(order.slice(0, CARDS.length)).toEqual(CARDS.map((c) => `${c.ws}:${c.path}`));
    // The rank is the three numbers summed, whatever the project: the two projects' first cards tie and keep their order
    for (const c of CARDS) {
      const item = items.find((i) => i.path === c.path && i.workspace === c.ws)!;
      expect(item.rank).toBe(c.entity.impact!.reduce((a, b) => a + b, 0));
    }
    expect(items[0]!.rank).toBe(items[1]!.rank);
    expect(new Set(items.slice(0, 2).map((i) => i.workspace))).toEqual(new Set([HANDBOOK, TODO]));
    // Below them, the projects' default triggers, ranked the same way
    expect(items.slice(CARDS.length).every((i) => i.rank <= items[CARDS.length - 1]!.rank)).toBe(true);
    await app.tab('Feed');
    await expect(app.text(HOLIDAYS.entity.title)).toBeVisible();
  });

  await step(1, async () => {
    for (const c of [HOLIDAYS, RELEASE]) {
      const before = env.git(c.ws, 'rev-list', '--count', 'main');
      await app.approve(c.ws, c.path);
      expect((await api.entity(c.ws, c.path)).verification).toBe('verified');
      expect(Number(env.git(c.ws, 'rev-list', '--count', 'main'))).toBe(Number(before) + 1);
    }
  });

  await step(2, async () => {
    const chat = await app.resolve(REMOTE.ws, REMOTE.path, 0);
    const run = await api.run(chat);
    expect(run.targetPath).toBe(REMOTE.path);
    expect(run.messages[0]!.text).toBe('Follow the policy: Make the guide say what the policy says.');
    expect((await api.runEnded(chat, 5 * 60_000)).status).toBe('finished');
    await gone(REMOTE);
    expect(env.show(REMOTE.ws, kg(REMOTE.path))).toBeNull();
  });

  await step(3, async () => {
    const chat = await app.ownResolution(USAGE.ws, USAGE.path, OWN);
    expect((await api.run(chat)).messages[0]!.text).toBe(OWN);
    expect((await api.runEnded(chat, 5 * 60_000)).status).toBe('finished');
    await gone(USAGE);
    await app.wontResolve(MEETING.ws, MEETING.path, WONT);
    const closed = await api.entity(MEETING.ws, MEETING.path);
    expect(closed.verification).toBe('verified');
    expect(env.show(MEETING.ws, kg(MEETING.path))).toContain(`wont_resolve: ${WONT}`);
  });

  await step(4, async () => {
    const chat = await app.sendBack(RENAME.ws, RENAME.path, COMMENT);
    const run = await api.run(chat);
    expect(run.targetPath).toBe(RENAME.path);
    expect(run.messages[0]!.text).toContain(COMMENT);
    await api.runEnded(chat, 5 * 60_000);
    // Every reaction went through the app, and each is on the timeline as the user's
    expect(app.throughApi).toEqual([]);
    const { events } = await api.call<TimelineResponse>('GET', '/timeline?actor=user&limit=100');
    const kinds = events.map((e) => e.kind);
    for (const kind of ['approved', 'sent_back'] as const) expect(kinds).toContain(kind);
    expect(events.filter((e) => e.kind === 'approved').length).toBeGreaterThanOrEqual(2);
  });
});
