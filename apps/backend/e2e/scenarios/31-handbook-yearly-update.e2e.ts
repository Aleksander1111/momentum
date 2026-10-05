import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { entitiesOf, refs } from '../support/landed.ts';
import { EXPENSES_MD, missingArtifacts } from '../support/life.ts';
import { move, type Turn } from '../support/scripted.ts';

const WS = 'handbook';
const LEAVE = 'Governance/Policy/leave-policy';
const REMOTE = 'Governance/Policy/remote-work';
const ONBOARDING = 'Knowledge/HowToGuide/onboarding';
const EXPENSES = 'Governance/Policy/expenses';
const RETIRE = 'Harness/Plan/retire-the-remote-work-policy';
const kg = (p: string) => `knowledge-graph/${p}.md`;

/** The card a summarization writes from the documents it lists, with the artifacts where they are now */
function rewrite(t: Turn, entity: string, docs: string[]): string {
  const file = readFileSync(t.file(kg(entity)), 'utf8').replace('verification: verified', 'verification: unverified');
  const bullets = docs.flatMap((d) => readFileSync(t.file(d), 'utf8').split(/\r?\n/).filter((l) => l.startsWith('- '))).slice(0, 6).join('\n');
  return file
    .replace(/artifacts:\n(  - .*\n)+/, `artifacts:\n${docs.map((d) => `  - ${d}\n`).join('')}`)
    .replace(/(\n# [^\n]+\n)[\s\S]*$/, `$1\n${bullets.slice(0, 600)}\n`);
}

// The handbook's knowledge graph is complete; the user keeps its documents up to date
scenario('handbook-yearly-update', { enabled: [WS], graphBuild: 'complete', settings: { summarization: { exclude: ['archive/**'] } } }, async ({ env, api, app, model, step }) => {
  const summarization = (since: Date) => api.automationRan(WS, 'summarization', since, 10 * 60_000);
  const exists = (path: string) => env.show(WS, path) !== null;
  /** The new policy, as summarization named it */
  let expenses = '';
  const over = async (file: string) =>
    (await env.sql<{ entity_path: string }[]>`select entity_path from ${env.sql('ws_handbook.entity_artifact')} where artifact_path = ${file}`).map((r) => r.entity_path);

  model.on('summarization', { automation: 'summarization', kind: 'prompt' }, (t) => {
    const moves = [];
    for (const [, entity, docs] of t.input.matchAll(/^- ([A-Z]\S+): (.+)$/gm)) {
      // Each artifact where it is now: moved ones under their new path, deleted ones gone
      const paths = docs!
        .split(/, (?=\S+(?: \(|$))/)
        .map((d) => /^(\S+)(?: \((?:moved to (\S+?)(?:,[^)]*)?|deleted)\))?$/.exec(d.trim()))
        .map((m) => (m ? (m[2] ?? m[1]!) : ''))
        .filter((p) => p && exists(p));
      // A policy whose document went to the archive is retired
      if (paths.length === 0) {
        moves.push(move.entity(t, RETIRE, { type: 'Harness/Plan', title: 'Retire the remote work policy', card: 'Its document moved to the archive.', impact: [1, 0, 0], references: [{ to: entity!, relation: 'retires' }] }));
      } else moves.push(move.write(t, kg(entity!), rewrite(t, entity!, paths)));
    }
    for (const [, file] of t.input.matchAll(/^- (docs\/\S+\.md)$/gm)) {
      if (file === 'docs/expenses.md') {
        moves.push(
          move.entity(t, EXPENSES, {
            type: 'Governance/Policy',
            origin: 'automation',
            title: 'Expenses policy',
            card: readFileSync(t.file(file), 'utf8').split(/\r?\n/).filter((l) => l.startsWith('- ')).join('\n'),
            references: [{ to: 'Product/Product/handbook', relation: 'part_of' }],
            artifacts: [file],
          }),
        );
      }
    }
    return [...moves, move.say('Summarized.')];
  });

  await step(0, async () => {
    const since = new Date();
    env.commit(WS, { 'docs/expenses.md': EXPENSES_MD }, 'Add the expenses policy');
    expect((await summarization(since)).status).toBe('finished');
    // A new policy over the document, waiting in the feed
    const policies = (await over('docs/expenses.md')).filter((p) => p.startsWith('Governance/Policy/'));
    expect(policies, 'a new policy over docs/expenses.md').toHaveLength(1);
    expenses = policies[0]!;
    const item = await until('the new policy in the feed', async () => (await api.feed()).items.find((i) => i.path === expenses));
    expect(item.verification).toBe('unverified');
    await app.approve(WS, expenses);
  });

  await step(1, async () => {
    const since = new Date();
    env.commit(
      WS,
      {
        'docs/leave-policy.md': env.show(WS, 'docs/leave-policy.md')!.replace('26 days of paid holiday', '27 days of paid holiday'),
        'docs/onboarding.md': `${env.show(WS, 'docs/onboarding.md')!}\n- New joiners get 27 days of holiday from their first year.\n`,
        'docs/expenses.md': EXPENSES_MD.replace('40 EUR a day', '45 EUR a day'),
      },
      'Update the handbook for the new year',
    );
    const run = await summarization(since);
    expect(run.status).toBe('finished');
    expect((await api.runs(WS, 'summarization')).filter((r) => r.created_at >= since)).toHaveLength(1);
    // The one run was asked about all three, and every card is in step with its document again
    for (const p of [LEAVE, ONBOARDING, expenses]) expect(model.turns(run.id)[0]!.input).toContain(`- ${p}: `);
    await until('the three cards in step', async () => (await Promise.all([LEAVE, ONBOARDING, expenses].map((p) => api.entity(WS, p)))).every((c) => c.sync === 'synced'));
    const leave = (await api.entity(WS, LEAVE)).markdown;
    expect(leave).toMatch(/\b27 days\b/);
    expect(leave).not.toMatch(/\b26 days\b/);
    expect((await api.entity(WS, expenses)).markdown).toMatch(/45\s*EUR/);
    const waiting = (await api.feed()).items.map((i) => i.path);
    for (const p of [LEAVE, ONBOARDING, expenses]) if (waiting.includes(p)) await app.approve(WS, p);
  });

  await step(2, async () => {
    const since = new Date();
    mkdirSync(join(env.path(WS), 'docs', 'policies'), { recursive: true });
    for (const f of ['leave-policy.md', 'expenses.md']) env.git(WS, 'mv', `docs/${f}`, `docs/policies/${f}`);
    env.commit(WS, {}, 'Move the policies into their own folder');
    const run = await summarization(since);
    expect(run.status).toBe('finished');
    // Told they moved as they were, not that two went and two came
    expect(model.turns(run.id)[0]!.input).toMatch(/docs\/leave-policy\.md \(moved to docs\/policies\/leave-policy\.md, content unchanged\)/);
    await until('the cards follow their documents', async () => (await missingArtifacts(env, WS, env.sql)).length === 0);
    expect((await api.entity(WS, LEAVE)).artifacts.map((a) => a.path)).toEqual(['docs/policies/leave-policy.md']);
    expect((await api.entity(WS, expenses)).artifacts.map((a) => a.path)).toEqual(['docs/policies/expenses.md']);
    // Nothing a person wrote changed: the cards carry the same words
    expect((await api.entity(WS, LEAVE)).diff).toBeNull();
  });

  await step(3, async () => {
    const since = new Date();
    env.git(WS, 'mv', 'docs/remote-work.md', 'archive/2025-remote-work.md');
    env.commit(WS, {}, 'Archive the remote work policy');
    const run = await summarization(since);
    expect(run.status).toBe('finished');
    // The archived document is never summarized: gone from what is, the policy over it is proposed for retirement
    expect(model.turns(run.id)[0]!.input).toMatch(/docs\/remote-work\.md \(deleted\)/);
    expect(model.turns(run.id)[0]!.input).not.toContain('archive/');
    const plans = (await Promise.all((await entitiesOf(env, WS, run.id)).map((p) => api.entity(WS, p)))).filter(
      (e) => e.type === 'Harness/Plan' && refs(e, 'retires').includes(REMOTE),
    );
    expect(plans, 'a plan retiring the remote work policy').toHaveLength(1);
    await app.approve(WS, plans[0]!.path);
    // The onboarding guide and the product still point at the policy: it stays until they no longer do
    expect(exists(kg(REMOTE))).toBe(true);
    expect(env.git(WS, 'log', '-1', '--format=%B', 'main')).toContain(`Keep ${REMOTE}`);
    expect(graphIssues(env, WS)).toEqual([]);
  });
});
