import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type { AutomationName, ContextItem, EntityFrontmatter, InterviewState, ModelChoice, ModelSettings, Risk, Run, RunDetail, RunMessage, RunStatus, RunTrigger } from '@momentum/contract';
import { fileOf } from '@momentum/entity';
import { createKbServer, type Embed } from '@momentum/kb';
import { ask, ensureCheckout, head, removeWorktree, show, startSession, workingChanges, type SessionHandle, type SessionResult, type Usage } from '@momentum/runs';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { z } from 'zod';
import { HARNESS_ONLY, type Automations } from './automations.ts';
import { config } from './config.ts';
import type { Bus } from './events.ts';
import type { Guard, RunRef } from './guard.ts';
import type { HarnessSettings } from './harness.ts';
import { bookkeeping, guardHooks } from './hooks.ts';
import { endKind, runEvent, type Timeline } from './timeline.ts';
import { merge, rise, type Rise } from './usage.ts';
import { ESTIMATOR, parseRisk, riskQuestion, sdkModel, setModel } from './models.ts';
import { runLine, SAY, workspaceLine } from './protocol.ts';
import { Serial } from './serial.ts';
import { Conflict, NotFound, type Workspace, type Workspaces } from './workspaces.ts';

interface RunRow {
  id: string;
  automation: AutomationName;
  checkout: string;
  trigger: RunTrigger;
  target_path: string | null;
  targets: string[];
  status: RunStatus;
  title: string;
  prompt: string;
  base_commit: string | null;
  session_id: string | null;
  /** A message to a chat whose run has ended: queued again, the run resumes its session with it */
  resume_prompt: string | null;
  error: string | null;
  created_at: Date;
  started_at: Date | null;
  ended_at: Date | null;
  usage_five_hour: number | null;
  usage_week: number | null;
  /** Chosen when the run first starts and kept when its session resumes */
  model: ModelChoice | null;
  risk: Risk | null;
  /** How often a restart has requeued the run */
  restarts: number;
  /** An interview as its last turn reported it */
  interview: InterviewState | null;
}

export interface NewRun {
  workspace: string;
  automation: AutomationName;
  trigger: RunTrigger;
  prompt: string;
  title?: string;
  targetPath?: string | null;
  /** Entities the run works on besides its target: marked updating until it lands */
  targets?: string[];
  /** What the chat shows as the user's message, when it differs from the prompt */
  message?: string;
  /** Parts of cards the user added to the chat's first message; the prompt carries them as references */
  context?: ContextItem[];
}

/**
 * The parts of cards the user added to a message, as references ahead of it, the way the stock-fly-8 knowledge base
 * handed them to its agent: the entity file and the headings, then the quoted text or the picked diagram element; a whole
 * card is the entity file alone
 */
export function withContext(context: ContextItem[], text: string): string {
  if (context.length === 0) return text;
  const refs = context.map((c) => {
    const path = [fileOf(c.path), ...c.heading].join(' > ');
    const body =
      c.element !== undefined ? `${path} > < ${c.element} >` : c.quote !== undefined ? `${path} >\n\n... ${c.quote} ...` : path;
    return `\`\`\`\n${body}\n\`\`\`\n\n`;
  });
  return `${refs.join('')}${text}`;
}

export interface QueuedRun {
  workspace: string;
  id: string;
  automation: AutomationName;
  trigger: RunTrigger;
}

interface Active {
  ref: RunRef;
  ws: Workspace;
  trigger: RunTrigger;
  handle: SessionHandle;
  /** Whether a reading of the limits arrived while the run was running, so the next rise can be partly its own */
  seen: boolean;
  /** What the run used in earlier sessions, and its share of the rises in this one */
  base: Rise;
  usage: Rise;
  graphBuild?: { complete: boolean; progress: string; coverage: number; documents?: string[] };
  interview?: InterviewState | null;
  /** The artifacts, as they stood, that summarization was last asked for */
  summarized?: string;
  /** Settles once the run's changes have landed on the main line and its status is recorded */
  finished?: Promise<void>;
  stoppedByUser?: boolean;
  /** Sent on by the Stop hook to summarize or describe its changes: its text then is bookkeeping, kept out of the conversation */
  bookkeeping?: boolean;
}

/** Graph build runs failing in a row before the build stops instead of queueing the next */
const MAX_BUILD_FAILURES = 3;
/** How often a run lost at restart is queued again before it fails */
const MAX_RESTARTS = 2;
const RESUME = `${SAY.resume}. Continue where you left off.`;

/** Runs the user talks to turn by turn: each turn ends the run, the next message resumes its session */
const conversational = (automation: AutomationName) => automation === 'chat' || automation === 'interview';

/** Runs the user starts: a chat, a send back, an automation started on demand */
export const userStarted = (trigger: RunTrigger) => trigger === 'on_demand';

