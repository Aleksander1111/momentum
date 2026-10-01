import { fileOf, parseEntity, serializeEntity } from '@momentum/entity';
import { commitPathsFrom, head, show } from '@momentum/runs';
import { DEFINITION_TYPE, TRIGGER_TYPE } from './automations.ts';
import type { Bus } from './events.ts';
import { sameText, type Guard } from './guard.ts';
import type { HarnessSettings } from './harness.ts';
import type { Runner } from './runner.ts';
import { NotFound, type Workspaces } from './workspaces.ts';

/** Approve and send back */
export class Approval {
  constructor(
    private readonly workspaces: Workspaces,
    private readonly settings: HarnessSettings,
    private readonly guard: Guard,
    private readonly runner: Runner,
    private readonly bus: Bus,
  ) {}

  /**
   * The entity's changes on its run branch are committed to the main line with verification verified; entities the
   * approved one retires are removed with it. An attention_metric row is recorded.
   */
  async approve(workspace: string, path: string, timeSpentMs: number): Promise<void> {
    const ws = await this.workspaces.get(workspace);
    const row = await ws.index.row(path);
    if (!row) throw new NotFound(`No entity ${path} in ${workspace}`);
    const ref = row.branch ? `refs/heads/${row.branch}` : `refs/heads/${ws.main}`;
    const text = await show(ws.path, ref, fileOf(path));
    if (text === null) throw new NotFound(`${fileOf(path)} is not on ${row.branch ?? ws.main}`);
    const entity = parseEntity(text);
    entity.frontmatter.verification = 'verified';
    entity.frontmatter.sync = await this.guard.syncOf(ws, path, entity.frontmatter);

    const files: { path: string; content: string | null }[] = [{ path: fileOf(path), content: serializeEntity(entity) }];
    const retired = entity.frontmatter.references.filter((r) => r.relation === 'retires').map((r) => r.to);
    for (const target of retired) files.push({ path: fileOf(target), content: null });
    for (const artifact of entity.frontmatter.artifacts) {
      if (!artifact.startsWith('chats/') || !row.branch) continue;
      const content = await show(ws.path, ref, artifact);
      const onMain = await show(ws.path, `refs/heads/${ws.main}`, artifact);
      if (content !== null && (onMain === null || !sameText(content, onMain))) files.push({ path: artifact, content });
    }
    // Results implementing an entity bring it back in sync
    const implemented = entity.frontmatter.references.filter((r) => r.relation === 'implements').map((r) => r.to);
    for (const target of implemented) {
      const onMain = await show(ws.path, `refs/heads/${ws.main}`, fileOf(target));
      if (onMain === null) continue;
      const t = parseEntity(onMain);
      if (t.frontmatter.sync === 'synced') continue;
      t.frontmatter.sync = 'synced';
      files.push({ path: fileOf(target), content: serializeEntity(t) });
    }

    await commitPathsFrom(ws.path, ws.main, files, `momentum: approve ${path}`);
    await ws.index.recordReaction(path, row.type, 'approved', timeSpentMs);
    await ws.index.leaveFeed(path);
    await this.guard.index(ws, path, entity, null, null);
    for (const target of retired) await ws.index.remove(target);
    for (const target of implemented) await ws.index.setSync(target, 'synced');
    await this.settings.setIndexedCommit(ws.name, await head(ws.path, `refs/heads/${ws.main}`));
    await this.guard.recordMetrics(ws);

    if (entity.frontmatter.sync === 'entity_ahead') this.bus.emit('entity_ahead', { workspace, path });
    if (entity.frontmatter.type === TRIGGER_TYPE) this.bus.emit('triggers_changed', { workspace });
    if (entity.frontmatter.type === DEFINITION_TYPE && ws.name === (await this.workspaces.harness()).name) {
      this.bus.emit('definition_approved', { path });
    }
    this.bus.emit('feed_changed');
    if (row.branch) await this.runner.cleanup(ws, row.branch);
  }

  /** The comment starts a chat run on the same branch, with the comment as its prompt and the entity as its target */
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
      branch: row.branch,
      message: comment,
      prompt: `The user sent back the entity ${path} ("${row.title}") from the attention feed with this comment:\n\n${comment}\n\nAct on the comment. It decides what happens to the entity: change it, split it, replace it, add entities alongside it, or retire it.`,
    });
  }
}
