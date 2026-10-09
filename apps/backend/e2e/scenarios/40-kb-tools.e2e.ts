import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { until } from '../support/api.ts';
import { graphIssues } from '../support/check.ts';
import { REPO } from '../support/env.ts';
import { expect, scenario } from '../support/fixtures.ts';
import { type Move, move, type Turn } from '../support/scripted.ts';

const WS = 'bookshelf-api';
const API = 'Architecture/Api/books-api';
const STORE = 'Architecture/Component/book-store';
const PRODUCT = 'Product/Product/bookshelf';
const FEATURE = 'Product/Feature/search-by-year';
const kbTool = (tool: string) => `mcp__momentum-kb__${tool}`;
const kb = (tool: string, input: Record<string, unknown>): Move => ({ tool: kbTool(tool), input });
/** The entity a call names, however the model spelled its path */
const pathOf = (r: Turn['results'][number]) =>
  String((r.input as { path?: unknown } | undefined)?.path ?? '')
    .replace(/^knowledge-graph\//, '')
    .replace(/\.md$/, '');

const frontmatter = (references: { to: string; relation: string }[]) => ({
  type: 'Product/Feature',
  origin: 'requested',
  verification: 'unverified',
  sync: 'synced',
  product_impact: 3,
  timeline_impact: 1,
  unlocks: 2,
  references,
  artifacts: [],
});
const good = {
  path: FEATURE,
  title: 'Search books by year',
  body: '`GET /books?year=<year>` answers the books published that year, so a reader finds what came out when.',
  frontmatter: frontmatter([{ to: API, relation: 'extends' }]),
};
// Depending on an entity that does not exist
const bad = {
  ...good,
  frontmatter: frontmatter([{ to: 'Product/Feature/tags', relation: 'depends_on' }]),
};

// A run that works through the knowledge base's own tools rather than the files
scenario('kb-tools', { enabled: [WS] }, async ({ env, api, app, model, step }) => {
  /** What the tools answered the run, as its last request carried them */
  let seen: Turn['results'] = [];
  const calls = (tool: string) => seen.filter((r) => r.tool === kbTool(tool));
  model.on('works through the tools', (t) => t.automation === 'chat' && t.kind === 'prompt' && /by year/.test(t.input), (t) => {
    seen = t.results;
    return [
      kb('types', {}),
      kb('search', { query: 'how a book is looked up by its id', depth: 1 }),
      kb('read', { path: API }),
      kb('references', { path: API }),
      kb('write', bad),
      kb('write', good),
      move.say('Proposed searching by year, through the tools.'),
    ];
  });

  const chat = await step(0, async () => {
    const chat = await app.chat(
      WS,
      'Propose a Product/Feature for searching books by year, working through the momentum-kb tools: list the types, search the knowledge base, read the API card and its references, then write the entity.',
    );
    expect((await api.runEnded(chat, 10 * 60_000)).status).toBe('finished');
    if (!model.live) expect(seen.map((r) => r.tool)).toEqual(['types', 'search', 'read', 'references', 'write', 'write'].map(kbTool));
    // Live, the model orders, repeats and adds calls its own way: each tool it was asked for was called, and answered as below
    const [types, search] = [calls('types')[0], calls('search')[0]];
    const read = calls('read').find((r) => pathOf(r) === API);
    const references = calls('references').find((r) => pathOf(r) === API);
    for (const [tool, call] of Object.entries({ types, search, read, references })) expect(call, `a ${tool} call`).toBeDefined();
    // Every type of entity-types.tsv, with what it is for
    // The rows of the file that are types: three columns, none empty
    const tsv = readFileSync(join(REPO, 'docs', 'entity-types.tsv'), 'utf8')
      .split(/\r?\n/)
      .slice(1)
      .filter((row) => row.split('\t').length === 3 && row.split('\t').every((c) => c.trim()));
    const rows = tsv.map((row) => {
      const [domain, type, description] = row.split('\t');
      return `${domain}/${type}\t${description}`;
    });
    const listed = types!.text.split('\n').filter(Boolean);
    // A query narrows the list to some of them
    if ((types!.input as { query?: string } | undefined)?.query?.trim()) for (const line of listed) expect(rows).toContain(line);
    else {
      expect(listed).toHaveLength(tsv.length);
      for (const row of rows) expect(listed).toContain(row);
    }
    // By meaning: the API answers the question, and the store it depends on comes along the reference
    const hits = JSON.parse(search!.text) as { path: string }[];
    expect(hits.length).toBeGreaterThan(0);
    // The real model's own query finds what it finds
    if (!model.live) {
      expect(hits.map((h) => h.path)).toContain(API);
      expect(hits.map((h) => h.path)).toContain(STORE);
    }
    // The card as it stands in the run's checkout
    expect(read!.text.trim()).toBe(env.show(WS, `knowledge-graph/${API}.md`));
    // Both directions, with the relation and the other end
    const refs = JSON.parse(references!.text) as { path: string; direction: string; relation: string; title: string | null; type: string | null }[];
    expect(refs).toContainEqual(expect.objectContaining({ path: STORE, direction: 'out', relation: 'depends_on', type: 'Architecture/Component' }));
    expect(refs).toContainEqual(expect.objectContaining({ path: PRODUCT, direction: 'in', relation: 'consists_of', type: 'Product/Product' }));
    return chat;
  });

  await step(1, async () => {
    const writes = calls('write');
    // Only the script writes a bad entity first; the real model writes what it means to, named its own way
    if (!model.live) {
      const [refused] = writes;
      // Answered with what the guard raises: the reference that does not resolve; the file is written all the same
      const answer = JSON.parse(refused!.text) as { wrote: string; issues: { code: string; message: string }[] };
      expect(answer.wrote).toBe(`knowledge-graph/${FEATURE}.md`);
      expect(answer.issues.map((i) => i.code)).toEqual(['unresolved_reference']);
      expect(answer.issues.find((i) => i.code === 'unresolved_reference')?.message).toContain('Product/Feature/tags');
      // The guard told the run at once, after the bad write and not before
      const turns = model.turns(chat).filter((t) => t.kind === 'prompt');
      expect(turns.find((t) => t.step === 4)?.flagged).toBe(false);
      expect(turns.find((t) => t.step === 5)?.flagged).toBe(true);
    }
    const accepted = writes.at(-1)!;
    const feature = model.live ? pathOf(accepted) : FEATURE;
    const title = model.live ? String((accepted.input as { title?: unknown }).title) : 'Search books by year';
    expect(accepted.text).toBe(`Wrote knowledge-graph/${feature}.md`);
    // Written right, it landed valid and waits in the feed
    const [t] = await env.sql<{ status: string; commit: string | null }[]>`select status, commit from ${env.sql('ws_bookshelf_api.transaction')} where run_id = ${chat}`;
    expect(t!.status).toBe('validated');
    expect(t!.commit).toBeTruthy();
    const landed = env.show(WS, `knowledge-graph/${feature}.md`)!;
    expect(landed).toContain(`# ${title}`);
    expect(landed).not.toContain('Product/Feature/tags');
    expect(graphIssues(env, WS)).toEqual([]);
    expect((await api.entity(WS, feature)).verification).toBe('unverified');
    await until('the feature in the feed', async () => (await api.feed()).items.some((i) => i.path === feature));
    await app.entity(WS, feature);
  });
});
