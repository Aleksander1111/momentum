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
const kb = (tool: string, input: Record<string, unknown>): Move => ({ tool: `mcp__momentum-kb__${tool}`, input });

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
    expect(seen.map((r) => r.tool)).toEqual(['types', 'search', 'read', 'references', 'write', 'write'].map((x) => `mcp__momentum-kb__${x}`));
    const [types, search, read, references] = seen;
    // Every type of entity-types.tsv, with what it is for
    // The rows of the file that are types: three columns, none empty
    const tsv = readFileSync(join(REPO, 'docs', 'entity-types.tsv'), 'utf8')
      .split(/\r?\n/)
      .slice(1)
      .filter((row) => row.split('\t').length === 3 && row.split('\t').every((c) => c.trim()));
    const listed = types!.text.split('\n').filter(Boolean);
    expect(listed).toHaveLength(tsv.length);
    for (const row of tsv) {
      const [domain, type, description] = row.split('\t');
      expect(listed).toContain(`${domain}/${type}\t${description}`);
    }
    // By meaning: the API answers the question, and the store it depends on comes along the reference
    const hits = JSON.parse(search!.text) as { path: string }[];
    expect(hits.map((h) => h.path)).toContain(API);
    expect(hits.map((h) => h.path)).toContain(STORE);
    // The card as it stands in the run's checkout
    expect(read!.text.trim()).toBe(env.show(WS, `knowledge-graph/${API}.md`));
    // Both directions, with the relation and the other end
    const refs = JSON.parse(references!.text) as { path: string; direction: string; relation: string; title: string | null; type: string | null }[];
    expect(refs).toContainEqual(expect.objectContaining({ path: STORE, direction: 'out', relation: 'depends_on', type: 'Architecture/Component' }));
    expect(refs).toContainEqual(expect.objectContaining({ path: PRODUCT, direction: 'in', relation: 'consists_of', type: 'Product/Product' }));
    return chat;
  });

  await step(1, async () => {
    const [, , , , refused, accepted] = seen;
    // Answered with what the guard raises: the reference that does not resolve; the file is written all the same
    const answer = JSON.parse(refused!.text) as { wrote: string; issues: { code: string; message: string }[] };
    expect(answer.wrote).toBe(`knowledge-graph/${FEATURE}.md`);
    expect(answer.issues.map((i) => i.code)).toEqual(['unresolved_reference']);
    expect(answer.issues.find((i) => i.code === 'unresolved_reference')?.message).toContain('Product/Feature/tags');
    expect(accepted!.text).toBe(`Wrote knowledge-graph/${FEATURE}.md`);
    // The guard told the run at once, after the bad write and not before
    const turns = model.turns(chat).filter((t) => t.kind === 'prompt');
    expect(turns.find((t) => t.step === 4)?.flagged).toBe(false);
    expect(turns.find((t) => t.step === 5)?.flagged).toBe(true);
    // Written right, it landed valid and waits in the feed
    const [t] = await env.sql<{ status: string; commit: string | null }[]>`select status, commit from ${env.sql('ws_bookshelf_api.transaction')} where run_id = ${chat}`;
    expect(t!.status).toBe('validated');
    expect(t!.commit).toBeTruthy();
    const landed = env.show(WS, `knowledge-graph/${FEATURE}.md`)!;
    expect(landed).toContain('# Search books by year');
    expect(landed).not.toContain('Product/Feature/tags');
    expect(graphIssues(env, WS)).toEqual([]);
    expect((await api.entity(WS, FEATURE)).verification).toBe('unverified');
    await until('the feature in the feed', async () => (await api.feed()).items.some((i) => i.path === FEATURE));
    await app.entity(WS, FEATURE);
  });
});
