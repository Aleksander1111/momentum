import { IssueFields } from '@momentum/contract';
import { entityPathOf, fileOf, parseEntity, serializeEntity } from '@momentum/entity';
import { commitPathsFrom, git, PathsChanged, show } from '@momentum/runs';
import { DEFINITION_TYPE, TRIGGER_TYPE } from './automations.ts';
import type { Bus } from './events.ts';
import type { Guard } from './guard.ts';
import type { HarnessSettings } from './harness.ts';
import type { Runner } from './runner.ts';
import { reactionEvent, type Timeline } from './timeline.ts';
import { Conflict, NotFound, type Workspace, type Workspaces } from './workspaces.ts';

/** Where the records of chats live: history, never something another entity depends on */
const CHAT_RECORD = 'Harness/Chat/';

/** Approve, send back and resolve an issue */
export class Approval {
  /** Reactions to one entity go one at a time: the same swipe from two devices, or twice from one, acts once */
  private reacting = new Map<string, Promise<unknown>>();

  constructor(
    private readonly workspaces: Workspaces,
    private readonly settings: HarnessSettings,
    private readonly guard: Guard,
    private readonly runner: Runner,
    private readonly bus: Bus,
    private readonly timeline: Timeline,
  ) {
    bus.on('run_ended', ({ workspace, runId }) => void this.backInFeed(workspace, runId).catch((e) => console.error(`run ${runId}:`, e)));
  }

  /**
   * An entity sent back or resolved leaves the feed while its chat acts on it. Once the chat has ended, an entity it left
   * unverified on the main line, without rewriting it, comes back: otherwise nothing would ever show it to the user again.
   */
  private async backInFeed(workspace: string, runId: string): Promise<void> {
    const ws = await this.workspaces.get(workspace);
    const [run] = await ws.index.sql<{ automation: string; target_path: string | null }[]>`
      select automation, target_path from ${ws.index.sql(`${ws.index.schema}.run`)} where id = ${runId}`;
    if (run?.automation !== 'chat' || !run.target_path) return;
    const path = run.target_path;
    await this.one(workspace, path, async () => {
      const row = await ws.index.row(path);
      if (!row || row.verification !== 'unverified' || (await ws.index.inFeed(path))) return;
      await ws.index.enterFeed(path, row.frontmatter);
      this.bus.emit('feed_changed');
    });
  }

  /** Runs one reaction to an entity once the reactions before it have finished */
  private one<T>(workspace: string, path: string, fn: () => Promise<T>): Promise<T> {
    const key = `${workspace}:${path}`;
    const next = (this.reacting.get(key) ?? Promise.resolve()).catch(() => {}).then(fn);
    this.reacting.set(key, next);
    void next
      .finally(() => {
        if (this.reacting.get(key) === next) this.reacting.delete(key);
      })
      .catch(() => {});
    return next;
  }

  /**
   * A chat already working on the entity: the same reaction again (a second device, a second tap) is that chat; a
   * different one is its next message. Either way no second chat starts on the entity.
   */
  private async openChat(workspace: string, path: string, text: string): Promise<{ id: string; repeated: boolean } | null> {
    const open = await this.runner.openChatOn(workspace, path);
    if (!open) return null;
    return { id: open.id, repeated: open.lastUserMessage?.trim() === text.trim() };
  }

  /**
   * Approval is a state, not a place: the entity already stands on the main line, and one commit sets its
   * verification to verified, removes the entities it retires that nothing else references and brings the entities it
   * implements in sync. An attention_metric row is recorded.
   */
  approve(workspace: string, path: string, timeSpentMs: number, version?: string): Promise<void> {
    return this.one(workspace, path, () => this.approveNow(workspace, path, timeSpentMs, version));
  }

  /** One commit of a reaction; a run landing on the same entities meanwhile makes it a conflict to look at again */
  private async commit(ws: Workspace, files: { path: string; content: string | null }[], message: string): Promise<void> {
    try {
      await commitPathsFrom(ws.path, ws.main, files, message);
    } catch (e) {
      if (e instanceof PathsChanged) throw new Conflict(`${e.paths.join(', ')} changed meanwhile; look at it again`);
      throw e;
    }
  }

