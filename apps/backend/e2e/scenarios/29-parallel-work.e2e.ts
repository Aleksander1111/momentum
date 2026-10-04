import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { until } from '../support/api.ts';
import { git } from '../support/env.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { move } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const STORE = 'Architecture/Component/book-store';
const kg = (p: string) => `knowledge-graph/${p}.md`;

// Developers keep working in the project's own checkout while runs land on its main line
scenario('parallel-work', { enabled: [WS] }, async ({ env, api, app, model, step }) => {
  const dir = env.path(WS);
  const working = (file: string) => readFileSync(join(dir, file), 'utf8');
  let gate: Promise<void> = Promise.resolve();
  let open = () => {};
  const hold = () => {
    gate = new Promise<void>((r) => (open = r));
  };

  // A chat changes one function of a file; it waits at the gate before writing, so the developer's work happens meanwhile
  model.on('chat edits', (t) => t.automation === 'chat' && t.kind === 'prompt', (t) => {
    const [, file, from, to] = /^EDIT (\S+) «(.+?)» «(.+?)»/s.exec(t.input) ?? [];
    if (!file) return undefined;
    return [move.gate(gate), move.write(t, file!, readFileSync(t.file(file!), 'utf8').replace(from!, to!)), move.say('Changed.')];
  });
  const edit = (file: string, from: string, to: string) => app.chat(WS, `EDIT ${file} «${from}» «${to}»`);

  await step(0, async () => {
    // The developer is halfway through a change to the server, not committed
    const mine = working('src/server.js').replace("send(res, 404, { error: 'not found' });", "send(res, 404, { error: 'not found', hint: 'try /books' });");
    writeFileSync(join(dir, 'src/server.js'), mine);
    const chat = await edit('src/server.js', "{ error: 'book not found' }", "{ error: 'no book with that id' }");
    expect((await api.runEnded(chat, 3 * 60_000)).status).toBe('finished');
    expect(env.show(WS, 'src/server.js')).toContain('no book with that id');
    // Their file has both changes; what they would commit is only their own
    const now = working('src/server.js');
    expect(now).toContain("hint: 'try /books'");
    expect(now).toContain('no book with that id');
    const diff = git(dir, 'diff', 'HEAD', '--', 'src/server.js');
    expect(diff).toContain("+    send(res, 404, { error: 'not found', hint: 'try /books' });");
    expect(diff).not.toContain('no book with that id');
    git(dir, 'commit', '-q', '-am', 'Hint at /books on a 404');
    expect(env.show(WS, 'src/server.js')).toContain('no book with that id');
    expect(env.show(WS, 'src/server.js')).toContain("hint: 'try /books'");
  });

  await step(1, async () => {
    hold();
    const chat = await edit('src/store.js', 'return list;', 'return [...list];');
    await until('the chat at work', async () => model.turns(chat).length > 0);
    env.commit(WS, { 'src/store.js': env.show(WS, 'src/store.js')!.replace('return list.find((book) => book.id === id);', 'return list.find((book) => book.id === Number(id));') }, 'Accept ids as strings');
    open();
    expect((await api.runEnded(chat, 3 * 60_000)).status).toBe('finished');
    const store = env.show(WS, 'src/store.js')!;
    expect(store).toContain('return [...list];');
    expect(store).toContain('book.id === Number(id)');
    expect(await api.entities(WS, 'Harness/Conflict')).toEqual([]);
  });

  model.on('the conflict resolved', (t) => t.automation === 'chat' && t.kind === 'prompt' && t.target?.startsWith('Harness/Conflict/') === true, (t) => [
    move.write(t, 'src/store.js', readFileSync(t.file('src/store.js'), 'utf8').replace("year ?? 'unknown'", 'year ?? null')),
    move.remove(t, kg(t.target!)),
    move.say('Kept the developer’s null year and retired the conflict.'),
  ]);

  await step(2, async () => {
    hold();
    const chat = await edit('src/store.js', 'const book = { id: list.length + 1, title, author, year };', "const book = { id: list.length + 1, title, author, year: year ?? 'unknown' };");
    await until('the chat at work', async () => model.turns(chat).length > 0);
    env.commit(WS, { 'src/store.js': env.show(WS, 'src/store.js')!.replace('const book = { id: list.length + 1, title, author, year };', 'const book = { id: list.length + 1, title, author, year: year ?? null };') }, 'Store a missing year as null');
    open();
    expect((await api.runEnded(chat, 3 * 60_000)).status).toBe('finished');
    const [conflict] = await until('the conflict raised', async () => {
      const rows = await api.entities(WS, 'Harness/Conflict');
      return rows.length ? rows : null;
    });
    expect(conflict!.frontmatter.artifacts).toEqual(['src/store.js']);
    expect((await api.entity(WS, conflict!.path)).references.map((r) => r.path)).toContain(STORE);
    const resolve = await app.sendBack(WS, conflict!.path, 'Keep my null year.');
    expect((await api.runEnded(resolve, 3 * 60_000)).status).toBe('finished');
    expect(env.show(WS, 'src/store.js')).toContain('year: year ?? null');
    expect(env.show(WS, kg(conflict!.path))).toBeNull();
  });

  await step(3, async () => {
    // A feature branch, checked out in the project, while the harness goes on
    git(dir, 'checkout', '-q', '-b', 'feature/search');
    writeFileSync(join(dir, 'src/search.js'), 'export const search = (books, q) => books.filter((b) => b.title.includes(q));\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'Start search');
    const chat = await edit('src/store.js', 'return [...list];', 'return list.slice();');
    expect((await api.runEnded(chat, 3 * 60_000)).status).toBe('finished');
    expect(env.show(WS, 'src/store.js')).toContain('return list.slice();');
    expect(git(dir, 'show', 'feature/search:src/store.js')).not.toContain('return list.slice();');
    // The machine restarts while the branch is checked out: the main line is still main
    env.stop();
    await env.start();
    await app.open();
    const after = await edit('src/server.js', 'no book with that id', 'no book with id');
    expect((await api.runEnded(after, 3 * 60_000)).status).toBe('finished');
    expect(env.show(WS, 'src/server.js')).toContain('no book with id');
    expect(git(dir, 'show', 'feature/search:src/server.js')).not.toContain('no book with id');
    expect(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('feature/search');
    // The branch is merged: the main line picks it up
    git(dir, 'checkout', '-q', 'main');
    git(dir, 'merge', '-q', '--no-edit', 'feature/search');
    await until('the merge indexed', async () => {
      const [r] = await env.sql<{ indexed_commit: string }[]>`select indexed_commit from harness.project where name = ${WS}`;
      return r?.indexed_commit === env.head(WS);
    }, 60_000);
    expect(env.show(WS, 'src/search.js')).toContain('export const search');
  });
});
