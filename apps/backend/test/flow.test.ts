import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// A throwaway workspaces root and database: the real settings are never touched
const root = mkdtempSync(join(tmpdir(), 'momentum-test-'));
process.loadEnvFile(join(import.meta.dirname, '../../../.env'));
const url = new URL(process.env.DATABASE_URL!);
url.pathname = '/momentum_test';
process.env.DATABASE_URL = url.toString();
process.env.MOMENTUM_ROOT = root;
process.env.MOMENTUM_RUNS = join(root, '.runs');

const repo = join(root, 'alpha');
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const put = (dir: string, file: string, text: string) => {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), text);
};
const entity = (type: string, title: string, body: string, refs: string[] = [], extra = '') => `---
type: ${type}
verification: unverified
product_impact: 3
timeline_impact: 2
unlocks: 1
references:${refs.length ? refs.map((r) => `\n  - to: ${r}\n    relation: depends_on`).join('') : ' []'}
${extra}---
# ${title}

${body}
`;

type M = Awaited<ReturnType<typeof import('../src/app.ts').createMomentum>>;
let m: M;
let ensureCheckout: typeof import('@momentum/runs').ensureCheckout;

const checkoutOf = (id: string) => join(root, '.runs', 'alpha', id);
const ref = (id: string, automation = 'chat') => ({ id, workspace: 'alpha', automation, checkout: checkoutOf(id), targetPath: null });

/** A run that wrote these files in its own checkout of the main line, landed by the guard when it ends */
async function run(id: string, files: Record<string, string>, automation = 'chat') {
  await ensureCheckout(repo, checkoutOf(id), 'main');
  for (const [f, t] of Object.entries(files)) put(checkoutOf(id), f, t);
  return m.guard.transaction(ref(id, automation));
}

beforeAll(async () => {
  const admin = postgres(new URL('/postgres', url).toString(), { onnotice: () => {} });
  await admin.unsafe('drop database if exists momentum_test with (force)');
  await admin.unsafe('create database momentum_test');
  await admin.end();

  mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 't@t');
  git(repo, 'config', 'user.name', 't');
  put(repo, 'knowledge-graph/Architecture/Api/session.md', entity('Architecture/Api', 'Session on the API', 'Per-user session.').replace('unverified', 'verified'));
  put(repo, 'src/app.txt', 'v1\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');

  // An empty harness workspace: no definitions, so enabling a project materializes and proposes nothing
  const harness = join(root, 'momentum');
  mkdirSync(harness);
  git(harness, 'init', '-q', '-b', 'main');
  git(harness, 'config', 'user.email', 't@t');
  git(harness, 'config', 'user.name', 't');
  git(harness, 'commit', '-q', '--allow-empty', '-m', 'init');

  const app = await import('../src/app.ts');
  ({ ensureCheckout } = await import('@momentum/runs'));
  m = await app.createMomentum();
  await m.settings.setEnabled('alpha', true);
  await m.guard.indexMainLine(await m.workspaces.get('alpha'));
}, 240_000);

afterAll(async () => {
  await m?.sql.end();
  rmSync(root, { recursive: true, force: true });

describe('model settings', () => {
  it('keeps what was set and fills an automation stored without one', async () => {
    const before = (await m.settings.get()).models;
    expect(before.mode).toBe('single');
    const { chat: _, ...perAutomation } = before.perAutomation;
    await m.settings.put({ models: { ...before, mode: 'risk', perAutomation: perAutomation as typeof before.perAutomation } });
    const after = (await m.settings.get()).models;
    expect(after.mode).toBe('risk');
    expect(after.perAutomation.chat).toBe('default');
    await m.settings.put({ models: before });
  });
});
});

