import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entitiesOf, refs } from '../support/landed.ts';
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

/** An issue concerns every entity of the finding, and may name others it touches */
const covers = (concerns: string[], entities: string[]) => entities.every((e) => concerns.includes(e));

// The consistency check trigger is approved: its schedule is due at once
scenario('maintenance', { enabled: [WS], triggers: ['consistency-check'] }, async ({ env, api, app, model, step }) => {
  const file = (path: string) => `knowledge-graph/${path}.md`;
  const open = async () => (await api.metrics(WS)).implementation.outstandingIssues.value;
  /** The issues the check raised, found by what they are about rather than by their names */
  let contradiction = '';
  let clash = '';
  let raised = 0;

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
    move.say('Two issues filed.'),
  ]);
  model.on('the chat applies the option', (t) => t.automation === 'chat' && t.target === contradiction && t.kind === 'prompt', (t) => [
    move.write(t, 'docs/onboarding.md', env.show(WS, 'docs/onboarding.md')!.replace(/at most 2 days/g, 'up to 3 days')),
    move.write(t, file(ONBOARDING), env.show(WS, file(ONBOARDING))!.replace('verification: verified', 'verification: unverified').replace('at most 2 days', 'up to 3 days')),
    move.remove(t, file(contradiction)),
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
    const run = await api.automationRan(WS, 'consistency-check', new Date(0), 15 * 60_000);
    expect(run.status).toBe('finished');
    const issues = (await entitiesOf(env, WS, run.id)).filter((p) => p.startsWith('Harness/Issue/'));
    const feed = (await api.feed()).items.filter((i) => issues.includes(i.path));
    expect(feed).toHaveLength(issues.length);
    // The seeded contradiction and naming clash, each with options to resolve it
    const remoteDays = feed.find((i) => i.issue?.category === 'contradiction' && covers(i.issue.concerns, [ONBOARDING, REMOTE]));
    expect(remoteDays, `the remote days contradiction among ${issues.join(', ')}`).toBeTruthy();
    const names = feed.find((i) => i.issue?.category === 'naming' && covers(i.issue.concerns, [GUIDE, MEETINGS]));
    expect(names, `the weekly meeting naming clash among ${issues.join(', ')}`).toBeTruthy();
    for (const i of [remoteDays!, names!]) {
      expect(i.issue!.options.length).toBeGreaterThanOrEqual(2);
      expect(i.issue!.options.length).toBeLessThanOrEqual(4);
    }
    expect(remoteDays!.issue!.recommended).not.toBeNull();
    contradiction = remoteDays!.path;
    clash = names!.path;
    raised = issues.length;
    expect((await api.entity(WS, REMOTE)).contradictions).toBe(1);
    // Nothing but the issues changed
    const changed = env.git(WS, 'diff', '--name-only', start, 'main').split('\n');
    expect(changed.sort()).toEqual(issues.map(file).sort());
    // The harness counts them as open
    await until('the issues counted open', async () => (await open()) === raised);
    expect((await api.metrics(WS)).understanding.openIssues.value).toBe(raised);
  });

  await step(1, async () => {
    const { issue } = (await api.feed()).items.find((i) => i.path === contradiction)!;
    const recommended = issue!.recommended!;
    const chat = await app.resolve(WS, contradiction, recommended);
    const run = await api.run(chat);
    expect(run.targetPath).toBe(contradiction);
    const option = issue!.options[recommended]!;
    expect(run.messages[0]!.text).toBe(`${option.label}: ${option.change}`);
    expect((await api.runEnded(chat, 15 * 60_000)).status).toBe('finished');
    expect(env.show(WS, file(contradiction))).toBeNull();
    // The recommended option follows the policy, the established rule: the guide's document no longer says 2 days
    expect(env.show(WS, 'docs/onboarding.md')).not.toMatch(/at most 2 days/);
    expect((await api.entity(WS, REMOTE)).contradictions).toBe(0);
    const guide = await until('the changed guide in the feed', async () => (await api.feed()).items.find((i) => i.path === ONBOARDING && i.diff));
    expect(guide.verification).toBe('unverified');
    // The guide changed with its document: nothing is left to summarize
    await new Promise((r) => setTimeout(r, 6000));
    expect(await api.runs(WS, 'summarization')).toEqual([]);
    expect((await api.entity(WS, ONBOARDING)).sync).toBe('synced');
    await until('one issue fewer counted open', async () => (await open()) === raised - 1);
  });

  await step(2, async () => {
    await app.wontResolve(WS, clash, 'One is the policy, the other how to run it; both names stay.');
    expect((await api.entity(WS, clash)).verification).toBe('verified');
    expect(env.show(WS, file(clash))).toContain('wont_resolve: One is the policy');
    await until('the clash no longer counted open', async () => (await open()) === raised - 2);
    expect((await api.metrics(WS)).understanding.openIssues.value).toBe(raised - 2);
  });

  await step(3, async () => {
    await app.tab('Settings');
    const settings = await api.settings();
    await api.putSettings({ lifetimes: [...settings.lifetimes.filter((l) => l.type !== LIFETIME.type), LIFETIME] });
    expect((await api.settings()).lifetimes).toContainEqual(LIFETIME);
    const since = new Date();
    await app.approve(WS, 'Harness/Trigger/retention');
    const run = await api.automationRan(WS, 'retention', since, 15 * 60_000);
    expect(run.status).toBe('finished');
    expect(model.instructions.get(run.id)).toContain(`${LIFETIME.type}: ${LIFETIME.rule}`);
    // Its retirement plans, waiting in the feed: the resolved task and the delivered survey are spent
    const plans = (await Promise.all((await entitiesOf(env, WS, run.id)).map((p) => api.entity(WS, p)))).filter(
      (e) => e.type === 'Harness/Plan' && refs(e, 'retires').length > 0,
    );
    expect(plans.flatMap((p) => refs(p, 'retires'))).toEqual(expect.arrayContaining([TASK, SURVEY]));
    // Meanwhile a new decision, made by hand, comes to rely on the survey
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
    await until('the decision indexed', async () => (await api.referencing(WS, SURVEY)).includes(DECISION));
    for (const plan of plans) {
      await app.approve(WS, plan.path);
      // Carried out, a plan that only retires went with them: nothing is left to implement
      if (plan.references.filter((r) => r.direction === 'out').every((r) => r.relation === 'retires')) expect(env.show(WS, file(plan.path))).toBeNull();
      // Retiring the survey would break the decision's reference: it stays, and the commit says why
      if (refs(plan, 'retires').includes(SURVEY)) expect(env.git(WS, 'log', '-1', '--format=%B', 'main')).toContain(`Keep ${SURVEY}`);
    }
    expect(env.show(WS, file(TASK))).toBeNull();
    expect(env.show(WS, file(SURVEY))).not.toBeNull();
    expect(graphIssues(env, WS)).toEqual([]);
  });

  await step(4, async () => {
    const before = (await api.metrics(WS)).understanding.consistency.value;
    expect(before).toBe(1);
    env.commit(WS, { [file(GUIDE)]: null }, 'Drop the weekly meeting guide');
    await until('the guide gone from the index', async () => !(await api.entities(WS)).some((e) => e.path === GUIDE));
    // The product, as the user wrote it, still points at it
    await until('consistency to drop', async () => ((await api.metrics(WS)).understanding.consistency.value ?? 1) < 1);
    expect(await api.referencing(WS, GUIDE)).toEqual(expect.arrayContaining(['Product/Product/handbook']));
  });
});
