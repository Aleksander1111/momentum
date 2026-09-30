import type { LifetimeRule, MappingState, ProjectSetting, PutSettings, Settings } from '@momentum/contract';
import type { Sql } from '@momentum/kb';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config.ts';

const DEFAULTS = {
  feedSize: 40,
  cards: { characterLimit: 700, presentationRules: '' },
  lifetimes: [
    { type: 'Product/DevTask', rule: '30 days after resolved, unless referenced' },
    { type: 'Harness/Research', rule: '60 days after delivered' },
    { type: 'Governance/Decision', rule: 'kept while referenced' },
  ] satisfies LifetimeRule[],
  agents: { concurrentPerProject: 2, concurrentTotal: 8 },
};

type Key = keyof typeof DEFAULTS;

/** Harness settings in the harness schema: enabling a project must not create commits in it */
export class HarnessSettings {
  private cache: Omit<Settings, 'projects'> | null = null;

  constructor(private readonly sql: Sql) {}

  async migrate(): Promise<void> {
    await this.sql`alter table harness.project add column if not exists indexed_commit text`;
    await this.sql`alter table harness.project add column if not exists mapping text`;
    await this.sql`alter table harness.project add column if not exists mapping_progress text`;
    await this.sql`alter table harness.project add column if not exists mapping_since timestamptz`;
    await this.sql`alter table harness.project add column if not exists mapping_coverage real`;
  }

  /** A git repository under the root is a workspace; deleting the directory retires it */
  async discover(): Promise<ProjectSetting[]> {
    const dirs = await readdir(config.root, { withFileTypes: true });
    const found = dirs
      .filter((d) => d.isDirectory() && !d.name.startsWith('.') && existsSync(join(config.root, d.name, '.git')))
      .map((d) => ({ name: d.name, path: join(config.root, d.name) }));
    for (const p of found) {
      await this.sql`insert into harness.project ${this.sql({ name: p.name, path: p.path, enabled: false })}
        on conflict (name) do update set path = excluded.path`;
    }
    const names = found.map((f) => f.name);
    await this.sql`delete from harness.project where not (name = any(${names}::text[]))`;
    return this.projects();
  }

  async projects(): Promise<ProjectSetting[]> {
    return this.sql<ProjectSetting[]>`select name, path, enabled from harness.project order by name`;
  }

  async enabled(): Promise<ProjectSetting[]> {
    return (await this.projects()).filter((p) => p.enabled);
  }

  async setEnabled(name: string, enabled: boolean): Promise<void> {
    await this.sql`update harness.project set enabled = ${enabled} where name = ${name}`;
  }

  async indexedCommit(name: string): Promise<string | null> {
    const [r] = await this.sql<{ indexed_commit: string | null }[]>`select indexed_commit from harness.project where name = ${name}`;
    return r?.indexed_commit ?? null;
  }

  async setIndexedCommit(name: string, commit: string): Promise<void> {
    await this.sql`update harness.project set indexed_commit = ${commit} where name = ${name}`;
  }

  /** The knowledge graph build of a project: its state, the progress its last run reported, and when it started */
  async mapping(name: string): Promise<{ state: MappingState | null; progress: string | null; since: Date | null; coverage: number | null }> {
    const [r] = await this.sql<
      { mapping: MappingState | null; mapping_progress: string | null; mapping_since: Date | null; mapping_coverage: number | null }[]
    >`select mapping, mapping_progress, mapping_since, mapping_coverage from harness.project where name = ${name}`;
    return { state: r?.mapping ?? null, progress: r?.mapping_progress ?? null, since: r?.mapping_since ?? null, coverage: r?.mapping_coverage ?? null };
  }

  async setMapping(name: string, state: MappingState): Promise<void> {
    await this.sql`update harness.project set mapping = ${state},
      mapping_since = case when ${state} = 'building' then coalesce(mapping_since, now()) else mapping_since end
      where name = ${name}`;
  }

  /** Forgets what the harness knows of a project's knowledge graph: the indexed commit and the build */
  async resetProject(name: string): Promise<void> {
    await this.sql`update harness.project set indexed_commit = null, mapping = null, mapping_progress = null, mapping_since = null, mapping_coverage = null
      where name = ${name}`;
  }

  async setMappingProgress(name: string, progress: string): Promise<void> {
    await this.sql`update harness.project set mapping_progress = ${progress} where name = ${name}`;
  }

  /** The share of the repository covered, 0–1, as the last run reported it */
  async setMappingCoverage(name: string, coverage: number): Promise<void> {
    await this.sql`update harness.project set mapping_coverage = ${Math.min(1, Math.max(0, coverage))} where name = ${name}`;
  }

  async values(): Promise<Omit<Settings, 'projects'>> {
    if (this.cache) return this.cache;
    const rows = await this.sql<{ key: Key; value: never }[]>`select key, value from harness.setting`;
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    this.cache = { ...DEFAULTS, ...stored };
    return this.cache;
  }

  async get(): Promise<Settings> {
    return { projects: await this.projects(), ...(await this.values()) };
  }

  async put(change: PutSettings): Promise<Settings> {
    const { projects, ...rest } = change;
    for (const p of projects ?? []) await this.setEnabled(p.name, p.enabled);
    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined || !(key in DEFAULTS)) continue;
      await this.sql`insert into harness.setting ${this.sql({ key, value: this.sql.json(value as never) })}
        on conflict (key) do update set value = excluded.value`;
    }
    this.cache = null;
    return this.get();
  }
}