describe('guard, feed and approval', () => {
  it('indexes the main line as approved', async () => {
    const d = await m.momentum.entity('alpha', 'Architecture/Api/session');
    expect(d.verification).toBe('verified');
    expect(d.contradictions).toBe(0);
  });

  it('lands a valid transaction on the main line and puts it in the feed', async () => {
    const t = await run('r1', {
      'knowledge-graph/Governance/Decision/private-mesh.md': entity(
        'Governance/Decision',
        'Remote access over a private mesh',
        'Clients reach the machine through a mesh.\n\n```mermaid\nflowchart LR\n  Client --> Mesh --> API\n```',
        ['Architecture/Api/session'],
      ),
    });
    expect(t).toMatchObject({ valid: true, paths: ['Governance/Decision/private-mesh'], conflicts: [] });
    expect(git(repo, 'rev-parse', 'main')).toBe(t.commit);
    expect(git(repo, 'show', 'main:knowledge-graph/Governance/Decision/private-mesh.md')).toContain('verification: unverified');
    expect(git(repo, 'branch', '--list')).toBe('* main'); // nothing is branched
    expect(git(repo, 'status', '--porcelain')).toBe(''); // the user's checkout follows the main line
    const feed = await m.momentum.feed();
    expect(feed.items.map((i) => [i.path, i.rank])).toEqual([['Governance/Decision/private-mesh', 6]]);
    expect(feed.counts.verification).toEqual({ verified: 1, unverified: 1 });
    expect(feed.counts.sync).toEqual({ synced: 2, entity_ahead: 0, artifact_ahead: 0, updating: 0 });
    const diagram = feed.items[0]!.card.find((b) => b.t === 'diagram');
    expect(diagram?.t === 'diagram' && diagram.svg).toMatch(/^<svg/);
  });

  it('raises an issue for changes that cannot be made consistent, landed with them', async () => {
    const t = await run('r2', {
      'knowledge-graph/Product/Feature/offline.md': entity('Product/Feature', 'Offline feed', 'x'.repeat(800), ['Nope/Missing/thing']),
    });
    expect(t.valid).toBe(false);
    expect(t.issues.map((i) => i.code).sort()).toEqual(['card_limit', 'unresolved_reference']);
    expect(git(repo, 'show', 'main:knowledge-graph/Harness/Issue/guard-r2.md')).toContain('source: guard');
    const feed = await m.momentum.feed();
    expect(feed.items.map((i) => i.path)).toContain('Harness/Issue/guard-r2');
    expect(feed.items.map((i) => i.path)).toContain('Product/Feature/offline');
    const issue = await m.momentum.entity('alpha', 'Harness/Issue/guard-r2');
    expect(issue.references.map((r) => [r.path, r.relation])).toEqual([['Product/Feature/offline', 'concerns']]);
  });

  it('approves in place: one commit on the main line, nothing else touched', async () => {
    await m.momentum.approve('alpha', 'Governance/Decision/private-mesh', 4200);
    const onMain = git(repo, 'show', 'main:knowledge-graph/Governance/Decision/private-mesh.md');
    expect(onMain).toContain('verification: verified');
    expect(readFileSync(join(repo, 'knowledge-graph/Governance/Decision/private-mesh.md'), 'utf8')).toContain('verified');
    expect(git(repo, 'status', '--porcelain')).toBe('');
    const feed = await m.momentum.feed();
    expect(feed.items.map((i) => i.path)).not.toContain('Governance/Decision/private-mesh');
    const metrics = await m.momentum.metrics('alpha');
    expect(metrics.attention.approved.value).toBe(1);
    expect(metrics.attention.timePerItemSeconds.value).toBe(4);
    expect(metrics.entities.verification.verified.value).toBe(2);
    expect(metrics.entities.verification.unverified.value).toBe(2);
  });

  it('marks an approved implementable entity entity_ahead', async () => {
    const events: string[] = [];
    m.bus.on('entity_ahead', (e) => events.push(e.path));
    await run('r3', { 'knowledge-graph/Product/Feature/swipe.md': entity('Product/Feature', 'Swipe to approve', 'Right approves.') });
    await m.momentum.approve('alpha', 'Product/Feature/swipe', 1000);
    expect((await m.momentum.entity('alpha', 'Product/Feature/swipe')).sync).toBe('entity_ahead');
    expect(events).toEqual(['Product/Feature/swipe']);
  });

  it('sends back into a chat run on the entity', async () => {
    await run('r4', { 'knowledge-graph/Product/UserStory/rank.md': entity('Product/UserStory', 'Attention feed ranking', 'Ranks the feed.') });
    const { runId } = await m.momentum.sendBack('alpha', 'Product/UserStory/rank', 'Rank by importance instead.', 900);
    const r = await m.momentum.run(runId);
    expect(r).toMatchObject({ automation: 'chat', trigger: 'on_demand', targetPath: 'Product/UserStory/rank', checkout: checkoutOf(runId) });
    expect(r.messages[0]).toMatchObject({ role: 'user', text: 'Rank by importance instead.' });
    expect((await m.momentum.entity('alpha', 'Product/UserStory/rank')).sync).toBe('updating');
    expect((await m.momentum.chats('alpha')).chats[0]?.runId).toBe(runId);
  });

  it('lands a run that conflicts with what reached the main line meanwhile, on the run side, and raises the conflict', async () => {
    const file = 'knowledge-graph/Product/UserStory/rank.md';
    await ensureCheckout(repo, checkoutOf('r5'), 'main');
    put(checkoutOf('r5'), file, entity('Product/UserStory', 'Attention feed ranking', 'Ranks the feed by the run.'));
    put(checkoutOf('r5'), 'src/app.txt', 'v2\n');
    // The user commits to the main line while the run is running: one file the run also changed, one it did not
    put(repo, file, entity('Product/UserStory', 'Attention feed ranking', 'Ranks the feed by the user.'));
    put(repo, 'src/other.txt', 'o\n');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'user');
    const t = await m.guard.transaction(ref('r5', 'implementation'));
    expect(t.conflicts).toEqual([file]);
    expect(git(repo, 'show', `main:${file}`)).toContain('by the run');
    expect(git(repo, 'show', 'main:src/app.txt')).toBe('v2');
    expect(git(repo, 'show', 'main:src/other.txt')).toBe('o');
    expect(git(repo, 'log', '--format=%P', '-1', 'main').split(' ')).toHaveLength(1); // one line of history
    expect(readFileSync(join(repo, 'src/app.txt'), 'utf8')).toMatch(/^v2\r?\n$/);
    const conflict = await m.momentum.entity('alpha', 'Harness/Conflict/r5');
    expect(conflict.references.map((r) => [r.path, r.relation])).toEqual([['Product/UserStory/rank', 'concerns']]);
    expect((await m.momentum.feed()).items.map((i) => i.path)).toContain('Harness/Conflict/r5');
  });

  it('counts the open contradiction issues over an entity', async () => {
    await run('r6', {
      'knowledge-graph/Harness/Issue/clash.md': entity('Harness/Issue', 'Swipe contradicts ranking', 'They clash.', [], 'source: consistency_check\ncategory: contradiction\n').replace(
        'references: []',
        'references:\n  - to: Product/Feature/swipe\n    relation: concerns\n  - to: Product/UserStory/rank\n    relation: concerns',
      ),
    });
    expect((await m.momentum.entity('alpha', 'Product/Feature/swipe')).contradictions).toBe(1);
    expect((await m.momentum.entity('alpha', 'Product/UserStory/rank')).contradictions).toBe(1);
    expect((await m.momentum.entity('alpha', 'Architecture/Api/session')).contradictions).toBe(0);
    const feed = await m.momentum.feed();
    expect(feed.items.find((i) => i.path === 'Product/UserStory/rank')?.contradictions).toBe(1);
  });

  it('offers the options of an issue in the feed and resolves it with one in a chat run', async () => {
    const options = [
      '  - label: Rank by impact\n    change: Swipe adopts impact and unlocks.',
      '  - label: Rank by age\n    change: Ranking drops impact; oldest first.',
    ];
    await run('r7', {
      'knowledge-graph/Harness/Issue/order.md': entity(
        'Harness/Issue',
        'Feed order differs',
        'Ranking orders by impact; swipe by age.',
        [],
        `source: consistency_check\ncategory: contradiction\nseverity: high\noptions:\n${options.join('\n')}\nrecommended: 0\n`,
      ).replace('references: []', 'references:\n  - to: Product/UserStory/rank\n    relation: concerns\n  - to: Product/Feature/swipe\n    relation: concerns'),
    });
    const item = (await m.momentum.feed()).items.find((i) => i.path === 'Harness/Issue/order');
    expect(item?.issue).toMatchObject({
      category: 'contradiction',
      severity: 'high',
      recommended: 0,
      concerns: ['Product/UserStory/rank', 'Product/Feature/swipe'],
    });
    expect(item?.issue?.options.map((o) => o.label)).toEqual(['Rank by impact', 'Rank by age']);
    // Any other entity, and an issue without options, carries none
    expect((await m.momentum.feed()).items.find((i) => i.path === 'Harness/Issue/guard-r2')?.issue).toBeNull();

    await expect(m.momentum.resolve('alpha', 'Harness/Issue/order', { option: 5 }, 0)).rejects.toThrow('no option 5');
    const { runId } = await m.momentum.resolve('alpha', 'Harness/Issue/order', { option: 0 }, 700);
    const r = await m.momentum.run(runId);
    expect(r).toMatchObject({ automation: 'chat', targetPath: 'Harness/Issue/order' });
    expect(r.messages[0]).toMatchObject({ role: 'user', text: 'Rank by impact: Swipe adopts impact and unlocks.' });
    expect((await m.momentum.feed()).items.map((i) => i.path)).not.toContain('Harness/Issue/order');
  });

  it("closes an issue as won't resolve: verified with the reason, no longer counted", async () => {
    await m.momentum.wontResolve('alpha', 'Harness/Issue/clash', 'Both orders are intended.', 300);
    const onMain = git(repo, 'show', 'main:knowledge-graph/Harness/Issue/clash.md');
    expect(onMain).toContain('verification: verified');
    expect(onMain).toContain('wont_resolve: Both orders are intended.');
    expect((await m.momentum.feed()).items.map((i) => i.path)).not.toContain('Harness/Issue/clash');
    expect((await m.momentum.entity('alpha', 'Product/Feature/swipe')).contradictions).toBe(1); // the order issue stays open
    await expect(m.momentum.wontResolve('alpha', 'Product/Feature/swipe', 'x', 0)).rejects.toThrow('not an issue');
  });
});

