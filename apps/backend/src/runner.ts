import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type { AutomationName, ModelChoice, ModelSettings, Risk, Run, RunDetail, RunMessage, RunStatus, RunTrigger } from '@momentum/contract';
import { fileOf } from '@momentum/entity';
import { createKbServer, type Embed } from '@momentum/kb';
import {
  addWorktree,
  ask,
  changes,
  commitAll,
  deleteBranch,
  head,
  isMerged,
  mergeKeeping,
  removeWorktree,
  startSession,
  type SessionHandle,
  type SessionResult,
  type Usage,
} from '@momentum/runs';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { z } from 'zod';
import type { Automations } from './automations.ts';
import { config } from './config.ts';
import type { Bus } from './events.ts';
import type { Guard, RunRef } from './guard.ts';
import type { HarnessSettings } from './harness.ts';
import { guardHooks } from './hooks.ts';
import { ESTIMATOR, parseRisk, riskQuestion, sdkModel, setModel } from './models.ts';
import { NotFound, type Workspace, type Workspaces } from './workspaces.ts';

interface RunRow {
  id: string;
  automation: AutomationName;
  branch: string;
  checkout: string;
  trigger: RunTrigger;
  target_path: string | null;
  status: RunStatus;
  title: string;
  prompt: string;
  base_commit: string | null;
  session_id: string | null;
  error: string | null;
  created_at: Date;
  started_at: Date | null;
  ended_at: Date | null;
  usage_five_hour: number | null;
  usage_week: number | null;
  /** Chosen when the run first starts and kept when its session resumes */
  model: ModelChoice | null;
  risk: Risk | null;
}

export interface NewRun {
  workspace: string;
  automation: AutomationName;
  trigger: RunTrigger;
  prompt: string;
  title?: string;
  targetPath?: string | null;
  /** Continue on this branch instead of a new one */
  branch?: string | null;
  /** What the chat shows as the user's message, when it differs from the prompt */
  message?: string;
}

interface Active {
  ref: RunRef;
  handle: SessionHandle;
  validation?: { passed: boolean; form: string; summary: string };
  mapping?: { complete: boolean; progress: string; coverage: number; documents?: string[] };
  /** Settles once the run's changes have passed the guard and its status is recorded */
  finished?: Promise<void>;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const delta = (a: number | null, b: number | null) => (a !== null && b !== null ? Math.max(0, b - a) : null);

export class Runner {
  private active = new Map<string, Active>();

  constructor(
    private readonly workspaces: Workspaces,
    private readonly settings: HarnessSettings,
    private readonly guard: Guard,
    private readonly automations: Automations,
    private readonly bus: Bus,
    private readonly embed: Embed,
  ) {}

  private t(ws: Workspace, table: string) {
    return ws.index.sql(`${ws.index.schema}.${table}`);
  }

  async workspaceOf(runId: string): Promise<Workspace> {
    const [r] = await this.workspaces.sql<{ workspace: string }[]>`select workspace from harness.run_ref where id = ${runId}`;
    if (!r) throw new NotFound(`No run ${runId}`);
    return this.workspaces.get(r.workspace);
  }

  private async row(ws: Workspace, id: string): Promise<RunRow> {
    const [r] = await ws.index.sql<RunRow[]>`select * from ${this.t(ws, 'run')} where id = ${id}`;
    if (!r) throw new NotFound(`No run ${id}`);
    return r;
  }

  private view(ws: Workspace, r: RunRow): Run {
    return {
      id: r.id,
      workspace: ws.name,
      automation: r.automation,
      branch: r.branch,
      checkout: r.checkout,
      trigger: r.trigger,
      targetPath: r.target_path,
      status: r.status,
      startedAt: iso(r.started_at),
      endedAt: iso(r.ended_at),
      error: r.error,
      usage: { fiveHour: r.usage_five_hour, week: r.usage_week },
    };
  }

