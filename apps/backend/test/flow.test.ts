import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
let addWorktree: typeof import('@momentum/runs').addWorktree;

async function run(id: string, files: Record<string, string>, branch = `momentum/chat/${id}`) {
  const checkout = join(root, '.runs', 'alpha', id);
  await addWorktree(repo, checkout, branch, 'refs/heads/main');
  for (const [f, t] of Object.entries(files)) put(checkout, f, t);
  return m.guard.transaction({ id, workspace: 'alpha', automation: 'chat', branch, checkout, targetPath: null });
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
  ({ addWorktree } = await import('@momentum/runs'));
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
    expect(d.branch).toBeNull();
  });

  it('puts a valid transaction in the feed', async () => {
    const t = await run('r1', {
      'knowledge-graph/Governance/Decision/private-mesh.md': entity(
        'Governance/Decision',
        'Remote access over a private mesh',
        'Clients reach the machine through a mesh.\n\n```mermaid\nflowchart LR\n  Client --> Mesh --> API\n```',
        ['Architecture/Api/session'],
      ),
    });
    expect(t).toMatchObject({ valid: true, paths: ['Governance/Decision/private-mesh'] });
    const feed = await m.momentum.feed();
    expect(feed.items.map((i) => [i.path, i.rank])).toEqual([['Governance/Decision/private-mesh', 6]]);
    expect(feed.counts.verification).toEqual({ verified: 1, unverified: 1 });
    expect(feed.counts.sync).toEqual({ synced: 2, entity_ahead: 0, artifact_ahead: 0, updating: 0 });
    const diagram = feed.items[0]!.card.find((b) => b.t === 'diagram');
    expect(diagram?.t === 'diagram' && diagram.svg).toMatch(/^<svg/);
  });

  it('raises an issue for changes that cannot be made consistent', async () => {
    const t = await run('r2', {
      'knowledge-graph/Product/Feature/offline.md': entity('Product/Feature', 'Offline feed', 'x'.repeat(800), ['Nope/Missing/thing']),
    });
    expect(t.valid).toBe(false);
    expect(t.issues.map((i) => i.code).sort()).toEqual(['card_limit', 'unresolved_reference']);
    const feed = await m.momentum.feed();
    expect(feed.items.map((i) => i.path)).toContain('Harness/Issue/guard-r2');
    expect(feed.items.map((i) => i.path)).not.toContain('Product/Feature/offline');
    expect(feed.counts.verification.unverified).toBe(2);
  });

  it('approves onto the main line without touching other files', async () => {
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
  });

  it('marks an approved implementable entity entity_ahead', async () => {
    const events: string[] = [];
    m.bus.on('entity_ahead', (e) => events.push(e.path));
    await run('r3', { 'knowledge-graph/Product/Feature/swipe.md': entity('Product/Feature', 'Swipe to approve', 'Right approves.') });
    await m.momentum.approve('alpha', 'Product/Feature/swipe', 1000);
    expect((await m.momentum.entity('alpha', 'Product/Feature/swipe')).sync).toBe('entity_ahead');
    expect(events).toEqual(['Product/Feature/swipe']);
  });

  it('sends back into a chat run on the same branch', async () => {
    await run('r4', { 'knowledge-graph/Product/UserStory/rank.md': entity('Product/UserStory', 'Attention feed ranking', 'Ranks the feed.') });
    const { runId } = await m.momentum.sendBack('alpha', 'Product/UserStory/rank', 'Rank by importance instead.', 900);
    const r = await m.momentum.run(runId);
    expect(r).toMatchObject({ automation: 'chat', branch: 'momentum/chat/r4', targetPath: 'Product/UserStory/rank' });
    expect(r.messages[0]).toMatchObject({ role: 'user', text: 'Rank by importance instead.' });
    expect((await m.momentum.entity('alpha', 'Product/UserStory/rank')).sync).toBe('updating');
    expect((await m.momentum.chats('alpha')).chats[0]?.runId).toBe(runId);
  });

  it('merges a validated branch keeping the knowledge base out of the merge', async () => {
    const { mergeKeeping } = await import('@momentum/runs');
    const checkout = join(root, '.runs', 'alpha', 'r5');
    await addWorktree(repo, checkout, 'momentum/implementation/r5', 'refs/heads/main');
    put(checkout, 'src/app.txt', 'v2\n');
    put(checkout, 'knowledge-graph/Code/PullRequest/swipe.md', entity('Code/PullRequest', 'Swipe', 'Done.'));
    git(checkout, 'add', '-A');
    git(checkout, 'commit', '-q', '-m', 'impl');
    const merged = await mergeKeeping(repo, 'main', 'momentum/implementation/r5', 'knowledge-graph', 'merge');
    expect(merged?.changed).toEqual(['src/app.txt']);
    expect(readFileSync(join(repo, 'src/app.txt'), 'utf8')).toMatch(/^v2\r?\n$/);
    expect(git(repo, 'ls-tree', '-r', '--name-only', 'main', 'knowledge-graph/Code')).toBe('');
  });
});