describe('orchestrator', () => {
  const trigger = (name: string) => `---
type: Harness/Trigger
verification: verified
automation: ${name}
schedule: "* * * * *"
on_demand: true
---
# ${name} trigger

Every minute.
`;

  it('queues scheduled loops while the feed has room and runs automations one at a time per project, user runs at once', async () => {
    const { Orchestrator } = await import('../src/orchestrator.ts');
    const { createBus } = await import('../src/events.ts');
    for (const name of ['exploration', 'preparation', 'retention']) put(repo, `knowledge-graph/Harness/Trigger/${name}.md`, trigger(name));
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'triggers');

    const created: string[] = [];
    const started: string[] = [];
    const queue: { workspace: string; id: string; automation: string; trigger: string }[] = [];
    const stub = {
      hasOpenRun: async () => false,
      lastStart: async () => null,
      create: async (r: { automation: string; trigger: string }) => {
        created.push(r.automation);
        queue.push({ workspace: 'alpha', id: r.automation, automation: r.automation, trigger: r.trigger });
        return r.automation;
      },
      queued: async () => queue.filter((q) => !started.includes(q.id)),
      activeCount: () => started.length,
      activeAutomationCount: () => started.filter((id) => queue.find((q) => q.id === id)?.trigger !== 'on_demand').length,
      start: async (id: string) => void started.push(id),
    };
    const o = new Orchestrator(m.workspaces, m.settings, m.guard, stub as never, m.automations, createBus());

    await m.settings.put({ feedSize: 1, agents: { concurrentTotal: 8 } });
    await o.tick();
    expect(created).toEqual([]); // the feed is at its limit: loops pause

    await m.settings.put({ feedSize: 40 });
    await o.tick();
    expect(created.sort()).toEqual(['exploration', 'preparation', 'retention']);
    expect(started).toHaveLength(1); // one automation run at a time per project

    queue.push({ workspace: 'alpha', id: 'chat1', automation: 'chat', trigger: 'on_demand' });
    await o.tick();
    expect(started).toEqual([started[0]!, 'chat1']); // a run the user started goes at once

    started.length = 0; // every run ended
    await o.tick();
    expect(started.filter((id) => id !== 'chat1')).toHaveLength(1); // the next automation run, still one at a time
  });

  it('builds the knowledge graph of an enabled project while the feed has room, until the user stops it', async () => {
    const { Orchestrator } = await import('../src/orchestrator.ts');
    const { createBus } = await import('../src/events.ts');
    const created: { automation: string; prompt: string }[] = [];
    const stopped: string[] = [];
    const stub = {
      hasOpenRun: async (_ws: string, automation: string) => created.some((r) => r.automation === automation),
      lastStart: async () => new Date(), // scheduled loops are not due
      create: async (r: { automation: string; prompt: string }) => {
        created.push(r);
        return r.automation;
      },
      stopAutomation: async (_ws: string, automation: string) => {
        stopped.push(automation);
        return [];
      },
      queued: async () => [],
      activeCount: () => 0,
      activeAutomationCount: () => 0,
      start: async () => undefined,
    };
    const o = new Orchestrator(m.workspaces, m.settings, m.guard, stub as never, m.automations, createBus());
    const ws = await m.workspaces.get('alpha');

    expect((await m.momentum.graphBuild('alpha')).state).toBeNull(); // nothing until the project is enabled
    await o.tick();
    expect(created).toEqual([]);

    await m.settings.setGraphBuild('alpha', 'building');
    await o.tick();
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ automation: 'graph-build' });
    expect(created[0]!.prompt).toMatch(/first graph build run/);
    expect(created[0]!.prompt).toMatch(/room for \d+ more items: write at most \d+ entities/);
    await o.tick();
    expect(created).toHaveLength(1); // one run at a time

    await m.settings.setGraphBuildProgress('alpha', 'Top level covered; services next.');
    created.length = 0;
    await o.tick();
    expect(created[0]!.prompt).toContain('Top level covered; services next.');

    await m.settings.put({ feedSize: 1 });
    created.length = 0;
    await o.tick();
    expect(created).toEqual([]); // the feed is at its limit: the build pauses
    await m.settings.put({ feedSize: 40 });

    await o.setGraphBuild(ws, false);
    expect(stopped).toEqual(['graph-build']);
    const status = await m.momentum.graphBuild('alpha');
    expect(status).toMatchObject({ state: 'stopped', progress: 'Top level covered; services next.', entities: 0, spentMs: 0, coverage: null, estimate: null });
    expect(status.since).not.toBeNull();

    // A run that took 10 minutes and 8% of the 5-hour limit for a quarter of the repository: the full build is four times that
    await ws.index.sql`insert into ${ws.index.sql(`${ws.index.schema}.run`)} ${ws.index.sql({
      id: 'map1',
      automation: 'graph-build',
      checkout: checkoutOf('map1'),
      trigger: 'event',
      status: 'finished',
      started_at: new Date(Date.now() - 600_000),
      ended_at: new Date(),
      usage_five_hour: 8,
      usage_week: 1,
    })}`;
    await m.settings.setGraphBuildCoverage('alpha', 0.25);
    const estimated = await m.momentum.graphBuild('alpha');
    expect(estimated.runs).toBe(1);
    expect(estimated.spentMs).toBeGreaterThanOrEqual(599_000);
    expect(estimated.estimate!.totalMs).toBeGreaterThanOrEqual(4 * 599_000);
    expect(estimated.estimate!.usage).toEqual({ fiveHour: 32, week: 4 });
    await o.tick();
    expect(created).toEqual([]); // stopped: nothing queued

    await o.setGraphBuild(ws, true);
    await o.tick();
    expect(created.map((r) => r.automation)).toEqual(['graph-build']); // resumed
    await o.setGraphBuild(ws, false);
  });
});