const iso = (d: Date | null) => (d ? d.toISOString() : null);
export class Runner {
  private active = new Map<string, Active>();
  /**
   * Starting, steering and killing one run go one after another: a message waits for the launch before it, a kill for
   * the message, and two messages to an ended chat resume it once
   */
  private lifecycle = new Serial();
  /** Messages of one run are written one after another */
  private messageWrites = new Serial();
  /** The latest account-wide reading of the limits, from whichever run reported it */
  private reading: Usage = { fiveHour: null, week: null };

  constructor(
    private readonly workspaces: Workspaces,
    private readonly settings: HarnessSettings,
    private readonly guard: Guard,
    private readonly automations: Automations,
    private readonly bus: Bus,
    private readonly embed: Embed,
    private readonly timeline: Timeline,
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
    const messages = await ws.index.sql<{ seq: number; role: RunMessage['role']; text: string; context: ContextItem[]; at: Date }[]>`
      select seq, role, text, context, at from ${this.t(ws, 'run_message')} where run_id = ${id} order by seq`;
    return { ...this.view(ws, r), messages: messages.map((m) => ({ ...m, at: m.at.toISOString() })), interview: r.interview ?? null };
  }

  private async setStatus(ws: Workspace, id: string, status: RunStatus, extra: Partial<RunRow> = {}) {
    const values = { status, ...extra };
    await ws.index.sql`update ${this.t(ws, 'run')} set ${ws.index.sql(values as never)} where id = ${id}`;
  }

  /**
   * Moves a run to `to` only from one of the states in `from`, in one statement: the row as it now stands, or null when
   * the run had moved on (killed while queued, started by another caller)
   */
  private async transition(ws: Workspace, id: string, from: RunStatus[], to: RunStatus, extra: Partial<RunRow> = {}): Promise<RunRow | null> {
    const values = { status: to, ...extra };
    const [r] = await ws.index.sql<RunRow[]>`update ${this.t(ws, 'run')} set ${ws.index.sql(values as never)}
      where id = ${id} and status = any(${from}::text[]) returning *`;
    return r ?? null;
  }

  /**
   * Messages of one run are written one after another: each takes the next sequence number, so two arriving together
   * (the assistant's text and the user's message) must not both read the same last one
   */
  private addMessage(ws: Workspace, id: string, role: RunMessage['role'], text: string, context: ContextItem[] = []): Promise<void> {
    return this.messageWrites.run(id, async () => {
      await ws.index.sql`insert into ${this.t(ws, 'run_message')} (run_id, seq, role, text, context)
        values (${id}, (select coalesce(max(seq), 0) + 1 from ${this.t(ws, 'run_message')} where run_id = ${id}), ${role}, ${text},
          ${ws.index.sql.json(context as never)})`;
    });
  }

  private ref(ws: Workspace, r: RunRow): RunRef {
    return { id: r.id, workspace: ws.name, automation: r.automation, checkout: r.checkout, targetPath: r.target_path, targets: r.targets ?? [] };
  }

  /** A queued run: its own checkout of the main line is created when it starts */
  async create(spec: NewRun): Promise<string> {
    const ws = await this.workspaces.get(spec.workspace);
    const id = randomBytes(4).toString('hex');
    const checkout = join(config.runs, ws.name, id);
    await this.workspaces.sql`insert into harness.run_ref ${this.workspaces.sql({ id, workspace: ws.name })}`;
    await ws.index.sql`insert into ${this.t(ws, 'run')} ${ws.index.sql({
      id,
      automation: spec.automation,
      checkout,
      trigger: spec.trigger,
      target_path: spec.targetPath ?? null,
      targets: spec.targets ?? [],
      status: 'queued',
      title: spec.title ?? '',
      prompt: withContext(spec.context ?? [], spec.prompt),
    })}`;
    if (spec.automation === 'chat') {
      await ws.index.sql`insert into ${this.t(ws, 'chat')} ${ws.index.sql({ run_id: id, entity_path: null })}`;
      await this.addMessage(ws, id, 'user', spec.message ?? spec.prompt, spec.context ?? []);
    }
    if (spec.automation === 'interview') await this.addMessage(ws, id, 'user', spec.message ?? spec.prompt);
    for (const path of new Set([spec.targetPath, ...(spec.targets ?? [])])) if (path) await this.guard.markUpdating(ws, path);
    // A chat's or an interview's turns are the user's messages; their runs are recorded when they land, fail or stop
    if (!conversational(spec.automation)) {
      await this.timeline.run(
        runEvent(ws.name, { id, automation: spec.automation, title: spec.title, targetPath: spec.targetPath }, 'run_queued', { facts: { trigger: spec.trigger } }),
      );
    }
    return id;
  }

  /** Queued runs of the enabled workspaces, oldest first */
  async queued(): Promise<QueuedRun[]> {
    const out: QueuedRun[] = [];
    for (const ws of await this.workspaces.enabled()) {
      const rows = await ws.index.sql<{ id: string; automation: AutomationName; trigger: RunTrigger }[]>`
        select id, automation, trigger from ${this.t(ws, 'run')} where status = 'queued' order by created_at`;
      out.push(...rows.map((r) => ({ workspace: ws.name, ...r })));
    }
    return out;
  }