  async detail(id: string): Promise<RunDetail> {
    const ws = await this.workspaceOf(id);
    const r = await this.row(ws, id);
    const messages = await ws.index.sql<{ seq: number; role: RunMessage['role']; text: string; at: Date }[]>`
      select seq, role, text, at from ${this.t(ws, 'run_message')} where run_id = ${id} order by seq`;
    return { ...this.view(ws, r), messages: messages.map((m) => ({ ...m, at: m.at.toISOString() })) };
  }

  private async setStatus(ws: Workspace, id: string, status: RunStatus, extra: Partial<RunRow> = {}) {
    const values = { status, ...extra };
    await ws.index.sql`update ${this.t(ws, 'run')} set ${ws.index.sql(values as never)} where id = ${id}`;
  }

  private async addMessage(ws: Workspace, id: string, role: RunMessage['role'], text: string) {
    await ws.index.sql`insert into ${this.t(ws, 'run_message')} (run_id, seq, role, text)
      values (${id}, (select coalesce(max(seq), 0) + 1 from ${this.t(ws, 'run_message')} where run_id = ${id}), ${role}, ${text})`;
  }

  /** A queued run: its own branch and checkout are created when it starts */
  async create(spec: NewRun): Promise<string> {
    const ws = await this.workspaces.get(spec.workspace);
    const id = randomBytes(4).toString('hex');
    const branch = spec.branch ?? `momentum/${spec.automation}/${id}`;
    const previous = spec.branch
      ? (await ws.index.sql<{ checkout: string }[]>`
          select checkout from ${this.t(ws, 'run')} where branch = ${spec.branch} order by created_at desc limit 1`)[0]
      : undefined;
    const checkout = previous && existsSync(previous.checkout) ? previous.checkout : join(config.runs, ws.name, id);
    await this.workspaces.sql`insert into harness.run_ref ${this.workspaces.sql({ id, workspace: ws.name })}`;
    await ws.index.sql`insert into ${this.t(ws, 'run')} ${ws.index.sql({
      id,
      automation: spec.automation,
      branch,
      checkout,
      trigger: spec.trigger,
      target_path: spec.targetPath ?? null,
      status: 'queued',
      title: spec.title ?? '',
      prompt: spec.prompt,
    })}`;
    if (spec.automation === 'chat') {
      await ws.index.sql`insert into ${this.t(ws, 'chat')} ${ws.index.sql({ run_id: id, entity_path: null })}`;
      await this.addMessage(ws, id, 'user', spec.message ?? spec.prompt);
    }
    if (spec.targetPath) await this.guard.markUpdating(ws, spec.targetPath);
    return id;
  }

  async queued(): Promise<{ workspace: string; id: string; automation: AutomationName; branch: string }[]> {
    const out: { workspace: string; id: string; automation: AutomationName; branch: string }[] = [];
    for (const ws of await this.workspaces.enabled()) {
      const rows = await ws.index.sql<{ id: string; automation: AutomationName; branch: string }[]>`
        select id, automation, branch from ${this.t(ws, 'run')} where status = 'queued' order by created_at`;
      out.push(...rows.map((r) => ({ workspace: ws.name, ...r })));
    }
    return out;
  }

  activeCount(workspace?: string): number {
    return [...this.active.values()].filter((a) => !workspace || a.ref.workspace === workspace).length;
  }

  isActive(id: string): boolean {
    return this.active.has(id);
  }

  /** Runs on one branch share its checkout, so they run one after another */
  branchBusy(workspace: string, branch: string): boolean {
    return [...this.active.values()].some((a) => a.ref.workspace === workspace && a.ref.branch === branch);
  }

  async hasOpenRun(workspace: string, automation: AutomationName): Promise<boolean> {
    const ws = await this.workspaces.get(workspace);
    const [r] = await ws.index.sql`select 1 from ${this.t(ws, 'run')}
      where automation = ${automation} and status in ('queued', 'running')`;
    return !!r;
  }

  async hasOpenRunOnBranch(workspace: string, branch: string): Promise<boolean> {
    const ws = await this.workspaces.get(workspace);
    const [r] = await ws.index.sql`select 1 from ${this.t(ws, 'run')}
      where branch = ${branch} and status in ('queued', 'running')`;
    return !!r;
  }

