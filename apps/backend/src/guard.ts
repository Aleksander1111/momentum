import type { Card, CardDiff, EntityFrontmatter, Sync } from '@momentum/contract';
import {
  cardLength,
  diffCards,
  entityPathOf,
  fileOf,
  KNOWLEDGE_GRAPH,
  parseEntity,
  renderDiagrams,
  serializeEntity,
  toCard,
  validateText,
  type DiagramRenderer,
  type ParsedEntity,
  type ValidationIssue,
} from '@momentum/entity';
import type { Embed } from '@momentum/kb';
import { changes, fileHistory, head, land, listFiles, mergeBase, mergesBetween, messageFile, moves, restorePath, show, workingChanges, type Landed } from '@momentum/runs';
import { HARNESS_SCOPE } from './automations.ts';
import type { Moved } from './events.ts';
import { watch, type FSWatcher } from 'chokidar';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, posix, relative } from 'node:path';
import { config } from './config.ts';
import type { Bus } from './events.ts';
import type { HarnessSettings } from './harness.ts';
import type { Workspace, Workspaces } from './workspaces.ts';

interface Handoff {
  artifacts: Set<string>;
  /** Handed since the step last finished: not yet seen by it */
  pending: Set<string>;
  keep: Set<string>;
}

/** What a run's summarization step was handed, and what of it is covered */
interface Summarized {
  handed: Set<string>;
  covered: Set<string>;
}

export interface RunRef {
  id: string;
  workspace: string;
  automation: string;
  checkout: string;
  targetPath: string | null;
  /** Entities the run works on besides its target, such as those a summarization run rewrites */
  targets?: string[];
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
const DEFINITION = 'Harness/Automation';
const REPORT_TYPE = 'Harness/Report';
/** Runs the user talks to tell them in the conversation what they removed; the other runs report it on a card */
const REPORTS_IN_CONVERSATION = new Set(['chat', 'interview']);

/** An entity a run removed, with the title it had */
export interface Removed {
  path: string;
  title: string;
}

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
  /** The main line of a workspace is indexed by one caller at a time: each change is seen, and acted on, once */
  private indexing = new Map<string, Promise<unknown>>();
  /**
   * What each run's summarization step was handed: the artifacts, those handed since the step last finished, and the
   * entities over them the run was told to leave as they stand (an implementation's target and what it plans)
   */
  private summarized = new Map<string, Handoff>();

  constructor(
    private readonly workspaces: Workspaces,
    private readonly settings: HarnessSettings,
    private readonly bus: Bus,
    private readonly render: DiagramRenderer,
    private readonly embed: Embed,
  ) {}

  private async validation() {
    return { types: this.workspaces.types };
  }

  /** Card blocks, the diff against the last verified version, embedding and index row for one entity at `commit` */
  async index(ws: Workspace, path: string, entity: ParsedEntity, commit: string): Promise<void> {
    const cardBlocks = await toCard(entity.body, this.render);
    const cardDiff = entity.frontmatter.verification === 'unverified' ? await this.diffSinceVerified(ws, path, entity, cardBlocks, commit) : null;
    const [embedding] = await this.embed([`${entity.title}\n${entity.body}`]);
    await ws.index.upsert({ path, title: entity.title, body: entity.body, frontmatter: entity.frontmatter, cardBlocks, cardDiff, embedding: embedding ?? null });
  }

  /**
   * The card against the version the user last verified: the newest version in the entity's history marked verified.
   * None when it was never verified or its card has not changed since.
   */
  private async diffSinceVerified(ws: Workspace, path: string, entity: ParsedEntity, card: Card, commit: string): Promise<CardDiff | null> {
    const file = fileOf(path);
    let baseline: ParsedEntity | null = null;
    for (const sha of await fileHistory(ws.path, commit, file).catch(() => [])) {
      const text = await show(ws.path, sha, file);
      if (text === null) continue;
      try {
        const version = parseEntity(text);
        if (version.frontmatter.verification === 'verified') {
          baseline = version;
          break;
        }
      } catch {
        // a version that does not parse is no baseline
      }
    }
    if (!baseline || (sameText(baseline.body, entity.body) && baseline.title.trim() === entity.title.trim())) return null;
    const diff = diffCards(baseline.title, await toCard(baseline.body), entity.title, card);
    await renderDiagrams(diff.card, this.render);
    return diff;
  }