  activeCount(workspace?: string): number {
    return [...this.active.values()].filter((a) => !workspace || a.ref.workspace === workspace).length;
  }

  /** Automation runs active in a workspace: they run one at a time, so their changes never conflict */
  activeAutomationCount(workspace: string): number {
    return [...this.active.values()].filter((a) => a.ref.workspace === workspace && !userStarted(a.trigger)).length;
  }

  isActive(id: string): boolean {
    return this.active.has(id);
  }

  async hasOpenRun(workspace: string, automation: AutomationName): Promise<boolean> {
    const ws = await this.workspaces.get(workspace);
    const [r] = await ws.index.sql`select 1 from ${this.t(ws, 'run')}
      where automation = ${automation} and status in ('queued', 'running')`;
    return !!r;
  }

  /** A chat on an entity that is still queued or running, with the last thing the user said in it */
  async openChatOn(workspace: string, path: string): Promise<{ id: string; lastUserMessage: string | null } | null> {
    const ws = await this.workspaces.get(workspace);
    const [r] = await ws.index.sql<{ id: string; last: string | null }[]>`select r.id,
        (select text from ${this.t(ws, 'run_message')} m where m.run_id = r.id and m.role = 'user' order by seq desc limit 1) as last
      from ${this.t(ws, 'run')} r
      where r.automation = 'chat' and r.target_path = ${path} and r.status in ('queued', 'running')
      order by r.created_at desc limit 1`;
    return r ? { id: r.id, lastUserMessage: r.last } : null;
  }

