import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { commitsOf, filesOf } from '../support/landed.ts';
import { TODO_GRAPH } from '../support/life.ts';
import { messageFileOf, move, type Move } from '../support/scripted.ts';

const WS = 'todo-cli';
const STORE = 'Architecture/Component/store';
const STORE_JS = 'src/store.js';
const CLI_JS = 'src/cli.js';
/** The line of the store the run and the user both change, each their own way */
const LINE = "throw new Error('a to-do needs some text');";
const RUN_LINE = "throw new Error('a to-do needs some text; nothing was added');";
const USER_LINE = "throw new Error('a to-do needs text');";
const CLI_COMMENT = '// The command line';
const STORE_COMMENT = '// Everything the CLI keeps';

// The graph is built; the user keeps working in their checkout while runs land on the same main line
scenario('working-alongside', { enabled: [WS], graphBuild: 'complete' }, async ({ env, api, app, model, step }) => {
  /** A file as the user's checkout has it */
  const mine = (file: string) => readFileSync(join(env.path(WS), file), 'utf8');
  /** The user's checkout against the main line: files changed but not staged, staged, and unknown to git */
  const lines = (...args: string[]) => env.git(WS, ...args).split('\n').filter(Boolean).sort();
  const status = () => ({
    changed: lines('diff', '--name-only'),
    staged: lines('diff', '--cached', '--name-only'),
    untracked: lines('ls-files', '--others', '--exclude-standard'),
  });
  const clean = { changed: [], staged: [], untracked: [] };

  model.on('a chat changes the error text', (t) => t.automation === 'chat' && t.kind === 'prompt' && /nothing was added/.test(t.input), (t) => [
    move.write(t, STORE_JS, readFileSync(t.file(STORE_JS), 'utf8').replace(LINE, RUN_LINE)),
    move.say('The error says nothing was added.'),
  ]);
  model.on('a chat comments the command line', (t) => t.automation === 'chat' && t.kind === 'prompt' && t.input.includes(CLI_COMMENT), (t) => [
    move.write(t, CLI_JS, readFileSync(t.file(CLI_JS), 'utf8').replace(/^(#!.*\r?\n)/, `$1${CLI_COMMENT}\n`)),
    move.say('Commented.'),
  ]);
  model.on('a chat comments the store', (t) => t.automation === 'chat' && t.kind === 'prompt' && t.input.includes(STORE_COMMENT), (t) => [
    move.write(t, STORE_JS, `${STORE_COMMENT}\n${readFileSync(t.file(STORE_JS), 'utf8')}`),
    move.say('Commented.'),
  ]);
  // The first chat lands only once the user has committed their own change to the same line: held at the network, live too
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  model.on('lands after the user', { automation: 'chat', kind: 'commit-message' }, (t) => {
    if (!/nothing was added/.test(t.inputs[0] ?? '')) return undefined;
    const file = messageFileOf(t.input);
    const message: Move[] = file ? [{ tool: 'Write', input: { file_path: file, content: 'Say nothing was added when the text is empty\n' } }, move.say('Described.')] : [move.say('Done.')];
    return [move.gate(held), ...message];
  });

  await step(0, async () => {
    env.commit(WS, TODO_GRAPH, 'Map the repository');
    await until('the graph indexed', async () => (await api.entities(WS)).some((e) => e.path === STORE));
    const chat = await app.chat(WS, `In ${STORE_JS}, make the error for an empty to-do say "a to-do needs some text; nothing was added". Change nothing else.`);
    await until('the run to describe its work', async () => model.turns(chat).some((t) => t.kind === 'commit-message'), 10 * 60_000);
    // Meanwhile the user changes the same line their own way and commits
    const theirs = env.commit(WS, { [STORE_JS]: env.show(WS, STORE_JS)!.replace(LINE, USER_LINE) }, 'Shorten the empty to-do error');
    release();
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    // Landed on top of the user's commit, on the run's side; the user's version is in the history
    const [landed] = await commitsOf(env, WS, chat);
    expect(landed).toBeTruthy();
    expect(env.head(WS)).toBe(landed);
    expect(env.git(WS, 'rev-parse', `${landed}^`)).toBe(theirs);
    expect(env.show(WS, STORE_JS)).toContain(RUN_LINE);
    expect(env.show(WS, STORE_JS)).not.toContain(USER_LINE);
    expect(env.git(WS, 'show', `${theirs}:${STORE_JS}`)).toContain(USER_LINE);
    // The conflict, raised in the same commit over the entity over the file
    const conflict = `Harness/Conflict/${chat}`;
    expect(filesOf(env, WS, [landed!])).toEqual(expect.arrayContaining([STORE_JS, `knowledge-graph/${conflict}.md`]));
    const [t] = await env.sql<{ conflicts: string[]; status: string }[]>`select conflicts, status from ${env.sql('ws_todo_cli.transaction')} where run_id = ${chat}`;
    expect(t!.conflicts).toEqual([STORE_JS]);
    expect(t!.status).toBe('validated');
    const raised = await until('the conflict indexed', async () => api.entity(WS, conflict));
    expect(raised.verification).toBe('unverified');
    expect(raised.references.filter((r) => r.direction === 'out' && r.relation === 'concerns').map((r) => r.path)).toContain(STORE);
    expect(raised.artifacts.map((a) => a.path)).toEqual([STORE_JS]);
    await until('the conflict in the feed', async () => (await api.feed()).items.some((i) => i.path === conflict));
    // The user's checkout, clean before, follows the landing
    expect(mine(STORE_JS)).toContain(RUN_LINE);
    expect(status()).toEqual(clean);
    await app.entity(WS, conflict);
  });

  await step(1, async () => {
    await api.idle(WS, 5 * 60_000);
    // Work in progress in the user's checkout: an edit, and a file git does not know
    const readme = `${mine('README.md')}\nA note the user has not committed yet.\n`;
    writeFileSync(join(env.path(WS), 'README.md'), readme);
    writeFileSync(join(env.path(WS), 'notes.txt'), 'scratch\n');
    const chat = await app.chat(WS, `Add the comment "${CLI_COMMENT}" right after the shebang line of ${CLI_JS}. Change nothing else.`);
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    expect(env.show(WS, CLI_JS)).toContain(CLI_COMMENT);
    // The checkout has the landed file, and the user's work as they left it
    expect(mine(CLI_JS).trim()).toBe(env.show(WS, CLI_JS));
    expect(mine('README.md')).toBe(readme);
    expect(mine('notes.txt')).toBe('scratch\n');
    expect(status()).toEqual({ changed: ['README.md'], staged: [], untracked: ['notes.txt'] });
    expect(env.git(WS, 'rev-parse', 'HEAD')).toBe(env.head(WS));
  });

  await step(2, async () => {
    await api.idle(WS, 5 * 60_000);
    // The user's own unfinished edit to the store
    writeFileSync(join(env.path(WS), STORE_JS), mine(STORE_JS).replace('padStart(3)', 'padStart(4)'));
    const theirs = mine(STORE_JS);
    const chat = await app.chat(WS, `Add the comment "${STORE_COMMENT}" as the first line of ${STORE_JS}. Change nothing else.`);
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    // The main line took the run's version
    expect(env.show(WS, STORE_JS)!.startsWith(STORE_COMMENT)).toBe(true);
    expect(env.show(WS, STORE_JS)).toContain('padStart(3)');
    // The user's working copy is still theirs, and the checkout is on the main line
    expect(mine(STORE_JS)).toBe(theirs);
    expect(env.git(WS, 'rev-parse', 'HEAD')).toBe(env.head(WS));
    expect(env.git(WS, 'diff', 'HEAD', '--', STORE_JS)).toContain('padStart(4)');
    expect(status().untracked).toEqual(['notes.txt']);
    await app.tab('Timeline');
  });
});