describe('guard hooks in a run', () => {
  it('flags a bad write at once and blocks the run from stopping until it is fixed', async () => {
    const { guardHooks } = await import('../src/hooks.ts');
    const checkout = checkoutOf('r7');
    await ensureCheckout(repo, checkout, 'main');
    const hooks = guardHooks(m.guard, ref('r7'));
    const post = hooks.PostToolUse![0]!.hooks[0]!;
    const stop = hooks.Stop![0]!.hooks[0]!;
    const opts = { signal: new AbortController().signal };
    const base = { session_id: 's', transcript_path: '', cwd: checkout };
    const file = 'knowledge-graph/Product/Bug/crash.md';

    put(checkout, file, entity('Product/Bug', 'Crash', 'Crashes.', ['Nope/Missing/thing']));
    const after = await post({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: join(checkout, file) }, tool_response: {}, tool_use_id: 't' } as never, 't', opts);
    expect(JSON.stringify(after)).toContain('Nope/Missing/thing');

    const stopInput = { ...base, hook_event_name: 'Stop', stop_hook_active: false } as never;
    expect(await stop(stopInput, undefined, opts)).toMatchObject({ decision: 'block' });

    put(checkout, file, entity('Product/Bug', 'Crash', 'Crashes.', ['Architecture/Api/session']));
    expect(await post({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: file }, tool_response: {}, tool_use_id: 't' } as never, 't', opts)).toEqual({});
    expect(await stop(stopInput, undefined, opts)).toEqual({});
  });

  it('hands the artifacts to summarization once, when the run stops by itself', async () => {
    const { guardHooks } = await import('../src/hooks.ts');
    const checkout = checkoutOf('r8');
    await ensureCheckout(repo, checkout, 'main');
    const stop = guardHooks(m.guard, ref('r8', 'preparation'), async () => 'Summarize:\n- plans/fix-crash.md (added)').Stop![0]!.hooks[0]!;
    const opts = { signal: new AbortController().signal };
    const base = { session_id: 's', transcript_path: '', cwd: checkout, hook_event_name: 'Stop' };

    expect(await stop({ ...base, stop_hook_active: false } as never, undefined, opts)).toMatchObject({
      decision: 'block',
      reason: expect.stringContaining('plans/fix-crash.md'),
    });
    expect(await stop({ ...base, stop_hook_active: true } as never, undefined, opts)).toEqual({});
  });
});