  /** Ends every open run of an automation in a workspace: running ones are killed, queued ones never start */
  async stopAutomation(workspace: string, automation: AutomationName): Promise<string[]> {
    const ws = await this.workspaces.get(workspace);
    const rows = await ws.index.sql<{ id: string }[]>`select id from ${this.t(ws, 'run')}
      where automation = ${automation} and status in ('queued', 'running')`;
    for (const r of rows) await this.kill(r.id);
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
   * Runs a restart left `running`: their processes are gone. Each is queued again and resumes its session on the same
   * checkout, up to MAX_RESTARTS times. A run past that, a chat or an interview, is failed: what it wrote still lands on
   * the main line and reaches the feed, and a chat or an interview resumes its session on the next message.
   */
  async recover(): Promise<void> {
    const refs = await this.workspaces.sql<{ workspace: string }[]>`select distinct workspace from harness.run_ref`;
    for (const { workspace } of refs) {
      const ws = await this.workspaces.get(workspace).catch(() => null);
      if (!ws) continue;
      const rows = await ws.index.sql<RunRow[]>`select * from ${this.t(ws, 'run')} where status = 'running'`;
      for (const r of rows) {
        if (this.active.has(r.id)) continue;
        if (!conversational(r.automation) && r.restarts < MAX_RESTARTS && existsSync(r.checkout)) {
          await this.setStatus(ws, r.id, 'queued', { restarts: r.restarts + 1 });
          await this.timeline.run(runEvent(ws.name, r, 'run_requeued'));
          console.log(`run ${r.id} (${r.automation}, ${ws.name}) was lost at restart and is queued again`);
          continue;
        }
        if (existsSync(r.checkout)) {
          await this.guard.transaction(this.ref(ws, r)).catch((e) => console.error(`recover ${r.id}:`, e));
          await removeWorktree(ws.path, r.checkout).catch(() => {});
        }
        await this.setStatus(ws, r.id, 'failed', { ended_at: new Date(), error: 'lost at restart' });
        await this.timeline.run(runEvent(ws.name, r, 'run_failed', { detail: 'Lost at restart', facts: { status: 'failed' } }));
        console.log(`run ${r.id} (${r.automation}, ${ws.name}) was lost at restart`);
      }
      await this.releaseUpdating(ws);
    }
  }

  /**
   * An entity stays updating while a run works on it; with no open run on it, it stands where it stood before. A run
   * that ended before the harness recorded every target of a run left some updating for good.
   */
  private async releaseUpdating(ws: Workspace): Promise<void> {
    const open = await ws.index.sql<{ target_path: string | null; targets: string[] }[]>`
      select target_path, targets from ${this.t(ws, 'run')} where status in ('queued', 'running')`;
    const worked = new Set(open.flatMap((o) => [o.target_path, ...(o.targets ?? [])]));
    const updating = await ws.index.sql<{ path: string; frontmatter: EntityFrontmatter }[]>`
      select path, frontmatter from ${this.t(ws, 'entity')} where sync = 'updating'`;
    for (const e of updating) {
      if (worked.has(e.path)) continue;
      const sync = (await ws.index.syncBefore(e.path)) ?? (await this.guard.syncOf(ws, e.path, e.frontmatter));
      await ws.index.setSync(e.path, sync);
      console.log(`${ws.name}: ${e.path} was left updating by no open run; it stands ${sync} again`);
    }
  }

  /** Starts a queued run: its own checkout of the main line as it stands, one Claude Code process */
  start(id: string): Promise<void> {
    return this.lifecycle.run(id, () => this.launchRun(id));
  }

  private async launchRun(id: string): Promise<void> {
    const ws = await this.workspaceOf(id);
    // Taken off the queue in one step: a run killed or started since the orchestrator listed it stays as it is
    const r = await this.transition(ws, id, ['queued'], 'running', { started_at: new Date(), error: null });
    if (!r) return;
    const ref = this.ref(ws, r);
    try {
      await ensureCheckout(ws.path, r.checkout, ws.main);
      const prompt = r.resume_prompt ?? (r.session_id ? RESUME : r.prompt);
      await this.setStatus(ws, id, 'running', { base_commit: r.base_commit ?? (await head(r.checkout)), resume_prompt: null });
      this.guard.watch(ref);
      // A run queued again after a restart, or a chat the user wrote to, resumes its session
      await this.launch(ws, r, ref, prompt, r.session_id);
    } catch (e) {
      await this.launchFailed(ws, r, e as Error);
    }
  }

  /** A run whose process could not be launched has failed: it ends at once, saying why */
  private async launchFailed(ws: Workspace, r: RunRow, e: Error): Promise<void> {
    // The build stops, if it must, before the run ends: once it has, a tick would queue the next build run
    if (r.automation === 'graph-build') await this.afterFailedBuild(ws, { id: r.id, error: e.message });
    await this.setStatus(ws, r.id, 'failed', { error: e.message, ended_at: new Date() });
    await this.timeline.run(runEvent(ws.name, r, 'run_failed', { detail: e.message, facts: { status: 'failed' } }));
    await this.guard.unwatch(r.id);
    this.bus.emit('run_ended', { workspace: ws.name, runId: r.id });
  }

  private async launch(ws: Workspace, r: RunRow, ref: RunRef, prompt: string, resume: string | null): Promise<void> {
    const definition = await this.automations.definition(ws, r.automation);
    const { cards, lifetimes, models } = await this.settings.values();
    const { model, risk } = r.model ? { model: r.model, risk: r.risk } : await this.chooseModel(ws, r, models);
    // A chat's or an interview's turns are the user's messages; their runs are recorded when they fail
    if (!conversational(r.automation)) {
      await this.timeline.run(
        runEvent(ws.name, r, resume ? 'run_resumed' : 'run_started', { facts: { model, trigger: r.trigger, ...(risk ? { risk } : {}) } }),
      );
    }
    const entry: Active = {
      ref,
      ws,
      trigger: r.trigger,
      handle: null as unknown as SessionHandle,
      seen: false,
      base: { fiveHour: r.usage_five_hour ?? 0, week: r.usage_week ?? 0 },
      usage: { fiveHour: 0, week: 0 },
      interview: r.interview,
    };
    const kb = createKbServer({
      index: ws.index,
      embed: this.embed,
      checkout: r.checkout,
      runId: r.id,
      validation: async () => ({ characterLimit: cards.characterLimit, types: this.workspaces.types }),
      types: () => [...this.workspaces.types.values()],
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
          'report_graph_build',
          'Report the progress of building the knowledge graph of this repository: what is covered, what the next run should take up, and the share of the repository covered so far (0–1), which estimates the full build. Set complete once the repository is covered; the graph build then stops. List in documents the repository files to summarize; they are handed to the summarization sub-agent when you stop.',
          {
            complete: z.boolean(),
            progress: z.string(),
            coverage: z.number().min(0).max(1),
            documents: z.array(z.string()).optional(),
          },
          async (v) => {
            entry.graphBuild = v;
            return { content: [{ type: 'text', text: 'Recorded' }] };
          },
        ),
        ...(r.automation === 'interview'
          ? [
              tool(
                'report_interview',
                'Report this turn of the interview: the question you ask next (or, when done, your one-line closing remark), whether the interview is done, and the path of the document it writes, relative to the checkout. Call it once every turn, before you stop.',
                { question: z.string(), done: z.boolean(), document: z.string() },
                async (v) => {
                  const document = v.document.replaceAll('\\', '/').replace(/^\.\//, '');
                  if (posix.isAbsolute(document) || document.startsWith('../') || document.startsWith('knowledge-graph/')) {
                    return { content: [{ type: 'text', text: 'The document is a repository file outside knowledge-graph/, relative to the checkout' }], isError: true };
                  }
                  entry.interview = { ...v, document };
                  await ws.index.sql`update ${this.t(ws, 'run')} set interview = ${ws.index.sql.json(entry.interview as never)} where id = ${r.id}`;
                  return { content: [{ type: 'text', text: 'Recorded' }] };
                },
              ),
            ]
          : []),
      ],
    });
    const instructions = [
      definition.instructions,
      this.context(ws, r, cards.characterLimit, cards.presentationRules, lifetimes),
      ...(HARNESS_ONLY.includes(r.automation) ? [await this.projectsContext(ws)] : []),
    ].join('\n\n');
    entry.handle = startSession({
      cwd: r.checkout,
      prompt: resume ? prompt : this.firstPrompt(r, prompt),
      instructions,
      agents: await this.automations.subAgents(ws, (step) => (models.mode === 'single' ? undefined : sdkModel(models.perAutomation[step]))),
      mcpServers: { 'momentum-kb': kb, 'momentum-run': harnessTools },
      // An interview's answers land with what they changed; its commit message, like its summary, waits until it is done
      hooks: guardHooks(this.guard, ref, () => this.summaryRequest(ws, r, entry), () => r.automation !== 'interview' || entry.interview?.done === true),
      resume: resume ?? undefined,
      model: sdkModel(model),
      limits: config.limits,
      procgov: config.procgov,
      onSessionId: (sid) => void this.setStatus(ws, r.id, 'running', { session_id: sid }).catch((e) => console.error(`session of run ${r.id}:`, e)),
      onHookFeedback: (feedback) => (entry.bookkeeping = bookkeeping(feedback)),
      onAssistantText: (text) => {
        if (entry.bookkeeping) return;
        void this.addMessage(ws, r.id, 'assistant', text).catch((e) => console.error(`message of run ${r.id}:`, e));
      },
      onUsage: (u) => void this.onReading(u).catch((e) => console.error(`usage reading of run ${r.id}:`, e)),
    });
    this.active.set(r.id, entry);
    entry.finished = entry.handle.done.then((result) => this.finish(ws, r.id, entry, result));
  }

