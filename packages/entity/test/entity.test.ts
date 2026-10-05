import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  entityLinkTarget,
  entityLinks,
  entityPathOf,
  loadEntityTypes,
  parseEntity,
  serializeEntity,
  toCard,
  validateEntity,
  validateText,
} from '../src/index.ts';

const fixture = readFileSync(join(import.meta.dirname, 'fixtures/private-mesh.md'), 'utf8');
const types = loadEntityTypes(join(import.meta.dirname, '../../../docs/entity-types.tsv'));
const path = 'Governance/Decision/remote-access/private-mesh';

describe('parse', () => {
  it('reads frontmatter, title and card', () => {
    const e = parseEntity(fixture);
    expect(e.title).toBe('Remote access over a private mesh');
    expect(e.frontmatter.type).toBe('Governance/Decision');
    expect(e.frontmatter.references).toEqual([{ to: 'Architecture/Api/session', relation: 'depends_on' }]);
    expect(e.frontmatter.origin).toBe('automation');
    expect(e.body.startsWith('No port')).toBe(true);
  });

  it('round-trips through serialize', () => {
    const e = parseEntity(fixture);
    expect(parseEntity(serializeEntity(e))).toEqual(e);
  });

  it('maps files to entity paths', () => {
    expect(entityPathOf('knowledge-graph/Governance/Decision/remote-access/private-mesh.md')).toBe(path);
    expect(entityPathOf('docs/SPEC.md')).toBeNull();
  });
});

describe('validate', () => {
  const ctx = { characterLimit: 700, types, resolves: (p: string) => p === 'Architecture/Api/session' };

  it('accepts the golden fixture', () => {
    expect(validateEntity(path, parseEntity(fixture), ctx)).toEqual([]);
  });

  it('flags card limit, unresolved references, unknown type and path mismatch', () => {
    const e = parseEntity(fixture);
    const codes = validateEntity('Product/Feature/x', e, { ...ctx, characterLimit: 50, resolves: () => false }).map(
      (i) => i.code,
    );
    expect(codes).toEqual(['type_path_mismatch', 'card_limit', 'unresolved_reference']);
    const unknown = { ...e, frontmatter: { ...e.frontmatter, type: 'Nope/Thing' } };
    expect(validateEntity('Nope/Thing/x', unknown, ctx).map((i) => i.code)).toEqual(['unknown_type']);
  });

  it('rejects mermaid diagrams', () => {
    const e = parseEntity(fixture);
    const mermaid = { ...e, body: e.body.replace(/```plantuml[\s\S]*```/, '```mermaid\nflowchart LR\n  A --> B\n```') };
    expect(validateEntity(path, mermaid, ctx).map((i) => i.code)).toEqual(['mermaid_diagram']);
  });

  it('accepts entity links in the card that are among its references, and flags the others', () => {
    const e = parseEntity(fixture);
    const linked = { ...e, body: `Reached through [the session API](Architecture/Api/session).\n\n${e.body}` };
    expect(validateEntity(path, linked, ctx)).toEqual([]);
    const unlisted = { ...e, body: `See [the feed](knowledge-graph/Architecture/Component/attention-feed.md).\n\n${e.body}` };
    const issues = validateEntity(path, unlisted, ctx);
    expect(issues.map((i) => i.code)).toEqual(['unlisted_link']);
    expect(issues[0]!.message).toContain('Architecture/Component/attention-feed');
  });

  it('reports parse errors as issues', () => {
    expect(validateText(path, '# no frontmatter', ctx).issues[0]?.code).toBe('parse');
    expect(validateText(path, '---\ntype: Governance/Decision\nproduct_impact: 9\n---\n# T\n', ctx).issues[0]?.code).toBe(
      'parse',
    );
  });
});

describe('card', () => {
  it('builds blocks from the markdown AST and fills diagrams', async () => {
    const card = await toCard(parseEntity(fixture).body, async (s) => s.map((x) => `<svg>${x.length}</svg>`));
    expect(card.map((b) => b.t)).toEqual(['p', 'list', 'table', 'diagram']);
    const table = card[2];
    expect(table?.t === 'table' && table.head.length).toBe(2);
    const diagram = card[3];
    expect(diagram?.t === 'diagram' && diagram.svg).toMatch(/^<svg>/);
  });
});

describe('entity links', () => {
  it('reads entity paths from link targets and leaves everything else', () => {
    expect(entityLinkTarget('Product/Feature/offline-feed')).toBe('Product/Feature/offline-feed');
    expect(entityLinkTarget('knowledge-graph/Harness/Plan/a/b.md')).toBe('Harness/Plan/a/b');
    expect(entityLinkTarget('entity:Governance/Decision/x')).toBe('Governance/Decision/x');
    expect(entityLinkTarget('https://example.com/A/B/c')).toBeNull();
    expect(entityLinkTarget('docs/plan.md')).toBeNull();
    expect(entityLinkTarget('Product/Feature')).toBeNull();
  });

  it('lists the entities a card links, once each, outside code', () => {
    const body = [
      'Depends on [the API](Architecture/Api/session) and [the feed](Architecture/Component/attention-feed).',
      'Again [the API](Architecture/Api/session), a [site](https://example.com) and `[not](Product/Feature/x)`.',
      '```\n[nor](Product/Feature/y)\n```',
    ].join('\n\n');
    expect(entityLinks(body)).toEqual(['Architecture/Api/session', 'Architecture/Component/attention-feed']);
  });
});
