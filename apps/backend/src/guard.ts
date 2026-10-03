import type { EntityFrontmatter, Sync } from '@momentum/contract';
import {
  cardLength,
  entityPathOf,
  fileOf,
  KNOWLEDGE_GRAPH,
  parseEntity,
  serializeEntity,
  toCard,
  validateText,
  type DiagramRenderer,
  type ParsedEntity,
  type ValidationIssue,
} from '@momentum/entity';
import type { Embed } from '@momentum/kb';
import { changes, head, land, listFiles, mergeBase, messageFile, show, workingChanges, type Landed } from '@momentum/runs';
import { watch, type FSWatcher } from 'chokidar';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { config } from './config.ts';
import type { Bus } from './events.ts';
import type { HarnessSettings } from './harness.ts';
import type { Workspace, Workspaces } from './workspaces.ts';

export interface RunRef {
  id: string;
  workspace: string;
  automation: string;
  checkout: string;
  targetPath: string | null;
}

/** Types whose approval waits for an implementation: approved with no `implements` reference, they are entity_ahead */
export const IMPLEMENTABLE = new Set([
  'Product/Feature',
  'Product/FeatureRequest',
  'Product/UserStory',
  'Product/DevTask',
  'Product/Bug',
  'Product/TechDebt',
  'Harness/Plan',
]);

export const ISSUE_TYPES = ['Harness/Issue', 'Harness/Conflict'];

/** Git may check files out with CRLF line endings */
export const sameText = (a: string, b: string) => a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');

export interface TransactionResult {
  valid: boolean;
  paths: string[];
  issues: ValidationIssue[];
  /** Files whose changes conflicted with the main line when the transaction landed */
  conflicts: string[];
  commit: string | null;
}

/**
 * Consistency guard: reacts to every change in the knowledge base of the run checkout, groups the changes of one run
 * into a transaction, validates it, lands it on the main line and updates the index and metrics database. The main
 * line is the only line: approval is a state of the entity, not a place.
 */
export class Guard {
  private watchers = new Map<string, { watcher: FSWatcher; issues: Map<string, ValidationIssue[]> }>();

  constructor(
    private readonly workspaces: Workspaces,
    private readonly settings: HarnessSettings,
    private readonly bus: Bus,
    private readonly render: DiagramRenderer,
    private readonly embed: Embed,
  ) {}

  private async validation() {
    const { cards } = await this.settings.values();
    return { characterLimit: cards.characterLimit, types: this.workspaces.types };
  }

  /** Card blocks, embedding and index row for one entity */
  async index(ws: Workspace, path: string, entity: ParsedEntity): Promise<void> {
    const cardBlocks = await toCard(entity.body, this.render);
    const [embedding] = await this.embed([`${entity.title}\n${entity.body}`]);
    await ws.index.upsert({ path, title: entity.title, body: entity.body, frontmatter: entity.frontmatter, cardBlocks, embedding: embedding ?? null });
  }

  // Main line

  /**
   * Brings the index up to date with the workspace's main line: every entity that changed since the last indexed
   * commit is indexed, an unverified one stands in the feed and a verified one leaves it. The one path into the index
   * for everything a run lands and everything the user commits or approves.
   */
  async indexMainLine(ws: Workspace): Promise<void> {
    const commit = await head(ws.path, `refs/heads/${ws.main}`);
    const previous = await this.settings.indexedCommit(ws.name);
    if (previous === commit) return;
    const files = (await listFiles(ws.path, commit, KNOWLEDGE_GRAPH)).filter((f) => entityPathOf(f));
    const onMain = new Set(files.map((f) => entityPathOf(f)!));
    let changed: Set<string> | null = null;
    let artifactFiles: string[] = [];
    if (previous) {
      try {
        const diff = await changes(ws.path, previous, commit);
        changed = new Set(diff.map((c) => entityPathOf(c.path)).filter((p): p is string => !!p));
        artifactFiles = diff.filter((c) => !entityPathOf(c.path)).map((c) => c.path);
      } catch {
        changed = null;
      }
    }
    const existing = await ws.index.paths();
    for (const path of onMain) {
      if (changed && !changed.has(path) && existing.has(path)) continue;
      const text = await show(ws.path, commit, fileOf(path));
      if (text === null) continue;
      try {
        const entity = parseEntity(text);
        entity.frontmatter.sync = await this.syncOf(ws, path, entity.frontmatter);
        await this.index(ws, path, entity);
        if (entity.frontmatter.verification === 'unverified') await ws.index.enterFeed(path, entity.frontmatter);
        else await ws.index.leaveFeed(path);
      } catch {
        // an entity that does not parse on the main line is reported by the consistency check
      }
    }
    for (const path of existing) {
      if (!onMain.has(path)) await ws.index.remove(path);
    }
    await ws.index.refreshContradictions();
    await this.settings.setIndexedCommit(ws.name, commit);
    await this.artifactsChanged(ws, artifactFiles, changed);
    if (!changed || [...changed].some((p) => p.startsWith('Harness/Trigger/'))) {
      this.bus.emit('triggers_changed', { workspace: ws.name });
    }
    // A definition committed straight to the harness main line is materialized like an approved one
    if (ws.name === config.harnessName && changed) {
      for (const p of changed) if (p.startsWith('Harness/Automation/')) this.bus.emit('definition_approved', { path: p });
    }
    await this.recordMetrics(ws);
  }

