import type {
  ArtifactView,
  Card,
  EntityDetail,
  EntityFrontmatter,
  EntityListItem,
  FeedCounts,
  FeedItem,
  Origin,
  ReferenceView,
  SearchResult,
  Sync,
  TypeNode,
  Verification,
} from '@momentum/contract';
import { typeOfPath } from '@momentum/entity';
import { schemaOf, type Sql } from './db.ts';
import { toVector } from './embeddings.ts';

export interface IndexedEntity {
  path: string;
  title: string;
  body: string;
  frontmatter: EntityFrontmatter;
  cardBlocks: Card;
  embedding: number[] | null;
}

interface EntityRow {
  path: string;
  type: string;
  title: string;
  card: string;
  origin: Origin;
  verification: Verification;
  sync: Sync;
  card_blocks: Card;
  frontmatter: EntityFrontmatter;
  contradictions: number;
}

export function artifactKind(path: string): string {
  if (path.startsWith('chats/')) return 'Chat';
  const ext = path.split('.').pop() ?? '';
  return ext === path ? 'File' : ext.toUpperCase();
}

/** The index and metrics database of one workspace: its own schema in Postgres */
export class WorkspaceIndex {
  readonly schema: string;

  constructor(
    readonly sql: Sql,
    readonly workspace: string,
  ) {
    this.schema = schemaOf(workspace);
  }

  private t(table: string) {
    return this.sql(`${this.schema}.${table}`);
  }

  // Entities

  async upsert(e: IndexedEntity, tx: Sql = this.sql): Promise<void> {
    const fm = e.frontmatter;
    const row = {
      path: e.path,
      type: fm.type,
      title: e.title,
      card: e.body,
      origin: fm.origin,
      verification: fm.verification,
      sync: fm.sync,
      card_blocks: tx.json(e.cardBlocks as never),
      frontmatter: tx.json(fm as never),
      embedding: e.embedding ? toVector(e.embedding) : null,
      updated_at: new Date(),
    };
    await tx`
      insert into ${this.t('entity')} ${tx(row)}
      on conflict (path) do update set ${tx(row, Object.keys(row).filter((k) => k !== 'path') as never)}`;
    await tx`delete from ${this.t('entity_artifact')} where entity_path = ${e.path}`;
    if (fm.artifacts.length > 0) {
      await tx`insert into ${this.t('entity_artifact')} ${tx(fm.artifacts.map((a) => ({ entity_path: e.path, artifact_path: a })))}`;
    }
    await tx`delete from ${this.t('entity_reference')} where from_path = ${e.path}`;
    const refs = new Map(fm.references.map((r) => [`${r.to}\u0000${r.relation}`, r]));
    if (refs.size > 0) {
      await tx`insert into ${this.t('entity_reference')} ${tx(
        [...refs.values()].map((r) => ({ from_path: e.path, to_path: r.to, relation_type: r.relation })),
      )}`;
    }
    await this.logState(e.path, tx);
  }

  async remove(path: string, tx: Sql = this.sql): Promise<void> {
    await tx`delete from ${this.t('entity')} where path = ${path}`;
    await this.logState(path, tx);
  }

  async setSync(path: string, sync: Sync, tx: Sql = this.sql): Promise<void> {
    await tx`update ${this.t('entity')} set sync = ${sync},
      frontmatter = jsonb_set(frontmatter, '{sync}', to_jsonb(${sync}::text)) where path = ${path}`;
    await this.logState(path, tx);
  }

  /** Appends the entity's states to its history when they changed; nulls once it is gone */
  private async logState(path: string, tx: Sql): Promise<void> {
    await tx`
      insert into ${this.t('entity_state')} (path, verification, sync)
      select p.path, e.verification, e.sync
      from (select ${path}::text as path) p
      left join ${this.t('entity')} e on e.path = p.path
      left join lateral (
        select verification, sync from ${this.t('entity_state')} where path = p.path order by at desc limit 1
      ) l on true
      where e.verification is distinct from l.verification or e.sync is distinct from l.sync`;
  }

  async row(path: string): Promise<EntityRow | null> {
    const [r] = await this.sql<EntityRow[]>`
      select path, type, title, card, origin, verification, sync, card_blocks, frontmatter, contradictions
      from ${this.t('entity')} where path = ${path}`;
    return r ?? null;
  }

  async paths(): Promise<Set<string>> {
    const rows = await this.sql<{ path: string }[]>`select path from ${this.t('entity')}`;
    return new Set(rows.map((r) => r.path));
  }

  async byArtifact(artifactPath: string): Promise<string[]> {
    const rows = await this.sql<{ entity_path: string }[]>`
      select entity_path from ${this.t('entity_artifact')} where artifact_path = ${artifactPath}`;
    return rows.map((r) => r.entity_path);
  }