  /** A reaction to a card that changed after the user saw it would act on what they never read */
  private async unchanged(ws: Workspace, path: string, version: string | undefined): Promise<void> {
    if (version && (await ws.index.version(path)) !== version) {
      throw new Conflict(`${path} changed after it was shown; look at it again`);
    }
  }

  private async approveNow(workspace: string, path: string, timeSpentMs: number, version?: string): Promise<void> {
    const ws = await this.workspaces.get(workspace);
    const row = await ws.index.row(path);
    if (!row) throw new NotFound(`No entity ${path} in ${workspace}`);
    const ref = `refs/heads/${ws.main}`;
    const text = await show(ws.path, ref, fileOf(path));
    if (text === null) throw new NotFound(`${fileOf(path)} is not on ${ws.main}`);
    const entity = parseEntity(text);
    // Approved already, from another device or a second swipe: nothing changes and nothing is counted twice
    if (entity.frontmatter.verification === 'verified') return;
    await this.unchanged(ws, path, version);
    entity.frontmatter.verification = 'verified';

    const files: { path: string; content: string | null }[] = [];
    const retiring = entity.frontmatter.references.filter((r) => r.relation === 'retires').map((r) => r.to);
    // An entity something else still relies on stays: retiring it would leave that reference pointing nowhere
    const kept: { path: string; by: string[] }[] = [];
    // A chat's record only tells what the chat was about, and what was written together with the retirement is part of
    // the same proposal, such as the tasks a task was split into: neither keeps anything alive, and each loses its
    // reference to what is retired
    const proposal = await this.writtenWith(ws, ref, path);
    const loose = (p: string) => p.startsWith(CHAT_RECORD) || proposal.has(p);
    const records = new Map<string, ReturnType<typeof parseEntity>>();
    const dropFromRecords = async (gone: string, referrers: string[]) => {
      for (const p of referrers.filter(loose)) {
        const record = records.get(p) ?? (await show(ws.path, ref, fileOf(p)).then((t) => (t === null ? null : parseEntity(t))));
        if (!record) continue;
        record.frontmatter.references = record.frontmatter.references.filter((r) => r.to !== gone);
        records.set(p, record);
      }
    };
    for (const target of retiring) {
      if ((await show(ws.path, ref, fileOf(target))) === null) continue;
      const referrers = (await ws.index.referrers(target)).filter((p) => p !== path && !retiring.includes(p));
      const by = referrers.filter((p) => !loose(p));
      if (by.length > 0) {
        kept.push({ path: target, by });
        continue;
      }
      files.push({ path: fileOf(target), content: null });
      await dropFromRecords(target, referrers);
    }
    const retired = retiring.filter((t) => !kept.some((k) => k.path === t));
    // Carried out, a retirement leaves no reference behind to what it removed; a plan that retires and plans no other
    // work is done with it, whatever else it mentions, unless an entity other than a chat's record still points at it
    const planReferrers = (await ws.index.referrers(path)).filter((p) => !retired.includes(p));
    const done =
      entity.frontmatter.type === 'Harness/Plan' &&
      retiring.length > 0 &&
      !entity.frontmatter.references.some((r) => r.relation === 'plans') &&
      !planReferrers.some((p) => !loose(p));
    if (done) await dropFromRecords(path, planReferrers);
    for (const [p, record] of records) if (!retired.includes(p)) files.push({ path: fileOf(p), content: serializeEntity(record) });
    entity.frontmatter.references = entity.frontmatter.references.filter((r) => !(r.relation === 'retires' && retired.includes(r.to)));
    entity.frontmatter.sync = done ? 'synced' : await this.guard.syncOf(ws, path, entity.frontmatter);
    files.unshift({ path: fileOf(path), content: done ? null : serializeEntity(entity) });
    // Results implementing an entity bring it back in sync
    const implemented = entity.frontmatter.references.filter((r) => r.relation === 'implements').map((r) => r.to);
    for (let i = 0; i < implemented.length; i++) {
      const target = implemented[i]!;
      const onMain = await show(ws.path, ref, fileOf(target));
      if (onMain === null) continue;
      const t = parseEntity(onMain);
      // Implementing a plan implements what it plans
      if (t.frontmatter.type === 'Harness/Plan') {
        for (const r of t.frontmatter.references) if (r.relation === 'plans' && !implemented.includes(r.to)) implemented.push(r.to);
      }
      if (t.frontmatter.sync === 'synced') continue;
      t.frontmatter.sync = 'synced';
      files.push({ path: fileOf(target), content: serializeEntity(t) });
    }

    const touched = (target: string) => files.some((f) => f.path === fileOf(target));
    const effects = [
      ...retired.filter(touched).map((t) => `Retire ${t}`),
      ...kept.map((k) => `Keep ${k.path}: still referenced by ${k.by.join(', ')}`),
      ...implemented.filter(touched).map((t) => `Bring ${t} back in sync`),
      ...(done ? [`Carried out, ${path} is retired with them`] : []),
    ];
    await this.commit(ws, files, [`Approve ${entity.title}`, ...(effects.length ? ['', ...effects] : [])].join('\n'));
    await ws.index.recordReaction(path, row.type, 'approved', timeSpentMs);
    await this.timeline.record(reactionEvent(workspace, { path, type: row.type, title: entity.title }, 'approved', { detail: effects.join('\n') || null, timeSpentMs }));
    await this.guard.indexMainLine(ws);
    for (const target of implemented) await ws.index.setSync(target, 'synced');

    if (entity.frontmatter.sync === 'entity_ahead') this.bus.emit('entity_ahead', { workspace, path });
    if (entity.frontmatter.type === TRIGGER_TYPE) this.bus.emit('triggers_changed', { workspace });
    if (entity.frontmatter.type === DEFINITION_TYPE && ws.name === (await this.workspaces.harness()).name) {
      this.bus.emit('definition_approved', { path });
    }
    this.bus.emit('feed_changed');
  }