  /**
   * Artifacts changed on the main line: the entities over them are artifact_ahead, and one summarization run rewrites
   * them all. An entity that changed in the same commits as its artifact agrees with it already, for example a definition
   * edited together with its agent file.
   */
  async artifactsChanged(ws: Workspace, artifactPaths: string[], changedEntities: Set<string> | null = null): Promise<void> {
    const entities = new Map<string, string[]>();
    for (const artifact of artifactPaths) {
      for (const path of await ws.index.byArtifact(artifact)) {
        if (changedEntities?.has(path)) continue;
        entities.set(path, [...(entities.get(path) ?? []), artifact]);
      }
    }
    for (const path of entities.keys()) await ws.index.setSync(path, 'artifact_ahead');
    if (entities.size > 0) {
      this.bus.emit('artifact_ahead', { workspace: ws.name, entities: [...entities].map(([path, artifacts]) => ({ path, artifacts })) });
    }
  }

  // Run checkout

  /** Validation on every change in the run's knowledge base */
  watch(run: RunRef): void {
    if (this.watchers.has(run.id)) return;
    const dir = join(run.checkout, KNOWLEDGE_GRAPH);
    const issues = new Map<string, ValidationIssue[]>();
    const watcher = watch(existsSync(dir) ? dir : run.checkout, {
      ignoreInitial: true,
      ignored: (p) => p.includes(`${join(run.checkout, '.git')}`),
      awaitWriteFinish: { stabilityThreshold: 300 },
    });
    const onChange = async (file: string) => {
      const path = entityPathOf(relative(run.checkout, file));
      if (!path) return;
      if (!existsSync(file)) {
        issues.delete(path);
        return;
      }
      const text = await readFile(file, 'utf8').catch(() => null);
      if (text === null) return;
      const ctx = { ...(await this.validation()), resolves: (p: string) => existsSync(join(run.checkout, fileOf(p))) };
      issues.set(path, validateText(path, text, ctx).issues);
    };
    watcher.on('add', onChange).on('change', onChange).on('unlink', onChange);
    this.watchers.set(run.id, { watcher, issues });
  }

  /** Issues found so far in a run's changes */
  liveIssues(runId: string): ValidationIssue[] {
    return [...(this.watchers.get(runId)?.issues.values() ?? [])].flat();
  }

  async unwatch(runId: string): Promise<void> {
    const w = this.watchers.get(runId);
    this.watchers.delete(runId);
    await w?.watcher.close();
  }

  async markUpdating(ws: Workspace, path: string | null): Promise<void> {
    if (path && (await ws.index.row(path))) await ws.index.setSync(path, 'updating');
  }

  /**
   * A transaction: everything the run left in the checkout, validated and landed on the main line as one commit.
   * Valid entities enter the feed unverified; changes that cannot be made consistent land too, with an issue entity
   * raised over them. A change that conflicts with what reached the main line meanwhile lands on the run's side,
   * raised as a conflict entity over what conflicted.
   */
  async transaction(run: RunRef): Promise<TransactionResult> {
    const ws = await this.workspaces.get(run.workspace);
    const { written, deleted, issues } = await this.check(run);
    const paths = [...written.map((w) => w.path), ...deleted];
    const valid = issues.length === 0;
    if (!valid) await this.raiseIssue(ws, run, issues);

    const landed = await this.land(ws, run, await this.message(run, written));
    await this.indexMainLine(ws);
    if (run.targetPath && !written.some((w) => w.path === run.targetPath)) {
      const row = await ws.index.row(run.targetPath);
      if (row?.sync === 'updating') await ws.index.setSync(run.targetPath, await this.syncOf(ws, run.targetPath, row.frontmatter));
    }
    await ws.index.sql`insert into ${ws.index.sql(`${ws.index.schema}.transaction`)} ${ws.index.sql({
      run_id: run.id,
      commit: landed?.commit ?? null,
      paths,
      status: valid ? 'validated' : 'invalid',
      issues: ws.index.sql.json(issues as never),
      conflicts: landed?.conflicts ?? [],
    })}`;
    await this.recordMetrics(ws);
    this.bus.emit('transaction', { workspace: ws.name, runId: run.id, commit: landed?.commit ?? null, paths, valid });
    return { valid, paths, issues, conflicts: landed?.conflicts ?? [], commit: landed?.commit ?? null };
  }

