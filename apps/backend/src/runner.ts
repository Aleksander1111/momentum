import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type { AutomationName, ContextItem, InterviewState, ModelChoice, ModelSettings, Risk, Run, RunDetail, RunMessage, RunStatus, RunTrigger } from '@momentum/contract';
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
import { guardHooks } from './hooks.ts';
import { endKind, runEvent, type Timeline } from './timeline.ts';
import { merge, rise, type Rise } from './usage.ts';
import { ESTIMATOR, parseRisk, riskQuestion, sdkModel, setModel } from './models.ts';
import { NotFound, type Workspace, type Workspaces } from './workspaces.ts';

interface RunRow {
  id: string;
  automation: AutomationName;
  checkout: string;
  trigger: RunTrigger;
  target_path: string | null;
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
}

/** How often a run lost at restart is queued again before it fails */
const MAX_RESTARTS = 2;
const RESUME = 'The harness restarted while you were working. Continue where you left off.';

/** Runs the user talks to turn by turn: each turn ends the run, the next message resumes its session */
const conversational = (automation: AutomationName) => automation === 'chat' || automation === 'interview';

/** Runs the user starts: a chat, a send back, an automation started on demand */
export const userStarted = (trigger: RunTrigger) => trigger === 'on_demand';

const iso = (d: Date | null) => (d ? d.toISOString() : null);
export class Runner {
  private active = new Map<string, Active>();
  /** Runs between being started and their process being launched: a message to one waits for its launch */
  private starting = new Map<string, Promise<void>>();
  /** The last message write of each run, which the next one waits for */
  private messageWrites = new Map<string, Promise<void>>();
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
   * Messages of one run are written one after another: each takes the next sequence number, so two arriving together
   * (the assistant's text and the user's message) must not both read the same last one
   */
  private addMessage(ws: Workspace, id: string, role: RunMessage['role'], text: string, context: ContextItem[] = []): Promise<void> {
    const write = (this.messageWrites.get(id) ?? Promise.resolve()).catch(() => {}).then(async () => {
      await ws.index.sql`insert into ${this.t(ws, 'run_message')} (run_id, seq, role, text, context)
        values (${id}, (select coalesce(max(seq), 0) + 1 from ${this.t(ws, 'run_message')} where run_id = ${id}), ${role}, ${text},
          ${ws.index.sql.json(context as never)})`;
    });
    this.messageWrites.set(id, write);
    void write.finally(() => {
      if (this.messageWrites.get(id) === write) this.messageWrites.delete(id);
    }).catch(() => {});
    return write;
  }