describe('orchestrator', () => {
  it('queues scheduled loops while the feed has room and starts them within the concurrency limit', async () => {
    const { Orchestrator } = await import('../src/orchestrator.ts');
    const { createBus } = await import('../src/events.ts');
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
    for (const name of ['exploration', 'preparation', 'retention']) put(repo, `knowledge-graph/Harness/Trigger/${name}.md`, trigger(name));
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'triggers');

    const created: string[] = [];
    const started: string[] = [];
    const queue: { workspace: string; id: string; automation: string }[] = [];
    const stub = {
      hasOpenRun: async () => false,
      hasOpenRunOnBranch: async () => false,
      lastStart: async () => null,
      create: async (r: { automation: string }) => {
        created.push(r.automation);
        queue.push({ workspace: 'alpha', id: r.automation, automation: r.automation });
        return r.automation;
      },
      queued: async () => queue.filter((q) => !started.includes(q.id)),
      activeCount: () => started.length,
      start: async (id: string) => void started.push(id),
    };
    const o = new Orchestrator(m.workspaces, m.settings, m.guard, stub as never, m.automations, createBus());

    await m.settings.put({ feedSize: 1, agents: { concurrentPerProject: 2, concurrentTotal: 8 } });
    await o.tick();
    expect(created).toEqual([]); // the feed is at its limit: loops pause

    await m.settings.put({ feedSize: 40 });
    await o.tick();
    expect(created.sort()).toEqual(['exploration', 'preparation', 'retention']);
    expect(started).toHaveLength(2); // two runs per project
  });

  it('builds the knowledge graph of an enabled project while the feed has room, until the user stops it', async () => {
    const { Orchestrator } = await import('../src/orchestrator.ts');
    const { createBus } = await import('../src/events.ts');
    const created: { automation: string; branch?: string | null; prompt: string }[] = [];
    const stopped: string[] = [];
    const stub = {
      hasOpenRun: async (_ws: string, automation: string) => created.some((r) => r.automation === automation),
      hasOpenRunOnBranch: async () => false,
      lastStart: async () => new Date(), // scheduled loops are not due
      create: async (r: { automation: string; branch?: string | null; prompt: string }) => {
        created.push(r);
        return r.automation;
      },
      stopAutomation: async (_ws: string, automation: string) => {
        stopped.push(automation);
        return [];
      },
      queued: async () => [],
      activeCount: () => 0,
      start: async () => undefined,
    };
    const o = new Orchestrator(m.workspaces, m.settings, m.guard, stub as never, m.automations, createBus());
    const ws = await m.workspaces.get('alpha');

    expect((await m.momentum.mapping('alpha')).state).toBeNull(); // nothing until the project is enabled
    await o.tick();
    expect(created).toEqual([]);

    await m.settings.setMapping('alpha', 'building');
    await o.tick();
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ automation: 'mapping', branch: 'momentum/mapping/alpha' });
    expect(created[0]!.prompt).toMatch(/first mapping run/);
    expect(created[0]!.prompt).toMatch(/room for \d+ more items: write at most \d+ entities/);
    await o.tick();
    expect(created).toHaveLength(1); // one run at a time

    await m.settings.setMappingProgress('alpha', 'Top level covered; services next.');
    created.length = 0;
    await o.tick();
    expect(created[0]!.prompt).toContain('Top level covered; services next.');

    await m.settings.put({ feedSize: 1 });
    created.length = 0;
    await o.tick();
    expect(created).toEqual([]); // the feed is at its limit: the build pauses
    await m.settings.put({ feedSize: 40 });

    await o.setMapping(ws, false);
    expect(stopped).toEqual(['mapping']);
    const status = await m.momentum.mapping('alpha');
    expect(status).toMatchObject({ state: 'stopped', progress: 'Top level covered; services next.', entities: 0, spentMs: 0, coverage: null, estimate: null });
    expect(status.since).not.toBeNull();

    // A run that took 10 minutes and 8% of the 5-hour limit for a quarter of the repository: the full build is four times that
    await ws.index.sql`insert into ${ws.index.sql(`${ws.index.schema}.run`)} ${ws.index.sql({
      id: 'map1',
      automation: 'mapping',
      branch: 'momentum/mapping/alpha',
      checkout: join(root, '.runs', 'alpha', 'map1'),
      trigger: 'event',
      status: 'finished',
      started_at: new Date(Date.now() - 600_000),
      ended_at: new Date(),
      usage_five_hour: 8,
      usage_week: 1,
    })}`;
    await m.settings.setMappingCoverage('alpha', 0.25);
    const estimated = await m.momentum.mapping('alpha');
    expect(estimated.runs).toBe(1);
    expect(estimated.spentMs).toBeGreaterThanOrEqual(599_000);
    expect(estimated.estimate!.totalMs).toBeGreaterThanOrEqual(4 * 599_000);
    expect(estimated.estimate!.usage).toEqual({ fiveHour: 32, week: 4 });
    await o.tick();
    expect(created).toEqual([]); // stopped: nothing queued

    await o.setMapping(ws, true);
    await o.tick();
    expect(created.map((r) => r.automation)).toEqual(['mapping']); // resumed
    await o.setMapping(ws, false);
  });
});