  /**
   * The commit message the run wrote for its changes, taken out of its checkout; without one, what changed: the
   * titles of the entities it wrote and the paths of everything else
   */
  private async message(run: RunRef, written: { path: string; entity: ParsedEntity }[]): Promise<string> {
    const file = await messageFile(run.checkout);
    const text = (await readFile(file, 'utf8').catch(() => '')).trim();
    await rm(file, { force: true });
    if (text) return text;
    const titles = new Map(written.map((w) => [w.path, w.entity.title]));
    const names = (await workingChanges(run.checkout, await head(run.checkout))).map((c) => titles.get(entityPathOf(c.path) ?? '') ?? c.path);
    if (names.length <= 1) return `Update ${names[0] ?? 'the knowledge graph'}`;
    return `Update ${names[0]} and ${names.length - 1} more\n\n${names.map((n) => `- ${n}`).join('\n')}`;
  }

  /** Lands the checkout on the main line; conflicted files take the run's version, raised as a Harness/Conflict in the same commit */
  private land(ws: Workspace, run: RunRef, message: string): Promise<Landed | null> {
    return land(ws.path, ws.main, run.checkout, message, async (conflicts) => [await this.conflictEntity(ws, run, conflicts)]);
  }

  /** One entity file as a run just wrote it: the issues the guard would raise, for the PostToolUse hook */
  async checkFile(run: RunRef, file: string): Promise<ValidationIssue[]> {
    const path = entityPathOf(relative(run.checkout, file));
    if (!path || !existsSync(file)) return [];
    const text = await readFile(file, 'utf8');
    const resolves = (p: string) => existsSync(join(run.checkout, fileOf(p)));
    return validateText(path, text, { ...(await this.validation()), resolves }).issues;
  }

  /**
   * The run's knowledge-base changes against the main line, committed or not, validated without side effects:
   * what the transaction will accept, for the Stop hook and the transaction itself.
   */
  async check(run: RunRef): Promise<{ written: { path: string; entity: ParsedEntity }[]; deleted: string[]; issues: ValidationIssue[] }> {
    const ws = await this.workspaces.get(run.workspace);
    const base = await mergeBase(ws.path, `refs/heads/${ws.main}`, await head(run.checkout));
    const kg = (await workingChanges(run.checkout, base)).filter((c) => entityPathOf(c.path));
    const resolves = (p: string) => existsSync(join(run.checkout, fileOf(p)));
    const ctx = { ...(await this.validation()), resolves };

    const written: { path: string; entity: ParsedEntity }[] = [];
    const issues: ValidationIssue[] = [];
    for (const c of kg.filter((c) => c.status !== 'D')) {
      const path = entityPathOf(c.path)!;
      const onMain = await show(ws.path, `refs/heads/${ws.main}`, c.path);
      const text = await readFile(join(run.checkout, c.path), 'utf8');
      if (onMain !== null && sameText(onMain, text)) continue; // on the main line as it is
      const result = validateText(path, text, ctx);
      issues.push(...result.issues);
      if (result.entity) written.push({ path, entity: result.entity });
    }
    const deleted = kg.filter((c) => c.status === 'D').map((c) => entityPathOf(c.path)!);
    for (const path of deleted) {
      const referrers = await ws.index.sql<{ from_path: string }[]>`
        select from_path from ${ws.index.sql(`${ws.index.schema}.entity_reference`)} where to_path = ${path}`;
      for (const r of referrers) {
        if (resolves(r.from_path) && !deleted.includes(r.from_path)) {
          issues.push({ path: r.from_path, code: 'unresolved_reference', message: `references ${path}, which this change removes` });
        }
      }
    }
    return { written, deleted, issues };
  }

  /** Sync state of an entity against its implementation: the `implements` references */
  async syncOf(ws: Workspace, path: string, fm: EntityFrontmatter): Promise<Sync> {
    if (fm.sync === 'artifact_ahead') return 'artifact_ahead';
    const implementsRefs = fm.references.filter((r) => r.relation === 'implements');
    if (implementsRefs.length > 0) return 'synced';
    if (!IMPLEMENTABLE.has(fm.type)) return 'synced';
    const [implemented] = await ws.index.sql`
      select 1 from ${ws.index.sql(`${ws.index.schema}.entity_reference`)} x
      join ${ws.index.sql(`${ws.index.schema}.entity`)} e on e.path = x.from_path
      where x.to_path = ${path} and x.relation_type = 'implements' and e.verification = 'verified'`;
    if (implemented) return 'synced';
    return fm.verification === 'verified' ? 'entity_ahead' : 'synced';
  }