  async byType(type: string): Promise<EntityRow[]> {
    return this.sql<EntityRow[]>`
      select path, type, title, card, origin, verification, sync, card_blocks, frontmatter, contradictions
      from ${this.t('entity')} where type = ${type} order by path`;
  }

  /**
   * The contradictions of every entity: the open contradiction issues the consistency check raised over it, counted
   * from the references so the figure follows the issues as they are raised and retired
   */
  async refreshContradictions(tx: Sql = this.sql): Promise<void> {
    await tx`update ${this.t('entity')} e set contradictions = (
      select count(*)::int from ${this.t('entity_reference')} x join ${this.t('entity')} i on i.path = x.from_path
      where x.to_path = e.path and x.relation_type = 'concerns' and i.type = 'Harness/Issue' and i.frontmatter->>'category' = 'contradiction')`;
  }

  async detail(path: string): Promise<EntityDetail | null> {
    const r = await this.row(path);
    if (!r) return null;
    const refs = await this.sql<{ path: string; relation: string; direction: 'out' | 'in'; title: string | null; type: string | null }[]>`
      select x.to_path as path, x.relation_type as relation, 'out' as direction, e.title, e.type
        from ${this.t('entity_reference')} x left join ${this.t('entity')} e on e.path = x.to_path
        where x.from_path = ${path}
      union all
      select x.from_path, x.relation_type, 'in', e.title, e.type
        from ${this.t('entity_reference')} x join ${this.t('entity')} e on e.path = x.from_path
        where x.to_path = ${path}`;
    const artifacts = await this.sql<{ artifact_path: string }[]>`
      select artifact_path from ${this.t('entity_artifact')} where entity_path = ${path} order by artifact_path`;
    return {
      workspace: this.workspace,
      path: r.path,
      type: r.type,
      title: r.title,
      verification: r.verification,
      sync: r.sync,
      contradictions: r.contradictions,
      origin: r.origin,
      card: r.card_blocks,
      markdown: r.card,
      references: refs.map((x) => ({ ...x }) satisfies ReferenceView),
      artifacts: artifacts.map((a) => ({ path: a.artifact_path, kind: artifactKind(a.artifact_path) }) satisfies ArtifactView),
    };
  }

  private item(r: Pick<EntityRow, 'path' | 'type' | 'title' | 'verification' | 'sync' | 'contradictions'>): EntityListItem {
    return { workspace: this.workspace, path: r.path, type: r.type, title: r.title, verification: r.verification, sync: r.sync, contradictions: r.contradictions };
  }

  /** Entities grouped by type path: Domain → Type → entities */
  async types(): Promise<{ total: number; types: TypeNode[] }> {
    const rows = await this.sql<EntityRow[]>`
      select path, type, title, verification, sync, contradictions from ${this.t('entity')} order by type, title`;
    const domains = new Map<string, TypeNode>();
    for (const r of rows) {
      const [domain = r.type, name = ''] = r.type.split('/');
      let d = domains.get(domain);
      if (!d) domains.set(domain, (d = { name: domain, path: domain, count: 0, children: [], entities: [] }));
      let t = d.children.find((c) => c.name === name);
      if (!t) d.children.push((t = { name, path: r.type, count: 0, children: [], entities: [] }));
      t.entities.push(this.item(r));
      t.count++;
      d.count++;
    }
    return { total: rows.length, types: [...domains.values()] };
  }

  /** Full text and vector search fused by reciprocal rank */
  async search(q: string, embedding: number[] | null, limit = 20): Promise<SearchResult[]> {
    const vec = embedding ? toVector(embedding) : null;
    const rows = await this.sql<(EntityRow & { score: number })[]>`
      with fts as (
        select path, row_number() over (order by ts_rank(search, websearch_to_tsquery('english', ${q})) desc) as r
        from ${this.t('entity')} where search @@ websearch_to_tsquery('english', ${q})
        limit 50
      ), vec as (
        select path, row_number() over (order by embedding <=> ${vec}::vector) as r
        from ${this.t('entity')} where ${vec}::vector is not null and embedding is not null
        order by embedding <=> ${vec}::vector
        limit 50
      ), fused as (
        select path, sum(1.0 / (60 + r)) as score from (select * from fts union all select * from vec) x group by path
      )
      select e.path, e.type, e.title, e.verification, e.sync, e.contradictions, f.score::float8 as score
      from fused f join ${this.t('entity')} e using (path)
      order by f.score desc limit ${limit}`;
    return rows.map((r) => ({ ...this.item(r), score: Number(r.score) }));
  }