describe('main line changes and restarts', () => {
  it('hands the artifacts one main-line change touched to one summarization run', async () => {
    const { Orchestrator } = await import('../src/orchestrator.ts');
    const { createBus } = await import('../src/events.ts');
    const ws = await m.workspaces.get('alpha');
    // Only this test reacts to the event: the app's own orchestrator would start a real run
    m.bus.removeAllListeners('artifact_ahead');
    const events: { path: string; artifacts: string[] }[][] = [];
    m.bus.on('artifact_ahead', ({ entities }) => void events.push(entities));

    put(repo, 'src/a.txt', 'a1\n');
    put(repo, 'src/b.txt', 'b1\n');
    put(repo, 'knowledge-graph/Architecture/Component/a.md', entity('Architecture/Component', 'A', 'A.', [], 'artifacts:\n  - src/a.txt\n  - src/b.txt\n'));
    put(repo, 'knowledge-graph/Architecture/Component/b.md', entity('Architecture/Component', 'B', 'B.', [], 'artifacts:\n  - src/b.txt\n'));
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'components');
    await m.guard.indexMainLine(ws);
    expect(events).toEqual([]); // the entities changed with their artifacts

    put(repo, 'src/a.txt', 'a2\n');
    put(repo, 'src/b.txt', 'b2\n');
    git(repo, 'commit', '-q', '-am', 'change both');
    await m.guard.indexMainLine(ws);
    expect(events).toHaveLength(1);
    expect(events[0]!.sort((x, y) => x.path.localeCompare(y.path))).toEqual([
      { path: 'Architecture/Component/a', artifacts: ['src/a.txt', 'src/b.txt'] },
      { path: 'Architecture/Component/b', artifacts: ['src/b.txt'] },
    ]);

    const created: { automation: string; targetPath?: string | null; prompt: string }[] = [];
    const stub = {
      hasOpenRun: async () => true,
      lastStart: async () => new Date(),
      create: async (r: (typeof created)[number]) => void created.push(r),
      queued: async () => [],
      activeCount: () => 0,
      activeAutomationCount: () => 0,
      start: async () => undefined,
    };
    const bus = createBus();
    new Orchestrator(m.workspaces, m.settings, m.guard, stub as never, m.automations, bus);
    bus.emit('artifact_ahead', { workspace: 'alpha', entities: events[0]! });
    await vi.waitFor(async () => expect((await m.momentum.entity('alpha', 'Architecture/Component/b')).sync).toBe('updating'));
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ automation: 'summarization' });
    expect(created[0]!.targetPath ?? null).toBeNull();
    expect(created[0]!.prompt).toContain('- Architecture/Component/a: src/a.txt, src/b.txt');
    expect(created[0]!.prompt).toContain('- Architecture/Component/b: src/b.txt');
  });

  it('queues a run lost at restart again, and fails it past the limit', async () => {
    const ws = await m.workspaces.get('alpha');
    const runs = ws.index.sql(`${ws.index.schema}.run`);
    const lost = async (id: string, automation: string, restarts: number) => {
      await ensureCheckout(repo, checkoutOf(id), 'main');
      await m.sql`insert into harness.run_ref ${m.sql({ id, workspace: 'alpha' })}`;
      await ws.index.sql`insert into ${runs} ${ws.index.sql({
        id,
        automation,
        checkout: checkoutOf(id),
        trigger: 'event',
        status: 'running',
        session_id: 's',
        started_at: new Date(),
        restarts,
      })}`;
    };
    await lost('lost1', 'graph-build', 0);
    await lost('lost2', 'graph-build', 2);
    await lost('lost3', 'chat', 0);
    await m.runner.recover();
    const rows = await ws.index.sql<{ id: string; status: string; restarts: number; error: string | null }[]>`
      select id, status, restarts, error from ${runs} where id like 'lost%' order by id`;
    expect(rows).toEqual([
      { id: 'lost1', status: 'queued', restarts: 1, error: null },
      { id: 'lost2', status: 'failed', restarts: 2, error: 'lost at restart' },
      { id: 'lost3', status: 'failed', restarts: 0, error: 'lost at restart' },
    ]);
    expect(existsSync(checkoutOf('lost1'))).toBe(true); // resumes on the same checkout
    expect(existsSync(checkoutOf('lost2'))).toBe(false); // what it wrote landed; the checkout went
    // Nothing may start it later in the suite
    await ws.index.sql`update ${runs} set status = 'killed' where id = 'lost1'`;
  });
});