  // Main line

  /**
   * Brings the index up to date with the workspace's main line: every entity that changed since the last indexed
   * commit is indexed, an unverified one stands in the feed and a verified one leaves it. The one path into the index
   * for everything a run lands and everything the user commits or approves.
   */
  /** `acceptMerges`: the user enabled the project as it stands, merge commits it holds included */
  indexMainLine(ws: Workspace, acceptMerges = false): Promise<void> {
    return this.exclusive(ws, () => this.indexNow(ws, null, acceptMerges));
  }

  /** Runs `fn` while nothing else indexes the workspace's main line */
  private exclusive<T>(ws: Workspace, fn: () => Promise<T>): Promise<T> {
    const next = (this.indexing.get(ws.name) ?? Promise.resolve()).catch(() => {}).then(fn);
    this.indexing.set(ws.name, next);
    void next
      .finally(() => {
        if (this.indexing.get(ws.name) === next) this.indexing.delete(ws.name);
      })
      .catch(() => {});
    return next;
  }

  /**
   * `landing`: the change is a run's landing, and what its summarization step was handed and did cover. A run's new
   * files are its step's to cover; those it was handed and left uncovered are new files like the user's, and the
   * entities over a changed artifact it left as they were are behind it
   */
  private async indexNow(ws: Workspace, landing: Summarized | null = null, acceptMerges = false): Promise<void> {
    const commit = await head(ws.path, `refs/heads/${ws.main}`);
    const previous = await this.settings.indexedCommit(ws.name);
    if (previous === commit) return;
    // A merge commit breaks the one straight line: the index stays before it and the orchestrator switches the project off
    if (previous && !acceptMerges && (await mergesBetween(ws.path, previous, commit).catch(() => [])).length > 0) return;
    const files = (await listFiles(ws.path, commit, KNOWLEDGE_GRAPH)).filter((f) => entityPathOf(f));
    const onMain = new Set(files.map((f) => entityPathOf(f)!));
    let changed: Set<string> | null = null;
    let artifactFiles: string[] = [];
    let added: string[] = [];
    let deleted: string[] = [];
    let moved: Moved[] = [];
    if (previous) {
      try {
        const diff = await changes(ws.path, previous, commit);
        changed = new Set(diff.map((c) => entityPathOf(c.path)).filter((p): p is string => !!p));
        artifactFiles = diff.filter((c) => !entityPathOf(c.path)).map((c) => c.path);
        // A file moved is neither gone nor new: the entities over it follow it to its new path. Moved where nothing is
        // summarized, an archive for one, it is gone as far as the knowledge base goes
        const { summarization } = await this.settings.values();
        const excluded = (path: string) => summarization.exclude.some((pattern) => posix.matchesGlob(path, pattern));
        moved = (await moves(ws.path, previous, commit))
          .filter((m) => !entityPathOf(m.from) && !entityPathOf(m.to) && !excluded(m.to))
          .map((m) => ({ from: m.from, to: m.to, unchanged: m.similarity === 100 }));
        const newFiles = diff.filter((c) => c.status === 'A' && !entityPathOf(c.path) && !moved.some((m) => m.to === c.path)).map((c) => c.path);
        added = landing ? newFiles.filter((f) => landing.handed.has(f) && !landing.covered.has(f)) : newFiles;
        deleted = diff.filter((c) => c.status === 'D' && !entityPathOf(c.path) && !moved.some((m) => m.from === c.path)).map((c) => c.path);
      } catch {
        changed = null;
      }
    }
    const existing = await ws.index.paths();
    for (const path of onMain) {
      if (changed && !changed.has(path) && existing.has(path)) continue;
      const text = await show(ws.path, commit, fileOf(path));
      if (text === null) continue;
      let entity: ReturnType<typeof parseEntity>;
      try {
        entity = parseEntity(text);
      } catch {
        // an entity that does not parse on the main line is reported by the consistency check
        continue;
      }
      // Anything else failing (the database, the embeddings) leaves the commit unindexed, to be indexed again
      entity.frontmatter.sync = await this.syncOf(ws, path, entity.frontmatter);
      await this.index(ws, path, entity, commit);
      if (entity.frontmatter.verification === 'unverified') await ws.index.enterFeed(path, entity.frontmatter);
      else await ws.index.leaveFeed(path);
    }
    for (const path of existing) {
      if (!onMain.has(path)) await ws.index.remove(path);
    }
    await ws.index.refreshContradictions();
    await this.settings.setIndexedCommit(ws.name, commit);
    await this.artifactsChanged(ws, artifactFiles.filter((f) => !landing?.covered.has(f)), changed, added, deleted, moved);
    if (!changed || [...changed].some((p) => p.startsWith('Harness/Trigger/'))) {
      this.bus.emit('triggers_changed', { workspace: ws.name });
    }
    // The definitions are materialized as they stand on the harness main line, whoever changed them: an entity or its files
    if (ws.name === config.harnessName && changed) {
      const touched = [...changed].find((p) => p.startsWith('Harness/Automation/')) ?? artifactFiles.find((f) => f.startsWith('automations/'));
      if (touched) this.bus.emit('definition_changed', { path: touched });
    }
    await this.recordMetrics(ws);
  }