  /** The other entities the commit that last changed `path` changed: what was proposed together with it */
  private async writtenWith(ws: Workspace, ref: string, path: string): Promise<Set<string>> {
    try {
      const sha = (await git(ws.path, ['log', '-1', '--format=%H', ref, '--', fileOf(path)])).trim();
      if (!sha) return new Set();
      const files = (await git(ws.path, ['show', '--name-only', '--format=', sha])).split('\n').map((f) => f.trim()).filter(Boolean);
      return new Set(files.map((f) => entityPathOf(f)).filter((p): p is string => !!p && p !== path));
    } catch {
      return new Set();
    }
  }

  /** The comment starts a chat run with the comment as its prompt and the entity as its target */
  sendBack(workspace: string, path: string, comment: string, timeSpentMs: number): Promise<string> {
    return this.one(workspace, path, () => this.sendBackNow(workspace, path, comment, timeSpentMs));
  }

  private async sendBackNow(workspace: string, path: string, comment: string, timeSpentMs: number): Promise<string> {
    const ws = await this.workspaces.get(workspace);
    const row = await ws.index.row(path);
    if (!row) throw new NotFound(`No entity ${path} in ${workspace}`);
    const open = await this.openChat(workspace, path, comment);
    if (open?.repeated) return open.id;
    await ws.index.recordReaction(path, row.type, 'sent_back', timeSpentMs);
    await ws.index.leaveFeed(path);
    this.bus.emit('feed_changed');
    if (open) await this.runner.send(open.id, comment);
    const runId = open?.id ?? await this.runner.create({
      workspace,
      automation: 'chat',
      trigger: 'on_demand',
      title: row.title,
      targetPath: path,
      message: comment,
      prompt: `The user sent back the entity ${path} ("${row.title}") from the attention feed with this comment:\n\n${comment}\n\nAct on the comment. It decides what happens to the entity: change it, split it, replace it, add entities alongside it, or retire it.`,
    });
    await this.timeline.record(reactionEvent(workspace, row, 'sent_back', { detail: comment, runId, timeSpentMs }));
    return runId;
  }