describe('guard hooks in a run', () => {
  it('flags a bad write at once and blocks the run from stopping until it is fixed', async () => {
    const { guardHooks } = await import('../src/hooks.ts');
    const checkout = join(root, '.runs', 'alpha', 'r6');
    await addWorktree(repo, checkout, 'momentum/chat/r6', 'refs/heads/main');
    const ref = { id: 'r6', workspace: 'alpha', automation: 'chat', branch: 'momentum/chat/r6', checkout, targetPath: null };
    const hooks = guardHooks(m.guard, ref);
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
    const checkout = join(root, '.runs', 'alpha', 'r7');
    await addWorktree(repo, checkout, 'momentum/preparation/r7', 'refs/heads/main');
    const ref = { id: 'r7', workspace: 'alpha', automation: 'preparation', branch: 'momentum/preparation/r7', checkout, targetPath: null };
    const stop = guardHooks(m.guard, ref, async () => 'Summarize:\n- plans/fix-crash.md (added)').Stop![0]!.hooks[0]!;
    const opts = { signal: new AbortController().signal };
    const base = { session_id: 's', transcript_path: '', cwd: checkout, hook_event_name: 'Stop' };

    expect(await stop({ ...base, stop_hook_active: false } as never, undefined, opts)).toMatchObject({
      decision: 'block',
      reason: expect.stringContaining('plans/fix-crash.md'),
    });
    expect(await stop({ ...base, stop_hook_active: true } as never, undefined, opts)).toEqual({});
  });
});

describe('reset', () => {
  it('removes every entity and database entry of a project and builds its knowledge graph afresh', async () => {
    const { Orchestrator } = await import('../src/orchestrator.ts');
    const { createBus } = await import('../src/events.ts');
    const created: { automation: string; branch?: string | null }[] = [];
    const stub = {
      stopWorkspace: async () => undefined,
      hasOpenRun: async () => false,
      hasOpenRunOnBranch: async () => false,
      lastStart: async () => new Date(),
      create: async (r: { automation: string; branch?: string | null }) => {
        created.push(r);
        return r.automation;
      },
      queued: async () => [],
      activeCount: () => 0,
      start: async () => undefined,
    };
    const o = new Orchestrator(m.workspaces, m.settings, m.guard, stub as never, m.automations, createBus());
    expect(git(repo, 'ls-tree', '-r', '--name-only', 'main', 'knowledge-graph')).not.toBe('');
    expect(git(repo, 'branch', '--list', 'momentum/*')).not.toBe('');
    const code = readFileSync(join(repo, 'src/app.txt'), 'utf8');

    await o.reset(await m.workspaces.get('alpha'));
    // the build starts again from the top
    await vi.waitFor(() => expect(created.map((r) => r.automation)).toContain('mapping'));

    expect(git(repo, 'ls-tree', '-r', '--name-only', 'main', 'knowledge-graph')).toBe('');
    expect(git(repo, 'branch', '--list', 'momentum/*')).toBe('');
    expect(git(repo, 'status', '--porcelain')).toBe('');
    expect(readFileSync(join(repo, 'src/app.txt'), 'utf8')).toBe(code); // code is untouched
    expect((await m.momentum.types('alpha')).total).toBe(0);
    expect((await m.momentum.chats('alpha')).chats).toEqual([]);
    expect((await m.momentum.feed()).items).toEqual([]);
    const status = await m.momentum.mapping('alpha');
    expect(status).toMatchObject({ state: 'building', progress: null, runs: 0, entities: 0, resettable: true });
    expect((await m.settings.enabled()).map((p) => p.name)).toEqual(['alpha']);

    await expect(o.reset(await m.workspaces.get('momentum'))).rejects.toThrow(/cannot be reset/);
  });
});
