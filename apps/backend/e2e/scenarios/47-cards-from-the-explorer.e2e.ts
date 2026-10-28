import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entityText, move, type Entity } from '../support/scripted.ts';

const WS = 'todo-cli';
const kg = (p: string) => `knowledge-graph/${p}.md`;

const task = (title: string): Entity => ({ type: 'Product/DevTask', origin: 'user', title, card: `${title}.`, impact: [1, 1, 1] });
const APPROVE = { path: 'Product/DevTask/add-a-done-command', entity: task('Add a done command') };
const REWORK = { path: 'Product/DevTask/colour-the-output', entity: task('Colour the output') };
const ASK = { path: 'Product/DevTask/sort-by-due-date', entity: task('Sort by due date') };
const ISSUE = {
  path: 'Harness/Issue/help-text-disagrees',
  entity: {
    type: 'Harness/Issue',
    title: 'The help text disagrees with the README',
    card: 'The help text disagrees with the README: the documents disagree.',
    impact: [1, 1, 1],
    extra: {
      source: 'consistency-check',
      category: 'contradiction',
      severity: 'low',
      options: [
        { label: 'Follow the README', change: 'Make the help text say what the README says.' },
        { label: 'Follow the help text', change: 'Make the README say what the help text says.' },
      ],
      recommended: 0,
    },
  } satisfies Entity,
};
const COMMENT = 'Say which colours, and for what.';
const QUESTION = 'Which date counts as due?';
const ANSWER = 'The due field of each to-do.';

// An entity opened from the Explorer is the feed's card: every reaction the feed takes, it takes there, on the phone
scenario('cards-from-the-explorer', { enabled: [WS] }, async ({ env, api, app, model, step }) => {
  app.strict = true;
  const runSince = (since: Date) => until('the chat it started', async () => (await api.runs(WS, 'chat')).find((r) => r.created_at >= since));
  model.on('answers on the card', (t) => t.automation === 'chat' && (t.kind === 'prompt' || t.kind === 'message'), (t) =>
    t.target === ISSUE.path ? [move.remove(t, kg(ISSUE.path)), move.say('Applied; the issue is retired.')] : [move.say(ANSWER)],
  );
  /** The entity opened in the Explorer on its own page, its card on screen */
  const open = async (c: { path: string; entity: Entity }) => {
    await app.entity(WS, c.path);
    await expect(app.text(c.entity.title)).toBeVisible({ timeout: 30_000 });
  };

  await step(0, async () => {
    for (const c of [APPROVE, REWORK, ASK, ISSUE]) {
      env.commit(WS, { [kg(c.path)]: entityText(c.entity) }, `Add ${c.entity.title}`);
      await until(`${c.path} indexed`, async () => (await api.entity(WS, c.path).catch(() => null)) !== null, 60_000, 500);
    }
    // Swiped right it approves, and the page goes back to where it was opened from
    await open(APPROVE);
    // The same card as in the feed: its states as icons in its top right corner, named by their labels; the mic below it
    const shown = (label: string) => app.frame().getByLabel(label, { exact: true }).locator('visible=true').first();
    await expect(shown('Unverified')).toBeVisible();
    await expect(shown('Synced')).toBeVisible();
    await expect(app.frame().getByLabel('Speak', { exact: true }).locator('visible=true').first()).toBeVisible();
    const before = env.git(WS, 'rev-list', '--count', 'main');
    await app.swipeCard(APPROVE.entity.title, 'right');
    await until(`${APPROVE.path} approved`, async () => (await api.entity(WS, APPROVE.path)).verification === 'verified', 60_000);
    expect(Number(env.git(WS, 'rev-list', '--count', 'main'))).toBe(Number(before) + 1);
    await until('back from the card', async () => !decodeURIComponent(app.frame().url()).includes(APPROVE.path));
  });

  await step(1, async () => {
    // Swiped left it asks for rework, with a comment, as from the feed
    await open(REWORK);
    const since = new Date();
    await app.swipeCard(REWORK.entity.title, 'left');
    await app.sheet('Rework', COMMENT, 'Send back');
    const run = await api.run((await runSince(since)).id);
    expect(run.targetPath).toBe(REWORK.path);
    expect(run.messages[0]!.text).toContain(COMMENT);
  });

  await step(2, async () => {
    // An issue resolves with the option picked on its card
    await open(ISSUE);
    const since = new Date();
    await app.frame().getByRole('radio').nth(1).click();
    await app.swipeCard(ISSUE.entity.title, 'right');
    const run = await api.run((await runSince(since)).id);
    expect(run.targetPath).toBe(ISSUE.path);
    expect(run.messages[0]!.text).toBe('Follow the help text: Make the README say what the help text says.');
  });

  await step(3, async () => {
    // Pulled up it opens the chat on it, the whole card in the context; the answer shows below the card
    await open(ASK);
    const since = new Date();
    await app.swipeCard(ASK.entity.title, 'up');
    await app.askOnCard(WS, QUESTION);
    const run = await api.run((await runSince(since)).id);
    expect(run.targetPath).toBe(ASK.path);
    expect(run.messages[0]!.context).toEqual([{ workspace: WS, path: ASK.path, title: ASK.entity.title, heading: [] }]);
    if (!model.live) await expect(app.text(ANSWER)).toBeVisible({ timeout: 5 * 60_000 });
    await expect(app.text(ASK.entity.title)).toBeVisible();
    await expect(app.frame().getByLabel('Close chat')).toBeVisible();
  });
});