  /**
   * Artifacts changed on the main line: the entities over them are artifact_ahead, and one summarization run rewrites
   * them all. An entity that changed in the same commits as its artifact agrees with it already, for example a definition
   * edited together with its agent file.
   */
  async artifactsChanged(
    ws: Workspace,
    artifactPaths: string[],
    changedEntities: Set<string> | null = null,
    added: string[] = [],
    deleted: string[] = [],
    moved: Moved[] = [],
  ): Promise<void> {
    const entities = new Map<string, string[]>();
    for (const artifact of artifactPaths) {
      for (const path of await ws.index.byArtifact(artifact)) {
        if (changedEntities?.has(path)) continue;
        entities.set(path, [...(entities.get(path) ?? []), artifact]);
      }
    }
    const uncovered = await this.uncovered(ws, added);
    for (const path of entities.keys()) await ws.index.setSync(path, 'artifact_ahead');
    if (entities.size > 0 || uncovered.length > 0) {
      this.bus.emit('artifact_ahead', {
        workspace: ws.name,
        entities: [...entities].map(([path, artifacts]) => ({ path, artifacts })),
        added: uncovered,
        deleted: artifactPaths.filter((f) => deleted.includes(f)),
        moved: moved.filter((m) => artifactPaths.includes(m.from)),
      });
    }
  }