  /** Ends every open run of an automation in a workspace: running ones are killed, queued ones never start */
  async stopAutomation(workspace: string, automation: AutomationName): Promise<string[]> {
    const ws = await this.workspaces.get(workspace);
    const rows = await ws.index.sql<{ id: string; status: RunStatus }[]>`select id, status from ${this.t(ws, 'run')}
      where automation = ${automation} and status in ('queued', 'running')`;
    for (const r of rows) {
      if (this.active.has(r.id)) this.active.get(r.id)!.handle.kill();
      else await this.setStatus(ws, r.id, 'killed', { ended_at: new Date() });
    }
    return rows.map((r) => r.id);
  }

  /** Ends every open run of a workspace and waits until the killed processes have finished */
  async stopWorkspace(workspace: string): Promise<void> {
    const ws = await this.workspaces.get(workspace);
    const running = [...this.active.values()].filter((a) => a.ref.workspace === workspace);
    for (const a of running) a.handle.kill();
    await ws.index.sql`update ${this.t(ws, 'run')} set status = 'killed', ended_at = now() where status = 'queued'`;
    await Promise.all(running.map((a) => a.finished?.catch(() => {})));
  }

  async lastStart(workspace: string, automation: AutomationName): Promise<Date | null> {
    const ws = await this.workspaces.get(workspace);
    const [r] = await ws.index.sql<{ at: Date | null }[]>`select max(created_at) as at from ${this.t(ws, 'run')}
      where automation = ${automation} and trigger = 'schedule'`;
    return r?.at ?? null;
  }

  /**
   * Runs a restart left `running`: their processes are gone. What they wrote still passes the guard and reaches the
   * feed; the run itself is failed, and a chat resumes its session on the next message.
   */
  async recover(): Promise<void> {
    const refs = await this.workspaces.sql<{ workspace: string }[]>`select distinct workspace from harness.run_ref`;
    for (const { workspace } of refs) {
      const ws = await this.workspaces.get(workspace).catch(() => null);
      if (!ws) continue;
      const rows = await ws.index.sql<RunRow[]>`select * from ${this.t(ws, 'run')} where status = 'running'`;
      for (const r of rows) {
        if (this.active.has(r.id)) continue;
        const ref: RunRef = { id: r.id, workspace: ws.name, automation: r.automation, branch: r.branch, checkout: r.checkout, targetPath: r.target_path };
        if (existsSync(r.checkout)) await this.guard.transaction(ref).catch((e) => console.error(`recover ${r.id}:`, e));
        await this.setStatus(ws, r.id, 'failed', { ended_at: new Date(), error: 'lost at restart' });
        console.log(`run ${r.id} (${r.automation}, ${ws.name}) was lost at restart`);
      }
    }
  }

  /** Starts a queued run: own checkout, own branch, one Claude Code process */
  async start(id: string): Promise<void> {
    const ws = await this.workspaceOf(id);
    const r = await this.row(ws, id);
    const ref: RunRef = { id, workspace: ws.name, automation: r.automation, branch: r.branch, checkout: r.checkout, targetPath: r.target_path };
    try {
      await addWorktree(ws.path, r.checkout, r.branch, `refs/heads/${ws.main}`);
      await this.setStatus(ws, id, 'running', { started_at: new Date(), base_commit: await head(r.checkout), error: null });
      this.guard.watch(ref);
      await this.launch(ws, r, ref, r.prompt, r.session_id);
    } catch (e) {
      await this.setStatus(ws, id, 'failed', { error: (e as Error).message, ended_at: new Date() });
      await this.guard.unwatch(id);
      this.bus.emit('run_ended', { workspace: ws.name, runId: id });
    }
  }