  /** Graph RAG: search hits expanded along references, up to depth hops */
  async retrieve(q: string, embedding: number[] | null, limit = 10, depth = 1): Promise<SearchResult[]> {
    const hits = await this.search(q, embedding, limit);
    if (hits.length === 0 || depth === 0) return hits;
    const seeds = hits.map((h) => h.path);
    const rows = await this.sql<(EntityRow & { hops: number })[]>`
      with recursive walk(path, hops) as (
        select unnest(${seeds}::text[]), 0
        union
        select case when x.from_path = w.path then x.to_path else x.from_path end, w.hops + 1
        from walk w join ${this.t('entity_reference')} x on x.from_path = w.path or x.to_path = w.path
        where w.hops < ${depth}
      )
      select e.path, e.type, e.title, e.verification, e.sync, e.contradictions, min(w.hops)::int as hops
      from walk w join ${this.t('entity')} e using (path)
      where w.hops > 0 and not (e.path = any(${seeds}::text[]))
      group by e.path, e.type, e.title, e.verification, e.sync, e.contradictions`;
    const floor = Math.min(...hits.map((h) => h.score));
    return [...hits, ...rows.map((r) => ({ ...this.item(r), score: floor / (r.hops + 1) }))];
  }

  async neighbours(path: string): Promise<ReferenceView[]> {
    return (await this.detail(path))?.references ?? [];
  }

  // Attention ranking

  async enterFeed(path: string, fm: EntityFrontmatter, tx: Sql = this.sql): Promise<void> {
    const row = { entity_path: path, product_impact: fm.product_impact, timeline_impact: fm.timeline_impact, unlocks: fm.unlocks };
    await tx`insert into ${this.t('attention_ranking')} ${tx(row)}
      on conflict (entity_path) do update set product_impact = excluded.product_impact,
        timeline_impact = excluded.timeline_impact, unlocks = excluded.unlocks`;
  }

  async leaveFeed(path: string, tx: Sql = this.sql): Promise<void> {
    await tx`delete from ${this.t('attention_ranking')} where entity_path = ${path}`;
  }

  async inFeed(path: string): Promise<boolean> {
    const [r] = await this.sql`select 1 from ${this.t('attention_ranking')} where entity_path = ${path}`;
    return !!r;
  }

  async feedCount(): Promise<number> {
    const [r] = await this.sql<{ n: number }[]>`select count(*)::int as n from ${this.t('attention_ranking')}`;
    return r?.n ?? 0;
  }

  async recordReaction(path: string, type: string, reaction: 'approved' | 'rejected' | 'sent_back', timeSpentMs: number) {
    await this.sql`insert into ${this.t('attention_metric')} ${this.sql({
      entity_path: path,
      entity_type: type,
      reaction,
      time_spent_ms: timeSpentMs,
    })}`;
  }
}

/** One feed across enabled projects: their attention_ranking tables merged by rank */
export async function crossProjectFeed(sql: Sql, workspaces: string[], limit: number): Promise<FeedItem[]> {
  if (workspaces.length === 0) return [];
  const parts = workspaces.map((w) => {
    const s = schemaOf(w);
    return `select '${w.replaceAll("'", "''")}' as workspace, e.path, e.type, e.title, e.card_blocks, e.verification, e.sync, e.contradictions,
      a.rank, a.entered_at from ${s}.attention_ranking a join ${s}.entity e on e.path = a.entity_path`;
  });
  const rows = await sql.unsafe<(EntityRow & { workspace: string; rank: number })[]>(
    `${parts.join(' union all ')} order by rank desc, entered_at asc limit $1`,
    [limit],
  );
  return rows.map((r) => ({
    workspace: r.workspace,
    path: r.path,
    type: r.type,
    title: r.title,
    card: r.card_blocks,
    verification: r.verification,
    sync: r.sync,
    contradictions: r.contradictions,
    rank: Number(r.rank),
  }));
}

/** Entities of the enabled projects counted by verification and by sync state */
export async function crossProjectEntityCounts(sql: Sql, workspaces: string[]): Promise<FeedCounts> {
  const counts: FeedCounts = {
    verification: { unverified: 0, verified: 0 },
    sync: { synced: 0, entity_ahead: 0, artifact_ahead: 0, updating: 0 },
  };
  if (workspaces.length === 0) return counts;
  const parts = workspaces.map((w) => `select verification, sync from ${schemaOf(w)}.entity`);
  const rows = await sql.unsafe<{ verification: Verification; sync: Sync; n: number }[]>(
    `select verification, sync, count(*)::int as n from (${parts.join(' union all ')}) e group by verification, sync`,
  );
  for (const r of rows) {
    counts.verification[r.verification] += r.n;
    counts.sync[r.sync] += r.n;
  }
  return counts;
}

export { typeOfPath };
