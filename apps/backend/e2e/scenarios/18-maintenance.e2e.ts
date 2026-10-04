import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entityText, move } from '../support/scripted.ts';

const WS = 'handbook';
const REMOTE = 'Governance/Policy/remote-work';
const ONBOARDING = 'Knowledge/HowToGuide/onboarding';
const GUIDE = 'Knowledge/HowToGuide/weekly-meeting';
const MEETINGS = 'Governance/Policy/weekly-meetings';
const CONTRADICTION = 'Harness/Issue/remote-days-disagree';
const CLASH = 'Harness/Issue/two-weekly-meetings';
const TASK = 'Product/DevTask/migrate-handbook-to-markdown';
const SURVEY = 'Harness/Research/survey-on-remote-work-preferences';
const DECISION = 'Governance/Decision/hybrid-days';
const RETIRE = 'Harness/Plan/retire-spent-entities';
const LIFETIME = { type: 'Harness/Research', rule: '30 days after delivered, unless referenced' };

const issue = (title: string, card: string, category: string, concerns: string[], options: { label: string; change: string }[]) => ({
  type: 'Harness/Issue',
  title,
  card,
  impact: [3, 2, 2] as [number, number, number],
  references: concerns.map((to) => ({ to, relation: 'concerns' })),
  extra: { source: 'consistency-check', category, severity: 'medium', options, recommended: 0 },
});