  private async launch(ws: Workspace, r: RunRow, ref: RunRef, prompt: string, resume: string | null): Promise<void> {
    const definition = await this.automations.definition(ws, r.automation);
    const { cards, lifetimes, models } = await this.settings.values();
    const model = r.model ?? (await this.chooseModel(ws, r, models));
    const entry: Active = { ref, handle: null as unknown as SessionHandle };
    const kb = createKbServer({
      index: ws.index,
      embed: this.embed,
      checkout: r.checkout,
      runId: r.id,
      validation: async () => ({ characterLimit: cards.characterLimit, types: this.workspaces.types }),
      recordAgentMetric: async (m) => {
        await ws.index.sql`insert into ${this.t(ws, 'agent_metric')} ${ws.index.sql({
          run_id: r.id,
          automation: r.automation,
          misalignments: m.misalignments,
          recurring_issues: m.recurringIssues,
          variant: definition.variant,
        })}`;
      },
    });
    const harnessTools = createSdkMcpServer({
      name: 'momentum-run',
      version: '0.0.0',
      tools: [
        tool(
          'report_validation',
          'Report the outcome of validating this branch. A passed validation merges the branch into the main line; a failed one holds it until the issue you raised is resolved.',
          { passed: z.boolean(), form: z.enum(['review', 'test suite run', 'exploratory pass', 'consistency check']), summary: z.string() },
          async (v) => {
            entry.validation = v;
            return { content: [{ type: 'text', text: 'Recorded' }] };
          },
        ),
        tool(
          'report_mapping',
          'Report the progress of mapping this repository into the knowledge base: what is covered, what the next run should take up, and the share of the repository covered so far (0–1), which estimates the full build. Set complete once the repository is covered; the mapping then stops. List in documents the repository files to summarize; the harness summarizes them after the run.',
          {
            complete: z.boolean(),
            progress: z.string(),
            coverage: z.number().min(0).max(1),
            documents: z.array(z.string()).optional(),
          },
          async (v) => {
            entry.mapping = v;
            return { content: [{ type: 'text', text: 'Recorded' }] };
          },
        ),
      ],
    });
    const instructions = [
      definition.instructions,
      this.context(ws, r, cards.characterLimit, cards.presentationRules, lifetimes),
    ].join('\n\n');
    let latest: Usage = { fiveHour: null, week: null };
    let first: Usage | null = null;
    entry.handle = startSession({
      cwd: r.checkout,
      prompt: resume ? prompt : this.firstPrompt(r, prompt),
      instructions,
      mcpServers: { 'momentum-kb': kb, 'momentum-run': harnessTools },
      hooks: guardHooks(this.guard, ref),
      resume: resume ?? undefined,
      model: sdkModel(model),
      interactiveIdleMs: r.automation === 'chat' ? config.chatIdleMs : undefined,
      limits: config.limits,
      procgov: config.procgov,
      onSessionId: (sid) => void this.setStatus(ws, r.id, 'running', { session_id: sid }),
      onAssistantText: (text) => void this.addMessage(ws, r.id, 'assistant', text),
      onUsage: (u) => {
        latest = { fiveHour: u.fiveHour ?? latest.fiveHour, week: u.week ?? latest.week };
        first = { fiveHour: first?.fiveHour ?? latest.fiveHour, week: first?.week ?? latest.week };
        void this.workspaces.sql`insert into harness.usage_sample ${this.workspaces.sql({ five_hour: latest.fiveHour, week: latest.week })}`;
        // What the run has used so far, visible while it runs
        void ws.index.sql`update ${this.t(ws, 'run')} set usage_five_hour = ${delta(first.fiveHour, latest.fiveHour)},
          usage_week = ${delta(first.week, latest.week)} where id = ${r.id} and status = 'running'`;
      },
    });
    this.active.set(r.id, entry);
    entry.finished = entry.handle.done.then((result) => this.finish(ws, r.id, entry, result));
  }

  /** The model a run starts on; in risk mode an implementation gets the one set for its estimated risk */
  private async chooseModel(ws: Workspace, r: RunRow, models: ModelSettings): Promise<ModelChoice> {
    let model = setModel(models, r.automation);
    let risk: Risk | null = null;
    if (models.mode === 'risk' && r.automation === 'implementation') {
      risk = await this.estimateRisk(ws, r).catch((e) => {
        console.error(`risk of run ${r.id}:`, e);
        return null;
      });
      if (risk) model = models.risk[risk];
    }
    await ws.index.sql`update ${this.t(ws, 'run')} set model = ${model}, risk = ${risk} where id = ${r.id}`;
    console.log(`run ${r.id} (${r.automation}, ${ws.name}) on ${model}${risk ? `, ${risk} risk` : ''}`);
    return model;
  }

