import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { until } from '../support/api.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { commitsOf } from '../support/landed.ts';
import { TODO_GRAPH } from '../support/life.ts';
import { entityText, messageFileOf, move, type Move } from '../support/scripted.ts';

const WS = 'todo-cli';
const STORE = 'Architecture/Component/store';
const STORE_JS = 'src/store.js';
const CLI_JS = 'src/cli.js';
/** The line of the store a chat changes */
const LINE = "throw new Error('a to-do needs some text');";
const RUN_LINE = "throw new Error('a to-do needs some text; nothing was added');";
const CLI_COMMENT = '// The command line';
const STORE_COMMENT = '// Everything the CLI keeps';
/** A goal the user wrote and approves while a chat works */
const GOAL = 'Product/Goal/offline';
const NOTE = 'A note the user commits while a chat works.';

// The graph is built; the user and the runs share the project's one working directory, on its one main line
scenario('working-alongside', { enabled: [WS], graphBuild: 'complete' }, async ({ env, api, app, model, step }) => {
  const dir = env.path(WS);
  /** A file as the working directory has it */
  const mine = (file: string) => readFileSync(join(dir, file), 'utf8');
  /** The working directory against the main line: files changed but not staged, staged, and unknown to git */
  const lines = (...args: string[]) => env.git(WS, ...args).split('\n').filter(Boolean).sort();
  const status = () => ({
    changed: lines('diff', '--name-only'),
    staged: lines('diff', '--cached', '--name-only'),
    untracked: lines('ls-files', '--others', '--exclude-standard'),
  });
  const clean = { changed: [], staged: [], untracked: [] };
  const worktrees = () => env.git(WS, 'worktree', 'list').split('\n').filter(Boolean);

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
  // Each chat describes its work only once the scenario has looked at the working directory: held at the network, live too
  let release = () => {};
  let held = Promise.resolve();
  const hold = () => (held = new Promise<void>((r) => (release = r)));
  model.on('describes once let through', { automation: 'chat', kind: 'commit-message' }, (t) => {
    const file = messageFileOf(t.input);
    const subject = (t.inputs[0] ?? '').split('\n')[0]!.slice(0, 60);
    const message: Move[] = file ? [{ tool: 'Write', input: { file_path: file, content: `${subject}\n` } }, move.say('Described.')] : [move.say('Done.')];
    return [move.gate(held), ...message];
  });
  /** Starts a chat and waits until it describes its work, its changes still in the working directory */
  const working = async (question: string) => {
    hold();
    const chat = await app.chat(WS, question);
    await until('the run to describe its work', async () => model.turns(chat).some((t) => t.kind === 'commit-message'), 10 * 60_000);
    return chat;
  };

  await step(0, async () => {
    env.commit(WS, TODO_GRAPH, 'Map the repository');
    await until('the graph indexed', async () => (await api.entities(WS)).some((e) => e.path === STORE));
    const before = env.head(WS);
    const chat = await working(`In ${STORE_JS}, make the error for an empty to-do say "a to-do needs some text; nothing was added". Change nothing else.`);
    // The chat writes in the project's own working directory, and nothing stands beside it
    expect(mine(STORE_JS)).toContain(RUN_LINE);
    expect(env.show(WS, STORE_JS)).not.toContain(RUN_LINE);
    expect(worktrees()).toHaveLength(1);
    release();
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    // One commit on the main line, right on top of where it started
    const [landed] = await commitsOf(env, WS, chat);
    expect(landed).toBeTruthy();
    expect(env.head(WS)).toBe(landed);
    expect(env.git(WS, 'rev-parse', `${landed}^`)).toBe(before);
    expect(env.show(WS, STORE_JS)).toContain(RUN_LINE);
    expect(env.git(WS, 'rev-parse', 'HEAD')).toBe(env.head(WS));
    expect(status()).toEqual(clean);
  });

  await step(1, async () => {
    await api.idle(WS, 5 * 60_000);
    const chat = await working(`Add the comment "${CLI_COMMENT}" right after the shebang line of ${CLI_JS}. Change nothing else.`);
    // Meanwhile the user commits a file of their own, in the same working directory
    const theirs = env.commitOnly(WS, { 'README.md': `${mine('README.md')}\n${NOTE}\n` }, 'Add a note');
    expect(env.show(WS, CLI_JS)).not.toContain(CLI_COMMENT);
    release();
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    // The chat's commit lands on top of the user's, on one straight line, and keeps both
    const [landed] = await commitsOf(env, WS, chat);
    expect(env.head(WS)).toBe(landed);
    expect(env.git(WS, 'rev-parse', `${landed}^`)).toBe(theirs);
    expect(env.git(WS, 'rev-list', '--merges', `${theirs}..main`)).toBe('');
    expect(env.show(WS, CLI_JS)).toContain(CLI_COMMENT);
    expect(env.show(WS, 'README.md')).toContain(NOTE);
    expect(status()).toEqual(clean);
  });

  await step(2, async () => {
    await api.idle(WS, 5 * 60_000);
    env.commit(WS, { [`knowledge-graph/${GOAL}.md`]: entityText({ type: 'Product/Goal', origin: 'user', title: 'Work offline', card: 'The to-dos are there without a network.', references: [{ to: 'Product/Product/todo-cli', relation: 'part_of' }] }) }, 'Add the offline goal');
    await until('the goal in the feed', async () => (await api.feed()).items.some((i) => i.path === GOAL));
    const chat = await working(`Add the comment "${STORE_COMMENT}" as the first line of ${STORE_JS}. Change nothing else.`);
    // The user approves the goal while the chat works: the approval reaches the working directory, the chat's edit stays
    await app.approve(WS, GOAL);
    expect(mine(`knowledge-graph/${GOAL}.md`)).toMatch(/^verification: verified$/m);
    expect(mine(STORE_JS).startsWith(STORE_COMMENT)).toBe(true);
    // Beside them only what the chat leaves to land with it: its edit and its transcript
    expect(status()).toEqual({ changed: [STORE_JS], staged: [], untracked: [`chats/${chat}.jsonl`] });
    release();
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    // The chat's commit keeps the approval
    expect(env.show(WS, STORE_JS)!.startsWith(STORE_COMMENT)).toBe(true);
    expect(env.show(WS, `knowledge-graph/${GOAL}.md`)).toMatch(/^verification: verified$/m);
    expect((await api.entity(WS, GOAL)).verification).toBe('verified');
    expect(status()).toEqual(clean);
    await app.tab('Timeline');
  });
});
