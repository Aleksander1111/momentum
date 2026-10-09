import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
import { HISTORY } from '../support/env.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { commitsOf, entitiesOf, filesOf, npmPasses, plainText, refs } from '../support/landed.ts';
import { entityText, move, type Turn } from '../support/scripted.ts';

const WS = 'notes-api';
const REPO_ENTITY = 'Code/Repository/notes-api';
const PRODUCT = 'Product/Product/notes-api';
const STORY = 'Product/UserStory/pin-notes';
const ROUTES = 'Architecture/Component/routes-notes';
const PINS_TEST = 'test/pins.test.ts';
const kg = (p: string) => `knowledge-graph/${p}.md`;
/** Source files a build run maps at once */
const BATCH = 4;

/** Files under a folder of a checkout, relative, with forward slashes */
const filesUnder = (dir: string, under: string): string[] =>
  readdirSync(join(dir, under), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? filesUnder(dir, `${under}/${d.name}`) : [`${under}/${d.name}`]));
/** The entity a source file maps to: src/routes/notes.ts → routes-notes */
const slug = (file: string) => file.replace(/^src\//, '').replace(/\.ts$/, '').replace(/\//g, '-');
/** A checkout's path as the run's shell takes it */
const sh = (checkout: string) => checkout.replaceAll('\\', '/');
const INSTALL = 'npm ci --prefer-offline --no-audit --no-fund';
const CHECKS = 'npm run typecheck && npm test';
/** Whether a check's output says it failed: the compiler's errors, failing tests or npm giving up */
const failed = (output: string) => /error TS\d+|^\W{0,3}fail [1-9]|npm ERR!|npm error/m.test(output);
/** The summary line node --test prints, whichever reporter it uses: # pass 16, or ℹ pass 16 */
const PASSED = /^\W{0,3}pass [1-9]\d*\s*$/m;
const INSTALLED = /added \d+ packages|up to date/;

const PINS_TEST_TS = `import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { start, type Api } from './helpers.js';

let api: Api;
before(async () => (api = await start()));
after(() => api.close());

test('a pinned note lists first; unpinned, the order is by id again', async () => {
  const pinned = await api.request('POST', '/notes/3/pin');
  assert.equal(pinned.status, 200);
  assert.equal((pinned.json as { pinned: boolean }).pinned, true);
  assert.deepEqual(((await api.request('GET', '/notes')).json as { id: number }[]).map((n) => n.id), [3, 1, 2]);
  assert.equal((await api.request('DELETE', '/notes/3/pin')).status, 200);
  assert.deepEqual(((await api.request('GET', '/notes')).json as { id: number }[]).map((n) => n.id), [1, 2, 3]);
});

test('pinning a missing note is 404', async () => {
  assert.equal((await api.request('POST', '/notes/99/pin')).status, 404);
});
`;

/** The implementation's edits, each the checkout's file with the pin support in it */
const edits = (t: Turn): [string, string][] => {
  const read = (f: string) => readFileSync(t.file(f), 'utf8');
  return [
    [
      'src/domain/note.ts',
      read('src/domain/note.ts')
        .replace("  tags: z.array(z.string()).max(20).default([]).transform(distinctTags),\n", "  tags: z.array(z.string()).max(20).default([]).transform(distinctTags),\n  /** A pinned note lists first */\n  pinned: z.boolean().default(false),\n")
        .replace('  tags: z.array(z.string()).max(20).transform(distinctTags).optional(),\n', '  tags: z.array(z.string()).max(20).transform(distinctTags).optional(),\n  pinned: z.boolean().optional(),\n'),
    ],
    [
      'src/store/memory.ts',
      read('src/store/memory.ts')
        // The sample notes only: one per line, each starting with its title
        .replace(/^(  \{ title: .*tags: \[[^\]]*\]) \},$/gm, '$1, pinned: false },')
        .replace('    all: () => notes.map((n) => ({ ...n, tags: [...n.tags] })),', '    // Pinned first, then by id\n    all: () => [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.id - b.id).map((n) => ({ ...n, tags: [...n.tags] })),')
        .replace('        tags: patch.tags ?? current.tags,\n', '        tags: patch.tags ?? current.tags,\n        pinned: patch.pinned ?? current.pinned,\n'),
    ],
    [
      'src/routes/notes.ts',
      read('src/routes/notes.ts').replace(
        '  // GET /export',
        `  // POST /notes/:id/pin keeps the note at the top of the listing; DELETE /notes/:id/pin lets it go
  for (const [method, pinned] of [['POST', true], ['DELETE', false]] as const) {
    router.on(method, '/notes/:id/pin', ({ res, params }) => {
      const note = store.update(idOf(params.id!), { pinned });
      if (!note) throw new HttpError(404, 'note not found');
      send(res, 200, note);
    });
  }

  // GET /export`,
      ),
    ],
    // The one test that builds a note by hand gets the new field
    ['test/markdown.test.ts', read('test/markdown.test.ts').replace("tags: ['work', 'meetings'], createdAt: ''", "tags: ['work', 'meetings'], pinned: false, createdAt: ''")],
    [PINS_TEST, PINS_TEST_TS],
  ];
};