  /** The user's risk rules applied to the target and its plans; null without rules or a target */
  private async estimateRisk(ws: Workspace, r: RunRow): Promise<Risk | null> {
    const rules = await this.automations.riskRules();
    const target = r.target_path ? await ws.index.row(r.target_path) : null;
    if (!rules || !target) return null;
    const plans = [];
    for (const ref of await ws.index.neighbours(target.path)) {
      if (ref.direction !== 'in' || ref.relation !== 'plans') continue;
      const plan = await ws.index.row(ref.path);
      if (plan) plans.push(plan);
    }
    const q = riskQuestion(rules, target, plans);
    const answer = await ask({ cwd: r.checkout, ...q, model: ESTIMATOR, limits: config.limits, procgov: config.procgov });
    return parseRisk(answer);
  }

  /** Harness facts every run needs: where it works and the rules of the knowledge base */
  private context(ws: Workspace, r: RunRow, limit: number, rules: string, lifetimes: { type: string; rule: string }[]): string {
    return `# Momentum run

- Workspace: ${ws.name} (${ws.path}); this checkout: ${r.checkout}; branch: ${r.branch}; main line: ${ws.main}
- Run: ${r.id}, automation ${r.automation}, started by ${r.trigger}${r.target_path ? `, target entity ${r.target_path}` : ''}
- Work only in this checkout and on this branch. The harness commits your changes when the run ends; the consistency guard validates them and the user approves them through the attention feed. Never push, never switch branches, never touch the main line.

## Knowledge base
- Entities live at knowledge-graph/<Domain>/<Type>/[<parent-name>/]<name>.md; the type path comes from docs/entity-types.tsv of the harness (Domain/Entity Type). Read and write them with the momentum-kb tools (search, read, references, write) or directly as files.
- Frontmatter: type, origin (user | requested | automation), verification (always unverified when you write), sync, product_impact, timeline_impact, unlocks (integers 0–5: impact on the product, impact on the timeline, how much the work unlocks — they rank the feed), references (to: entity path, relation: snake_case verb such as depends_on, implements, concerns, retires), artifacts (repository paths the entity summarizes).
- The body starts with "# <title>" and then the card: free-form markdown within ${limit} characters, in whatever form presents the entity best (paragraph, bullets, table, mermaid diagram). The entity is its card. An entity that does not fit is split into entities that reference each other.
- Card presentation rules from the user: ${rules.trim() || 'none beyond the character limit'}
- Artifacts are repository files outside knowledge-graph/. When this run ends, the harness summarizes every artifact it added, changed or deleted into entities: never write summaries of your own artifacts.
- Lifetimes per entity type: ${lifetimes.map((l) => `${l.type}: ${l.rule}`).join('; ') || 'none set'}
- Every reference must resolve to an existing entity on this branch.`;
  }

  private firstPrompt(r: RunRow, prompt: string): string {
    return r.automation === 'chat' ? prompt : `${prompt}\n\nToday is ${new Date().toISOString().slice(0, 10)}.`;
  }

  /** A message from the chat tool: steers the running process, or resumes the session on the same checkout */
  async send(id: string, text: string): Promise<void> {
    const ws = await this.workspaceOf(id);
    await this.addMessage(ws, id, 'user', text);
    const entry = this.active.get(id);
    if (entry?.handle.send(text)) return;
    const r = await this.row(ws, id);
    // Another run holds the branch's checkout, such as the chat's summarization: resume once it has ended
    if (await this.hasOpenRunOnBranch(ws.name, r.branch)) {
      const prompt = r.status === 'queued' ? `${r.prompt}\n\n${text}` : text;
      await this.setStatus(ws, id, 'queued', { prompt, ended_at: null, error: null });
      return;
    }
    const ref: RunRef = { id, workspace: ws.name, automation: r.automation, branch: r.branch, checkout: r.checkout, targetPath: r.target_path };
    await addWorktree(ws.path, r.checkout, r.branch, `refs/heads/${ws.main}`);
    await this.setStatus(ws, id, 'running', { ended_at: null, error: null });
    this.guard.watch(ref);
    await this.launch(ws, r, ref, text, r.session_id);
  }