  private ref(ws: Workspace, r: RunRow): RunRef {
    return { id: r.id, workspace: ws.name, automation: r.automation, checkout: r.checkout, targetPath: r.target_path };
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
      status: 'queued',
      title: spec.title ?? '',
      prompt: withContext(spec.context ?? [], spec.prompt),
    })}`;
    if (spec.automation === 'chat') {
      await ws.index.sql`insert into ${this.t(ws, 'chat')} ${ws.index.sql({ run_id: id, entity_path: null })}`;
      await this.addMessage(ws, id, 'user', spec.message ?? spec.prompt, spec.context ?? []);
    }
    if (spec.automation === 'interview') await this.addMessage(ws, id, 'user', spec.message ?? spec.prompt);
    if (spec.targetPath) await this.guard.markUpdating(ws, spec.targetPath);
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

  /** Ends every open run of an automation in a workspace: running ones are killed, queued ones never start */
  async stopAutomation(workspace: string, automation: AutomationName): Promise<string[]> {
    const ws = await this.workspaces.get(workspace);
    const rows = await ws.index.sql<{ id: string; status: RunStatus }[]>`select id, status from ${this.t(ws, 'run')}
      where automation = ${automation} and status in ('queued', 'running')`;
    for (const r of rows) {
      if (this.active.has(r.id)) this.active.get(r.id)!.handle.kill();
      else {
        await this.setStatus(ws, r.id, 'killed', { ended_at: new Date() });
        await this.timeline.run(runEvent(ws.name, await this.row(ws, r.id), 'run_killed', { facts: { status: 'killed' } }));
      }
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
    }
  }

  /** Starts a queued run: its own checkout of the main line as it stands, one Claude Code process */
  async start(id: string): Promise<void> {
    const started = this.launchRun(id);
    this.starting.set(id, started);
    try {
      await started;
    } finally {
      this.starting.delete(id);
    }
  }

  private async launchRun(id: string): Promise<void> {
    const ws = await this.workspaceOf(id);
    const r = await this.row(ws, id);
    const ref = this.ref(ws, r);
    try {
      await ensureCheckout(ws.path, r.checkout, ws.main);
      const prompt = r.resume_prompt ?? (r.session_id ? RESUME : r.prompt);
      await this.setStatus(ws, id, 'running', {
        started_at: new Date(),
        base_commit: r.base_commit ?? (await head(r.checkout)),
        error: null,
        resume_prompt: null,
      });
      this.guard.watch(ref);
      // A run queued again after a restart, or a chat the user wrote to, resumes its session
      await this.launch(ws, r, ref, prompt, r.session_id);
    } catch (e) {
      await this.setStatus(ws, id, 'failed', { error: (e as Error).message, ended_at: new Date() });
      await this.timeline.run(runEvent(ws.name, r, 'run_failed', { detail: (e as Error).message, facts: { status: 'failed' } }));
      await this.guard.unwatch(id);
      this.bus.emit('run_ended', { workspace: ws.name, runId: id });
    }
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
      onAssistantText: (text) => void this.addMessage(ws, r.id, 'assistant', text).catch((e) => console.error(`message of run ${r.id}:`, e)),
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

- Workspace: ${ws.name} (${ws.path}); this checkout: ${r.checkout}; main line: ${ws.main}
- Run: ${r.id}, automation ${r.automation}, started by ${r.trigger}${r.target_path ? `, target entity ${r.target_path}` : ''}
- Work only in this checkout. It is a detached checkout of the main line as it stood when you started; the harness commits your changes and lands them on the main line when the run ends, the consistency guard validates them and the user verifies them through the attention feed. Never commit, never push, never create or switch branches, never touch the workspace directory.

## Knowledge base
- Entities live at knowledge-graph/<Domain>/<Type>/[<parent-name>/]<name>.md; the type path is Domain/Entity Type from the harness's entity types, ${config.entityTypes} (read it there: it is not in this checkout). Read and write them with the momentum-kb tools (search, read, references, write) or directly as files.
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
  async send(id: string, text: string, context: ContextItem[] = []): Promise<void> {
    const ws = await this.workspaceOf(id);
    await this.addMessage(ws, id, 'user', text, context);
    const prompt = withContext(context, text);
    await this.starting.get(id);
    const entry = this.active.get(id);
    if (entry?.handle.send(prompt)) return;
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
    await ensureCheckout(ws.path, r.checkout, ws.main);
    await this.setStatus(ws, id, 'running', { ended_at: null, error: null, base_commit: await head(r.checkout) });
    this.guard.watch(this.ref(ws, r));
    await this.launch(ws, r, this.ref(ws, r), prompt, r.session_id);
  }

  /** Ends a run; one the user stops says so on its event */
  async kill(id: string, byUser = false): Promise<void> {
    const entry = this.active.get(id);
    if (!entry) return;
    entry.stoppedByUser ||= byUser;
    entry.handle.kill();
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

  /** The run ended: what it left lands on the main line, its status and usage are recorded, its checkout goes */
  private async finish(ws: Workspace, id: string, entry: Active, result: SessionResult): Promise<void> {
    const r = await this.row(ws, id);
    try {
      if (r.automation === 'chat') await this.writeTranscriptFile(ws, r);
      await this.guard.transaction(entry.ref);
      if (r.automation === 'chat') await this.recordTranscript(ws, r);
      const status: RunStatus = result.error === 'killed' ? 'killed' : result.ok ? 'finished' : 'failed';
      const endedAt = new Date();
      const usage = { fiveHour: entry.base.fiveHour + entry.usage.fiveHour, week: entry.base.week + entry.usage.week };
      await this.setStatus(ws, id, status, {
        ended_at: endedAt,
        error: result.ok ? null : result.error,
        usage_five_hour: usage.fiveHour,
        usage_week: usage.week,
      });
      if (!conversational(r.automation) || status !== 'finished') {
        await this.timeline.run(
          runEvent(ws.name, r, endKind(status), {
            byUser: entry.stoppedByUser,
            detail: result.ok ? null : result.error,
            facts: {
              status,
              usage,
              ...(r.model ? { model: r.model } : {}),
              ...(r.started_at ? { durationMs: endedAt.getTime() - r.started_at.getTime() } : {}),
            },
          }),
        );
      }
      const variant = (await this.automations.approved()).find((d) => d.name === r.automation)?.variant ?? null;
      await ws.index.sql`insert into ${this.t(ws, 'agent_metric')} ${ws.index.sql({
        run_id: id,
        automation: r.automation,
        variant,
        usage_five_hour: entry.usage.fiveHour,
        usage_week: entry.usage.week,
      })}`;
      if (r.automation === 'graph-build') await this.afterGraphBuild(ws, status, entry.graphBuild);
      if (r.automation === 'implementation' && status === 'finished') {
        this.bus.emit('implementation_finished', { workspace: ws.name, runId: id, targetPath: r.target_path });
      }
    } catch (e) {
      await this.setStatus(ws, id, 'failed', { ended_at: new Date(), error: (e as Error).message });
      await this.timeline.run(runEvent(ws.name, r, 'run_failed', { detail: (e as Error).message, facts: { status: 'failed' } }));
    } finally {
      this.active.delete(id);
      await this.guard.unwatch(id);
      await removeWorktree(ws.path, r.checkout).catch((e) => console.error(`checkout of run ${id}:`, e));
      this.bus.emit('run_ended', { workspace: ws.name, runId: id });
    }
  }

  /** The graph build goes on run after run until a run reports the repository covered, or the user stops it */
  private async afterGraphBuild(ws: Workspace, status: RunStatus, report: Active['graphBuild']): Promise<void> {
    if (report?.progress) await this.settings.setGraphBuildProgress(ws.name, report.progress);
    if (report) await this.settings.setGraphBuildCoverage(ws.name, report.complete ? 1 : report.coverage);
    if (status !== 'finished') return;
    if (report?.complete && (await this.settings.graphBuild(ws.name)).state === 'building') {
      await this.settings.setGraphBuild(ws.name, 'complete');
      await this.timeline.record({ workspace: ws.name, actor: 'harness', kind: 'graph_build_complete', title: 'Knowledge graph build complete' });
    }
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
    // Asked once per state of the artifacts: a run that stops again after its sub-agent finished in the background
    // does not summarize the same artifacts twice
    const state = await Promise.all(
      [...artifacts.keys()].map(async (p) => [p, await readFile(join(r.checkout, p)).then((b) => createHash('sha1').update(b).digest('hex'), () => 'gone')]),
    );
    const key = JSON.stringify(state);
    if (entry.summarized === key) return null;
    entry.summarized = key;
    const list = [...artifacts].map(([path, what]) => `- ${path} (${what})`).join('\n');
    const target = r.target_path ? ` The run's target entity is ${r.target_path}.` : '';
    return `Before you finish, have the momentum-summarization sub-agent summarize these artifacts into entities in this checkout, passing it the character limit and presentation rules from your instructions.${target}\n\n${list}`;
  }

  /** Whether an artifact is on the main line, for callers that must not assume a checkout */
  async onMainLine(ws: Workspace, path: string): Promise<boolean> {
    return (await show(ws.path, `refs/heads/${ws.main}`, path)) !== null;
  }
}