  /** The model a run starts on; in risk mode an implementation gets the one set for its estimated risk */
  private async chooseModel(ws: Workspace, r: RunRow, models: ModelSettings): Promise<{ model: ModelChoice; risk: Risk | null }> {
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
    return { model, risk };
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

  /** An automation of the harness alone works over every enabled project: where their repositories are */
  private async projectsContext(ws: Workspace): Promise<string> {
    const projects = (await this.workspaces.enabled()).filter((p) => p.name !== ws.name);
    const list = projects.map((p) => `- ${p.name}: ${p.path} (main line ${p.main})`).join('\n');
    return `## Projects\nThe enabled projects, read where they stand; never write in them:\n${list || '- none enabled'}`;
  }

  /** Harness facts every run needs: where it works and the rules of the knowledge base */
  private context(ws: Workspace, r: RunRow, limit: number, rules: string, lifetimes: { type: string; rule: string }[]): string {
    return `# Momentum run

${workspaceLine(ws, r.checkout)}
${runLine({ id: r.id, automation: r.automation, trigger: r.trigger, targetPath: r.target_path })}
- Work only in this checkout. It is a detached checkout of the main line as it stood when you started; the harness commits your changes and lands them on the main line when the run ends, the consistency guard validates them and the user verifies them through the attention feed. Never commit, never push, never create or switch branches, never touch the workspace directory.

## Knowledge base
- Entities live at knowledge-graph/<Domain>/<Type>/[<parent-name>/]<name>.md; the type path is Domain/Entity Type from the harness's entity types, ${config.entityTypes} (read it there or list them with the momentum-kb types tool: it is not in this checkout). Read and write them with the momentum-kb tools (search, read, references, write) or directly as files.
- Frontmatter: type, origin (user | requested | automation), verification (always unverified when you write), sync, product_impact, timeline_impact, unlocks (integers 0–5: impact on the product, impact on the timeline, how much the work unlocks — they rank the feed), references (to: entity path, relation: snake_case verb such as depends_on, implements, concerns, retires), artifacts (repository paths the entity summarizes).
- The body starts with "# <title>" and then the card: free-form markdown within ${limit} characters, in whatever form presents the entity best (paragraph, bullets, table, PlantUML diagram in a \`\`\`plantuml code block; mermaid is not accepted). The entity is its card. An entity that does not fit is split into entities that reference each other.
- Card presentation rules from the user: ${rules.trim() || 'none beyond the character limit'}
- Artifacts are repository files outside knowledge-graph/. Never write summaries of them yourself: when you stop, a harness hook lists the artifacts this run added, changed or deleted, for the momentum-summarization sub-agent.
- Lifetimes per entity type: ${lifetimes.map((l) => `${l.type}: ${l.rule}`).join('; ') || 'none set'}
- Every reference must resolve to an existing entity in this checkout.`;
  }

  private firstPrompt(r: RunRow, prompt: string): string {
    return r.automation === 'chat' ? prompt : `${prompt}\n\nToday is ${new Date().toISOString().slice(0, 10)}.`;
  }

  /**
   * A message from the chat tool: steers the running process, or resumes the session of a run that has ended on a fresh
   * checkout of the main line. A chat is started by the user, so it runs alongside whatever automation is running.
   */
  send(id: string, text: string, context: ContextItem[] = []): Promise<void> {
    return this.lifecycle.run(id, () => this.sendNow(id, text, context));
  }

  private async sendNow(id: string, text: string, context: ContextItem[]): Promise<void> {
    const ws = await this.workspaceOf(id);
    await this.addMessage(ws, id, 'user', text, context);
    const prompt = withContext(context, text);
    const entry = this.active.get(id);
    if (entry?.handle.send(prompt)) {
      // What it answers to the user's message is for the user again
      entry.bookkeeping = false;
      return;
    }
    await entry?.finished;
    const r = await this.row(ws, id);
    // A run still waiting to start takes the message with its first prompt, when the orchestrator starts it
    if (r.status === 'queued') {
      if (r.session_id) {
        await ws.index.sql`update ${this.t(ws, 'run')} set resume_prompt = ${`${r.resume_prompt ?? RESUME}\n\n${prompt}`} where id = ${id}`;
      } else {
        await ws.index.sql`update ${this.t(ws, 'run')} set prompt = ${`${r.prompt}\n\n${prompt}`} where id = ${id}`;
      }
      return;
    }
    // Resumed on a fresh checkout of the main line, whichever way it ended
    const resumed = await this.transition(ws, id, ['finished', 'failed', 'killed'], 'running', { ended_at: null, error: null });
    if (!resumed) throw new Conflict(`Run ${id} is ${r.status} and cannot take a message now`);
    try {
      await ensureCheckout(ws.path, resumed.checkout, ws.main);
      await this.setStatus(ws, id, 'running', { base_commit: await head(resumed.checkout) });
      this.guard.watch(this.ref(ws, resumed));
      await this.launch(ws, resumed, this.ref(ws, resumed), prompt, resumed.session_id);
    } catch (e) {
      await this.launchFailed(ws, resumed, e as Error);
      throw e;
    }
  }

  /** Ends a run; one the user stops says so on its event */
  kill(id: string, byUser = false): Promise<void> {
    return this.lifecycle.run(id, () => this.killNow(id, byUser));
  }

  private async killNow(id: string, byUser: boolean): Promise<void> {
    const entry = this.active.get(id);
    if (entry) {
      entry.stoppedByUser ||= byUser;
      entry.handle.kill();
      return;
    }
    // Still waiting for a place: it never starts, and whatever it was to change stands where it did
    const ws = await this.workspaceOf(id);
    const r = await this.transition(ws, id, ['queued'], 'killed', { ended_at: new Date() });
    if (!r) return;
    for (const path of new Set([r.target_path, ...(r.targets ?? [])])) {
      const row = path ? await ws.index.row(path) : null;
      if (row?.sync === 'updating') await ws.index.setSync(path!, r.automation === 'summarization' ? 'artifact_ahead' : await this.guard.syncOf(ws, path!, row.frontmatter));
    }
    await this.timeline.run(runEvent(ws.name, r, 'run_killed', { byUser, facts: { status: 'killed' } }));
    this.bus.emit('run_ended', { workspace: ws.name, runId: id });
  }

  /**
   * A reading of the account's limits reported by any run. The limits are shared, so the rise since the last reading is
   * split evenly among the runs that were running at both; each run's share is recorded and shown while it runs.
   */
  private async onReading(u: Usage): Promise<void> {
    const next = merge(this.reading, u);
    const up = rise(this.reading, next);
    this.reading = next;
    const sharing = [...this.active.values()].filter((a) => a.seen);
    for (const a of this.active.values()) a.seen = true;
    const share = { fiveHour: up.fiveHour / (sharing.length || 1), week: up.week / (sharing.length || 1) };
    const writes = up.fiveHour || up.week ? sharing : [];
    for (const a of writes) {
      a.usage.fiveHour += share.fiveHour;
      a.usage.week += share.week;
    }
    await this.workspaces.sql`insert into harness.usage_sample ${this.workspaces.sql({ five_hour: next.fiveHour, week: next.week })}`;
    await Promise.all(
      writes.map(async (a) => {
        const sql = a.ws.index.sql;
        await sql`insert into ${this.t(a.ws, 'usage_share')} ${sql({ run_id: a.ref.id, automation: a.ref.automation, five_hour: share.fiveHour, week: share.week })}`;
        await sql`update ${this.t(a.ws, 'run')} set usage_five_hour = ${a.base.fiveHour + a.usage.fiveHour},
          usage_week = ${a.base.week + a.usage.week} where id = ${a.ref.id}`;
      }),
    );
  }

  /**
   * The run ended: what it left lands on the main line, its status and usage are recorded, its checkout goes. It never
   * rejects: nothing waits on it but a message to the run, and a run whose ending failed still ends, as failed.
   */
  private async finish(ws: Workspace, id: string, entry: Active, result: SessionResult): Promise<void> {
    const log = (what: string) => (e: unknown) => console.error(`run ${id}: ${what}:`, e);
    let r: RunRow | null = null;
    try {
      r = await this.row(ws, id);
      if (r.automation === 'chat') await this.writeTranscriptFile(ws, r);
      const landed = await this.guard.transaction(entry.ref);
      if (r.automation === 'chat') await this.recordTranscript(ws, r);
      let status: RunStatus = result.error === 'killed' ? 'killed' : result.ok ? 'finished' : 'failed';
      let error = result.ok ? null : result.error;
      // A build run that never said how far it got would be followed by the same run again and again
      if (r.automation === 'graph-build' && status === 'finished' && !entry.graphBuild) {
        status = 'failed';
        error = 'The run ended without reporting its progress with report_graph_build';
      }
      if (status !== 'finished') await this.stillBehind(ws, r, landed.paths);
      // The build's state moves before the run ends: once it has, a tick would otherwise queue the next build run
      if (r.automation === 'graph-build') await this.recordGraphBuild(ws, status, entry.graphBuild);
      if (r.automation === 'graph-build' && status === 'failed') await this.afterFailedBuild(ws, { id, error });
      const endedAt = new Date();
      const usage = { fiveHour: entry.base.fiveHour + entry.usage.fiveHour, week: entry.base.week + entry.usage.week };
      await this.setStatus(ws, id, status, {
        ended_at: endedAt,
        error,
        usage_five_hour: usage.fiveHour,
        usage_week: usage.week,
      });
      if (!conversational(r.automation) || status !== 'finished') {
        await this.timeline.run(
          runEvent(ws.name, r, endKind(status), {
            byUser: entry.stoppedByUser,
            detail: error,
            facts: {
              status,
              usage,
              ...(r.model ? { model: r.model } : {}),
              ...(r.started_at ? { durationMs: endedAt.getTime() - r.started_at.getTime() } : {}),
            },
          }),
        );
      }
      const variant = (await this.automations.approved()).find((d) => d.name === entry.ref.automation)?.variant ?? null;
      await ws.index.sql`insert into ${this.t(ws, 'agent_metric')} ${ws.index.sql({
        run_id: id,
        automation: r.automation,
        variant,
        usage_five_hour: entry.usage.fiveHour,
        usage_week: entry.usage.week,
      })}`;
      if (r.automation === 'implementation' && status === 'finished') {
        this.bus.emit('implementation_finished', { workspace: ws.name, runId: id, targetPath: r.target_path });
      }
    } catch (e) {
      log('ending')(e);
      await this.setStatus(ws, id, 'failed', { ended_at: new Date(), error: (e as Error).message }).catch(log('status'));
      const run = r ?? { id, automation: entry.ref.automation, targetPath: entry.ref.targetPath };
      await this.timeline.run(runEvent(ws.name, run, 'run_failed', { detail: (e as Error).message, facts: { status: 'failed' } })).catch(log('timeline'));
    } finally {
      this.active.delete(id);
      await this.guard.unwatch(id).catch(log('watcher'));
      await removeWorktree(ws.path, entry.ref.checkout).catch(log('checkout'));
      this.bus.emit('run_ended', { workspace: ws.name, runId: id });
    }
  }

  /** Entities a summarization run failed or was stopped before rewriting are still behind their artifacts */
  private async stillBehind(ws: Workspace, r: RunRow, written: string[]): Promise<void> {
    if (r.automation !== 'summarization') return;
    for (const path of r.targets ?? []) {
      if (!written.includes(path) && (await ws.index.row(path))) await ws.index.setSync(path, 'artifact_ahead');
    }
  }

  /** The graph build goes on run after run until a run reports the repository covered, or the user stops it */
  private async recordGraphBuild(ws: Workspace, status: RunStatus, report: Active['graphBuild']): Promise<void> {
    if (report?.progress) await this.settings.setGraphBuildProgress(ws.name, report.progress);
    if (report) await this.settings.setGraphBuildCoverage(ws.name, report.complete ? 1 : report.coverage);
    if (status !== 'finished') return;
    if (report?.complete && (await this.settings.graphBuild(ws.name)).state === 'building') {
      await this.settings.setGraphBuild(ws.name, 'complete');
      await this.timeline.record({ workspace: ws.name, actor: 'harness', kind: 'graph_build_complete', title: 'Knowledge graph build complete' });
    }
  }

  /**
   * Each failed build run would be queued again at once; when the last few all failed, something is wrong that another
   * run will not fix, so the build stops and says why until the user resumes it
   */
  private async afterFailedBuild(ws: Workspace, failing: { id: string; error: string | null }): Promise<void> {
    // The run failing now counts, though its own row does not say so yet
    const before = await ws.index.sql<{ status: RunStatus; error: string | null }[]>`select status, error from ${this.t(ws, 'run')}
      where automation = 'graph-build' and status in ('finished', 'failed') and id <> ${failing.id}
      order by created_at desc limit ${MAX_BUILD_FAILURES - 1}`;
    const last = [{ status: 'failed' as RunStatus, error: failing.error }, ...before];
    if (last.length < MAX_BUILD_FAILURES || last.some((r) => r.status !== 'failed')) return;
    if ((await this.settings.graphBuild(ws.name)).state !== 'building') return;
    await this.settings.setGraphBuild(ws.name, 'stopped');
    await this.timeline.record({
      workspace: ws.name,
      actor: 'harness',
      kind: 'graph_build_stopped',
      title: `Stopped the knowledge graph build: its last ${MAX_BUILD_FAILURES} runs failed`,
      detail: last[0]?.error ?? null,
    });
  }

  /** The chat is stored as an artifact of its summary entity, once summarization has written it */
  private async recordTranscript(ws: Workspace, r: RunRow): Promise<void> {
    const [summary] = await ws.index.sql<{ entity_path: string }[]>`
      select entity_path from ${this.t(ws, 'entity_artifact')} where artifact_path = ${`chats/${r.id}.jsonl`}`;
    if (summary) await ws.index.sql`update ${this.t(ws, 'chat')} set entity_path = ${summary.entity_path} where run_id = ${r.id}`;
  }

  private async writeTranscriptFile(ws: Workspace, r: RunRow): Promise<void> {
    const messages = await ws.index.sql<{ role: string; text: string; context: ContextItem[]; at: Date }[]>`
      select role, text, context, at from ${this.t(ws, 'run_message')} where run_id = ${r.id} order by seq`;
    const file = join(r.checkout, 'chats', `${r.id}.jsonl`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, messages.map((m) => JSON.stringify(m)).join('\n') + '\n', 'utf8');
  }

  /**
   * What the Stop hook hands the summarization sub-agent: the artifacts the run added, changed or deleted and the
   * documents a graph build run listed, minus the knowledge graph and the user's exclusions; null when there are none.
   * An interview's document is summarized once, when the interview is done, never half written.
   */
  private async summaryRequest(ws: Workspace, r: RunRow, entry: Active): Promise<string | null> {
    if (r.automation === 'chat') await this.writeTranscriptFile(ws, r);
    if (r.automation === 'interview' && !entry.interview?.done) return null;
    const { summarization } = await this.settings.values();
    const excluded = (path: string) =>
      path.startsWith('knowledge-graph/') || summarization.exclude.some((pattern) => posix.matchesGlob(path, pattern));
    const base = (await this.row(ws, r.id)).base_commit;
    const artifacts = new Map<string, string>();
    for (const c of base ? await workingChanges(r.checkout, base) : []) {
      if (!excluded(c.path)) artifacts.set(c.path, c.status === 'A' ? 'added' : c.status === 'D' ? 'deleted' : 'changed');
    }
    for (const d of entry.graphBuild?.documents ?? []) if (!excluded(d) && !artifacts.has(d)) artifacts.set(d, 'to map');
    // Each answer resumed the session on a fresh checkout: the document is listed whether or not the last turn changed it
    const document = r.automation === 'interview' ? entry.interview?.document : undefined;
    if (document && !excluded(document) && !artifacts.has(document)) artifacts.set(document, 'interview');
    if (artifacts.size === 0) return null;
    // The work an implementation was asked for, its target and what a target plan plans, is never summarized as its result
    const asked = new Set<string>();
    if (r.automation === 'implementation' && r.target_path) {
      asked.add(r.target_path);
      const row = await ws.index.row(r.target_path);
      if (row?.frontmatter.type === 'Harness/Plan') for (const ref of row.frontmatter.references) if (ref.relation === 'plans') asked.add(ref.to);
    }
    this.guard.handedToSummarization(r.id, [...artifacts.keys()], [...asked]);
    // Asked once per state of the artifacts: a run that stops again after its sub-agent finished in the background
    // does not summarize the same artifacts twice
    const state = await Promise.all(
      [...artifacts.keys()].map(async (p) => [p, await readFile(join(r.checkout, p)).then((b) => createHash('sha1').update(b).digest('hex'), () => 'gone')]),
    );
    const key = JSON.stringify(state);
    if (entry.summarized === key) return null;
    entry.summarized = key;
    // The entities over each artifact already, which summarization rewrites rather than adding new ones beside them
    const lines = await Promise.all(
      [...artifacts].map(async ([path, what]) => {
        const over = (await ws.index.byArtifact(path)).filter((p) => !asked.has(p));
        return `- ${path} (${what}${over.length ? `; summarized by ${over.join(', ')}` : ''})`;
      }),
    );
    const target = !r.target_path
      ? ''
      : r.automation === 'implementation'
        ? ` The run's target entity is ${r.target_path}: what is written for these artifacts is the result of implementing it, so every entity written or rewritten for them references ${r.target_path} with \`implements\`, and ${[...asked].join(', ')} ${asked.size > 1 ? 'are' : 'is'} not rewritten. Pass this message on to the sub-agent as it stands.`
        : ` The run's target entity is ${r.target_path}.`;
    return `Before you finish, ${SAY.summarize} these artifacts into entities in this checkout, passing it the character limit and presentation rules from your instructions. Run it in the foreground and wait for it to finish before you stop.${target}\n\n${lines.join('\n')}`;
  }

  /** Whether an artifact is on the main line, for callers that must not assume a checkout */
  async onMainLine(ws: Workspace, path: string): Promise<boolean> {
    return (await show(ws.path, `refs/heads/${ws.main}`, path)) !== null;
  }
}