  async kill(id: string): Promise<void> {
    this.active.get(id)?.handle.kill();
  }

  private async finish(ws: Workspace, id: string, entry: Active, result: SessionResult): Promise<void> {
    this.active.delete(id);
    const r = await this.row(ws, id);
    try {
      if (r.automation === 'chat') await this.writeTranscript(ws, r);
      await this.guard.transaction(entry.ref);
      const status: RunStatus = result.error === 'killed' ? 'killed' : result.ok ? 'finished' : 'failed';
      const usage = {
        usage_five_hour: delta(result.usageBefore.fiveHour, result.usageAfter.fiveHour) ?? r.usage_five_hour,
        usage_week: delta(result.usageBefore.week, result.usageAfter.week) ?? r.usage_week,
      };
      await this.setStatus(ws, id, status, { ended_at: new Date(), error: result.ok ? null : result.error, ...usage });
      const variant = (await this.automations.approved()).find((d) => d.name === r.automation)?.variant ?? null;
      await ws.index.sql`insert into ${this.t(ws, 'agent_metric')} ${ws.index.sql({
        run_id: id,
        automation: r.automation,
        variant,
        ...usage,
      })}`;
      if (r.automation === 'mapping') await this.afterMapping(ws, status, entry.mapping);
      // Queued before the validation below, so validation finds the result entity summarization writes
      if (r.automation === 'summarization') await this.linkChats(ws);
      else if (status !== 'killed') await this.queueSummarization(ws, r, entry.mapping?.documents ?? []);
      if (
        r.branch.startsWith('momentum/implementation/') &&
        r.automation !== 'validation' &&
        r.automation !== 'summarization' &&
        status === 'finished'
      ) {
        this.bus.emit('implementation_finished', { workspace: ws.name, runId: id, branch: r.branch, targetPath: r.target_path });
      }
      if (r.automation === 'validation') await this.afterValidation(ws, r, entry.validation);
    } catch (e) {
      await this.setStatus(ws, id, 'failed', { ended_at: new Date(), error: (e as Error).message });
    } finally {
      await this.guard.unwatch(id);
      this.bus.emit('run_ended', { workspace: ws.name, runId: id });
    }
  }

  /** The mapping goes on run after run until a run reports the repository covered, or the user stops it */
  private async afterMapping(ws: Workspace, status: RunStatus, report: Active['mapping']): Promise<void> {
    if (report?.progress) await this.settings.setMappingProgress(ws.name, report.progress);
    if (report) await this.settings.setMappingCoverage(ws.name, report.complete ? 1 : report.coverage);
    if (status !== 'finished') return;
    if (report?.complete && (await this.settings.mapping(ws.name)).state === 'building') {
      await this.settings.setMapping(ws.name, 'complete');
    }
  }

  /** The chat is stored as an artifact; summarization writes its summary entity after the run */
  private async writeTranscript(ws: Workspace, r: RunRow): Promise<void> {
    const messages = await ws.index.sql<{ role: string; text: string; at: Date }[]>`
      select role, text, at from ${this.t(ws, 'run_message')} where run_id = ${r.id} order by seq`;
    const file = join(r.checkout, 'chats', `${r.id}.jsonl`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, messages.map((m) => JSON.stringify(m)).join('\n') + '\n', 'utf8');
    await commitAll(r.checkout, `momentum: chat ${r.id}`);
  }

  /** Each chat points at the summary entity of its transcript, once summarization has written it */
  private async linkChats(ws: Workspace): Promise<void> {
    await ws.index.sql`update ${this.t(ws, 'chat')} c set entity_path = a.entity_path
      from ${this.t(ws, 'entity_artifact')} a
      where a.artifact_path = 'chats/' || c.run_id || '.jsonl' and c.entity_path is distinct from a.entity_path`;
  }