  /**
   * Resolving an issue starts a chat run that applies the chosen option, or the user's own resolution, to the entities
   * the issue concerns and retires the issue. A chosen option counts as approved, the user's own as sent back.
   */
  resolve(workspace: string, path: string, choice: { option?: number; comment?: string }, timeSpentMs: number, version?: string): Promise<string> {
    return this.one(workspace, path, () => this.resolveNow(workspace, path, choice, timeSpentMs, version));
  }

  private async resolveNow(
    workspace: string,
    path: string,
    choice: { option?: number; comment?: string },
    timeSpentMs: number,
    version?: string,
  ): Promise<string> {
    const ws = await this.workspaces.get(workspace);
    const row = await ws.index.row(path);
    if (!row) throw new NotFound(`No entity ${path} in ${workspace}`);
    if (row.type !== 'Harness/Issue') throw new Conflict(`${path} is not an issue`);
    const { options } = IssueFields.parse(row.frontmatter);
    const option = choice.option === undefined ? undefined : options[choice.option];
    if (choice.option !== undefined && !option) throw new Conflict(`${path} has no option ${choice.option}`);
    const resolution = option ? `${option.label}: ${option.change}` : choice.comment?.trim();
    if (!resolution) throw new Conflict(`Resolve ${path} with an option or a comment`);
    const concerns = row.frontmatter.references.filter((r) => r.relation === 'concerns').map((r) => `- ${r.to}`);
    const open = await this.openChat(workspace, path, resolution);
    if (open?.repeated) return open.id;
    await this.unchanged(ws, path, version);

    await ws.index.recordReaction(path, row.type, option ? 'approved' : 'sent_back', timeSpentMs);
    await ws.index.leaveFeed(path);
    this.bus.emit('feed_changed');
    if (open) await this.runner.send(open.id, resolution);
    const runId = open?.id ?? await this.runner.create({
      workspace,
      automation: 'chat',
      trigger: 'on_demand',
      title: row.title,
      targetPath: path,
      message: resolution,
      prompt: [
        `The user resolved the issue ${path} ("${row.title}") from the attention feed with ${option ? 'this option' : 'their own resolution'}:`,
        '',
        resolution,
        '',
        'Apply it to the entities the issue concerns:',
        ...concerns,
        '',
        'Then retire the issue: delete its entity file.',
      ].join('\n'),
    });
    await this.timeline.record(reactionEvent(workspace, row, 'resolved', { detail: resolution, runId, timeSpentMs }));
    return runId;
  }

  /** Closing an issue without a change keeps it, verified, with the user's reason; it no longer counts as open */
  wontResolve(workspace: string, path: string, reason: string, timeSpentMs: number): Promise<void> {
    return this.one(workspace, path, () => this.wontResolveNow(workspace, path, reason, timeSpentMs));
  }

  private async wontResolveNow(workspace: string, path: string, reason: string, timeSpentMs: number): Promise<void> {
    const ws = await this.workspaces.get(workspace);
    const row = await ws.index.row(path);
    if (!row) throw new NotFound(`No entity ${path} in ${workspace}`);
    if (row.type !== 'Harness/Issue') throw new Conflict(`${path} is not an issue`);
    const text = await show(ws.path, `refs/heads/${ws.main}`, fileOf(path));
    if (text === null) throw new NotFound(`${fileOf(path)} is not on ${ws.main}`);
    const entity = parseEntity(text);
    if (entity.frontmatter.verification === 'verified' && entity.frontmatter.wont_resolve) return;
    entity.frontmatter.verification = 'verified';
    entity.frontmatter.wont_resolve = reason;

    await this.commit(ws, [{ path: fileOf(path), content: serializeEntity(entity) }], `Won't resolve ${entity.title}\n\n${reason}`);
    await ws.index.recordReaction(path, row.type, 'rejected', timeSpentMs);
    await this.timeline.record(reactionEvent(workspace, row, 'wont_resolve', { detail: reason, timeSpentMs }));
    await this.guard.indexMainLine(ws);
    this.bus.emit('feed_changed');
  }
}