describe('run branches from before everything went to the main line', () => {
  it('lands every momentum/ branch on the main line, oldest first, and removes it with its worktree', async () => {
    const { landRunBranches } = await import('../src/legacy.ts');
    const ws = await m.workspaces.get('alpha');
    const branch = async (id: string, file: string, text: string) => {
      const dir = join(root, '.runs', 'alpha', `legacy-${id}`);
      git(repo, 'worktree', 'add', '-q', '-b', `momentum/summarization/${id}`, dir, 'main');
      put(dir, file, text);
      git(dir, 'add', '-A');
      git(dir, 'commit', '-q', '-m', `momentum: summarization run ${id}`);
    };
    const file = 'knowledge-graph/Harness/Chat/old.md';
    await branch('old1', file, entity('Harness/Chat', 'Old chat', 'First version.'));
    await branch('old2', file, entity('Harness/Chat', 'Old chat', 'Second version.'));
    const { landed, conflicts } = await landRunBranches(ws);
    expect(landed).toEqual(['momentum/summarization/old1', 'momentum/summarization/old2']);
    expect(conflicts).toEqual([`momentum/summarization/old2: ${file}`]);
    expect(git(repo, 'show', `main:${file}`)).toContain('Second version.'); // the later landing wins
    expect(git(repo, 'branch', '--list', 'momentum/*')).toBe('');
    expect(git(repo, 'worktree', 'list').split('\n')).toHaveLength(1); // every run worktree went with the branches
    await m.guard.indexMainLine(ws);
    expect((await m.momentum.entity('alpha', 'Harness/Chat/old')).verification).toBe('unverified');
    expect(await landRunBranches(ws)).toEqual({ landed: [], conflicts: [] }); // nothing left to do
  });
});

