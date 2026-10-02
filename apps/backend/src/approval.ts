import { IssueFields } from '@momentum/contract';
import { fileOf, parseEntity, serializeEntity } from '@momentum/entity';
import { commitPathsFrom, show } from '@momentum/runs';
import { DEFINITION_TYPE, TRIGGER_TYPE } from './automations.ts';
import type { Bus } from './events.ts';
import type { Guard } from './guard.ts';
import type { HarnessSettings } from './harness.ts';
import type { Runner } from './runner.ts';
import { Conflict, NotFound, type Workspaces } from './workspaces.ts';

/** Approve, send back and resolve an issue, PLAN.md → Approval, send back and issue resolution */
export class Approval {
  constructor(
    private readonly workspaces: Workspaces,
    private readonly settings: HarnessSettings,
    private readonly guard: Guard,
    private readonly runner: Runner,
    private readonly bus: Bus,
  ) {}

  /**
   * Approval is a state, not a place: the entity already stands on the main line, and one commit sets its
   * verification to verified, removes the entities it retires and brings the entities it implements in sync. An
   * attention_metric row is recorded.
   */
  async approve(workspace: string, path: string, timeSpentMs: number): Promise<void> {
    const ws = await this.workspaces.get(workspace);
    const row = await ws.index.row(path);
    if (!row) throw new NotFound(`No entity ${path} in ${workspace}`);
    const ref = `refs/heads/${ws.main}`;
    const text = await show(ws.path, ref, fileOf(path));
    if (text === null) throw new NotFound(`${fileOf(path)} is not on ${ws.main}`);
    const entity = parseEntity(text);
    entity.frontmatter.verification = 'verified';
    entity.frontmatter.sync = await this.guard.syncOf(ws, path, entity.frontmatter);

    const files: { path: string; content: string | null }[] = [{ path: fileOf(path), content: serializeEntity(entity) }];
    const retired = entity.frontmatter.references.filter((r) => r.relation === 'retires').map((r) => r.to);
    for (const target of retired) {
      if ((await show(ws.path, ref, fileOf(target))) !== null) files.push({ path: fileOf(target), content: null });
    }
    // Results implementing an entity bring it back in sync
    const implemented = entity.frontmatter.references.filter((r) => r.relation === 'implements').map((r) => r.to);
    for (const target of implemented) {
      const onMain = await show(ws.path, ref, fileOf(target));
      if (onMain === null) continue;
      const t = parseEntity(onMain);
      if (t.frontmatter.sync === 'synced') continue;
      t.frontmatter.sync = 'synced';
      files.push({ path: fileOf(target), content: serializeEntity(t) });
    }

    await commitPathsFrom(ws.path, ws.main, files, `momentum: approve ${path}`);
    await ws.index.recordReaction(path, row.type, 'approved', timeSpentMs);
    await this.guard.indexMainLine(ws);
    for (const target of implemented) await ws.index.setSync(target, 'synced');

    if (entity.frontmatter.sync === 'entity_ahead') this.bus.emit('entity_ahead', { workspace, path });
    if (entity.frontmatter.type === TRIGGER_TYPE) this.bus.emit('triggers_changed', { workspace });
    if (entity.frontmatter.type === DEFINITION_TYPE && ws.name === (await this.workspaces.harness()).name) {
      this.bus.emit('definition_approved', { path });
    }
    this.bus.emit('feed_changed');
  }

  /** The comment starts a chat run with the comment as its prompt and the entity as its target */
  async sendBack(workspace: string, path: string, comment: string, timeSpentMs: number): Promise<string> {
    const ws = await this.workspaces.get(workspace);
    const row = await ws.index.row(path);
    if (!row) throw new NotFound(`No entity ${path} in ${workspace}`);
    await ws.index.recordReaction(path, row.type, 'sent_back', timeSpentMs);
    await ws.index.leaveFeed(path);
    this.bus.emit('feed_changed');
    return this.runner.create({
      workspace,
      automation: 'chat',
      trigger: 'on_demand',
      title: row.title,
      targetPath: path,
      message: comment,
      prompt: `The user sent back the entity ${path} ("${row.title}") from the attention feed with this comment:\n\n${comment}\n\nAct on the comment. It decides what happens to the entity: change it, split it, replace it, add entities alongside it, or retire it.`,
    });
  }

  /**
   * Resolving an issue starts a chat run that applies the chosen option, or the user's own resolution, to the entities
   * the issue concerns and retires the issue. A chosen option counts as approved, the user's own as sent back.
   */
  async resolve(workspace: string, path: string, choice: { option?: number; comment?: string }, timeSpentMs: number): Promise<string> {
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

    await ws.index.recordReaction(path, row.type, option ? 'approved' : 'sent_back', timeSpentMs);
    await ws.index.leaveFeed(path);
    this.bus.emit('feed_changed');
    return this.runner.create({
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
  }

  /** Closing an issue without a change keeps it, verified, with the user's reason; it no longer counts as open */
  async wontResolve(workspace: string, path: string, reason: string, timeSpentMs: number): Promise<void> {
    const ws = await this.workspaces.get(workspace);
    const row = await ws.index.row(path);
    if (!row) throw new NotFound(`No entity ${path} in ${workspace}`);
    if (row.type !== 'Harness/Issue') throw new Conflict(`${path} is not an issue`);
    const text = await show(ws.path, `refs/heads/${ws.main}`, fileOf(path));
    if (text === null) throw new NotFound(`${fileOf(path)} is not on ${ws.main}`);
    const entity = parseEntity(text);
    entity.frontmatter.verification = 'verified';
    entity.frontmatter.wont_resolve = reason;

    await commitPathsFrom(ws.path, ws.main, [{ path: fileOf(path), content: serializeEntity(entity) }], `momentum: won't resolve ${path}`);
    await ws.index.recordReaction(path, row.type, 'rejected', timeSpentMs);
    await this.guard.indexMainLine(ws);
    this.bus.emit('feed_changed');
  }
}