  /**
   * Files the user added that no entity summarizes, once the knowledge graph is built: until then the build maps them.
   * The user's exclusions are never summarized.
   */
  private async uncovered(ws: Workspace, added: string[]): Promise<string[]> {
    if (added.length === 0 || (await this.settings.graphBuild(ws.name)).state !== 'complete') return [];
    const { summarization } = await this.settings.values();
    const out: string[] = [];
    for (const file of added) {
      if (summarization.exclude.some((pattern) => posix.matchesGlob(file, pattern))) continue;
      if ((await ws.index.byArtifact(file)).length === 0) out.push(file);
    }
    return out;
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

  /** The artifacts a run's summarization step is handed; once they land with the run, no summarization run follows for them */
  handedToSummarization(runId: string, artifacts: string[], keep: string[] = []): void {
    const handed = this.summarized.get(runId) ?? { artifacts: new Set<string>(), pending: new Set<string>(), keep: new Set<string>() };
    for (const a of artifacts) {
      handed.artifacts.add(a);
      handed.pending.add(a);
    }
    for (const k of keep) handed.keep.add(k);
    this.summarized.set(runId, handed);
  }

  /** The run's summarization sub-agent finished: what it was handed so far, it has seen */
  summarizationRan(runId: string): void {
    this.summarized.get(runId)?.pending.clear();
  }

  /**
   * What the run's summarization step covered of what it was handed. The step may leave a card as it is when a change
   * leaves it true, so what it saw once it ran is trusted. What it never saw (the run ignored the hand-over, or the step
   * failed) counts only where the run's own entities show it: an entity it wrote lists the artifact, or every entity
   * over the artifact is one it rewrote, deleted or was told to leave as it stands.
   */
  private async summarizedBy(ws: Workspace, run: RunRef, written: { path: string; entity: ParsedEntity }[], deleted: string[]): Promise<Summarized> {
    const handed = this.summarized.get(run.id) ?? { artifacts: new Set<string>(), pending: new Set<string>(), keep: new Set<string>() };
    this.summarized.delete(run.id);
    const touched = new Set([...written.map((w) => w.path), ...deleted, ...handed.keep]);
    const covered = new Set([...handed.artifacts].filter((a) => !handed.pending.has(a)));
    for (const artifact of handed.pending) {
      if (written.some((w) => w.entity.frontmatter.artifacts.includes(artifact))) {
        covered.add(artifact);
        continue;
      }
      const over = await ws.index.byArtifact(artifact);
      if (over.length > 0 && over.every((p) => touched.has(p))) covered.add(artifact);
    }
    return { handed: handed.artifacts, covered };
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
    const refused = await this.confine(ws, run);
    const { written, deleted, issues: found } = await this.check(run);
    const issues = [...refused, ...found];
    await this.definitionsToReview(ws, run, written);
    const removed = await this.removed(ws, deleted);
    if (removed.length > 0 && !REPORTS_IN_CONVERSATION.has(run.automation)) await this.reportRemoval(ws, run, removed);
    // Only the user verifies: an entity a run changed lands unverified, whatever the run left in its frontmatter
    for (const w of written) {
      if (w.entity.frontmatter.verification === 'unverified') continue;
      w.entity.frontmatter.verification = 'unverified';
      await this.writeEntity(run.checkout, w.path, w.entity);
    }
    const paths = [...written.map((w) => w.path), ...deleted];
    const valid = issues.length === 0;
    if (!valid) await this.raiseIssue(ws, run, issues);

    const message = await this.message(run, written);
    const summarized = await this.summarizedBy(ws, run, written, deleted);
    // Landed and indexed in one go, so the artifacts the run summarized itself are never taken for the user's changes
    const landed = await this.exclusive(ws, async () => {
      const l = await this.land(ws, run, message);
      await this.indexNow(ws, summarized);
      return l;
    });
    // Entities the run was to change and left as they were stand where they did: the run found nothing to change
    for (const target of new Set([run.targetPath, ...(run.targets ?? [])])) {
      if (!target || written.some((w) => w.path === target)) continue;
      const row = await ws.index.row(target);
      if (row?.sync === 'updating') await ws.index.setSync(target, await this.syncOf(ws, target, row.frontmatter));
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
    this.bus.emit('transaction', {
      workspace: ws.name,
      runId: run.id,
      automation: run.automation,
      commit: landed?.commit ?? null,
      message,
      paths,
      removed,
      valid,
      issues: issues.length,
      conflicts: landed?.conflicts ?? [],
    });
    return { valid, paths, issues, conflicts: landed?.conflicts ?? [], commit: landed?.commit ?? null };
  }

  /**
   * In the harness's own repository a run lands only what its automation may change there (HARNESS_SCOPE): anything
   * else it changed is put back as the main line had it, before it is validated or landed, and named in its issue
   */
  private async confine(ws: Workspace, run: RunRef): Promise<ValidationIssue[]> {
    if (ws.name !== config.harnessName) return [];
    const scope = HARNESS_SCOPE[run.automation as keyof typeof HARNESS_SCOPE] ?? [];
    if (scope === 'any') return [];
    const allowed = [`${KNOWLEDGE_GRAPH}/`, ...scope];
    const base = await mergeBase(ws.path, `refs/heads/${ws.main}`, await head(run.checkout));
    const refused = (await workingChanges(run.checkout, base)).filter((c) => !allowed.some((p) => c.path.startsWith(p)));
    for (const c of refused) await restorePath(run.checkout, base, c.path);
    return refused.map((c) => ({
      path: c.path,
      code: 'out_of_scope' as const,
      message: `the ${run.automation} automation may not change this in the harness's repository; it was put back, not landed`,
    }));
  }

  /**
   * A definition whose files a run changed is a proposal like any other: it lands unverified, so it waits for the
   * user in the feed and is not materialized into any project until approved
   */
  private async definitionsToReview(ws: Workspace, run: RunRef, written: { path: string; entity: ParsedEntity }[]): Promise<void> {
    const base = await mergeBase(ws.path, `refs/heads/${ws.main}`, await head(run.checkout));
    const files = (await workingChanges(run.checkout, base)).filter((c) => !entityPathOf(c.path)).map((c) => c.path);
    for (const file of files) {
      for (const path of await ws.index.byArtifact(file)) {
        if (written.some((w) => w.path === path) || (await ws.index.row(path))?.type !== DEFINITION) continue;
        const text = await readFile(join(run.checkout, fileOf(path)), 'utf8').catch(() => null);
        if (text === null) continue;
        written.push({ path, entity: parseEntity(text) });
      }
    }
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
    // Implemented directly, or through a plan of it that a verified result implements
    const refs = ws.index.sql(`${ws.index.schema}.entity_reference`);
    const [implemented] = await ws.index.sql`
      select 1 from ${refs} x
      join ${ws.index.sql(`${ws.index.schema}.entity`)} e on e.path = x.from_path
      where x.relation_type = 'implements' and e.verification = 'verified'
        and (x.to_path = ${path} or x.to_path in (select from_path from ${refs} where to_path = ${path} and relation_type = 'plans'))`;
    if (implemented) return 'synced';
    return fm.verification === 'verified' ? 'entity_ahead' : 'synced';
  }

  /** Changes that cannot be made consistent become an issue entity in the checkout, landed with them, in the feed */
  /** The entities a run deleted, with the titles they had: read from the index before the landing takes them out of it */
  private async removed(ws: Workspace, deleted: string[]): Promise<Removed[]> {
    const out: Removed[] = [];
    for (const path of deleted) {
      const row = await ws.index.row(path);
      out.push({ path, title: row?.title ?? path.split('/').pop()! });
    }
    return out;
  }

  /**
   * What a run removed is done, not proposed: the run did its work. The user sees it as a report card in the feed, with
   * the title each entity had, and on the run's timeline event; approving the card only takes it off the feed
   */
  private async reportRemoval(ws: Workspace, run: RunRef, removed: Removed[]): Promise<void> {
    const { cards } = await this.settings.values();
    const path = `${REPORT_TYPE}/removed-${run.id}`;
    const lines: string[] = [];
    const what = removed.length === 1 ? 'this entity' : `these ${removed.length} entities`;
    let body = `The ${run.automation} run removed ${what} from the knowledge base. Nothing to approve: this card only says what was done.\n`;
    for (const r of removed) {
      const line = `\n- ${r.title} (\`${r.path}\`)`;
      if (cardLength(body + lines.join('') + line) > cards.characterLimit - 20) {
        lines.push(`\n- and ${removed.length - lines.length} more`);
        break;
      }
      lines.push(line);
    }
    body += lines.join('');
    await this.writeEntity(run.checkout, path, {
      title: `Removed by the ${run.automation} run`,
      body,
      frontmatter: {
        type: REPORT_TYPE,
        origin: 'automation',
        verification: 'unverified',
        sync: 'synced',
        product_impact: 2,
        timeline_impact: 1,
        unlocks: 1,
        references: [],
        artifacts: [],
      },
    });
  }

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
    const s = ws.index.schema;
    const [u] = await ws.index.sql.unsafe<{ total: number; inconsistent: number; open_issues: number; bugs: number; defects: number }[]>(
      `select count(*)::int as total,
        count(*) filter (where exists (
          select 1 from ${s}.entity_reference x where x.from_path = e.path
          and not exists (select 1 from ${s}.entity t where t.path = x.to_path)))::int as inconsistent,
        count(*) filter (where e.type = any($1::text[]) and e.verification = 'unverified')::int as open_issues,
        count(*) filter (where e.type = 'Product/Bug' and not (e.verification = 'verified' and e.sync = 'synced'))::int as bugs,
        count(*) filter (where e.type = 'Harness/Issue' and e.frontmatter->>'source' = 'validation' and e.verification = 'unverified')::int as defects
      from ${s}.entity e`,
      [ISSUE_TYPES],
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