// A real toolchain under the harness: dependencies to install, a compiler to satisfy and a suite to pass
scenario('typescript-service', { settings: { feedSize: 60 } }, async ({ env, api, app, model, step }) => {
  // What the shell commands answered, without the colours a reporter may add
  const checks = (t: Turn) => t.results.filter((r) => r.tool === 'Bash').map((r) => plainText(r.text));
  /** What each run's shell commands answered, by run */
  const shells = new Map<string, string[]>();
  /** The shell commands each run issued, by run: live, an install may say nothing (`npm ci >/dev/null`) */
  const commands = new Map<string, string[]>();
  const commandsOf = (t: Turn) => t.results.filter((r) => r.tool === 'Bash').map((r) => String((r.input as { command?: string }).command ?? ''));

  model.on('graph build', { automation: 'graph-build', kind: 'prompt' }, (t) => {
    const source = filesUnder(t.checkout, 'src');
    // What was mapped before this run: the script is asked again at every step, so what it wrote this turn does not count
    const dir = t.file('knowledge-graph/Architecture/Component');
    const wrote = new Set(t.wrote);
    const mapped = new Set(
      (existsSync(dir) ? readdirSync(dir) : []).filter((f) => !wrote.has(`knowledge-graph/Architecture/Component/${f}`)).map((f) => f.replace(/\.md$/, '')),
    );
    const left = source.filter((f) => !mapped.has(slug(f)));
    const batch = left.slice(0, BATCH);
    const first = !existsSync(t.file(kg(REPO_ENTITY))) || wrote.has(kg(REPO_ENTITY));
    const done = left.length <= BATCH;
    const covered = source.length - left.length + batch.length;
    return [
      ...(first
        ? [
            move.entity(t, REPO_ENTITY, {
              type: 'Code/Repository',
              title: 'notes-api repository',
              card: 'TypeScript on Node 24, ESM. `npm ci` installs zod and the dev tools; `npm run typecheck` is `tsc --noEmit`; `npm test` runs `test/*.test.ts` under `node --test` through tsx.',
              artifacts: ['package.json', 'tsconfig.json'],
            }),
          ]
        : []),
      ...batch.map((f) =>
        move.entity(t, `Architecture/Component/${slug(f)}`, {
          type: 'Architecture/Component',
          title: slug(f),
          card: `The module \`${f}\` of the notes API, ${readFileSync(t.file(f), 'utf8').split(/\r?\n/).length} lines.`,
          artifacts: [f],
          references: [{ to: REPO_ENTITY, relation: 'part_of' }],
        }),
      ),
      move.graphBuild({ complete: done, progress: `Mapped ${covered} of ${source.length} source files`, ...(first ? { documents: ['README.md', 'docs/api.md'] } : {}) }),
      move.say('Mapped a batch.'),
    ];
  });
  model.on('summarizes the documents', { automation: 'graph-build', kind: 'summarize' }, (t) =>
    /README\.md \(to map/.test(t.input)
      ? [
          move.summarize(),
          move.entity(t, PRODUCT, { type: 'Product/Product', title: 'notes-api', card: 'An HTTP API for notes with tags, search and markdown export; see `docs/api.md` for the routes.', impact: [3, 1, 2], artifacts: ['README.md', 'docs/api.md'] }),
          move.say('Summarized.'),
        ]
      : undefined,
  );

  await step(0, async () => {
    const original = env.head(WS);
    expect(Number(env.git(WS, 'rev-list', '--count', 'main'))).toBe(HISTORY[WS]!.length);
    await app.setProject(WS, true);
    await until('the build complete', async () => (await api.graphBuild(WS)).state === 'complete', 30 * 60_000, 5000);
    const builds = await api.runs(WS, 'graph-build');
    // Scripted, a run maps a batch of files; a real one may map the whole repository within the feed's room
    expect(builds.length).toBeGreaterThan(model.live ? 0 : 2);
    expect(builds.every((r) => r.status === 'finished')).toBe(true);
    expect((await api.graphBuild(WS)).completeness.score).toBeGreaterThan(0);
    // Every source file and the documents are artifacts of entities on the main line: a directory claims what is in it
    const artifacts = (await env.sql<{ artifact_path: string }[]>`select artifact_path from ${env.sql('ws_notes_api.entity_artifact')}`).map((a) => a.artifact_path);
    for (const f of filesUnder(env.path(WS), 'src')) expect(artifacts.some((a) => a === f || f.startsWith(`${a}/`)), f).toBe(true);
    expect(artifacts).toEqual(expect.arrayContaining(['README.md', 'docs/api.md', 'package.json']));
    expect(graphIssues(env, WS)).toEqual([]);
    // The history is what it was, with the build's landings on top, one commit each, none merged
    expect(env.git(WS, 'merge-base', '--is-ancestor', original, 'main')).toBe('');
    expect(env.git(WS, 'rev-list', '--merges', 'main')).toBe('');
    const landed = (await Promise.all(builds.map((r) => commitsOf(env, WS, r.id)))).flat();
    expect(landed).toHaveLength(builds.length);
    const since = env.git(WS, 'rev-list', `${original}..main`).split('\n');
    for (const c of landed) expect(since).toContain(c);
    await app.tab('Explorer');
  });

  model.on('implementation', { automation: 'implementation', kind: 'prompt' }, (t) => {
    shells.set(t.run, checks(t));
    commands.set(t.run, commandsOf(t));
    return [
      move.bash(`cd "${sh(t.checkout)}" && ${INSTALL}`),
      ...edits(t).map(([file, content]) => move.write(t, file, content)),
      move.bash(`cd "${sh(t.checkout)}" && ${CHECKS}`),
      move.say(checks(t).length >= 2 && !failed(checks(t)[1]!) ? 'Pinned notes list first; the type check and the suite pass.' : 'Pinned notes list first.'),
    ];
  });
  model.on('implementation summarizes', { automation: 'implementation', kind: 'summarize' }, (t) => [
    move.summarize(),
    move.write(
      t,
      kg(ROUTES),
      readFileSync(t.file(kg(ROUTES)), 'utf8')
        .replace('verification: verified', 'verification: unverified')
        .replace(/^references:\n/m, `references:\n  - to: ${STORY}\n    relation: implements\n`)
        .replace(/\n$/, ' `POST /notes/:id/pin` and `DELETE /notes/:id/pin` keep a note at the top of the listing.\n'),
    ),
    move.entity(t, 'Testing/TestSuite/pins-tests', { type: 'Testing/TestSuite', title: 'Pin tests', card: 'Pinning lists the note first; unpinning restores the order; a missing note is 404.', artifacts: [PINS_TEST], references: [{ to: ROUTES, relation: 'concerns' }] }),
    move.say('Summarized.'),
  ]);
  model.subject = (t) => (t.automation === 'implementation' ? 'Pin notes to the top of the listing' : `Scripted ${t.automation} work`);
  model.on('validation checks', { automation: 'validation', kind: 'prompt' }, (t) => {
    shells.set(t.run, checks(t));
    const output = checks(t)[0] ?? '';
    const broken = t.step >= 1 && failed(output);
    const said = output.split(/\r?\n/).find((l) => /error TS\d+/.test(l)) ?? output.slice(0, 200);
    return [
      move.bash(`cd "${sh(t.checkout)}" && ${INSTALL} && ${CHECKS}`),
      ...(broken
        ? [
            move.entity(t, 'Harness/Issue/checks-fail-on-main', {
              type: 'Harness/Issue',
              title: 'The checks fail on the main line',
              card: `\`npm run typecheck\` fails:\n\n\`\`\`\n${said.slice(0, 300)}\n\`\`\``,
              impact: [3, 3, 2],
              references: [{ to: REPO_ENTITY, relation: 'concerns' }],
              extra: { source: 'validation', category: 'defect', severity: 'high', options: [{ label: 'Fix the type', change: 'Give the terms their type back.' }, { label: 'Revert the commit', change: 'Undo the last commit to src/search.ts.' }], recommended: 0 },
            }),
          ]
        : []),
      move.say(broken ? 'The checks fail; raised.' : 'Every check passes.'),
    ];
  });

  const implemented = await step(1, async () => {
    // Validation runs on landed work here, and later every night once the user schedules it
    await env.trigger(WS, 'validation', { schedule: null });
    await env.trigger(WS, 'implementation');
    env.commit(
      WS,
      {
        [kg(STORY)]: entityText({
          type: 'Product/UserStory',
          origin: 'user',
          title: 'Pin a note',
          card: 'As a user I pin a note so it lists first whatever its tags: `POST /notes/:id/pin` pins it, `DELETE /notes/:id/pin` lets it go.',
          impact: [3, 2, 2],
          references: [{ to: PRODUCT, relation: 'part_of' }],
        }),
      },
      'Ask for pinned notes',
    );
    await until('the story indexed', async () => (await api.entities(WS)).some((e) => e.path === STORY));
    await api.idle(WS, 10 * 60_000);
    const original = env.head(WS);
    const since = new Date();
    await app.approve(WS, STORY);
    const run = await api.automationRan(WS, 'implementation', since, 30 * 60_000);
    expect(run.status).toBe('finished');
    expect(run.target_path).toBe(STORY);
    // It installed into its own checkout and ran the checks there, which passed
    // Scripted, the install and then the checks; live, the model runs what it likes in between, and may silence the install
    const outputs = shells.get(run.id) ?? [];
    if (model.live) expect(commands.get(run.id) ?? [], 'the install ran').toContainEqual(expect.stringMatching(/\bnpm (ci|install|i)\b/));
    else expect(outputs[0], 'the install ran').toMatch(INSTALLED);
    const checked = model.live ? outputs.findLast((o) => PASSED.test(o)) : outputs[1];
    expect(checked, `the checks ran: ${JSON.stringify(checked?.slice(-200))}`).toMatch(PASSED);
    // Live, a run may fix what a check found and check again in part: the user's checkout below judges the landed work
    if (!model.live) expect(failed(checked ?? 'npm error')).toBe(false);
    // One commit on top of the approval: code, test and cards, and nothing of the install
    const own = await commitsOf(env, WS, run.id);
    expect(own).toHaveLength(1);
    expect(env.git(WS, 'rev-list', '--count', `${original}..main`)).toBe('2');
    expect(env.head(WS)).toBe(own[0]);
    const files = filesOf(env, WS, own);
    if (model.live) {
      expect(files.some((f) => f.startsWith('src/')) && files.some((f) => f.startsWith('test/')), `code and a test among ${files}`).toBe(true);
    } else expect(files).toEqual(expect.arrayContaining(['src/domain/note.ts', 'src/store/memory.ts', 'src/routes/notes.ts', PINS_TEST, kg(ROUTES)]));
    expect(files.filter((f) => f.startsWith('node_modules/') || f === 'package-lock.json')).toEqual([]);
    const results = (await Promise.all((await entitiesOf(env, WS, run.id)).map((p) => api.entity(WS, p)))).filter((e) => refs(e, 'implements').includes(STORY));
    expect(results.length, 'an entity implementing the story').toBeGreaterThan(0);
    // The user's checkout, with the dependencies it has, passes the checks on the landed work
    expect(npmPasses(env, WS, 'typecheck').ok).toBe(true);
    const tests = npmPasses(env, WS, 'test');
    expect(tests.ok, tests.output).toBe(true);
    expect(tests.output).toMatch(model.live ? PASSED : /^\W{0,3}pass 16\s*$/m);
    // Its checkout, node_modules and all, is gone; the validation it started may be working in one of its own
    expect(existsSync(join(env.dir, 'runs', WS, run.id))).toBe(false);
    expect(env.git(WS, 'rev-list', '--merges', 'main')).toBe('');
    return run;
  });

  await step(2, async () => {
    const run = await api.automationRan(WS, 'validation', new Date(implemented.ended_at!), 30 * 60_000);
    expect(run.trigger).toBe('event');
    expect(run.status).toBe('finished');
    const outputs = shells.get(run.id) ?? [];
    const checked = model.live ? outputs.findLast((o) => PASSED.test(o)) : outputs[0];
    expect(checked, `the checks ran: ${JSON.stringify(checked?.slice(-200))}`).toMatch(PASSED);
    expect((await entitiesOf(env, WS, run.id)).filter((p) => p.startsWith('Harness/Issue/'))).toEqual([]);
    // The user breaks the type check in a commit of their own
    env.commit(WS, { 'src/search.ts': env.show(WS, 'src/search.ts')!.replace('const terms = words(query);', 'const terms: number[] = words(query);') }, 'Count the terms');
    expect(npmPasses(env, WS, 'typecheck').ok).toBe(false);
    const trigger = kg('Harness/Trigger/validation');
    const since = new Date();
    // The night comes: validation runs on its schedule
    env.commit(WS, { [trigger]: env.show(WS, trigger)!.replace(/^(on_demand: .*)$/m, '$1\nschedule: "* * * * *"') }, 'Validate every minute');
    const nightly = await api.automationRan(WS, 'validation', since, 30 * 60_000);
    expect(nightly.trigger).toBe('schedule');
    env.commit(WS, { [trigger]: env.show(WS, trigger)!.replace(/^schedule: .*$/m, 'schedule: "0 2 * * *"') }, 'Validate nightly');
    // Raised with what the compiler said, waiting in the feed
    const raised = (await entitiesOf(env, WS, nightly.id)).filter((p) => p.startsWith('Harness/Issue/'));
    expect(raised).toHaveLength(1);
    const issue = await api.entity(WS, raised[0]!);
    // The compiler's own codes: "error TS2322", or as a run quotes them, "TS2322"
    expect(issue.markdown).toMatch(/\bTS\d{4}\b/);
    expect(issue.markdown).toContain('src/search.ts');
    const item = await until('the issue in the feed', async () => (await api.feed()).items.find((i) => i.path === raised[0]));
    expect(item.issue!.severity).toBe('high');
    // The definition asks for 2-4 ways to resolve it; the script offers two
    if (model.live) expect(item.issue!.options.length).toBeGreaterThanOrEqual(2);
    else expect(item.issue!.options.length).toBe(2);
    await app.entity(WS, raised[0]!);
    // Every run's checkout went when the run ended, the dependencies installed in it too
    await api.idle(WS, 10 * 60_000);
    await until('no checkout left', async () => !existsSync(join(env.dir, 'runs', WS)) || readdirSync(join(env.dir, 'runs', WS)).length === 0, 60_000);
    expect(env.git(WS, 'worktree', 'list').split('\n')).toHaveLength(1);
  });
});
