import { AutomationName } from '@momentum/contract';
import type { LifetimeRule, GraphBuildState, ModelChoice, ModelSettings, ProjectSetting, PutSettings, Settings } from '@momentum/contract';
import type { Sql } from '@momentum/kb';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config.ts';

const DEFAULTS = {
  feedSize: 40,
  cards: { characterLimit: 700, presentationRules: '' },
  summarization: { exclude: [] as string[] },
  lifetimes: [
    { type: 'Product/DevTask', rule: '30 days after resolved, unless referenced' },
    { type: 'Harness/Research', rule: '60 days after delivered' },
    { type: 'Governance/Decision', rule: 'kept while referenced' },
  ] satisfies LifetimeRule[],
  agents: { concurrentTotal: 8 },
  models: {
    mode: 'single',
    single: 'default',
    perAutomation: Object.fromEntries(AutomationName.options.map((a) => [a, 'default'])) as Record<AutomationName, ModelChoice>,
    risk: { low: 'haiku', medium: 'sonnet', high: 'opus' },
  } satisfies ModelSettings,
};

type Key = keyof typeof DEFAULTS;

/** What the index holds per entity; raised when that changes, so every project is indexed again. 1: card diffs and pickable diagram shapes */
const INDEX_VERSION = 1;

/** Harness settings in the harness schema: enabling a project must not create commits in it */
export class HarnessSettings {
  private cache: Omit<Settings, 'projects'> | null = null;

  constructor(private readonly sql: Sql) {}

  async migrate(): Promise<void> {
    await this.sql`alter table harness.project add column if not exists indexed_commit text`;
    await this.sql`alter table harness.project add column if not exists index_version int not null default 0`;
    // The graph build was called mapping: its columns and model setting keep their values under the new name
    for (const suffix of ['', '_progress', '_since', '_coverage']) {
      await this.sql.unsafe(`do $$ begin
        if exists (select 1 from information_schema.columns
                   where table_schema = 'harness' and table_name = 'project' and column_name = 'mapping${suffix}') then
          if exists (select 1 from information_schema.columns
                     where table_schema = 'harness' and table_name = 'project' and column_name = 'graph_build${suffix}') then
            execute 'update harness.project set graph_build${suffix} = coalesce(graph_build${suffix}, mapping${suffix})';
            execute 'alter table harness.project drop column mapping${suffix}';
          else
            execute 'alter table harness.project rename column mapping${suffix} to graph_build${suffix}';
          end if;
        end if;
      end $$`);
    }
    await this.sql`update harness.setting
      set value = jsonb_set(value #- '{perAutomation,mapping}', '{perAutomation,graph-build}', value -> 'perAutomation' -> 'mapping')
      where key = 'models' and jsonb_exists(value -> 'perAutomation', 'mapping')`;
    await this.sql`alter table harness.project add column if not exists graph_build text`;
    await this.sql`alter table harness.project add column if not exists graph_build_progress text`;
    await this.sql`alter table harness.project add column if not exists graph_build_since timestamptz`;
    await this.sql`alter table harness.project add column if not exists graph_build_coverage real`;
    await this.sql`alter table harness.project add column if not exists logo text`;
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
    return this.sql<ProjectSetting[]>`select name, path, enabled, logo from harness.project order by name`;
  }

  async enabled(): Promise<ProjectSetting[]> {
    return (await this.projects()).filter((p) => p.enabled);
  }

  async setEnabled(name: string, enabled: boolean): Promise<void> {
    await this.sql`update harness.project set enabled = ${enabled} where name = ${name}`;
  }

  /** Sets the logo a project uploaded, or clears it so the app draws one from the name; false when there is no such project */
  async setLogo(name: string, logo: string | null): Promise<boolean> {
    const rows = await this.sql`update harness.project set logo = ${logo} where name = ${name} returning name`;
    return rows.length > 0;
  }

  /** The main line commit the index stands at; none when the index was built by an older version and is rebuilt whole */
  async indexedCommit(name: string): Promise<string | null> {
    const [r] = await this.sql<{ indexed_commit: string | null; index_version: number }[]>`
      select indexed_commit, index_version from harness.project where name = ${name}`;
    return r && r.index_version >= INDEX_VERSION ? r.indexed_commit : null;
  }

  async setIndexedCommit(name: string, commit: string): Promise<void> {
    await this.sql`update harness.project set indexed_commit = ${commit}, index_version = ${INDEX_VERSION} where name = ${name}`;
  }

  /** The knowledge graph build of a project: its state, the progress its last run reported, and when it started */
  async graphBuild(name: string): Promise<{ state: GraphBuildState | null; progress: string | null; since: Date | null; coverage: number | null }> {
    const [r] = await this.sql<
      { graph_build: GraphBuildState | null; graph_build_progress: string | null; graph_build_since: Date | null; graph_build_coverage: number | null }[]
    >`select graph_build, graph_build_progress, graph_build_since, graph_build_coverage from harness.project where name = ${name}`;
    return { state: r?.graph_build ?? null, progress: r?.graph_build_progress ?? null, since: r?.graph_build_since ?? null, coverage: r?.graph_build_coverage ?? null };
  }

  async setGraphBuild(name: string, state: GraphBuildState): Promise<void> {
    await this.sql`update harness.project set graph_build = ${state},
      graph_build_since = case when ${state} = 'building' then coalesce(graph_build_since, now()) else graph_build_since end
      where name = ${name}`;
  }

  /** Forgets what the harness knows of a project's knowledge graph: the indexed commit and the build */
  async resetProject(name: string): Promise<void> {
    await this.sql`update harness.project set indexed_commit = null, graph_build = null, graph_build_progress = null, graph_build_since = null, graph_build_coverage = null
      where name = ${name}`;
  }

  async setGraphBuildProgress(name: string, progress: string): Promise<void> {
    await this.sql`update harness.project set graph_build_progress = ${progress} where name = ${name}`;
  }

  /** The share of the repository covered, 0–1, as the last run reported it */
  async setGraphBuildCoverage(name: string, coverage: number): Promise<void> {
    await this.sql`update harness.project set graph_build_coverage = ${Math.min(1, Math.max(0, coverage))} where name = ${name}`;
  }

  async values(): Promise<Omit<Settings, 'projects'>> {
    if (this.cache) return this.cache;
    const rows = await this.sql<{ key: Key; value: never }[]>`select key, value from harness.setting`;
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const cache: Omit<Settings, 'projects'> = { ...DEFAULTS, ...stored };
    // Runs were once bounded per project too; automation runs now go one at a time and only the total is set
    const agents = stored.agents as { concurrentTotal?: number } | undefined;
    if (agents) cache.agents = { concurrentTotal: agents.concurrentTotal ?? DEFAULTS.agents.concurrentTotal };
    // An automation added after the models were stored starts on the default; a removed one is dropped
    const models = stored.models as ModelSettings | undefined;
    if (models) {
      const perAutomation = Object.fromEntries(
        AutomationName.options.map((a) => [a, models.perAutomation[a] ?? DEFAULTS.models.perAutomation[a]]),
      ) as Record<AutomationName, ModelChoice>;
      cache.models = { ...models, perAutomation };
    }
    this.cache = cache;
    return cache;
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