// The consistency check trigger is approved: its schedule is due at once
scenario('maintenance', { enabled: [WS], triggers: ['consistency-check'] }, async ({ env, api, app, model, step }) => {
  const file = (path: string) => `knowledge-graph/${path}.md`;
  const open = async () => (await api.metrics(WS)).implementation.outstandingIssues.value;

  model.on('consistency check', { automation: 'consistency-check', kind: 'prompt' }, (t) => [
    move.entity(
      t,
      CONTRADICTION,
      issue(
        'Remote days disagree',
        'The remote work policy allows 3 remote days a week; the onboarding guide says at most 2.',
        'contradiction',
        [ONBOARDING, REMOTE],
        [
          { label: 'Follow the policy', change: 'The onboarding guide says up to 3 remote days, as the policy does.' },
          { label: 'Follow the guide', change: 'The policy allows 2 remote days.' },
        ],
      ),
    ),
    move.entity(
      t,
      CLASH,
      issue('Two weekly meetings', 'A guide and a policy are both called "Weekly meeting(s)".', 'naming', [GUIDE, MEETINGS], [
        { label: 'Rename the guide', change: 'Call the guide "Running the weekly meeting".' },
        { label: 'Merge them', change: 'Fold the guide into the policy.' },
      ]),
    ),
    move.metric(0, 2),
    move.say('Two issues filed.'),
  ]);
  model.on('the chat applies the option', (t) => t.automation === 'chat' && t.target === CONTRADICTION && t.kind === 'prompt', (t) => [
    move.write(t, 'docs/onboarding.md', env.show(WS, 'docs/onboarding.md')!.replace(/at most 2 days/g, 'up to 3 days')),
    move.write(t, file(ONBOARDING), env.show(WS, file(ONBOARDING))!.replace('verification: verified', 'verification: unverified').replace('at most 2 days', 'up to 3 days')),
    move.remove(t, file(CONTRADICTION)),
    move.say('The guide follows the policy now.'),
  ]);
  model.on('retention', { automation: 'retention', kind: 'prompt' }, (t) => [
    move.entity(t, RETIRE, {
      type: 'Harness/Plan',
      title: 'Retire the migration task and the survey',
      card: 'The migration task was resolved on 2025-01-15 and the survey delivered on 2025-02-01; both are past their lifetime.',
      impact: [1, 0, 0],
      references: [
        { to: TASK, relation: 'retires' },
        { to: SURVEY, relation: 'retires' },
      ],
    }),
    move.say('Proposed one retirement.'),
  ]);

  await step(0, async () => {
    const start = env.head(WS);
    const run = await api.automationRan(WS, 'consistency-check', new Date(0), 5 * 60_000);
    expect(run.status).toBe('finished');
    const feed = (await api.feed()).items;
    const contradiction = feed.find((i) => i.path === CONTRADICTION)!;
    expect(contradiction.issue!.options).toHaveLength(2);
    expect(contradiction.issue!.recommended).toBe(0);
    expect(contradiction.issue!.concerns).toEqual([ONBOARDING, REMOTE]);
    expect(feed.some((i) => i.path === CLASH)).toBe(true);
    expect((await api.entity(WS, REMOTE)).contradictions).toBe(1);
    const changed = env.git(WS, 'diff', '--name-only', start, 'main').split('\n');
    expect(changed.sort()).toEqual([file(CLASH), file(CONTRADICTION)].sort());
    const [m] = await env.sql<{ recurring_issues: number }[]>`select recurring_issues from ${env.sql('ws_handbook.agent_metric')} where run_id = ${run.id} and recurring_issues is not null`;
    expect(m!.recurring_issues).toBe(2);
    expect(await open()).toBe(2);
  });

  await step(1, async () => {
    const chat = await app.resolve(WS, CONTRADICTION, 0);
    const run = await api.run(chat);
    expect(run.targetPath).toBe(CONTRADICTION);
    expect(run.messages[0]!.text).toBe('Follow the policy: The onboarding guide says up to 3 remote days, as the policy does.');
    expect((await api.runEnded(chat, 5 * 60_000)).status).toBe('finished');
    expect(env.show(WS, file(CONTRADICTION))).toBeNull();
    expect(env.show(WS, 'docs/onboarding.md')).toContain('up to 3 days');
    expect((await api.entity(WS, REMOTE)).contradictions).toBe(0);
    const guide = await until('the changed guide in the feed', async () => (await api.feed()).items.find((i) => i.path === ONBOARDING && i.diff));
    expect(guide.verification).toBe('unverified');
    // The guide changed with its document: nothing is left to summarize
    await new Promise((r) => setTimeout(r, 6000));
    expect(await api.runs(WS, 'summarization')).toEqual([]);
    expect(await open()).toBe(1);
  });

  await step(2, async () => {
    await app.wontResolve(WS, CLASH, 'One is the policy, the other how to run it; both names stay.');
    const clash = await api.entity(WS, CLASH);
    expect(clash.verification).toBe('verified');
    expect(env.show(WS, file(CLASH))).toContain('wont_resolve: One is the policy');
    await until('no issue counted open', async () => (await open()) === 0);
    expect((await api.metrics(WS)).understanding.openIssues.value).toBe(0);
  });

  await step(3, async () => {
    // A new decision, made by hand, still relies on the survey
    env.commit(
      WS,
      {
        [file(DECISION)]: entityText({
          type: 'Governance/Decision',
          origin: 'user',
          verification: 'verified',
          title: 'Three remote days',
          card: 'Everyone may work remotely up to 3 days a week, as most of the team asked in the survey.',
          references: [{ to: SURVEY, relation: 'based_on' }],
        }),
      },
      'Decide on three remote days',
    );
    await app.tab('Settings');
    const settings = await api.settings();
    await api.putSettings({ lifetimes: [...settings.lifetimes.filter((l) => l.type !== LIFETIME.type), LIFETIME] });
    expect((await api.settings()).lifetimes).toContainEqual(LIFETIME);
    const since = new Date();
    await app.approve(WS, 'Harness/Trigger/retention');
    const run = await api.automationRan(WS, 'retention', since, 5 * 60_000);
    expect(run.status).toBe('finished');
    expect(model.instructions.get(run.id)).toContain(`${LIFETIME.type}: ${LIFETIME.rule}`);
    await app.approve(WS, RETIRE);
    expect(env.show(WS, file(TASK))).toBeNull();
    // Retiring the survey would break the decision's reference: it stays, and the commit says why
    expect(env.show(WS, file(SURVEY))).not.toBeNull();
    expect(env.git(WS, 'log', '-1', '--format=%B', 'main')).toContain(`Keep ${SURVEY}`);
    expect(graphIssues(env, WS)).toEqual([]);
    // Carried out, the plan went with them: nothing is left to implement
    expect(env.show(WS, file(RETIRE))).toBeNull();
  });

  await step(4, async () => {
    const before = (await api.metrics(WS)).understanding.consistency.value;
    expect(before).toBe(1);
    env.commit(WS, { [file(GUIDE)]: null }, 'Drop the weekly meeting guide');
    await until('the guide gone from the index', async () => !(await api.entities(WS)).some((e) => e.path === GUIDE));
    // The onboarding guide and the product still point at it
    await until('consistency to drop', async () => ((await api.metrics(WS)).understanding.consistency.value ?? 1) < 1);
    expect(await api.referencing(WS, GUIDE)).toEqual(expect.arrayContaining([ONBOARDING]));
  });
});