describe('reset', () => {
  it('removes every entity and database entry of a project and builds its knowledge graph afresh', async () => {
    const { Orchestrator } = await import('../src/orchestrator.ts');
    const { createBus } = await import('../src/events.ts');
    const created: { automation: string }[] = [];
    const stub = {
      stopWorkspace: async () => undefined,
      hasOpenRun: async () => false,
      lastStart: async () => new Date(),
      create: async (r: { automation: string }) => {
        created.push(r);
        return r.automation;
      },
      queued: async () => [],
      activeCount: () => 0,
      activeAutomationCount: () => 0,
      start: async () => undefined,
    };
    const o = new Orchestrator(m.workspaces, m.settings, m.guard, stub as never, m.automations, createBus());
    await ensureCheckout(repo, checkoutOf('r9'), 'main');
    expect(existsSync(checkoutOf('r9'))).toBe(true);
    expect(existsSync(join(root, '.runs', 'alpha'))).toBe(true);
    const code = readFileSync(join(repo, 'src/app.txt'), 'utf8');

    await o.reset(await m.workspaces.get('alpha'));
    // the build starts again from the top
    await vi.waitFor(() => expect(created.map((r) => r.automation)).toContain('graph-build'));

    expect(git(repo, 'ls-tree', '-r', '--name-only', 'main', 'knowledge-graph')).toBe('');
    expect(git(repo, 'worktree', 'list').split('\n')).toHaveLength(1); // every run checkout went
    expect(existsSync(join(root, '.runs', 'alpha'))).toBe(false);
    expect(git(repo, 'status', '--porcelain')).toBe('');
    expect(readFileSync(join(repo, 'src/app.txt'), 'utf8')).toBe(code); // code is untouched
    expect((await m.momentum.types('alpha')).total).toBe(0);
    expect((await m.momentum.chats('alpha')).chats).toEqual([]);
    expect((await m.momentum.feed()).items).toEqual([]);
    const status = await m.momentum.graphBuild('alpha');
    expect(status).toMatchObject({ state: 'building', progress: null, runs: 0, entities: 0, resettable: true });
    expect((await m.settings.enabled()).map((p) => p.name)).toEqual(['alpha']);

    await expect(o.reset(await m.workspaces.get('momentum'))).rejects.toThrow(/cannot be reset/);
  });
});