  /**
   * Summarization is the harness's step, not the run's: the artifacts a run added, changed or deleted, and the documents
   * a mapping run listed, are summarized by a summarization run on the same branch, minus the user's exclusions
   */
  private async queueSummarization(ws: Workspace, r: RunRow, documents: string[]): Promise<void> {
    const { summarization } = await this.settings.values();
    const excluded = (path: string) =>
      path.startsWith('knowledge-graph/') || summarization.exclude.some((pattern) => posix.matchesGlob(path, pattern));
    const changed = r.base_commit ? await changes(r.checkout, r.base_commit, 'HEAD') : [];
    const artifacts = new Map<string, string>();
    for (const c of changed) {
      if (!excluded(c.path)) artifacts.set(c.path, c.status === 'A' ? 'added' : c.status === 'D' ? 'deleted' : 'changed');
    }
    for (const d of documents) if (!excluded(d) && !artifacts.has(d)) artifacts.set(d, 'to map');
    if (artifacts.size === 0) return;
    const list = [...artifacts].map(([path, what]) => `- ${path} (${what})`).join('\n');
    const target = r.target_path ? ` Its target entity is ${r.target_path}.` : '';
    await this.create({
      workspace: ws.name,
      automation: 'summarization',
      trigger: 'event',
      branch: r.branch,
      title: r.title ? `Summary: ${r.title}` : undefined,
      prompt: `The ${r.automation} run ${r.id} on this branch ended.${target} Summarize these artifacts:\n\n${list}`,
    });
  }

  /** Validation gates the merge: a passed branch is merged into the main line; a failed one is held */
  private async afterValidation(ws: Workspace, r: RunRow, v: Active['validation']): Promise<void> {
    const implementation = (await ws.index.sql<{ id: string }[]>`
      select id from ${this.t(ws, 'run')} where branch = ${r.branch} and automation = 'implementation'
      order by created_at desc limit 1`)[0];
    if (!v?.passed) {
      if (implementation) await this.setStatus(ws, implementation.id, 'held');
      return;
    }
    const merged = await mergeKeeping(ws.path, ws.main, r.branch, 'knowledge-graph', `momentum: merge ${r.branch} (validated: ${v.form})`);
    if (!merged) {
      await this.raiseConflict(ws, r);
      if (implementation) await this.setStatus(ws, implementation.id, 'held');
      return;
    }
    if (implementation) await this.setStatus(ws, implementation.id, 'finished');
    await this.guard.indexMainLine(ws);
    await this.cleanup(ws, r.branch);
  }

  private async raiseConflict(ws: Workspace, r: RunRow): Promise<void> {
    const path = `Harness/Conflict/${r.branch.split('/').pop()}`;
    const text = `---
type: Harness/Conflict
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 4
unlocks: 4
references: []
artifacts: []
---
# ${r.branch} cannot be merged

The branch passed validation but conflicts with the main line \`${ws.main}\`. A send back with how to resolve it starts a chat run on the branch.
`;
    const file = join(r.checkout, fileOf(path));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text, 'utf8');
    await this.guard.transaction({ id: r.id, workspace: ws.name, automation: r.automation, branch: r.branch, checkout: r.checkout, targetPath: null });
  }

  /** A branch with nothing left to approve or merge loses its checkout */
  async cleanup(ws: Workspace, branch: string): Promise<void> {
    const pending = await ws.index.onBranch(branch);
    if (pending.length > 0) return;
    const runs = await ws.index.sql<{ id: string; checkout: string; status: RunStatus }[]>`
      select id, checkout, status from ${this.t(ws, 'run')} where branch = ${branch}`;
    if (runs.some((x) => this.active.has(x.id) || x.status === 'queued' || x.status === 'held')) return;
    // An implementation branch keeps its checkout until validation has merged it
    if (branch.startsWith('momentum/implementation/') && !(await isMerged(ws.path, branch, ws.main))) return;
    for (const checkout of new Set(runs.map((x) => x.checkout))) await removeWorktree(ws.path, checkout).catch(() => {});
    await deleteBranch(ws.path, branch).catch(() => {});
  }
}