  /** Changes that cannot be made consistent become an issue entity in the checkout, landed with them, in the feed */
  private async raiseIssue(ws: Workspace, run: RunRef, issues: ValidationIssue[]): Promise<void> {
    const { cards } = await this.settings.values();
    const path = `Harness/Issue/guard-${run.id}`;
    const concerned = [...new Set(issues.map((i) => i.path))].filter((p) => existsSync(join(run.checkout, fileOf(p))));
    const lines: string[] = [];
    let body = `The ${run.automation} run ${run.id} left changes the guard cannot accept:\n`;
    for (const i of issues) {
      const line = `\n- \`${i.path}\`: ${i.message}`;
      if (cardLength(body + lines.join('') + line) > cards.characterLimit - 20) {
        lines.push(`\n- and ${issues.length - lines.length} more`);
        break;
      }
      lines.push(line);
    }
    body += lines.join('');
    await this.writeEntity(run.checkout, path, {
      title: `Inconsistent changes from the ${run.automation} run`,
      body,
      frontmatter: {
        type: 'Harness/Issue',
        origin: 'automation',
        verification: 'unverified',
        sync: 'synced',
        product_impact: 2,
        timeline_impact: 3,
        unlocks: 3,
        references: concerned.map((to) => ({ to, relation: 'concerns' })),
        artifacts: [],
        source: 'guard',
      },
    });
  }

  /**
   * Files a run changed that changed on the main line while it ran: landed on the run's side and raised as a conflict
   * entity concerning the conflicted entities and the entities over the conflicted artifacts
   */
  private async conflictEntity(ws: Workspace, run: RunRef, conflicts: string[]): Promise<{ path: string; content: string }> {
    const path = `Harness/Conflict/${run.id}`;
    const entities = conflicts.map((p) => entityPathOf(p)).filter((p): p is string => !!p);
    const artifacts = conflicts.filter((p) => !entityPathOf(p));
    const concerned = new Set<string>(entities);
    for (const artifact of artifacts) for (const p of await ws.index.byArtifact(artifact)) concerned.add(p);
    const body = [
      `The ${run.automation} run ${run.id} changed files that changed on the main line while it ran. The run's version landed:`,
      ...conflicts.map((c) => `- \`${c}\``),
      '',
      'Check the landed files against the main line history; a send back starts a chat run to resolve them.',
    ].join('\n');
    const entity: ParsedEntity = {
      title: `Changes of the ${run.automation} run conflicted with the main line`,
      body,
      frontmatter: {
        type: 'Harness/Conflict',
        origin: 'automation',
        verification: 'unverified',
        sync: 'synced',
        product_impact: 3,
        timeline_impact: 4,
        unlocks: 4,
        references: [...concerned].map((to) => ({ to, relation: 'concerns' })),
        artifacts,
        source: 'guard',
      },
    };
    return { path: fileOf(path), content: serializeEntity(entity) };
  }

  private async writeEntity(checkout: string, path: string, entity: ParsedEntity): Promise<void> {
    const file = join(checkout, fileOf(path));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, serializeEntity(entity), 'utf8');
  }

  /** Understanding and implementation metrics, recorded with every validated transaction */
  async recordMetrics(ws: Workspace): Promise<void> {
    const { cards } = await this.settings.values();
    const s = ws.index.schema;
    const [u] = await ws.index.sql.unsafe<{ total: number; inconsistent: number; open_issues: number; bugs: number; defects: number }[]>(
      `select count(*)::int as total,
        count(*) filter (where char_length(e.card) > $1 or exists (
          select 1 from ${s}.entity_reference x where x.from_path = e.path
          and not exists (select 1 from ${s}.entity t where t.path = x.to_path)))::int as inconsistent,
        count(*) filter (where e.type = any($2::text[]))::int as open_issues,
        count(*) filter (where e.type = 'Product/Bug')::int as bugs,
        count(*) filter (where e.type = 'Harness/Issue' and e.frontmatter->>'source' = 'validation')::int as defects
      from ${s}.entity e`,
      [cards.characterLimit, ISSUE_TYPES],
    );
    if (!u) return;
    const consistency = u.total === 0 ? 1 : 1 - u.inconsistent / u.total;
    await ws.index.sql.unsafe(`insert into ${s}.understanding_metric (consistency, open_issues) values ($1, $2)`, [consistency, u.open_issues]);
    await ws.index.sql.unsafe(`insert into ${s}.implementation_metric (outstanding_issues, bugs, defects) values ($1, $2, $3)`, [
      u.open_issues,
      u.bugs,
      u.defects,
    ]);
  }
}

